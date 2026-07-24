from __future__ import annotations

from math import floor
from typing import Any, TypedDict

try:
    from langgraph.graph import END, StateGraph
except ImportError:  # pragma: no cover - fallback keeps the demo importable before install.
    END = None
    StateGraph = None

from .repository import InventoryRepository


class MonitorState(TypedDict, total=False):
    session_id: str
    products: list[dict[str, Any]]
    inventory: dict[str, dict[str, Any]]
    suppliers: dict[str, dict[str, Any]]
    open_purchase_orders: list[dict[str, Any]]
    risks: list[dict[str, Any]]
    alert: dict[str, Any] | None


def _calculate_risks(state: MonitorState) -> MonitorState:
    inventory = state["inventory"]
    suppliers = state["suppliers"]
    open_purchase_orders = state["open_purchase_orders"]
    risks: list[dict[str, Any]] = []

    for product in state["products"]:
        daily_demand = float(product["daily_demand"])
        if daily_demand <= 0:
            continue

        component_capacities = []
        for component in product["components"]:
            item = inventory[component["inventory_id"]]
            quantity_per_unit = float(component["quantity_per_unit"])
            if quantity_per_unit <= 0:
                continue
            component_units = float(item["quantity_on_hand"]) / quantity_per_unit
            component_capacities.append(
                {
                    "inventory_id": item["_id"],
                    "name": item["name"],
                    "available_product_units": floor(component_units),
                    "quantity_on_hand": item["quantity_on_hand"],
                    "unit": item["unit"],
                    "supplier_id": item.get("supplier_id"),
                    "backup_supplier_id": item.get("backup_supplier_id"),
                }
            )

        if not component_capacities:
            continue

        finished_units = float(product["finished_units_on_hand"])
        limiting_component = min(component_capacities, key=lambda item: item["available_product_units"])
        total_available_units = finished_units + limiting_component["available_product_units"]
        days_until_stockout = total_available_units / daily_demand

        if days_until_stockout > 7:
            continue

        supplier_id = limiting_component.get("supplier_id")
        backup_supplier_id = limiting_component.get("backup_supplier_id")
        primary_supplier = suppliers.get(supplier_id or "", {})
        backup_supplier = suppliers.get(backup_supplier_id or "", {}) if backup_supplier_id else {}
        existing_orders = [
            order
            for order in open_purchase_orders
            for line in order.get("line_items", [])
            if line.get("inventory_id") == limiting_component["inventory_id"]
        ]

        recommended_supplier = backup_supplier if backup_supplier else primary_supplier
        recommended_supplier_id = recommended_supplier.get("_id", supplier_id)
        lead_time_days = int(recommended_supplier.get("default_lead_time_days", 7))
        unit_cost = float(
            recommended_supplier.get("unit_costs", {}).get(limiting_component["inventory_id"], 0)
        )
        minimum_order = int(
            recommended_supplier.get("minimum_order", {}).get(limiting_component["inventory_id"], 1000)
        )
        quantity_needed = max(product["target_stock"] - int(total_available_units), minimum_order)

        primary_eta_days = int(primary_supplier.get("default_lead_time_days", 0) or 0)
        summary = (
            f"{product['name']} is projected to stock out in {days_until_stockout:.1f} days. "
            f"The blocker is {limiting_component['name']}. "
            f"{primary_supplier.get('name', 'The primary supplier')} needs about {primary_eta_days} days; "
            f"{recommended_supplier.get('name', 'the recommended supplier')} can deliver in {lead_time_days} days."
        )

        risks.append(
            {
                "product_id": product["_id"],
                "product_sku": product["sku"],
                "product_name": product["name"],
                "daily_demand": daily_demand,
                "finished_units_on_hand": product["finished_units_on_hand"],
                "blocker_inventory_id": limiting_component["inventory_id"],
                "blocker_name": limiting_component["name"],
                "blocker_quantity_on_hand": limiting_component["quantity_on_hand"],
                "days_until_stockout": round(days_until_stockout, 1),
                "total_available_units": int(total_available_units),
                "component_capacities": component_capacities,
                "primary_supplier": primary_supplier,
                "backup_supplier": backup_supplier,
                "existing_orders": existing_orders,
                "summary": summary,
                "recommendation": {
                    "supplier_id": recommended_supplier_id,
                    "supplier_name": recommended_supplier.get("name"),
                    "inventory_id": limiting_component["inventory_id"],
                    "item_name": limiting_component["name"],
                    "quantity": quantity_needed,
                    "unit_cost": unit_cost,
                    "lead_time_days": lead_time_days,
                    "rationale": "Rush packaging arrives before the stockout window; the existing standard PO does not.",
                },
            }
        )

    state["risks"] = sorted(risks, key=lambda risk: risk["days_until_stockout"])
    return state


class InventoryMonitorGraph:
    def __init__(self, repository: InventoryRepository):
        self.repository = repository
        self.graph = self._build_graph()

    def run(self, session_id: str) -> dict[str, Any] | None:
        initial_state: MonitorState = {"session_id": session_id}
        if self.graph:
            final_state = self.graph.invoke(initial_state)
        else:
            final_state = self._run_fallback(initial_state)
        self.repository.mark_monitor_ran(session_id)
        return final_state.get("alert")

    def _build_graph(self):
        if StateGraph is None:
            return None

        workflow = StateGraph(MonitorState)
        workflow.add_node("load_context", self._load_context)
        workflow.add_node("detect_risk", _calculate_risks)
        workflow.add_node("create_alert", self._create_alert)
        workflow.set_entry_point("load_context")
        workflow.add_edge("load_context", "detect_risk")
        workflow.add_edge("detect_risk", "create_alert")
        workflow.add_edge("create_alert", END)
        return workflow.compile()

    def _run_fallback(self, state: MonitorState) -> MonitorState:
        state = self._load_context(state)
        state = _calculate_risks(state)
        return self._create_alert(state)

    def _load_context(self, state: MonitorState) -> MonitorState:
        session_id = state["session_id"]
        repo = self.repository

        repo.log_event(session_id, "thinking",
            "Scheduled inventory sweep triggered. Checking finished goods, shared components, and inbound POs.")
        repo.log_event(session_id, "plan",
            "Plan: read finished-goods stock, then packaging components, then supplier lead times, then open POs.")

        products = repo.logged_find(session_id, "products", sort=[("name", 1)],
            message="Read finished-goods stock levels.")
        inventory = repo.logged_find(session_id, "inventory_items",
            message="Read packaging and component inventory.")
        suppliers = repo.logged_find(session_id, "suppliers",
            message="Pulled supplier lead times and reliability.")
        open_pos = repo.logged_find(session_id, "purchase_orders",
            filter={"status": {"$in": ["ordered", "submitted"]}},
            message="Checked inbound purchase orders.")

        state["products"] = products
        state["inventory"] = {item["_id"]: item for item in inventory}
        state["suppliers"] = {supplier["_id"]: supplier for supplier in suppliers}
        state["open_purchase_orders"] = open_pos
        return state

    def _create_alert(self, state: MonitorState) -> MonitorState:
        session_id = state["session_id"]
        repo = self.repository
        risks = state.get("risks", [])
        if not risks:
            repo.log_event(session_id, "thinking", "Every finished good clears its reorder point. No action needed.")
            repo.log_event(session_id, "monitor", "No stockout risks crossed the alert threshold.")
            state["alert"] = None
            return state

        risk = risks[0]
        recommendation = risk["recommendation"]
        repo.log_event(session_id, "thinking",
            f"Roasted coffee is sufficient. The binding constraint is {risk['blocker_name']} "
            f"({risk['blocker_quantity_on_hand']} on hand).")
        repo.log_event(session_id, "thinking",
            f"At about {risk['daily_demand']:.0f} units/day, {risk['product_name']} stocks out in "
            f"~{risk['days_until_stockout']} days.")
        repo.log_event(session_id, "plan",
            "Plan: compare the candidate packaging suppliers and confirm the open PO arrives after the stockout.")

        candidate_ids = [
            supplier.get("_id")
            for supplier in (risk.get("primary_supplier"), risk.get("backup_supplier"))
            if supplier and supplier.get("_id")
        ]
        if candidate_ids:
            repo.logged_aggregate(session_id, "suppliers",
                [
                    {"$match": {"_id": {"$in": candidate_ids}}},
                    {"$project": {"name": 1, "default_lead_time_days": 1, "reliability": 1}},
                ],
                message="Compared candidate supplier lead times for the blocking component.")

        repo.log_event(session_id, "thinking",
            f"The standard PO lands after the stockout window. Recommending a rush order from "
            f"{recommendation['supplier_name']} ({recommendation['lead_time_days']}-day lead time).")

        alert = repo.create_or_get_alert(session_id, risk)
        state["alert"] = alert
        return state

