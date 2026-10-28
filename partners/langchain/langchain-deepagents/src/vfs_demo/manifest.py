"""Run receipt — the manifest that makes resume auditable.

The manifest records what woke the pipeline up, what state it inherited,
what authority it used, what executed, and what evidence survived.

Schema follows Govindarajan's AIEWF "Your Agent Didn't Fail. Your Harness Did."
talk — see plan §4.4.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

from langchain_mongodb_deepagents_vfs import AdapterError


@dataclass
class StageRecord:
    """One stage in the pipeline execution."""

    name: str
    status: str = "pending"  # pending | in_progress | complete | failed
    output: str | None = None
    tokens: int = 0
    usd: float = 0.0
    started_at: str | None = None
    completed_at: str | None = None
    error: str | None = None

    def mark_started(self) -> None:
        self.status = "in_progress"
        self.started_at = datetime.now(timezone.utc).isoformat()

    def mark_complete(self, tokens: int = 0, usd: float = 0.0) -> None:
        self.status = "complete"
        self.tokens = tokens
        self.usd = usd
        self.completed_at = datetime.now(timezone.utc).isoformat()

    def mark_failed(self, error: str) -> None:
        self.status = "failed"
        self.error = error
        self.completed_at = datetime.now(timezone.utc).isoformat()


@dataclass
class Manifest:
    """Run receipt persisted to workspace/<run_id>/manifest.json."""

    run_id: str
    question: str
    woke_up_by: str = ""
    inherited_state: str = ""
    authority: dict[str, str] = field(
        default_factory=lambda: {"corpus": "read-only", "workspace": "read-write"}
    )
    stages: list[StageRecord] = field(default_factory=list)
    evidence: list[str] = field(default_factory=list)

    @classmethod
    def new(
        cls,
        run_id: str,
        question: str,
        woke_up_by: str,
        stage_names: list[str],
    ) -> Manifest:
        """Create a fresh manifest with all stages pending."""
        stages = []
        for name in stage_names:
            output = f"findings/{name}.md" if name != "writer" else "memo.md"
            stages.append(StageRecord(name=name, output=output))
        return cls(
            run_id=run_id,
            question=question,
            woke_up_by=woke_up_by,
            stages=stages,
        )

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Manifest:
        """Reconstruct a manifest from a parsed JSON dict."""
        stages = [StageRecord(**s) for s in data.get("stages", [])]
        return cls(
            run_id=data["run_id"],
            question=data["question"],
            woke_up_by=data.get("woke_up_by", ""),
            inherited_state=data.get("inherited_state", ""),
            authority=data.get("authority", {}),
            stages=stages,
            evidence=data.get("evidence", []),
        )

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2)

    def pending_stages(self) -> list[StageRecord]:
        """Return stages that have not completed (pending or failed)."""
        return [s for s in self.stages if s.status not in ("complete",)]

    def completed_stages(self) -> list[StageRecord]:
        return [s for s in self.stages if s.status == "complete"]

    def update_evidence(self) -> None:
        """Rebuild the evidence list from completed stages."""
        self.evidence = [
            s.output for s in self.stages if s.status == "complete" and s.output
        ]

    def describe_inherited_state(self, existing_files: list[str]) -> None:
        """Record what files existed at startup — makes resume auditable."""
        if existing_files:
            self.inherited_state = (
                f"workspace/{self.run_id}/ "
                f"({len(existing_files)} findings present at start)"
            )
        else:
            self.inherited_state = f"workspace/{self.run_id}/ (empty)"


def save_manifest(backend: Any, run_id: str, manifest: Manifest) -> None:
    """Write the manifest to the workspace via the backend."""
    path = f"workspace/{run_id}/manifest.json"
    result = backend.write(path, manifest.to_json())
    if result.error:
        raise RuntimeError(f"Failed to save manifest: {result.error}")


def load_manifest(backend: Any, run_id: str) -> Manifest | None:
    """Load a manifest from the workspace, or None if not found."""
    path = f"workspace/{run_id}/manifest.json"
    try:
        result = backend.read(path)
    except AdapterError:
        # debug=True re-raises on not-found — expected for fresh runs
        return None
    if result.error:
        return None
    data = json.loads(result.file_data["content"])
    return Manifest.from_dict(data)
