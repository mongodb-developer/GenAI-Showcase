"""Atlas service-account authentication for MongoDB Remote MCP.

The agent holds no database username or password. It holds an Atlas service
account — a client id and secret, the same credential a CI job would use — and
trades it for a one-hour bearer token via a standard OAuth 2.0
`client_credentials` grant. That token authorizes every MCP tool call, so access
is exactly what the service account is granted in the Atlas project.

`service_account_token()` is the whole exchange.
"""

from __future__ import annotations

import os
from base64 import b64encode
from typing import Any
from urllib.parse import urlencode, urlparse

from dotenv import load_dotenv

load_dotenv()


class RemoteMCPAuth:
    """Credentials and token endpoint for the Remote MCP server."""

    def __init__(self) -> None:
        self.url = os.getenv("MDB_MCP_API_BASE_URL", "https://mcp-dev.mongodb.com")
        self.client_id = os.getenv("MDB_MCP_API_CLIENT_ID")
        self.client_secret = os.getenv("MDB_MCP_API_CLIENT_SECRET")

    def service_account_token(self, client: Any) -> str:
        """Trade the Atlas service-account id + secret for a 1-hour bearer token."""
        if not self.client_id or not self.client_secret:
            raise ValueError(
                "MCP endpoint requires auth. Set MDB_MCP_API_CLIENT_ID and "
                "MDB_MCP_API_CLIENT_SECRET."
            )

        credentials = b64encode(f"{self.client_id}:{self.client_secret}".encode())
        response = client.post(
            self.token_url(),
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

    def token_url(self) -> str:
        """`mcp-dev.mongodb.com` -> `cloud-dev.mongodb.com/api/oauth/token`.

        Derived rather than hardcoded per environment, so pointing
        MDB_MCP_API_BASE_URL at production picks up `cloud.mongodb.com` on its own.
        Set MDB_MCP_TOKEN_URL to override for a non-Atlas-hosted endpoint.
        """
        override = os.getenv("MDB_MCP_TOKEN_URL")
        if override:
            return override

        hostname = urlparse(self.url or "").netloc
        if not hostname.startswith("mcp") or not hostname.endswith("mongodb.com"):
            raise ValueError(
                f"Cannot derive an Atlas token endpoint from {self.url!r}. "
                "Set MDB_MCP_TOKEN_URL."
            )
        return f"https://cloud{hostname[len('mcp'):]}/api/oauth/token"
