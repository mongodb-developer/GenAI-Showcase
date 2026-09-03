"""Metrics collection — tokens, latency, USD cost per run.

Reports tokens, wall-clock, and USD cost for cold / killed / resumed runs.
Cost per task is the unit the ecosystem currently reports (§6, Beat 3).

Pricing uses OpenAI gpt-4o as default; adjust MODEL_PRICING for other models.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

# USD per 1M tokens (input/output) — update for your model
MODEL_PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
}


@dataclass
class StageMetrics:
    """Metrics for a single pipeline stage."""

    name: str
    input_tokens: int = 0
    output_tokens: int = 0
    wall_clock_seconds: float = 0.0
    model: str = "gpt-4o"

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    @property
    def usd_cost(self) -> float:
        pricing = MODEL_PRICING.get(self.model, MODEL_PRICING["gpt-4o"])
        input_cost = (self.input_tokens / 1_000_000) * pricing["input"]
        output_cost = (self.output_tokens / 1_000_000) * pricing["output"]
        return input_cost + output_cost


@dataclass
class RunMetrics:
    """Aggregate metrics for a full pipeline run."""

    run_id: str
    run_type: str = "cold"  # cold | killed | resumed
    stages: list[StageMetrics] = field(default_factory=list)
    _start_time: float = 0.0

    def start(self) -> None:
        self._start_time = time.monotonic()

    @property
    def wall_clock_seconds(self) -> float:
        if self._start_time:
            return time.monotonic() - self._start_time
        return sum(s.wall_clock_seconds for s in self.stages)

    @property
    def total_tokens(self) -> int:
        return sum(s.total_tokens for s in self.stages)

    @property
    def total_usd(self) -> float:
        return sum(s.usd_cost for s in self.stages)

    @property
    def stages_executed(self) -> int:
        return len(self.stages)

    def add_stage(self, stage: StageMetrics) -> None:
        self.stages.append(stage)

    def report(self) -> str:
        """Human-readable metrics report."""
        lines = [
            f"Run: {self.run_id} ({self.run_type})",
            f"  Stages executed: {self.stages_executed}",
            f"  Total tokens:    {self.total_tokens:,}",
            f"  Total cost:      ${self.total_usd:.4f}",
            f"  Wall clock:      {self.wall_clock_seconds:.1f}s",
            "",
        ]
        for s in self.stages:
            lines.append(
                f"  {s.name}: {s.total_tokens:,} tokens, "
                f"${s.usd_cost:.4f}, {s.wall_clock_seconds:.1f}s"
            )
        return "\n".join(lines)


def compare_runs(runs: list[RunMetrics]) -> str:
    """Compare metrics across cold/killed/resumed runs."""
    lines = ["=" * 60, "Run Comparison", "=" * 60, ""]
    header = f"{'Run':<25} {'Type':<10} {'Tokens':>10} {'Cost':>10} {'Time':>8}"
    lines.append(header)
    lines.append("-" * 60)
    for r in runs:
        lines.append(
            f"{r.run_id:<25} {r.run_type:<10} "
            f"{r.total_tokens:>10,} ${r.total_usd:>8.4f} "
            f"{r.wall_clock_seconds:>7.1f}s"
        )

    if len(runs) >= 2:
        cold = next((r for r in runs if r.run_type == "cold"), None)
        resumed = next((r for r in runs if r.run_type == "resumed"), None)
        if cold and resumed:
            saved_tokens = cold.total_tokens - resumed.total_tokens
            saved_usd = cold.total_usd - resumed.total_usd
            lines.append("")
            lines.append(f"Resume saved: {saved_tokens:,} tokens, ${saved_usd:.4f}")

    return "\n".join(lines)
