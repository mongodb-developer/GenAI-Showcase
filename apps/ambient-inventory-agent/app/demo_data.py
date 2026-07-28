from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from pymongo.database import Database

DEMO_COLLECTIONS = [
    "products",
    "inventory_items",
    "suppliers",
    "purchase_orders",
    "alerts",
    "session_history",
    "demo_sessions",
    # LangGraph's agent memory. Dropped with everything else so a reseed leaves no
    # stale threads behind — the alternative would be a TTL, but every run of this
    # demo starts from a reset anyway.
    "checkpoints",
    "checkpoint_writes",
]

# Seeded (non-session) documents carry this instead of omitting session_id, so
# session-scoped queries stay indexable equality matches.
SEED_SESSION_ID = "seed"

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


SEED_VERSION = "seed_v2"


def seed_demo_data(db: Database, reset: bool = False) -> None:
    if reset:
        for collection in DEMO_COLLECTIONS:
            db[collection].drop()
        # Retired collections from earlier versions of this demo: the seed marker
        # moved into demo_sessions, and chat_messages + agent_events merged into
        # session_history.
        for retired in ("demo_meta", "chat_messages", "agent_events"):
            db[retired].drop()

    # The seed marker lives in demo_sessions rather than its own single-document
    # collection, so there is one less collection (and _id index) to carry.
    if db.demo_sessions.find_one({"_id": SEED_VERSION}):
        return

    now = utc_now()
    expected_green_arrival = now + timedelta(days=12)

    db.products.insert_many(
        [
            {
                "_id": "espresso_blend_12oz",
                "sku": "ESP-12OZ",
                "name": "Leafy Espresso Blend - 12oz",
                "channel": "Shopify, cafe shelves, subscriptions",
                "category": "Roasted coffee",
                "daily_demand": 18,
                "finished_units_on_hand": 180,
                "target_stock": 420,
                "reorder_point": 120,
                "components": [
                    {"inventory_id": "roasted_espresso_blend", "quantity_per_unit": 0.34, "unit": "kg"},
                    {"inventory_id": "bag_12oz_valve", "quantity_per_unit": 1, "unit": "each"},
                    {"inventory_id": "label_espresso_12oz", "quantity_per_unit": 1, "unit": "each"},
                    {"inventory_id": "mailer_single", "quantity_per_unit": 0.35, "unit": "each"},
                ],
            },
            {
                "_id": "ethiopia_single_origin_12oz",
                "sku": "ETH-12OZ",
                "name": "Ethiopia Guji Single Origin - 12oz",
                "channel": "Shopify and cafe shelves",
                "category": "Roasted coffee",
                "daily_demand": 7,
                "finished_units_on_hand": 118,
                "target_stock": 180,
                "reorder_point": 60,
                "components": [
                    {"inventory_id": "roasted_ethiopia_guji", "quantity_per_unit": 0.34, "unit": "kg"},
                    {"inventory_id": "bag_12oz_valve", "quantity_per_unit": 1, "unit": "each"},
                    {"inventory_id": "label_ethiopia_12oz", "quantity_per_unit": 1, "unit": "each"},
                    {"inventory_id": "mailer_single", "quantity_per_unit": 0.25, "unit": "each"},
                ],
            },
            {
                "_id": "cold_brew_can_4pk",
                "sku": "CB-4PK",
                "name": "Cold Brew 4-Pack",
                "channel": "Cafes and local delivery",
                "category": "Ready to drink",
                "daily_demand": 10,
                "finished_units_on_hand": 165,
                "target_stock": 260,
                "reorder_point": 90,
                "components": [
                    {"inventory_id": "cold_brew_cans", "quantity_per_unit": 4, "unit": "each"},
                    {"inventory_id": "cold_brew_carrier", "quantity_per_unit": 1, "unit": "each"},
                ],
            },
            {
                "_id": "colombia_huila_12oz",
                "sku": "COL-12OZ",
                "name": "Colombia Huila Single Origin - 12oz",
                "channel": "Shopify and cafe shelves",
                "category": "Roasted coffee",
                "daily_demand": 9,
                "finished_units_on_hand": 190,
                "target_stock": 200,
                "reorder_point": 70,
                "components": [
                    {"inventory_id": "roasted_colombia_huila", "quantity_per_unit": 0.34, "unit": "kg"},
                    {"inventory_id": "bag_12oz_valve", "quantity_per_unit": 1, "unit": "each"},
                    {"inventory_id": "label_colombia_12oz", "quantity_per_unit": 1, "unit": "each"},
                    {"inventory_id": "mailer_single", "quantity_per_unit": 0.3, "unit": "each"},
                ],
            },
            {
                "_id": "decaf_blend_12oz",
                "sku": "DEC-12OZ",
                "name": "Decaf Blend - 12oz",
                "channel": "Shopify and subscriptions",
                "category": "Roasted coffee",
                "daily_demand": 5,
                "finished_units_on_hand": 96,
                "target_stock": 150,
                "reorder_point": 55,
                "components": [
                    {"inventory_id": "roasted_decaf_blend", "quantity_per_unit": 0.34, "unit": "kg"},
                    {"inventory_id": "bag_12oz_valve", "quantity_per_unit": 1, "unit": "each"},
                    {"inventory_id": "label_decaf_12oz", "quantity_per_unit": 1, "unit": "each"},
                    {"inventory_id": "mailer_single", "quantity_per_unit": 0.3, "unit": "each"},
                ],
            },
            {
                "_id": "house_drip_2lb",
                "sku": "HSE-2LB",
                "name": "House Drip Blend - 2lb",
                "channel": "Cafes and wholesale",
                "category": "Roasted coffee",
                "daily_demand": 12,
                "finished_units_on_hand": 210,
                "target_stock": 300,
                "reorder_point": 120,
                "components": [
                    {"inventory_id": "roasted_house_blend", "quantity_per_unit": 0.9, "unit": "kg"},
                    {"inventory_id": "bag_2lb_valve", "quantity_per_unit": 1, "unit": "each"},
                    {"inventory_id": "label_house_2lb", "quantity_per_unit": 1, "unit": "each"},
                ],
            },
            {
                "_id": "espresso_blend_5lb",
                "sku": "ESP-5LB",
                "name": "Espresso Blend - 5lb Wholesale",
                "channel": "Wholesale accounts",
                "category": "Roasted coffee",
                "daily_demand": 6,
                "finished_units_on_hand": 92,
                "target_stock": 160,
                "reorder_point": 60,
                "components": [
                    {"inventory_id": "roasted_espresso_blend", "quantity_per_unit": 2.3, "unit": "kg"},
                    {"inventory_id": "bag_5lb_kraft", "quantity_per_unit": 1, "unit": "each"},
                ],
            },
            {
                "_id": "cold_brew_concentrate_32oz",
                "sku": "CBC-32OZ",
                "name": "Cold Brew Concentrate - 32oz",
                "channel": "Cafes and local delivery",
                "category": "Ready to drink",
                "daily_demand": 8,
                "finished_units_on_hand": 132,
                "target_stock": 180,
                "reorder_point": 80,
                "components": [
                    {"inventory_id": "cold_brew_bottle_32oz", "quantity_per_unit": 1, "unit": "each"},
                ],
            },
            {
                "_id": "single_origin_sampler_3pk",
                "sku": "SMP-3PK",
                "name": "Single Origin Sampler - 3 Pack",
                "channel": "Shopify and gifting",
                "category": "Gift sets",
                "daily_demand": 4,
                "finished_units_on_hand": 150,
                "target_stock": 200,
                "reorder_point": 60,
                "components": [
                    {"inventory_id": "sampler_box", "quantity_per_unit": 1, "unit": "each"},
                ],
            },
        ]
    )

    db.inventory_items.insert_many(
        [
            {
                "_id": "roasted_espresso_blend",
                "name": "Roasted Espresso Blend",
                "kind": "roasted_coffee",
                "quantity_on_hand": 520,
                "unit": "kg",
                "supplier_id": "atlas_green_importers",
            },
            {
                "_id": "roasted_ethiopia_guji",
                "name": "Roasted Ethiopia Guji",
                "kind": "roasted_coffee",
                "quantity_on_hand": 44,
                "unit": "kg",
                "supplier_id": "atlas_green_importers",
            },
            {
                "_id": "bag_12oz_valve",
                "name": "12oz Kraft Valve Bags",
                "kind": "packaging",
                # Just below its reorder point: 4 SKUs draw ~39/day and the primary
                # supplier needs 8 days, so ~429 is the trigger level. The demo is
                # about catching the crossing, not surviving a crisis.
                "quantity_on_hand": 402,
                "unit": "each",
                "supplier_id": "pacific_bagworks",
                "backup_supplier_id": "quickpack_west",
                # No denormalized `shared_by` list: which products use a component
                # is derivable from products.components.inventory_id, and a cached
                # copy here went stale the moment new 12oz SKUs were added.
            },
            {
                "_id": "label_espresso_12oz",
                "name": "Espresso Blend 12oz Labels",
                "kind": "label",
                "quantity_on_hand": 720,
                "unit": "each",
                "supplier_id": "summit_label",
            },
            {
                "_id": "label_ethiopia_12oz",
                "name": "Ethiopia 12oz Labels",
                "kind": "label",
                "quantity_on_hand": 310,
                "unit": "each",
                "supplier_id": "summit_label",
            },
            {
                "_id": "mailer_single",
                "name": "Single-Bag Shipping Mailers",
                "kind": "shipping",
                "quantity_on_hand": 460,
                "unit": "each",
                "supplier_id": "pacific_bagworks",
            },
            {
                "_id": "cold_brew_cans",
                "name": "Cold Brew Cans",
                "kind": "packaging",
                "quantity_on_hand": 1100,
                "unit": "each",
                "supplier_id": "cascade_canning",
            },
            {
                "_id": "cold_brew_carrier",
                "name": "Cold Brew 4-Pack Carriers",
                "kind": "packaging",
                "quantity_on_hand": 390,
                "unit": "each",
                "supplier_id": "cascade_canning",
            },
            {
                "_id": "roasted_colombia_huila",
                "name": "Roasted Colombia Huila",
                "kind": "roasted_coffee",
                "quantity_on_hand": 80,
                "unit": "kg",
                "supplier_id": "atlas_green_importers",
            },
            {
                "_id": "roasted_decaf_blend",
                "name": "Roasted Decaf Blend",
                "kind": "roasted_coffee",
                "quantity_on_hand": 60,
                "unit": "kg",
                "supplier_id": "atlas_green_importers",
            },
            {
                "_id": "roasted_house_blend",
                "name": "Roasted House Blend",
                "kind": "roasted_coffee",
                "quantity_on_hand": 260,
                "unit": "kg",
                "supplier_id": "atlas_green_importers",
            },
            {
                "_id": "bag_2lb_valve",
                "name": "2lb Kraft Valve Bags",
                "kind": "packaging",
                "quantity_on_hand": 900,
                "unit": "each",
                "supplier_id": "pacific_bagworks",
                "backup_supplier_id": "quickpack_west",
            },
            {
                "_id": "bag_5lb_kraft",
                "name": "5lb Wholesale Kraft Bags",
                "kind": "packaging",
                "quantity_on_hand": 400,
                "unit": "each",
                "supplier_id": "pacific_bagworks",
            },
            {
                "_id": "label_colombia_12oz",
                "name": "Colombia 12oz Labels",
                "kind": "label",
                "quantity_on_hand": 500,
                "unit": "each",
                "supplier_id": "summit_label",
            },
            {
                "_id": "label_decaf_12oz",
                "name": "Decaf 12oz Labels",
                "kind": "label",
                "quantity_on_hand": 480,
                "unit": "each",
                "supplier_id": "summit_label",
            },
            {
                "_id": "label_house_2lb",
                "name": "House Blend 2lb Labels",
                "kind": "label",
                "quantity_on_hand": 300,
                "unit": "each",
                "supplier_id": "summit_label",
            },
            {
                "_id": "sampler_box",
                "name": "Single Origin Sampler Boxes",
                "kind": "packaging",
                "quantity_on_hand": 260,
                "unit": "each",
                "supplier_id": "cascade_canning",
            },
            {
                "_id": "cold_brew_bottle_32oz",
                "name": "Cold Brew 32oz Bottles",
                "kind": "packaging",
                "quantity_on_hand": 700,
                "unit": "each",
                "supplier_id": "cascade_canning",
            },
        ]
    )

    db.suppliers.insert_many(
        [
            {
                "_id": "atlas_green_importers",
                "name": "Atlas Green Importers",
                "vendor_type": "Green coffee importer",
                "default_lead_time_days": 14,
                "reliability": 0.96,
            },
            {
                "_id": "pacific_bagworks",
                "name": "Pacific BagWorks",
                "vendor_type": "Primary packaging supplier",
                "default_lead_time_days": 8,
                "reliability": 0.93,
                "unit_costs": {"bag_12oz_valve": 0.31, "mailer_single": 0.22},
                "minimum_order": {"bag_12oz_valve": 2000},
            },
            {
                # The middle option, and the reason the demo has a conversation in
                # it. The agent correctly recommends the cheapest supplier that
                # fits the window, but 8 days against 10.3 days of stock is a thin
                # margin — so an owner can reasonably say "that's too close" and
                # ask for something faster without jumping to the rush vendor.
                "_id": "harborline_supply",
                "name": "Harborline Supply",
                "vendor_type": "Secondary packaging supplier",
                "default_lead_time_days": 5,
                "reliability": 0.95,
                "unit_costs": {"bag_12oz_valve": 0.34},
                "minimum_order": {"bag_12oz_valve": 1500},
            },
            {
                "_id": "quickpack_west",
                "name": "QuickPack West",
                "vendor_type": "Rush packaging vendor",
                "default_lead_time_days": 2,
                "reliability": 0.88,
                "unit_costs": {"bag_12oz_valve": 0.37},
                "minimum_order": {"bag_12oz_valve": 1000},
            },
            {
                "_id": "summit_label",
                "name": "Summit Label Co.",
                "vendor_type": "Label printer",
                "default_lead_time_days": 5,
                "reliability": 0.91,
                "unit_costs": {"label_espresso_12oz": 0.07, "label_ethiopia_12oz": 0.08},
                "minimum_order": {"label_espresso_12oz": 500},
            },
            {
                "_id": "cascade_canning",
                "name": "Cascade Canning Supply",
                "vendor_type": "Canning and carriers",
                "default_lead_time_days": 6,
                "reliability": 0.9,
                "unit_costs": {"cold_brew_cans": 0.12, "cold_brew_carrier": 0.19},
            },
        ]
    )

    db.purchase_orders.insert_many(
        [
            {
                "_id": "PO-1027",
                "session_id": SEED_SESSION_ID,
                "supplier_id": "pacific_bagworks",
                "supplier_name": "Pacific BagWorks",
                "status": "received",
                "created_at": now - timedelta(days=26),
                "expected_arrival": now - timedelta(days=18),
                "received_at": now - timedelta(days=18),
                "line_items": [
                    {
                        "inventory_id": "mailer_single",
                        "name": "Single-Bag Shipping Mailers",
                        "quantity": 2000,
                        "unit_cost": 0.22,
                    }
                ],
            },
            {
                "_id": "PO-1028",
                "session_id": SEED_SESSION_ID,
                "supplier_id": "atlas_green_importers",
                "supplier_name": "Atlas Green Importers",
                "status": "ordered",
                "created_at": now - timedelta(days=6),
                "expected_arrival": expected_green_arrival,
                "line_items": [
                    {
                        "inventory_id": "roasted_ethiopia_guji",
                        "name": "Ethiopia Guji replacement lot",
                        "quantity": 120,
                        "unit": "kg",
                        "unit_cost": 9.4,
                    }
                ],
            },
        ]
    )

    db.demo_sessions.insert_one({"_id": SEED_VERSION, "seeded_at": now})
    # Dropping collections also drops their indexes and validators, so re-apply
    # both here — otherwise a demo reset silently leaves them off.
    ensure_indexes(db)
    ensure_validators(db)


def ensure_indexes(db: Database) -> None:
    """Create only indexes that serve a query this app actually runs."""
    # alerts: list_alerts filters {session_id} and sorts created_at desc; the
    # active-alert lookup adds {status: {$nin: [...]}}. A ($nin) range predicate
    # cannot seek, so leading with session_id + created_at serves the sort for
    # both and avoids a blocking SORT stage.
    db.alerts.create_index([("session_id", 1), ("created_at", -1)], name="alerts_session_recent")
    # Enforces one alert per (session, product+blocker) — backs the upsert dedupe.
    db.alerts.create_index([("session_id", 1), ("dedupe_key", 1)], unique=True, name="alerts_dedupe")

    # One timeline per session: read newest-first for the feed, oldest-first for
    # the dialogue, so index both directions off session_id.
    db.session_history.create_index(
        [("session_id", 1), ("created_at", -1)], name="history_session_recent"
    )
    db.session_history.create_index(
        [("session_id", 1), ("role", 1), ("created_at", 1)], name="history_session_dialogue"
    )

    # purchase_orders: list view filters session_id and sorts by created_at.
    db.purchase_orders.create_index(
        [("session_id", 1), ("created_at", -1)], name="po_session_recent"
    )
    # Makes approval idempotent at the database level: at most one placed PO
    # per alert, so a double-click cannot place two supplier orders.
    db.purchase_orders.create_index(
        [("alert_id", 1)],
        unique=True,
        name="po_one_order_per_alert",
        partialFilterExpression={"status": "ordered"},
    )

    db.demo_sessions.create_index([("session_id", 1)], unique=True, sparse=True,
                                  name="sessions_session_id")


def ensure_validators(db: Database) -> None:
    """Attach $jsonSchema validators to the collections the agent writes.

    Warn-level on purpose: the demo should never hard-fail on stage because of a
    validation edge case, but drift still shows up in the server log.
    """
    validators = {
        "products": {
            "bsonType": "object",
            "required": ["_id", "sku", "name", "daily_demand", "finished_units_on_hand", "components"],
            "properties": {
                "sku": {"bsonType": "string"},
                "daily_demand": {"bsonType": ["double", "int"], "minimum": 0},
                "finished_units_on_hand": {"bsonType": ["double", "int"], "minimum": 0},
                "reorder_point": {"bsonType": ["double", "int"], "minimum": 0},
                "components": {
                    "bsonType": "array",
                    "items": {
                        "bsonType": "object",
                        "required": ["inventory_id", "quantity_per_unit"],
                        "properties": {
                            "inventory_id": {"bsonType": "string"},
                            "quantity_per_unit": {
                                "bsonType": ["double", "int"],
                                "minimum": 0,
                                "exclusiveMinimum": True,
                            },
                        },
                    },
                },
            },
        },
        "inventory_items": {
            "bsonType": "object",
            "required": ["_id", "name", "quantity_on_hand", "unit"],
            "properties": {
                "quantity_on_hand": {"bsonType": ["double", "int"], "minimum": 0},
                "kind": {"enum": ["roasted_coffee", "packaging", "label", "shipping"]},
            },
        },
        "purchase_orders": {
            "bsonType": "object",
            "required": ["_id", "supplier_id", "status", "line_items"],
            "properties": {
                "status": {"enum": ["ordered", "received", "cancelled"]},
                "line_items": {"bsonType": "array", "minItems": 1},
            },
        },
        "alerts": {
            "bsonType": "object",
            "required": ["_id", "session_id", "status", "risk", "recommendation"],
            "properties": {
                "status": {
                    "enum": ["New", "Opened", "Discussing", "Waiting approval", "Resolved", "Dismissed"]
                },
                "severity": {"enum": ["High", "Medium", "Low"]},
            },
        },
    }
    for name, schema in validators.items():
        db.command(
            "collMod" if name in db.list_collection_names() else "create",
            name,
            validator={"$jsonSchema": schema},
            validationLevel="moderate",
            validationAction="warn",
        )


def iso_document(document: dict[str, Any]) -> dict[str, Any]:
    converted = {}
    for key, value in document.items():
        if isinstance(value, ObjectId):
            converted[key] = str(value)
        elif isinstance(value, datetime):
            # Everything is stored in UTC, but the driver returns naive datetimes.
            # Without the offset the browser would read them as local time and the
            # activity feed would be wrong by the viewer's UTC offset.
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            converted[key] = value.isoformat()
        elif isinstance(value, list):
            converted[key] = [iso_document(item) if isinstance(item, dict) else item for item in value]
        elif isinstance(value, dict):
            converted[key] = iso_document(value)
        else:
            converted[key] = value
    return converted
