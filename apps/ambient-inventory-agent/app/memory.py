"""Short-term agent memory, checkpointed to MongoDB.

A new agent is constructed for every chat message, so without a checkpointer the
model starts each turn blank and re-runs the discovery queries it already ran.
LangGraph's MongoDB checkpointer persists the real conversation state — messages,
tool calls, and tool results — keyed by a thread id, and reloads it on the next
turn. So the agent's working memory lives in the same database it queries.

This replaces reconstructing history by hand from the activity log. The log is
still the record we render and audit; this is what the model actually resumes
from, and it keeps the tool results rather than a summary of them.
"""

from __future__ import annotations

import os
from typing import Any
from uuid import uuid4

from dotenv import load_dotenv

load_dotenv()

_saver: Any | None = None
_saver_cm: Any | None = None


def get_checkpointer() -> Any | None:
    """Process-wide MongoDB checkpointer, or None if unavailable.

    Returning None rather than raising is deliberate: losing memory degrades the
    demo (the agent re-queries) but should not break a conversation.
    """
    global _saver, _saver_cm
    if _saver is not None:
        return _saver

    try:
        from langgraph.checkpoint.mongodb import MongoDBSaver
    except ImportError:
        return None

    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    database = os.getenv("MONGODB_DATABASE", "ambient_inventory_agent")
    try:
        # from_conn_string is a context manager; hold it open for the process so
        # the same client and collections are reused across turns.
        _saver_cm = MongoDBSaver.from_conn_string(uri, db_name=database)
        _saver = _saver_cm.__enter__()
    except Exception:
        _saver, _saver_cm = None, None
        return None
    return _saver


def close_checkpointer() -> None:
    """Release the checkpointer's client on shutdown."""
    global _saver, _saver_cm
    if _saver_cm is not None:
        try:
            _saver_cm.__exit__(None, None, None)
        except Exception:
            pass
    _saver, _saver_cm = None, None


def new_sweep_id() -> str:
    """Identity for one monitoring run, and for the conversation it leads to."""
    return f"sweep_{uuid4().hex[:12]}"


def thread_config(sweep_id: str) -> dict[str, Any]:
    """One memory thread per sweep.

    The sweep is the investigation; the alert is what it publishes; the owner's
    follow-up questions continue that same investigation. Anchoring memory to the
    sweep rather than the alert means the thread already exists while the sweep is
    working, so whatever the monitor discovered is there when the first question
    arrives — and if a sweep ever filed two alerts, both conversations would
    inherit its reasoning instead of re-deriving it.

    The alert records its `sweep_id`, so any device opening that alert resumes the
    same thread. Memory lives in MongoDB, so it is not tied to a browser.
    """
    return {"configurable": {"thread_id": sweep_id}}
