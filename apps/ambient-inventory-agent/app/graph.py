from __future__ import annotations

import asyncio
from math import floor
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from .memory import new_sweep_id
from .repository import InventoryRepository

class MonitorState(TypedDict, total=False):
    session_id: str
    sweep_id: str
    products: list[dict[str, Any]]
    alert: dict[str, Any] | None




def product_cover(products: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Days of finished stock per product, for the dashboard's Cover column.

    Deliberately shallow: just `finished_units_on_hand / daily_demand`. Judging
    whether a product is actually at risk means allocating shared components by
    demand and comparing against supplier lead times — that is the agent's job,
    done over MCP, and duplicating it here would put a second opinion on screen
    that could disagree with the alert.
    """
    cover: dict[str, dict[str, Any]] = {}
    for product in products:
        daily_demand = float(product.get("daily_demand") or 0)
        if daily_demand <= 0:
            continue
        units = float(product.get("finished_units_on_hand") or 0)
        # Whole days: a tenth of a day of coffee is not a number anyone acts on.
        cover[product["_id"]] = {"days_of_cover": int(units // daily_demand)}
    return cover



class InventoryMonitorGraph:
    """Schedules the monitoring run. The diagnosis itself is the agent's."""

    def __init__(self, repository: InventoryRepository):
        self.repository = repository
        self.graph = self._build_graph()

    def run(self, session_id: str) -> dict[str, Any] | None:
        # The sweep gets an identity up front: it keys the agent's memory thread,
        # and the alert records it so a follow-up conversation on any device
        # resumes the investigation that produced it.
        final_state = self.graph.invoke(
            {"session_id": session_id, "sweep_id": new_sweep_id()}
        )
        self.repository.mark_monitor_ran(session_id)
        return final_state.get("alert")

    def _build_graph(self):
        workflow = StateGraph(MonitorState)
        workflow.add_node("load_context", self._load_context)
        workflow.add_node("create_alert", self._create_alert)
        workflow.set_entry_point("load_context")
        workflow.add_edge("load_context", "create_alert")
        workflow.add_edge("create_alert", END)
        return workflow.compile()

    def _load_context(self, state: MonitorState) -> MonitorState:
        """Read the product fields the alert document needs to label itself.

        Not a diagnosis — the agent does all of that over MCP. Projected to four
        fields, and kept off the activity feed because nothing decided to run it.
        """
        state["products"] = list(
            self.repository.db.products.find(
                {}, {"sku": 1, "name": 1, "daily_demand": 1, "finished_units_on_hand": 1}
            )
        )
        return state

    def _create_alert(self, state: MonitorState) -> MonitorState:
        """Let the agent sweep, diagnose and file the alert over Remote MCP.

        The agent owns this entirely: it queries inventory itself, decides which
        component has reached its reorder point, works out why, and files the
        alert. There is no rule-based alternative — if the agent cannot complete,
        no alert is raised and the failure is surfaced rather than papered over.
        """
        session_id = state["session_id"]
        repo = self.repository

        sweep_id = state["sweep_id"]
        alert = self._investigate(session_id, sweep_id)
        if alert:
            repo.log_event(session_id, "agent_finding",
                f"Diagnosis: {alert.get('summary', '')}")
            state["alert"] = alert
            return state

        # No alert rather than a fabricated one. The error is already in the feed.
        state["alert"] = None
        return state

    def _investigate(self, session_id: str, sweep_id: str) -> dict[str, Any] | None:
        """Run the MCP-backed sweep + diagnosis, returning alert fields or None."""
        from .investigator import AlertInvestigator

        try:
            diagnosis = asyncio.run(
                AlertInvestigator(self.repository).investigate(session_id, sweep_id)
            )
        except Exception as exc:
            self.repository.log_event(
                session_id, "error", f"Alert investigation failed: {exc}"
            )
            return None

        return diagnosis or None

