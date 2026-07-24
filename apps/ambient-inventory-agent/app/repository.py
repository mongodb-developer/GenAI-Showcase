from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from pymongo import ReturnDocument
from pymongo.database import Database

from .demo_data import iso_document


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _fmt(value: Any) -> str:
    """Render a filter/pipeline/document the way it would appear in a MongoDB call."""
    return json.dumps(value, default=str)


class InventoryRepository:
    def __init__(self, db: Database):
        self.db = db

    def log_event(self, session_id: str, event_type: str, message: str, metadata: dict[str, Any] | None = None) -> None:
        self.db.agent_events.insert_one(
            {
                "_id": f"evt_{uuid4().hex[:12]}",
                "session_id": session_id,
                "event_type": event_type,
                "message": message,
                "metadata": metadata or {},
                "created_at": utc_now(),
            }
        )

    # --- Instrumented data access: run a real MongoDB operation and log the exact command. ---

    def logged_find(
        self,
        session_id: str,
        collection: str,
        filter: dict[str, Any] | None = None,
        sort: list[tuple[str, int]] | None = None,
        message: str = "",
    ) -> list[dict[str, Any]]:
        filter = filter or {}
        cursor = self.db[collection].find(filter)
        if sort:
            cursor = cursor.sort(sort)
        docs = list(cursor)
        command = f'find("{collection}", {_fmt(filter)})'
        if sort:
            command += f".sort({_fmt({key: direction for key, direction in sort})})"
        self.log_event(
            session_id,
            "mcp_tool",
            message or f"Queried {collection}.",
            {"tool": "find", "collection": collection, "filter": filter, "count": len(docs), "command": command},
        )
        return docs

    def logged_find_one(
        self,
        session_id: str,
        collection: str,
        filter: dict[str, Any] | None = None,
        message: str = "",
    ) -> dict[str, Any] | None:
        filter = filter or {}
        doc = self.db[collection].find_one(filter)
        self.log_event(
            session_id,
            "mcp_tool",
            message or f"Queried {collection}.",
            {
                "tool": "find",
                "collection": collection,
                "filter": filter,
                "count": 1 if doc else 0,
                "command": f'findOne("{collection}", {_fmt(filter)})',
            },
        )
        return doc

    def logged_aggregate(
        self,
        session_id: str,
        collection: str,
        pipeline: list[dict[str, Any]],
        message: str = "",
    ) -> list[dict[str, Any]]:
        docs = list(self.db[collection].aggregate(pipeline))
        self.log_event(
            session_id,
            "mcp_tool",
            message or f"Aggregated {collection}.",
            {
                "tool": "aggregate",
                "collection": collection,
                "pipeline": pipeline,
                "count": len(docs),
                "command": f'aggregate("{collection}", {_fmt(pipeline)})',
            },
        )
        return docs

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

    def mark_monitor_ran(self, session_id: str) -> None:
        self.db.demo_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"monitor_ran": True, "monitor_ran_at": utc_now()}},
            upsert=True,
        )

    def get_products(self) -> list[dict[str, Any]]:
        return list(self.db.products.find().sort("name", 1))

    def get_inventory_items(self) -> dict[str, dict[str, Any]]:
        return {item["_id"]: item for item in self.db.inventory_items.find()}

    def get_suppliers(self) -> dict[str, dict[str, Any]]:
        return {supplier["_id"]: supplier for supplier in self.db.suppliers.find()}

    def get_open_purchase_orders(self) -> list[dict[str, Any]]:
        return list(self.db.purchase_orders.find({"status": {"$in": ["ordered", "submitted"]}}))

    def active_alert_for_session(self, session_id: str) -> dict[str, Any] | None:
        alert = self.db.alerts.find_one(
            {"session_id": session_id, "status": {"$nin": ["Submitted", "Dismissed"]}},
            sort=[("created_at", -1)],
        )
        return iso_document(alert) if alert else None

    def create_or_get_alert(self, session_id: str, risk: dict[str, Any]) -> dict[str, Any]:
        now = utc_now()
        alert_id = f"alert_{uuid4().hex[:10]}"
        dedupe_key = f"{risk['product_id']}:{risk['blocker_inventory_id']}:demo"
        update = {
            "$setOnInsert": {
                "_id": alert_id,
                "session_id": session_id,
                "dedupe_key": dedupe_key,
                "status": "New",
                "severity": "High",
                "title": f"{risk['product_name']} stockout risk",
                "summary": risk["summary"],
                "risk": risk,
                "recommendation": risk["recommendation"],
                "created_at": now,
            },
            "$set": {"updated_at": now},
        }
        filter_doc = {"session_id": session_id, "dedupe_key": dedupe_key}
        alert = self.db.alerts.find_one_and_update(
            filter_doc,
            update,
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        set_on_insert_preview = {
            "status": update["$setOnInsert"]["status"],
            "severity": update["$setOnInsert"]["severity"],
            "title": update["$setOnInsert"]["title"],
        }
        self.log_event(
            session_id,
            "mcp_tool",
            f"Raised inbox alert {alert['_id']} for {risk['product_sku']}.",
            {
                "tool": "update-many",
                "collection": "alerts",
                "command": f'updateOne("alerts", {_fmt(filter_doc)}, '
                f'{{ "$setOnInsert": {_fmt(set_on_insert_preview)} }}, {{ "upsert": true }})',
            },
        )
        return iso_document(alert)

    def list_alerts(self, session_id: str) -> list[dict[str, Any]]:
        return [
            iso_document(alert)
            for alert in self.db.alerts.find({"session_id": session_id}).sort("created_at", -1)
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

    def add_chat_message(self, session_id: str, role: str, content: str, alert_id: str | None = None) -> None:
        self.db.chat_messages.insert_one(
            {
                "_id": f"msg_{uuid4().hex[:12]}",
                "session_id": session_id,
                "alert_id": alert_id,
                "role": role,
                "content": content,
                "created_at": utc_now(),
            }
        )

    def list_chat_messages(self, session_id: str, alert_id: str | None = None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {"session_id": session_id}
        if alert_id:
            query["alert_id"] = alert_id
        return [
            iso_document(message)
            for message in self.db.chat_messages.find(query).sort("created_at", 1)
        ]

    def submit_recommended_order(self, session_id: str, alert_id: str) -> dict[str, Any]:
        alert = self.db.alerts.find_one({"_id": alert_id, "session_id": session_id})
        if not alert:
            raise ValueError("Alert not found")
        existing_submission = self.db.purchase_orders.find_one(
            {"session_id": session_id, "alert_id": alert_id, "status": "submitted"}
        )
        if existing_submission:
            return iso_document(existing_submission)

        recommendation = alert["recommendation"]
        supplier_id = recommendation["supplier_id"]
        supplier = self.db.suppliers.find_one({"_id": supplier_id})
        if not supplier:
            raise ValueError("Supplier not found")

        confirmation_id = f"SIM-{uuid4().hex[:8].upper()}"
        po_id = f"PO-SIM-{uuid4().hex[:6].upper()}"
        line_item = {
            "inventory_id": recommendation["inventory_id"],
            "name": recommendation["item_name"],
            "quantity": recommendation["quantity"],
            "unit": "each",
            "unit_cost": recommendation["unit_cost"],
        }
        now = utc_now()
        po = {
            "_id": po_id,
            "session_id": session_id,
            "alert_id": alert_id,
            "supplier_id": supplier_id,
            "supplier_name": supplier["name"],
            "status": "submitted",
            "created_at": now,
            "submitted_at": now,
            "expected_arrival": now + timedelta(days=recommendation["lead_time_days"]),
            "confirmation_id": confirmation_id,
            "line_items": [line_item],
            "events": [
                {
                    "type": "submitted_to_supplier",
                    "created_at": now,
                    "message": "Purchase order submitted to supplier.",
                }
            ],
            "notes": "Supplier purchase order created by the inventory assistant.",
        }
        self.log_event(
            session_id,
            "thinking",
            "Owner approved the recommended action. Drafting and submitting the supplier purchase order.",
        )
        self.db.purchase_orders.insert_one(po)
        self.update_alert_status(alert_id, "Submitted")
        insert_preview = {
            "_id": po_id,
            "supplier_id": supplier_id,
            "status": "submitted",
            "confirmation_id": confirmation_id,
            "line_items": [line_item],
        }
        self.log_event(
            session_id,
            "mcp_tool",
            f"Inserted submitted purchase order {po_id}.",
            {
                "tool": "insert-many",
                "collection": "purchase_orders",
                "command": f'insertOne("purchase_orders", {_fmt(insert_preview)})',
            },
        )
        return iso_document(po)

    def list_purchase_orders(self, session_id: str | None = None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {}
        if session_id:
            query["$or"] = [{"session_id": session_id}, {"session_id": {"$exists": False}}]
        return [
            iso_document(order)
            for order in self.db.purchase_orders.find(query).sort("created_at", -1)
        ]

    def list_agent_events(self, session_id: str) -> list[dict[str, Any]]:
        return [
            iso_document(event)
            for event in self.db.agent_events.find({"session_id": session_id}).sort("created_at", -1).limit(30)
        ]

    def state_snapshot(self, session_id: str) -> dict[str, Any]:
        return {
            "alerts": self.list_alerts(session_id),
            "purchase_orders": self.list_purchase_orders(session_id),
            "chat_messages": self.list_chat_messages(session_id),
            "agent_events": self.list_agent_events(session_id),
            "products": [iso_document(product) for product in self.get_products()],
            "inventory_items": [iso_document(item) for item in self.db.inventory_items.find().sort("name", 1)],
            "suppliers": [iso_document(supplier) for supplier in self.db.suppliers.find().sort("name", 1)],
        }
