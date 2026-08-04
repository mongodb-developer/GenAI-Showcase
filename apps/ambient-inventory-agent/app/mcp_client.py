from __future__ import annotations

import json
import os
from base64 import b64encode
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode, urljoin, urlparse

from dotenv import load_dotenv

load_dotenv()


@dataclass
class MCPStatus:
    configured: bool
    url: str | None
    reachable: bool
    tools: list[str]
    auth_method: str | None = None
    error: str | None = None


class RemoteMCPProbe:
    """Probe a Streamable HTTP MCP endpoint once credentials are configured."""

    def __init__(self) -> None:
        self.url = os.getenv("MDB_MCP_API_BASE_URL", "https://mcp-dev.mongodb.com")
        self.client_id = os.getenv("MDB_MCP_API_CLIENT_ID")
        self.client_secret = os.getenv("MDB_MCP_API_CLIENT_SECRET")

    def status(self) -> MCPStatus:
        if not self.url:
            return MCPStatus(configured=False, url=None, reachable=False, tools=[])

        try:
            import httpx
        except ImportError:
            return MCPStatus(
                configured=True,
                url=self.url,
                reachable=False,
                tools=[],
                error="Install httpx to probe the remote MCP endpoint.",
            )

        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=8.0, follow_redirects=True) as client:
                initialize = self._initialize(client, headers)
                if initialize.status_code == 401 and not headers.get("Authorization"):
                    token = self.service_account_token(client)
                    headers["Authorization"] = f"Bearer {token}"
                    initialize = self._initialize(client, headers)
                initialize.raise_for_status()
                session_id = initialize.headers.get("Mcp-Session-Id")
                if session_id:
                    headers["Mcp-Session-Id"] = session_id

                client.post(
                    self.url,
                    headers=headers,
                    json={
                        "jsonrpc": "2.0",
                        "method": "notifications/initialized",
                        "params": {},
                    },
                )
                tools_response = client.post(
                    self.url,
                    headers=headers,
                    json={
                        "jsonrpc": "2.0",
                        "id": 2,
                        "method": "tools/list",
                        "params": {},
                    },
                )
                tools_response.raise_for_status()
                payload = _decode_mcp_response(tools_response.text)
                tools = [
                    tool.get("name", "")
                    for tool in payload.get("result", {}).get("tools", [])
                    if tool.get("name")
                ]
                return MCPStatus(
                    configured=True,
                    url=self.url,
                    reachable=True,
                    tools=tools,
                    auth_method=self._auth_method(headers),
                )
        except Exception as exc:
            return MCPStatus(
                configured=True, url=self.url, reachable=False, tools=[], error=str(exc)
            )

    def _initialize(self, client: Any, headers: dict[str, str]) -> Any:
        return client.post(
            self.url,
            headers=headers,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {
                        "name": "ambient-inventory-agent",
                        "version": "0.1.0",
                    },
                },
            },
        )

    def _auth_method(self, headers: dict[str, str]) -> str | None:
        if self.client_id and self.client_secret and headers.get("Authorization"):
            return "oauth_client_credentials"
        return None

    def service_account_token(self, client: Any) -> str:
        """Trade the Atlas service-account id + secret for a 1-hour bearer token."""
        if not self.client_id or not self.client_secret:
            raise ValueError(
                "MCP endpoint requires auth. Set MDB_MCP_API_CLIENT_ID and "
                "MDB_MCP_API_CLIENT_SECRET."
            )

        credentials = b64encode(f"{self.client_id}:{self.client_secret}".encode())
        response = client.post(
            self._token_url(client),
            content=urlencode({"grant_type": "client_credentials"}),
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": f"Basic {credentials.decode()}",
            },
        )
        response.raise_for_status()

        access_token = response.json().get("access_token")
        if not access_token:
            raise ValueError("OAuth token response did not include access_token.")
        return access_token

    def _token_url(self, client: Any) -> str:
        """Get or discover the token URL."""
        cloud_token_url = self._cloud_token_url_from_mcp_url()
        if cloud_token_url:
            return cloud_token_url

        discovered = self._discover_token_url(client, self._unauthorized(client))
        if not discovered:
            raise ValueError(
                "Could not determine the Atlas token endpoint for the MCP server."
            )
        return discovered

    def _unauthorized(self, client: Any) -> Any:
        """The MCP server's 401, which names its authorization server."""
        return self._initialize(
            client,
            {
                "Accept": "application/json, text/event-stream",
                "Content-Type": "application/json",
            },
        )

    def _discover_token_url(
        self, client: Any, unauthorized_response: Any
    ) -> str | None:
        resource_metadata_url = _parse_resource_metadata_url(
            unauthorized_response.headers.get("WWW-Authenticate", "")
        )
        if resource_metadata_url:
            protected_resource = client.get(resource_metadata_url)
            protected_resource.raise_for_status()
            metadata = protected_resource.json()
            authorization_servers = metadata.get("authorization_servers", [])
            for authorization_server in authorization_servers:
                token_url = self._token_url_from_authorization_server(
                    client, authorization_server
                )
                if token_url:
                    return token_url

        return self._fallback_token_url(client)

    def _token_url_from_authorization_server(
        self, client: Any, authorization_server: str
    ) -> str | None:
        metadata_urls = []
        if ".well-known" in authorization_server:
            metadata_urls.append(authorization_server)
        else:
            base = authorization_server.rstrip("/") + "/"
            metadata_urls.append(
                urljoin(base, ".well-known/oauth-authorization-server")
            )
            metadata_urls.append(urljoin(base, ".well-known/openid-configuration"))

        for metadata_url in metadata_urls:
            response = client.get(metadata_url)
            if response.status_code >= 400:
                continue
            token_url = response.json().get("token_endpoint")
            if token_url:
                return token_url
        return None

    def _fallback_token_url(self, client: Any) -> str | None:
        parsed = urlparse(self.url or "")
        if not parsed.scheme or not parsed.netloc:
            return None
        origin = f"{parsed.scheme}://{parsed.netloc}"
        for metadata_path in [
            "/.well-known/oauth-authorization-server",
            "/.well-known/openid-configuration",
        ]:
            response = client.get(origin + metadata_path)
            if response.status_code >= 400:
                continue
            token_url = response.json().get("token_endpoint")
            if token_url:
                return token_url
        return None

    def _cloud_token_url_from_mcp_url(self) -> str | None:
        """`mcp-dev.mongodb.com` -> `cloud-dev.mongodb.com/api/oauth/token`.

        Derived rather than hardcoded per environment, so pointing
        MDB_MCP_API_BASE_URL at production picks up `cloud.mongodb.com` on its own.
        """
        hostname = urlparse(self.url or "").netloc
        if not hostname.startswith("mcp") or not hostname.endswith("mongodb.com"):
            return None
        return f"https://cloud{hostname[len('mcp'):]}/api/oauth/token"


def _decode_mcp_response(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("{"):
        return json.loads(stripped)

    for line in stripped.splitlines():
        if line.startswith("data:"):
            return json.loads(line.removeprefix("data:").strip())
    return {}


def _parse_resource_metadata_url(www_authenticate: str) -> str | None:
    marker = "resource_metadata="
    if marker not in www_authenticate:
        return None
    value = www_authenticate.split(marker, 1)[1].split(",", 1)[0].strip()
    if value.startswith('"') and value.endswith('"'):
        value = value[1:-1]
    return value or None
