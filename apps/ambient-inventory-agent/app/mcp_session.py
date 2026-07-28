"""Long-lived MongoDB Remote MCP session that backs the agent's tools.

The demo is MCP-only on purpose: every read and write the agent performs is a
real Remote MCP `tools/call`. If MCP is unreachable we surface the failure
instead of silently falling back to the driver, so the story on stage is never
a claim the code cannot back.

MCP data tools (`find`, `aggregate`, `insert-many`, ...) require a
`connectionId` returned by `remote-atlas-connect`. We perform that handshake
once at startup and inject the id into every tool call, so the model never has
to guess it.
"""

from __future__ import annotations

import asyncio
import os
import re
from typing import Any

import httpx
from dotenv import load_dotenv

from .mcp_client import RemoteMCPProbe

load_dotenv()

CONNECTION_ID_PATTERN = re.compile(
    r"connectionId is \"([0-9a-fA-F-]{36})\"|([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"
)

# Tools the agent is allowed to see. A trimmed surface keeps the model out of
# Atlas administration (drop-database, create-cluster, ...) and keeps the
# tool-choice prompt small enough to stay fast on stage.
#
# The discovery tools let the agent introspect the schema itself rather than
# trusting a hardcoded description that can drift from the database.
DISCOVERY_TOOL_NAMES = {"list-collections", "collection-schema", "collection-indexes"}

# Collections the agent may touch: the shop's own data, plus `alerts` because filing
# one is its job. Everything else in this database is app bookkeeping — session
# state, and the activity log that holds the agent's own transcript. Left visible,
# the agent wanders into them looking for context, and reading its own history back
# is a feedback loop worth preventing outright.
AGENT_COLLECTIONS = {
    "products",
    "inventory_items",
    "suppliers",
    "purchase_orders",
    "alerts",
}
DATA_TOOL_NAMES = {"find", "aggregate", "count", "insert-many", "update-many"}
AGENT_TOOL_NAMES = DISCOVERY_TOOL_NAMES | DATA_TOOL_NAMES


class MCPUnavailable(RuntimeError):
    """Raised when the Remote MCP server cannot be used."""



def _extract_connection_id(payload: Any) -> str | None:
    text = payload if isinstance(payload, str) else str(payload)
    match = CONNECTION_ID_PATTERN.search(text)
    if not match:
        return None
    return match.group(1) or match.group(2)


class MCPSession:
    """Holds the authenticated MCP tool set and the Atlas connectionId."""

    def __init__(self) -> None:
        self.probe = RemoteMCPProbe()
        self.project_id = os.getenv("MDB_MCP_PROJECT_ID", "").strip()
        self.cluster_name = os.getenv("MDB_MCP_CLUSTER_NAME", "Cluster0").strip()
        self.database = os.getenv("MONGODB_DATABASE", "ambient_inventory_agent")
        self.connection_id: str | None = None
        self.tools: list[Any] = []
        self.error: str | None = None
        # Cached list-collections / collection-schema / collection-indexes results,
        # keyed by (tool, collection). Cleared when the demo reseeds.
        self.discovery_cache: dict[tuple[str, str | None], str] = {}
        # Fields stamped onto every document the agent inserts. `session_id` is app
        # bookkeeping — the agent has no reliable way to know it, and copying it from
        # a sampled document silently attributes the write to the wrong session.
        self.write_defaults: dict[str, Any] = {}
        self._lock = asyncio.Lock()

    @property
    def ready(self) -> bool:
        return bool(self.connection_id and self.tools)

    def _fetch_token(self) -> str | None:
        """Client-credentials token via the probe's OAuth discovery (sync httpx)."""
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            initialize = self.probe._initialize(client, headers)
            if initialize.status_code == 401:
                return self.probe._get_oauth_token(client, initialize)
        return None

    async def connect(self) -> None:
        """Authenticate, load tools, and bind an Atlas connectionId."""
        async with self._lock:
            if self.ready:
                return

            if not self.probe.client_id or not self.probe.client_secret:
                raise MCPUnavailable(
                    "Remote MCP credentials are missing. Set MDB_MCP_API_CLIENT_ID and "
                    "MDB_MCP_API_CLIENT_SECRET in .env."
                )
            if not self.project_id:
                raise MCPUnavailable(
                    "MDB_MCP_PROJECT_ID is not set. MCP data tools need an Atlas project "
                    "and cluster to open a connection against."
                )

            try:
                from langchain_mcp_adapters.client import MultiServerMCPClient
            except ImportError as exc:  # pragma: no cover
                raise MCPUnavailable(
                    "Install langchain-mcp-adapters to expose MCP tools to the agent."
                ) from exc

            try:
                token = await asyncio.to_thread(self._fetch_token)
            except Exception as exc:
                raise MCPUnavailable(f"MCP OAuth failed: {exc}") from exc

            headers = {"Authorization": f"Bearer {token}"} if token else {}
            client = MultiServerMCPClient(
                {
                    "mongodb": {
                        "transport": "streamable_http",
                        "url": self.probe.url,
                        "headers": headers,
                    }
                }
            )

            try:
                all_tools = await client.get_tools()
            except Exception as exc:
                raise MCPUnavailable(f"Could not load MCP tools: {exc}") from exc

            by_name = {tool.name: tool for tool in all_tools}
            connect_tool = by_name.get("remote-atlas-connect")
            if not connect_tool:
                raise MCPUnavailable(
                    "Remote MCP server did not expose remote-atlas-connect."
                )

            try:
                result = await connect_tool.ainvoke(
                    {"projectId": self.project_id, "clusterName": self.cluster_name}
                )
            except Exception as exc:
                raise MCPUnavailable(f"remote-atlas-connect failed: {exc}") from exc

            connection_id = _extract_connection_id(result)
            if not connection_id:
                raise MCPUnavailable(
                    f"Could not read a connectionId from remote-atlas-connect: {str(result)[:200]}"
                )

            self.connection_id = connection_id
            self.tools = [
                tool for tool in all_tools if tool.name in AGENT_TOOL_NAMES
            ]
            self.error = None

    async def ensure(self) -> None:
        try:
            await self.connect()
        except MCPUnavailable as exc:
            self.error = str(exc)
            raise

    async def reconnect(self) -> None:
        """Drop the session and authenticate again.

        The OAuth token and the Atlas `connectionId` are both minted once at
        startup. A laptop that has been sitting open on stage for half an hour may
        be holding expired credentials, so the demo's start button reconnects
        rather than discovering that on its first query.
        """
        async with self._lock:
            self.connection_id = None
            self.tools = []
            self.error = None
        await self.ensure()

    async def warm_discovery(self, collections: list[str]) -> None:
        """Pre-fetch the discovery calls the agent makes on its first question.

        The agent still owns the decision to call these tools; warming just means
        the first answer on stage isn't paying for round trips the second one
        gets free.
        """
        if not self.ready:
            return
        by_name = {tool.name: tool for tool in self.tools}
        jobs: list[tuple[tuple[str, str | None], Any, dict[str, Any]]] = []
        base = {"connectionId": self.connection_id, "database": self.database}
        if "list-collections" in by_name:
            jobs.append((("list-collections", None), by_name["list-collections"], dict(base)))
        for collection in collections:
            for name in ("collection-schema", "collection-indexes"):
                if name in by_name:
                    jobs.append(
                        ((name, collection), by_name[name], {**base, "collection": collection})
                    )

        async def run(key, tool, payload):
            try:
                result = await tool.ainvoke(payload)
                self.discovery_cache[key] = (
                    result if isinstance(result, str) else str(result)
                )
            except Exception:
                # A warm-up miss is harmless: the agent will just call the tool.
                pass

        await asyncio.gather(*(run(*job) for job in jobs))

    # Deliberately no `call_tool` helper: MCP tools are for agents to choose, not
    # for application code to invoke directly. Anything the app needs to do itself
    # uses the driver, and says so in the activity feed.


    def status(self) -> dict[str, Any]:
        return {
            "configured": bool(self.probe.client_id and self.probe.client_secret),
            "url": self.probe.url,
            "ready": self.ready,
            "connection_id": self.connection_id,
            "cluster": self.cluster_name,
            "database": self.database,
            "tools": [tool.name for tool in self.tools],
            "error": self.error,
        }


_session: MCPSession | None = None


def get_mcp_session() -> MCPSession:
    global _session
    if _session is None:
        _session = MCPSession()
    return _session
