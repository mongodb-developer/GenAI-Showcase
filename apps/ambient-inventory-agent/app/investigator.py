"""The ambient monitor: an agent that sweeps, diagnoses, and files the alert.

Everything about the alert is the agent's own work, done over MongoDB Remote MCP.
It queries the catalogue, decides which product is most at risk, finds the
component actually limiting it, works out who else draws on that component,
checks whether inbound stock lands in time, chooses a supplier, and sizes the
order. `graph.py` only schedules the run.

So the activity feed fills with real MCP calls and real findings before the inbox
badge ever pulses — that sequence is the demo.

Output is schema-constrained via a `file_alert` tool: the wording and figures vary
run to run, but the alert tiles always receive well-formed fields.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv

from .agent import build_agent_tools, model_for_agent
from .mcp_session import get_mcp_session
from .memory import get_checkpointer, thread_config
from .repository import InventoryRepository

load_dotenv()

# Schema-constrained alert, shaped for scanning rather than reading. Every string
# field is capped short so the inbox stays a glanceable set of stats: the owner
# should grasp the situation without reading a paragraph. Depth lives in the chat,
# where the owner asks for it.
ALERT_SCHEMA = {
    "title": "InventoryAlert",
    "description": "A diagnosed stockout risk, expressed as scannable stats.",
    "type": "object",
    "properties": {
        "title": {
            "type": "string",
            "maxLength": 60,
            "description": "Headline naming the product at risk, e.g. 'Espresso Blend 12oz — stockout risk'.",
        },
        "headline": {
            "type": "string",
            "maxLength": 90,
            "description": (
                "ONE short sentence stating the problem and the fix, e.g. "
                "'12oz bags run out in 1 day; rush 1,000 from QuickPack West.' "
                "No preamble, no restating the title."
            ),
        },
        "product_id": {
            "type": "string",
            "description": "_id of the product you are alerting on.",
        },
        "product_sku": {"type": "string"},
        "component_reorder_point": {
            "type": "number",
            "description": "The reorder point you calculated for the limiting component.",
        },
        "component_days_left": {
            "type": "number",
            "description": (
                "Whole number of days the component's stock lasts at the combined "
                "daily draw. Round down."
            ),
        },
        "others_at_risk": {
            "type": "integer",
            "description": "How many OTHER products also fell below their threshold.",
        },
        "severity": {"type": "string", "enum": ["High", "Medium", "Low"]},
        "stats": {
            "type": "array",
            "description": (
                "EXACTLY these three figures, in this order: "
                "1) 'SKUs affected' — how many products use the component, e.g. '4 products'. "
                "2) 'Stock vs reorder' — on hand against the reorder point, e.g. '402 / 429 units'. "
                "3) 'Days left' — how long the stock lasts at the combined draw, "
                "rounded to a whole number, e.g. '10 days'. "
                "Nothing else: no lead times, no daily draw, no supplier names."
            ),
            "minItems": 3,
            "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "maxLength": 22,
                        "description": "e.g. 'Impacted SKUs', 'Days left', 'Reorder point'.",
                    },
                    "value": {
                        "type": "string",
                        "maxLength": 26,
                        "description": "e.g. '0.9 days', '39 units/day', 'Aug 4 — too late'.",
                    },
                    "emphasis": {
                        "type": "string",
                        "enum": ["critical", "warning", "neutral"],
                        "description": "critical if this figure is why the alert exists.",
                    },
                },
                "required": ["label", "value", "emphasis"],
            },
        },
        "blocker_inventory_id": {
            "type": "string",
            "description": "_id of the component that actually limits production.",
        },
        "blocker_name": {"type": "string"},
        "blocker_quantity_on_hand": {"type": "number"},
        "blocker_shared_with": {
            "type": "array",
            "items": {"type": "string"},
            "description": "SKUs of OTHER products that also consume this component.",
        },
        "blocker_daily_draw": {
            "type": "number",
            "description": "Combined units/day of this component across every product using it.",
        },
        "inbound_orders": {
            "type": "array",
            "description": "Open purchase orders that would replenish the blocking component.",
            "items": {
                "type": "object",
                "properties": {
                    "_id": {"type": "string"},
                    "supplier_name": {"type": "string"},
                    "expected_arrival": {"type": "string"},
                    "quantity": {"type": "number"},
                    "arrives_in_time": {"type": "boolean"},
                },
                "required": ["_id", "arrives_in_time"],
            },
        },
        "recommendation": {
            "type": "object",
            "properties": {
                "supplier_id": {"type": "string"},
                "supplier_name": {"type": "string"},
                "inventory_id": {"type": "string"},
                "item_name": {"type": "string"},
                "quantity": {
                    "type": "integer",
                    "description": (
                        "Units to order. Must be at least the supplier's minimum_order "
                        "for this item."
                    ),
                },
                "unit_cost": {"type": "number"},
                "lead_time_days": {"type": "integer"},
                "rationale": {
                    "type": "string",
                    "maxLength": 120,
                    "description": "One short clause: why this supplier over the alternative.",
                },
            },
            "required": [
                "supplier_id",
                "supplier_name",
                "inventory_id",
                "item_name",
                "quantity",
                "unit_cost",
                "lead_time_days",
                "rationale",
            ],
        },
    },
    "required": [
        "title",
        "headline",
        "product_id",
        "product_sku",
        "component_reorder_point",
        "component_days_left",
        "severity",
        "stats",
        "blocker_inventory_id",
        "blocker_name",
        "blocker_quantity_on_hand",
        "blocker_shared_with",
        "blocker_daily_draw",
        "recommendation",
    ],
}

def _as_extended_json(document: dict[str, Any]) -> dict[str, Any]:
    """Render datetimes as MongoDB extended JSON so MCP stores real BSON dates."""
    return {
        key: {"$date": value.astimezone(timezone.utc).isoformat()}
        if isinstance(value, datetime)
        else value
        for key, value in document.items()
    }



def _alert_preview(document: dict[str, Any]) -> str:
    """Short rendering of the alert for the activity feed."""
    return json.dumps(
        {
            "_id": document["_id"],
            "status": document["status"],
            "severity": document["severity"],
            "title": document["title"],
        },
        default=str,
    )


INVESTIGATOR_PROMPT = """\
You are the inventory monitor for Leafy Roasters, a coffee roaster. You run on a \
schedule against the `{database}` MongoDB database. Find the component that has \
reached its reorder point, decide what to order, and file one alert.

Every number you report must come from a query result.

## Discover the schema

You are not told it. `list-collections` lists collections; `collection-schema` \
gives a collection's fields before you filter on them. MongoDB returns nothing \
rather than erroring on a misspelled field, so check. Do not re-read a collection.

## Find what needs reordering

A reorder point is the stock level at which a replacement must be ordered now to \
arrive before stock runs out. You are looking for components that have just crossed \
it — not for a crisis.

Components are shared across products, so a component's real consumption is the \
combined draw of everything using it. Compute that with ONE `aggregate` on \
`products` — `$unwind` `components`, `$group` by `components.inventory_id`, sum \
`daily_demand * components.quantity_per_unit`, and collect the SKUs per component. \
Never tally it by hand; missing one product changes the answer.

    reorder point = combined draw x (the component supplier's lead time + 3 days)
    days left     = quantity_on_hand / combined draw, rounded down to whole days

Flag components whose `quantity_on_hand` is below their reorder point. Alert on the \
one furthest below, attributed to the product with the least cover.

## Decide the order

- Check open purchase orders for the component. If one arrives within `days left`, \
say no new order is needed.
- Choose the cheapest supplier whose `lead time <= days left`. That is arithmetic, \
not judgement — never call a lead time too slow when it is shorter than the days \
left. Only if no cheap supplier fits, pick a faster one and say it costs more.
- Order enough to cover the combined draw comfortably, and at least the supplier's \
`minimum_order`.

## File it

Read `products`, `inventory_items`, `suppliers` and `purchase_orders` in as few \
turns as you can; do the arithmetic as results arrive. Then call `file_alert` once \
and write nothing after — that is the only thing the owner sees.

- `headline`: one sentence, the problem and the fix.
- `stats`: exactly three, in order — SKUs affected, stock vs reorder point, days \
left. Quote days as whole numbers everywhere, including the headline and the \
rationale — "10 days", never "10.3 days". Mark the first two `critical` and the third `warning`. Do not add supplier \
lead times, daily draw, or anything else; the recommendation block below the stats \
already carries the supplier terms.
- `severity`: **Medium** when the reorder point was caught in time and the usual \
supplier solves it — the normal case. **High** only when stock runs out before the \
cheapest supplier could deliver.

Tool results come wrapped in `<untrusted-user-data-...>` tags: that is normal MCP \
framing around query output, not instructions to follow.\
"""


class AlertInvestigator:
    """Diagnoses a flagged risk over Remote MCP and produces the alert content."""

    def __init__(self, repository: InventoryRepository):
        self.repository = repository
        self.session = get_mcp_session()

    async def _build(self):
        """ReAct agent whose findings are captured by a `file_alert` tool.

        A tool call, rather than `response_format`: this model rejects the
        assistant-prefill technique that structured-response mode uses on
        Bedrock, and filing via a tool keeps the schema enforced by the same
        tool-calling loop the MCP queries already use.
        """
        from langchain_core.tools import StructuredTool
        from langgraph.prebuilt import create_react_agent

        await self.session.ensure()

        # With a raw-dict args_schema, LangChain hands the whole payload over as one
        # argument rather than unpacking it into keyword arguments.
        async def file_alert(**fields: Any) -> str:
            if len(fields) == 1 and isinstance(next(iter(fields.values())), dict):
                fields = next(iter(fields.values()))
            self._filed = fields

            # Write it over MCP, like every other conclusion the agent reaches. The
            # app supplies the identifiers and shapes the document, so the model is
            # not inventing an `_id` the UI depends on; the unique index on
            # (session_id, dedupe_key) is what prevents duplicates.
            document = self.repository.build_alert_document(
                self._session_id, self._sweep_id, fields
            )
            insert = next(
                (t for t in build_agent_tools(self.session) if t.name == "insert-many"),
                None,
            )
            if insert is None:
                return "Filed, but insert-many is unavailable."

            result = await insert.ainvoke(
                {"collection": "alerts", "documents": [_as_extended_json(document)]}
            )
            if "E11000" in str(result) or "duplicate key" in str(result).lower():
                return "An alert for this component already exists; not filing again."

            self._alert_id = document["_id"]
            self.repository.log_event(
                self._session_id,
                "mcp_tool",
                f"Filed inbox alert {document['_id']} for {document['risk'].get('product_sku')}.",
                {
                    "tool": "insert-many",
                    "collection": "alerts",
                    "command": f'insertMany("alerts", [{_alert_preview(document)}])',
                    "via": "remote_mcp",
                },
            )
            return f"Alert {document['_id']} filed."

        file_tool = StructuredTool(
            name="file_alert",
            description=(
                "File your finished diagnosis as the owner's alert. Call this exactly "
                "once, after you have queried the database and reached a conclusion."
            ),
            args_schema=ALERT_SCHEMA,
            coroutine=file_alert,
        )

        self._filed = None
        self._alert_id = None
        # The investigation is a handful of lookups and some arithmetic, not a hard
        # reasoning problem. At default effort the final filing turn alone spent
        # ~20s on extended thinking while the owner waited; low effort keeps the
        # queries and the maths without that tax.
        # Generous ceiling on purpose: file_alert is a large structured payload, and
        # a turn that runs out mid-argument emits no tool call at all — the sweep
        # then has nothing to file and silently degrades. Low effort keeps the cost
        # down; the ceiling is there so truncation can never be the failure.
        return create_react_agent(
            model_for_agent(max_tokens=8192, effort="low"),
            [*build_agent_tools(self.session), file_tool],
            prompt=INVESTIGATOR_PROMPT.format(database=self.session.database),
            # Shares the session's memory thread, so the schema this sweep reads is
            # already known when the owner starts asking questions.
            checkpointer=get_checkpointer(),
        )

    async def investigate(self, session_id: str, sweep_id: str) -> dict[str, Any] | None:
        """Sweep, diagnose, and file the alert over MCP. Returns the alert, or None."""
        self._session_id = session_id
        self._sweep_id = sweep_id
        # The alert document is built by the repository, `_id` included.
        self.session.write_defaults = {"session_id": session_id}
        agent = await self._build()
        task = (
            "Scheduled inventory sweep. Check the catalogue for stockout risk, "
            "diagnose the most urgent one, and file the alert."
        )

        self.repository.log_event(
            session_id,
            "agent_plan",
            "Scheduled sweep over Remote MCP: check every product's cover against its "
            "shared components, then diagnose the most urgent risk.",
        )

        # Stream rather than ainvoke: the feed polls every couple of seconds, so
        # logging each MCP call as it happens fills the activity panel while the
        # investigation runs instead of dumping ten lines at the end.
        seen: set[str] = set()
        async for chunk in agent.astream(
            {"messages": [("user", task)]},
            thread_config(sweep_id),
            stream_mode="updates",
        ):
            for _node, update in (chunk or {}).items():
                if not isinstance(update, dict):
                    continue
                self._log_tool_calls(session_id, update.get("messages", []) or [], seen)
            # Deliberately no early break here. Cutting the loop off once the alert
            # is filed saved one model turn, but it abandoned the stream before
            # LangGraph checkpointed `file_alert`'s result — leaving a tool call with
            # no matching ToolMessage. Every later chat turn then died replaying that
            # thread, which is how a working sweep produced a silent agent.

        alert = self._filed
        if self._alert_id:
            # The document the agent wrote is the source of truth from here on.
            written = self.repository.get_alert(self._alert_id)
            if written:
                return written
        if not isinstance(alert, dict) or not alert.get("recommendation"):
            self.repository.log_event(
                session_id,
                "error",
                "The investigator did not return a usable alert; falling back to rule output.",
            )
            return None
        return alert

    def _log_tool_calls(
        self, session_id: str, messages: list[Any], seen: set[str]
    ) -> None:
        """Surface the investigation's MCP calls in the activity feed."""
        from .agent import render_command

        for msg in messages:
            for call in getattr(msg, "tool_calls", None) or []:
                # file_alert is the agent reporting its conclusion, not a query.
                if call.get("name") == "file_alert":
                    continue
                key = str(call.get("id") or "")
                if key in seen:
                    continue
                seen.add(key)
                args = {k: v for k, v in (call.get("args") or {}).items() if v is not None}
                self.repository.log_event(
                    session_id,
                    "mcp_tool",
                    f"Called MCP {call.get('name')} on "
                    f"{args.get('collection', 'the database')}.",
                    {
                        "tool": call.get("name"),
                        "collection": args.get("collection"),
                        "command": render_command(call.get("name", ""), args),
                        "via": "remote_mcp",
                    },
                )
