from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from .demo_data import SEED_SESSION_ID, iso_document


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AlreadyOrdered(Exception):
    """An order already exists for this alert."""

    def __init__(self, order_id: str):
        super().__init__(f"purchase order {order_id} already placed")
        self.order_id = order_id


def _fmt(value: Any) -> str:
    """Render a filter/pipeline/document the way it would appear in a MongoDB call."""
    return json.dumps(value, default=str)


class InventoryRepository:
    def __init__(self, db: Database):
        self.db = db

    # --- session_history: one timeline per session ---
    #
    # Owner questions, agent answers, and every tool call the agent made, in one
    # ordered collection. A tool call on its own does not explain itself; sitting
    # between the question that prompted it and the answer it produced, it does.
    # That timeline is both what the UI renders and what the agent replays as
    # memory on its next turn.

    def log_event(
        self,
        session_id: str,
        event_type: str,
        message: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Record something the system or the agent did."""
        self.db.session_history.insert_one(
            {
                "_id": f"evt_{uuid4().hex[:12]}",
                "session_id": session_id,
                "event_type": event_type,
                "message": message,
                "metadata": metadata or {},
                "created_at": utc_now(),
            }
        )

    def ensure_session(self, session_id: str) -> dict[str, Any]:
        session = self.db.demo_sessions.find_one_and_update(
            {"session_id": session_id},
            {
                "$setOnInsert": {
                    "session_id": session_id,
                    "created_at": utc_now(),
                    "monitor_scheduled": False,
                    "monitor_ran": False,
                }
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return iso_document(session)

    def mark_monitor_scheduled(self, session_id: str) -> None:
        self.db.demo_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"monitor_scheduled": True, "monitor_scheduled_at": utc_now()}},
            upsert=True,
        )

    def monitor_has_run(self, session_id: str) -> bool:
        """True once this session's sweep has completed, successfully or not."""
        session = self.db.demo_sessions.find_one(
            {"session_id": session_id}, {"monitor_ran": 1}
        )
        return bool(session and session.get("monitor_ran"))

    def mark_monitor_ran(self, session_id: str) -> None:
        self.db.demo_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"monitor_ran": True, "monitor_ran_at": utc_now()}},
            upsert=True,
        )

    def get_products(self) -> list[dict[str, Any]]:
        return list(self.db.products.find().sort("name", 1))

    def active_alert_for_session(self, session_id: str) -> dict[str, Any] | None:
        alert = self.db.alerts.find_one(
            {"session_id": session_id, "status": {"$nin": ["Resolved", "Dismissed"]}},
            sort=[("created_at", -1)],
        )
        return iso_document(alert) if alert else None

    def next_purchase_order_id(self) -> str:
        """Next id in the same sequence as the existing orders, e.g. PO-1029.

        The seeded orders are PO-1027 and PO-1028, so a new one should continue the
        series rather than announcing itself with a different shape.
        """
        latest = self.db.purchase_orders.find_one(
            {"_id": {"$regex": r"^PO-\d+$"}}, sort=[("_id", -1)], projection={"_id": 1}
        )
        nextnum = int(latest["_id"].split("-")[1]) + 1 if latest else 1001
        return f"PO-{nextnum}"

    def _derived_risk_fields(self, risk: dict[str, Any]) -> dict[str, Any]:
        """Look up the alert fields that follow from the two ids the agent chose.

        Returns only what it can resolve, so a missing document leaves whatever the
        agent supplied rather than blanking a tile.
        """
        derived: dict[str, Any] = {}

        component_id = risk.get("blocker_inventory_id")
        if component_id:
            item = self.db.inventory_items.find_one(
                {"_id": component_id}, {"name": 1, "quantity_on_hand": 1}
            )
            if item:
                derived["blocker_name"] = item.get("name")
                derived["blocker_quantity_on_hand"] = item.get("quantity_on_hand")

            # Every OTHER product drawing on this component, from the bill of materials
            # rather than a stored list — the same derivation the sweep's aggregate does.
            product_id = risk.get("product_id")
            sharers = self.db.products.find(
                {"components.inventory_id": component_id}, {"sku": 1}
            )
            derived["blocker_shared_with"] = sorted(
                p["sku"] for p in sharers if p["_id"] != product_id and p.get("sku")
            )

        product_id = risk.get("product_id")
        if product_id:
            product = self.db.products.find_one({"_id": product_id}, {"sku": 1})
            if product and product.get("sku"):
                derived["product_sku"] = product["sku"]

        return derived

    def build_alert_document(
        self, session_id: str, sweep_id: str, diagnosis: dict[str, Any]
    ) -> dict[str, Any]:
        """Shape the agent's diagnosis into the alert document, without writing it.

        The agent writes it over MCP — the alert is its conclusion, so it should not
        be the one thing the app inserts on its behalf. But the identifiers and the
        layout come from here: the UI reads `_id`, `status` and `dedupe_key`, and the
        unique index on (session_id, dedupe_key) is what stops duplicates.
        """
        # Fields the UI reads from the top level are not duplicated inside `risk`.
        promoted = ("summary", "headline", "recommendation", "title", "severity")
        risk = {key: value for key, value in diagnosis.items() if key not in promoted}

        # Fill the fields that are lookups rather than judgements. The agent supplies the
        # two ids — which product, which component — and everything below follows from
        # them by definition. Asking the model to also transcribe the name, the on-hand
        # count, the SKU and the sharing SKUs made the filing turn longer and gave those
        # figures a second source that could disagree with the collection they came from.
        # What the agent decides is unchanged: which component is at risk, the reorder
        # point, days left, the supplier, the quantity, the urgency and the wording.
        risk.update(self._derived_risk_fields(risk))
        now = utc_now()
        return {
            "_id": f"alert_{uuid4().hex[:10]}",
            "session_id": session_id,
            "sweep_id": sweep_id,
            "dedupe_key": f"{diagnosis.get('product_id')}:{diagnosis.get('blocker_inventory_id')}",
            "status": "New",
            "title": diagnosis.get("title") or "Stockout risk",
            "severity": diagnosis.get("severity") or "Medium",
            "summary": diagnosis.get("headline") or diagnosis.get("summary", ""),
            "risk": risk,
            "recommendation": diagnosis.get("recommendation") or {},
            "created_at": now,
            "updated_at": now,
        }

    def list_alerts(self, session_id: str) -> list[dict[str, Any]]:
        return [
            iso_document(alert)
            for alert in self.db.alerts.find({"session_id": session_id}).sort(
                "created_at", -1
            )
        ]

    def get_alert(self, alert_id: str) -> dict[str, Any] | None:
        alert = self.db.alerts.find_one({"_id": alert_id})
        return iso_document(alert) if alert else None

    def update_alert_status(self, alert_id: str, status: str) -> dict[str, Any] | None:
        alert = self.db.alerts.find_one_and_update(
            {"_id": alert_id},
            {"$set": {"status": status, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return iso_document(alert) if alert else None

    def add_chat_message(
        self,
        session_id: str,
        role: str,
        content: str,
        alert_id: str | None = None,
        queries: list[str] | None = None,
    ) -> None:
        """Store a transcript turn.

        `queries` records the MCP calls that produced an agent answer, so the
        rendered message keeps showing its evidence after the stream ends.
        """
        entry: dict[str, Any] = {
            "_id": f"msg_{uuid4().hex[:12]}",
            "session_id": session_id,
            "alert_id": alert_id,
            # `event_type` keeps every history entry uniformly filterable; `role`
            # marks the two that are dialogue.
            "event_type": "owner_message" if role == "owner" else "agent_message",
            "role": role,
            "content": content,
            "message": content,
            "created_at": utc_now(),
        }
        if queries:
            entry["queries"] = queries
        self.db.session_history.insert_one(entry)

    def list_dialogue(
        self, session_id: str, alert_id: str | None = None
    ) -> list[dict[str, Any]]:
        """Just the owner/agent turns from the session history, oldest first."""
        query: dict[str, Any] = {
            "session_id": session_id,
            "role": {"$in": ["owner", "agent"]},
        }
        if alert_id:
            query["alert_id"] = alert_id
        return [
            iso_document(message)
            for message in self.db.session_history.find(query).sort("created_at", 1)
        ]

    def draft_purchase_order(self, session_id: str, alert_id: str) -> dict[str, Any]:
        """Build the purchase order for an alert, without writing it.

        Every field is derived here — ids, dates, supplier lookup, line item — so
        whoever performs the write is only transcribing. Raises `AlreadyOrdered` if
        one exists; the unique partial index on `{alert_id}` is the real guarantee,
        this just avoids attempting a write the database would reject.
        """
        alert = self.db.alerts.find_one({"_id": alert_id, "session_id": session_id})
        if not alert:
            raise ValueError("Alert not found")

        existing = self.db.purchase_orders.find_one(
            {"alert_id": alert_id, "status": "ordered"}
        )
        if existing:
            raise AlreadyOrdered(existing["_id"])

        order = alert.get("recommendation") or {}
        supplier = self.db.suppliers.find_one({"_id": order["supplier_id"]})
        if not supplier:
            raise ValueError("Supplier not found")

        now = utc_now()
        return {
            "_id": self.next_purchase_order_id(),
            "session_id": session_id,
            "alert_id": alert_id,
            "sweep_id": alert.get("sweep_id"),
            "supplier_id": order["supplier_id"],
            "supplier_name": supplier["name"],
            "status": "ordered",
            "created_at": now,
            "ordered_at": now,
            "expected_arrival": now + timedelta(days=order["lead_time_days"]),
            "confirmation_id": f"CONF-{uuid4().hex[:8].upper()}",
            "line_items": [
                {
                    "inventory_id": order["inventory_id"],
                    "name": order["item_name"],
                    "quantity": order["quantity"],
                    "unit": "each",
                    "unit_cost": order["unit_cost"],
                }
            ],
        }

    def has_order(self, alert_id: str) -> bool:
        """Whether a purchase order has been placed for this alert."""
        return (
            self.db.purchase_orders.count_documents(
                {"alert_id": alert_id, "status": "ordered"}, limit=1
            )
            > 0
        )

    def confirm_purchase_order(
        self, session_id: str, alert_id: str, order: dict[str, Any]
    ) -> None:
        """Close the loop after the approve button has written an order."""
        self.update_alert_status(alert_id, "Resolved")
        self.log_event(
            session_id,
            "approval",
            f"Purchase order {order['_id']} placed with {order['supplier_name']}.",
        )
        self.add_chat_message(
            session_id,
            "agent",
            f"Placed purchase order {order['_id']} with {order['supplier_name']} "
            f"with confirmation {order['confirmation_id']}.",
            alert_id,
        )

    def place_order_directly(
        self, session_id: str, alert_id: str
    ) -> tuple[dict[str, Any], bool]:
        """Write the order with the driver. Used by the approve button.

        The button is app plumbing, not an agent action, so it writes directly and
        is labelled `MongoDB · write` — the same as the alert upsert. When the owner
        asks in the chat instead, the agent writes it over MCP.
        """
        try:
            order = self.draft_purchase_order(session_id, alert_id)
        except AlreadyOrdered as exc:
            existing = self.db.purchase_orders.find_one({"_id": exc.order_id})
            return iso_document(existing), False

        try:
            self.db.purchase_orders.insert_one(order)
        except DuplicateKeyError:
            winner = self.db.purchase_orders.find_one(
                {"alert_id": alert_id, "status": "ordered"}
            )
            if winner:
                return iso_document(winner), False
            raise

        self.log_event(
            session_id,
            "db_write",
            f"Recorded purchase order {order['_id']}.",
            {
                "tool": "insertOne",
                "collection": "purchase_orders",
                "command": f'insertOne("purchase_orders", {_fmt({"_id": order["_id"]})})',
                "via": "driver",
            },
        )
        self.confirm_purchase_order(session_id, alert_id, order)
        return iso_document(order), True

    def list_purchase_orders(
        self, session_id: str | None = None
    ) -> list[dict[str, Any]]:
        query: dict[str, Any] = {}
        if session_id:
            # Seeded orders carry session_id "seed", so this stays an indexable
            # equality match instead of an unindexable {$exists: false} branch.
            query["session_id"] = {"$in": [session_id, SEED_SESSION_ID]}
        return [
            iso_document(order)
            for order in self.db.purchase_orders.find(query).sort("created_at", -1)
        ]

    def list_history(self, session_id: str) -> list[dict[str, Any]]:
        """The session timeline, newest first, for the activity feed."""
        return [
            iso_document(event)
            for event in self.db.session_history.find({"session_id": session_id})
            .sort("created_at", -1)
            .limit(30)
        ]

    def state_snapshot(self, session_id: str) -> dict[str, Any]:
        from .graph import product_cover

        products = self.get_products()
        inventory_items = list(self.db.inventory_items.find().sort("name", 1))
        suppliers = list(self.db.suppliers.find().sort("name", 1))
        # Whether this session's sweep has been started, so the UI's play control
        # can stay in its running state during the seconds before the agent logs
        # its first event. Without this it briefly reverts to "Run sweep" and looks
        # like the click did not register.
        session = self.db.demo_sessions.find_one(
            {"session_id": session_id}, {"monitor_scheduled": 1, "monitor_ran": 1}
        )
        return {
            "monitor": {
                "scheduled": bool(session and session.get("monitor_scheduled")),
                "ran": bool(session and session.get("monitor_ran")),
            },
            "alerts": self.list_alerts(session_id),
            "purchase_orders": self.list_purchase_orders(session_id),
            "dialogue": self.list_dialogue(session_id),
            "history": self.list_history(session_id),
            "products": [iso_document(product) for product in products],
            "inventory_items": [iso_document(item) for item in inventory_items],
            "suppliers": [iso_document(supplier) for supplier in suppliers],
            # Computed server-side so the dashboard's "Cover" column and the
            # inbox alert can never disagree about the same product.
            "cover": product_cover(products),
        }
