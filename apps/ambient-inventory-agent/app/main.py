from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .agent import CoffeeInventoryAgent
from .db import get_database
from .demo_data import ensure_indexes, ensure_validators, seed_demo_data
from .graph import InventoryMonitorGraph
from .mcp_session import MCPUnavailable, get_mcp_session
from .memory import close_checkpointer
from .repository import InventoryRepository

STATIC_DIR = Path(__file__).parent / "static"
scheduled_tasks: dict[str, asyncio.Task] = {}


class SessionRequest(BaseModel):
    session_id: str | None = None


class ChatRequest(BaseModel):
    session_id: str
    alert_id: str
    message: str


class AlertRequest(BaseModel):
    session_id: str
    alert_id: str


def alert_delay_seconds() -> int:
    return int(os.getenv("DEMO_ALERT_DELAY_SECONDS", "20"))


def repository() -> InventoryRepository:
    return InventoryRepository(get_database())


def monitor_graph() -> InventoryMonitorGraph:
    return InventoryMonitorGraph(repository())


async def delayed_monitor(session_id: str, delay_seconds: int) -> None:
    await asyncio.sleep(delay_seconds)
    repo = repository()
    if repo.active_alert_for_session(session_id):
        return
    await asyncio.to_thread(monitor_graph().run, session_id)


def schedule_monitor_once(session_id: str) -> None:
    """Start the sweep for this session, at most once.

    A page reload re-hits this endpoint, so guard on all three states: an alert
    already raised, a sweep still running, and a sweep that has already completed
    (including one that failed — re-running it silently would double the MCP work
    and could produce a second alert).
    """
    repo = repository()
    if repo.active_alert_for_session(session_id):
        return
    task = scheduled_tasks.get(session_id)
    if task and not task.done():
        return
    if repo.monitor_has_run(session_id):
        return
    repo.mark_monitor_scheduled(session_id)
    scheduled_tasks[session_id] = asyncio.create_task(
        delayed_monitor(session_id, alert_delay_seconds())
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = get_database()
    if os.getenv("DEMO_SEED_ON_START", "true").lower() == "true":
        seed_demo_data(db, reset=False)
    ensure_indexes(db)
    ensure_validators(db)

    # Open the Remote MCP session up front: the OAuth + remote-atlas-connect
    # handshake takes a few seconds, and paying it on the first chat message
    # would show up as dead air on stage. Failures are surfaced, not swallowed.
    try:
        session = get_mcp_session()
        await session.ensure()
        print("[mcp] connected:", session.status()["tools"])
        await session.warm_discovery(
            ["products", "inventory_items", "suppliers", "purchase_orders"]
        )
        print(f"[mcp] discovery warmed: {len(session.discovery_cache)} entries")
    except MCPUnavailable as exc:
        print(f"[mcp] UNAVAILABLE: {exc}")

    yield
    for task in scheduled_tasks.values():
        task.cancel()
    close_checkpointer()


app = FastAPI(title="Ambient Inventory Agent", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# StaticFiles sends an ETag but no Cache-Control, so a browser may reuse app.js without
# revalidating — which shows up as a UI change that "didn't work" until a hard reload.
# Not worth debugging twice, and this demo serves three small files to one laptop.
@app.middleware("http")
async def no_store_static(request: Request, call_next):
    response = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-store, must-revalidate"
    return response


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health() -> dict:
    """Report component health without throwing: the UI renders this as a banner."""
    db = get_database()
    try:
        db.command("ping")
        mongodb_ok, mongodb_error = True, None
    except Exception as exc:
        mongodb_ok, mongodb_error = False, str(exc)

    mcp = get_mcp_session().status()
    return {
        "ok": mongodb_ok and mcp["ready"],
        "mongodb": {"ok": mongodb_ok, "database": db.name, "error": mongodb_error},
        "mcp": mcp,
        "model": os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-5"),
    }


@app.post("/api/demo/session")
async def create_session(payload: SessionRequest) -> dict:
    session_id = payload.session_id or f"session_{uuid4().hex[:10]}"
    repo = repository()
    session = repo.ensure_session(session_id)
    return {"session_id": session_id, "session": session}


@app.post("/api/demo/start")
async def start_demo(_: SessionRequest) -> dict:
    """Start the sweep. Seed separately, before the laptop goes on stage.

    Deliberately does not reseed: `python seed_demo.py --reset` is a pre-flight
    step, so pressing this is fast and the start screen is on display for seconds
    rather than minutes.

    The MCP session is re-minted rather than reused: the laptop may have sat on the
    podium for a long time before anyone spoke, and a stale OAuth token would
    otherwise surface as a failure on the agent's first query.
    """
    for task in scheduled_tasks.values():
        task.cancel()
    scheduled_tasks.clear()

    try:
        await get_mcp_session().reconnect()
    except MCPUnavailable as exc:
        raise HTTPException(
            status_code=503, detail=f"Remote MCP is not available: {exc}"
        ) from exc

    # A fresh session id, so a previous run's alert and transcript stay behind.
    session_id = f"session_{uuid4().hex[:10]}"
    repository().ensure_session(session_id)
    schedule_monitor_once(session_id)
    return {"session_id": session_id, "started": True}


@app.post("/api/monitor/run")
async def run_monitor(payload: SessionRequest) -> dict:
    """Run a sweep synchronously — useful for rehearsing without reloading."""
    session_id = payload.session_id or f"session_{uuid4().hex[:10]}"
    repo = repository()
    repo.ensure_session(session_id)
    alert = await asyncio.to_thread(monitor_graph().run, session_id)
    return {"session_id": session_id, "alert": alert}


@app.get("/api/state")
def get_state(session_id: str) -> dict:
    repo = repository()
    repo.ensure_session(session_id)
    snapshot = repo.state_snapshot(session_id)
    snapshot["mcp"] = get_mcp_session().status()
    return snapshot


@app.post("/api/alerts/open")
def open_alert(payload: AlertRequest) -> dict:
    repo = repository()
    alert = repo.get_alert(payload.alert_id)
    if not alert or alert["session_id"] != payload.session_id:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert["status"] == "New":
        alert = repo.update_alert_status(payload.alert_id, "Opened")
    return {"alert": alert}


@app.post("/api/chat")
async def chat(payload: ChatRequest) -> StreamingResponse:
    """Stream the agent's reasoning, MCP tool calls, and answer as SSE."""
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")

    agent = CoffeeInventoryAgent(repository())

    async def event_stream():
        try:
            async for event in agent.stream(
                payload.session_id, payload.alert_id, payload.message.strip()
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except ValueError as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/purchase_orders/submit")
def submit_order(payload: AlertRequest) -> dict:
    repo = repository()
    try:
        purchase_order, created = repo.place_order_directly(
            payload.session_id, payload.alert_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    # The transcript entry is written by confirm_purchase_order, and only on the
    # request that actually created the order — so a double-click cannot repeat it.
    return {
        "purchase_order": purchase_order,
        "created": created,
        "state": repo.state_snapshot(payload.session_id),
    }
