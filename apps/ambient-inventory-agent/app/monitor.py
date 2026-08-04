"""Schedules one monitoring run. The diagnosis itself is the agent's.

There is no orchestration here on purpose: the sweep is a single agent doing the
whole job over Remote MCP, and that agent IS a LangGraph graph — `create_agent` in
`investigator.py` compiles one, streams from it, and checkpoints its memory to
MongoDB. This file only gives the run an identity and marks it finished.
"""

from __future__ import annotations

import asyncio
from typing import Any

from .memory import new_sweep_id
from .repository import InventoryRepository


class InventoryMonitor:
    """Runs the sweep and returns the alert the agent filed, or None."""

    def __init__(self, repository: InventoryRepository):
        self.repository = repository

    def run(self, session_id: str) -> dict[str, Any] | None:
        """Sweep, diagnose and file, synchronously.

        The agent owns the judgement entirely: it queries inventory itself, decides
        which component has reached its reorder point, works out why, and files the
        alert. There is no rule-based alternative — if it cannot complete, no alert
        is raised and the failure is surfaced in the feed rather than papered over
        with a fabricated one.
        """
        from .investigator import AlertInvestigator

        # The sweep gets an identity up front: it keys the agent's memory thread, and
        # the alert records it so a follow-up conversation on any device resumes the
        # investigation that produced it.
        sweep_id = new_sweep_id()
        try:
            alert = asyncio.run(
                AlertInvestigator(self.repository).investigate(session_id, sweep_id)
            )
        except Exception as exc:
            self.repository.log_event(
                session_id, "error", f"Alert investigation failed: {exc}"
            )
            alert = None

        self.repository.mark_monitor_ran(session_id)
        return alert
