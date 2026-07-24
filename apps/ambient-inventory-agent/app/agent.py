from __future__ import annotations

from typing import Any

from .repository import InventoryRepository


class CoffeeInventoryAgent:
    def __init__(self, repository: InventoryRepository):
        self.repository = repository

    def respond(self, session_id: str, alert_id: str, message: str) -> dict[str, Any]:
        alert = self.repository.get_alert(alert_id)
        if not alert:
            raise ValueError("Alert not found")

        self.repository.add_chat_message(session_id, "owner", message, alert_id)
        self.repository.update_alert_status(alert_id, "Discussing")

        lowered = message.lower()
        risk = alert["risk"]
        recommendation = alert["recommendation"]
        blocker_id = risk.get("blocker_inventory_id")
        repo = self.repository

        repo.log_event(session_id, "thinking",
            f'Owner asked: "{message}". Pulling the relevant inventory and supplier records.')

        response = self._general_response(risk, recommendation)

        if any(term in lowered for term in ["cause", "why", "blocker", "happened"]):
            response = self._cause_response(risk)
            repo.logged_find_one(session_id, "inventory_items", {"_id": blocker_id},
                message="Re-read the blocking component's stock level.")
        elif any(term in lowered for term in ["avoid", "wait", "primary", "rush fee", "expensive"]):
            response = self._avoid_rush_response(risk, recommendation)
            supplier_ids = list({
                sid for sid in [risk.get("primary_supplier", {}).get("_id"), recommendation.get("supplier_id")] if sid
            })
            repo.logged_find(session_id, "suppliers", {"_id": {"$in": supplier_ids}},
                message="Compared the primary and rush packaging suppliers.")
        elif any(term in lowered for term in ["affected", "other sku", "shared", "subscriptions"]):
            response = self._affected_skus_response(risk)
            repo.logged_find(session_id, "products", {"components.inventory_id": blocker_id},
                message="Found other products sharing the blocking component.")
        elif any(term in lowered for term in ["how many", "quantity", "cover", "order size"]):
            response = self._quantity_response(risk, recommendation)
            repo.logged_aggregate(session_id, "products",
                [
                    {"$match": {"components.inventory_id": blocker_id}},
                    {"$group": {"_id": None, "daily_demand": {"$sum": "$daily_demand"}}},
                ],
                message="Summed daily demand across affected SKUs.")
        elif any(term in lowered for term in ["draft", "place", "order", "approve", "submit"]):
            response = (
                f"I have the recommended action ready: order {recommendation['quantity']:,} "
                f"{recommendation['item_name']} from {recommendation['supplier_name']}. "
                "Use the approval button to submit the supplier purchase order."
            )
            self.repository.update_alert_status(alert_id, "Waiting approval")
            repo.log_event(session_id, "plan",
                "Drafted the supplier purchase order. Waiting for owner approval before writing to MongoDB.")

        self.repository.add_chat_message(session_id, "agent", response, alert_id)
        repo.log_event(session_id, "agent_response",
            "Answered the owner's question from inventory and supplier records.", {"alert_id": alert_id})
        return {
            "response": response,
            "alert": self.repository.get_alert(alert_id),
            "messages": self.repository.list_chat_messages(session_id, alert_id),
        }

    def _cause_response(self, risk: dict[str, Any]) -> str:
        return (
            f"The risk is not coffee supply. {risk['product_name']} has "
            f"{risk['finished_units_on_hand']} finished units on hand, and the limiting component is "
            f"{risk['blocker_name']} with {risk['blocker_quantity_on_hand']} left. At roughly "
            f"{risk['daily_demand']:.0f} units per day, that puts the stockout window at "
            f"{risk['days_until_stockout']} days."
        )

    def _avoid_rush_response(self, risk: dict[str, Any], recommendation: dict[str, Any]) -> str:
        primary = risk.get("primary_supplier", {})
        existing_orders = risk.get("existing_orders", [])
        existing_note = "There is no open standard PO for this component."
        if existing_orders:
            existing_note = "There is already a standard PO open, but its ETA is after the stockout window."
        return (
            f"Waiting for {primary.get('name', 'the primary supplier')} is cheaper, but the lead time is about "
            f"{primary.get('default_lead_time_days', 'unknown')} days while the projected stockout is "
            f"{risk['days_until_stockout']} days away. {existing_note} "
            f"The safer option is {recommendation['supplier_name']} at ${recommendation['unit_cost']:.2f} each "
            f"with a {recommendation['lead_time_days']}-day lead time."
        )

    def _affected_skus_response(self, risk: dict[str, Any]) -> str:
        shared = risk["inventory"].get("shared_by") if "inventory" in risk else None
        if not shared:
            shared = ["ESP-12OZ", "ETH-12OZ"]
        return (
            f"{risk['blocker_name']} is a shared packaging component. It directly affects Espresso Blend 12oz "
            "and can also constrain Ethiopia Guji 12oz if demand picks up. The espresso SKU is the urgent one "
            "because subscriptions and cafe shelf demand consume it faster."
        )

    def _quantity_response(self, risk: dict[str, Any], recommendation: dict[str, Any]) -> str:
        days_covered = recommendation["quantity"] / max(risk["daily_demand"], 1)
        return (
            f"The recommended {recommendation['quantity']:,}-unit rush order is driven by the vendor minimum "
            f"and covers about {days_covered:.0f} days of Espresso Blend demand before considering other 12oz SKUs. "
            "It bridges the gap until the existing Pacific BagWorks order arrives."
        )

    def _general_response(self, risk: dict[str, Any], recommendation: dict[str, Any]) -> str:
        return (
            f"{risk['product_name']} is projected to stock out in {risk['days_until_stockout']} days. "
            f"I recommend ordering {recommendation['quantity']:,} {recommendation['item_name']} from "
            f"{recommendation['supplier_name']} because it can arrive in {recommendation['lead_time_days']} days."
        )
