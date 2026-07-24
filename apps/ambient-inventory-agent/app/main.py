from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .agent import CoffeeInventoryAgent
from .db import get_database
from .demo_data import ensure_indexes, seed_demo_data
from .graph import InventoryMonitorGraph
from .mcp_client import RemoteMCPProbe
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
    repo = repository()
    if repo.active_alert_for_session(session_id):
        return
    task = scheduled_tasks.get(session_id)
    if task and not task.done():
        return
    repo.mark_monitor_scheduled(session_id)
    scheduled_tasks[session_id] = asyncio.create_task(delayed_monitor(session_id, alert_delay_seconds()))


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = get_database()
    if os.getenv("DEMO_SEED_ON_START", "true").lower() == "true":
        seed_demo_data(db, reset=False)
    ensure_indexes(db)
    yield
    for task in scheduled_tasks.values():
        task.cancel()


app = FastAPI(title="Ambient Inventory Agent", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health() -> dict:
    db = get_database()
    db.command("ping")
    return {"ok": True, "database": db.name}


@app.post("/api/demo/session")
async def create_session(payload: SessionRequest) -> dict:
    session_id = payload.session_id or f"session_{uuid4().hex[:10]}"
    repo = repository()
    session = repo.ensure_session(session_id)
    schedule_monitor_once(session_id)
    return {"session_id": session_id, "session": session, "delay_seconds": alert_delay_seconds()}


@app.post("/api/demo/reset")
async def reset_demo() -> dict:
    for task in scheduled_tasks.values():
        task.cancel()
    scheduled_tasks.clear()
    seed_demo_data(get_database(), reset=True)
    session_id = f"session_{uuid4().hex[:10]}"
    repo = repository()
    repo.ensure_session(session_id)
    schedule_monitor_once(session_id)
    return {"session_id": session_id, "delay_seconds": alert_delay_seconds()}


@app.post("/api/monitor/run")
async def run_monitor(payload: SessionRequest) -> dict:
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
    probe = RemoteMCPProbe()
    snapshot["mcp"] = {"configured": bool(probe.url), "url": probe.url}
    return snapshot


@app.get("/api/mcp/status")
def mcp_status() -> dict:
    status = RemoteMCPProbe().status()
    return {
        "configured": status.configured,
        "url": status.url,
        "reachable": status.reachable,
        "tools": status.tools,
        "auth_method": status.auth_method,
        "error": status.error,
    }


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
def chat(payload: ChatRequest) -> dict:
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")
    agent = CoffeeInventoryAgent(repository())
    try:
        return agent.respond(payload.session_id, payload.alert_id, payload.message.strip())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/purchase_orders/submit")
def submit_order(payload: AlertRequest) -> dict:
    repo = repository()
    try:
        purchase_order = repo.submit_recommended_order(payload.session_id, payload.alert_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    repo.add_chat_message(
        payload.session_id,
        "agent",
        f"Submitted supplier purchase order {purchase_order['_id']} with confirmation {purchase_order['confirmation_id']}.",
        payload.alert_id,
    )
    return {"purchase_order": purchase_order, "state": repo.state_snapshot(payload.session_id)}
