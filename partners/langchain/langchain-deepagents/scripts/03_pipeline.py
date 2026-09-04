"""Beat 2 — Multi-agent pipeline with shared workspace.

Four sub-agents search a read-only corpus and write findings to a durable
workspace. A writer reads those findings by exact path and produces a memo.

Usage:
    python scripts/03_pipeline.py --run-id aircleaners-001
    python scripts/03_pipeline.py --run-id aircleaners-002 --kill-after 2

The --kill-after flag sends SIGKILL after N stages complete, simulating
a crash. Use 04_resume.py to pick up where it left off.
"""

from __future__ import annotations

import argparse
import os
import signal
import sys
import time

from dotenv import load_dotenv
from langchain_mongodb_deepagents_vfs import AdapterError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from vfs_demo.agents import (
    STAGE_NAMES,
    STAGE_OUTPUT_PATHS,
    STAGE_SUBAGENTS,
    create_coordinator,
)
from vfs_demo.backend import create_backend
from vfs_demo.manifest import Manifest, load_manifest, save_manifest
from vfs_demo.metrics import RunMetrics, StageMetrics

load_dotenv()

QUESTION = (
    "Did DOE adopt what the Joint Stakeholders proposed, "
    "and do the energy-savings numbers agree?"
)


def run_pipeline(run_id: str, kill_after: int | None = None) -> None:
    print("=" * 64)
    print(f"Pipeline: {run_id}")
    print(f"Question: {QUESTION}")
    if kill_after:
        print(f"Will SIGKILL after {kill_after} stage(s)")
    print("=" * 64)

    with create_backend() as backend:
        # Check for existing manifest (resume case)
        manifest = load_manifest(backend, run_id)
        if manifest:
            print(f"\nFound existing manifest for {run_id}")
            completed = manifest.completed_stages()
            print(f"  Completed stages: {[s.name for s in completed]}")
            pending = manifest.pending_stages()
            print(f"  Pending stages: {[s.name for s in pending]}")
        else:
            print(f"\nFresh run: {run_id}")
            manifest = Manifest.new(
                run_id=run_id,
                question=QUESTION,
                woke_up_by=f"cli:03_pipeline.py --run-id {run_id}",
                stage_names=STAGE_NAMES,
            )

        # Check what files already exist in workspace
        existing = []
        try:
            ls_result = backend.ls(f"workspace/{run_id}/")
            if not ls_result.error and ls_result.entries:
                existing = [e["path"] for e in ls_result.entries if not e.get("is_dir")]
        except AdapterError:
            pass  # debug=True re-raises on empty prefix — expected for fresh runs
        manifest.describe_inherited_state(existing)

        # Write initial manifest
        save_manifest(backend, run_id, manifest)

        # Write the plan
        plan_path = f"workspace/{run_id}/plan.md"
        plan_content = f"# Research Plan\n\n**Question:** {QUESTION}\n\n"
        plan_content += "## Stages\n\n"
        for stage in STAGE_NAMES:
            plan_content += f"- {stage}: {STAGE_OUTPUT_PATHS[stage]}\n"
        backend.write(plan_path, plan_content)

        # Create the coordinator agent
        coordinator = create_coordinator(backend)

        # Run metrics
        run_metrics = RunMetrics(run_id=run_id, run_type="cold")
        run_metrics.start()

        stages_completed = 0

        for stage in manifest.stages:
            if stage.status == "complete":
                print(f"\n  Skipping {stage.name} (already complete)")
                stages_completed += 1
                continue

            print(f"\n  Running stage: {stage.name}...")
            stage.mark_started()
            save_manifest(backend, run_id, manifest)

            t0 = time.monotonic()
            output_path = f"workspace/{run_id}/{STAGE_OUTPUT_PATHS[stage.name]}"
            subagent_name = STAGE_SUBAGENTS[stage.name]

            # Build the task instruction for the coordinator
            if stage.name == "writer":
                task_msg = (
                    f"Use the '{subagent_name}' sub-agent. "
                    f"Read the findings from "
                    f"workspace/{run_id}/findings/proposal.md, "
                    f"workspace/{run_id}/findings/adopted.md, and "
                    f"workspace/{run_id}/findings/numbers.md. "
                    f"Write the final memo to {output_path}."
                )
            else:
                task_msg = (
                    f"Use the '{subagent_name}' sub-agent to search the "
                    f"corpus and write findings to {output_path}."
                )

            try:
                result = coordinator.invoke(
                    {"messages": task_msg},
                )

                elapsed = time.monotonic() - t0

                # Log agent messages for debugging
                if "messages" in result:
                    for msg in result["messages"][-3:]:
                        role = type(msg).__name__
                        content = str(msg.content)[:200]
                        print(f"      [{role}] {content}")

                # Extract token usage from result if available
                tokens = 0
                usage = {}
                if hasattr(result, "get"):
                    usage = result.get("usage", {})
                    tokens = usage.get("total_tokens", 0)

                stage_metrics = StageMetrics(
                    name=stage.name,
                    input_tokens=usage.get("input_tokens", 0)
                    if isinstance(usage, dict)
                    else 0,
                    output_tokens=usage.get("output_tokens", 0)
                    if isinstance(usage, dict)
                    else 0,
                    wall_clock_seconds=elapsed,
                )
                run_metrics.add_stage(stage_metrics)

                # Verify the output file was written
                try:
                    verify = backend.read(output_path)
                except AdapterError:
                    verify = None
                if verify is None or verify.error:
                    err = verify.error if verify else "file not found"
                    stage.mark_failed(f"Output not written: {err}")
                    print(f"    FAILED: output not written at {output_path}")
                elif verify.file_data and verify.file_data[
                    "content"
                ].strip().startswith("NOT FOUND"):
                    stage.mark_failed("Agent wrote NOT FOUND — search failed")
                    print(f"    FAILED: agent could not find content for {stage.name}")
                else:
                    stage.mark_complete(
                        tokens=stage_metrics.total_tokens,
                        usd=stage_metrics.usd_cost,
                    )
                    print(f"    Complete: {output_path} ({elapsed:.1f}s)")

            except Exception as e:
                stage.mark_failed(str(e))
                print(f"    FAILED: {e}")

            manifest.update_evidence()
            save_manifest(backend, run_id, manifest)

            stages_completed += 1

            # Kill test: SIGKILL after N stages
            if kill_after and stages_completed >= kill_after:
                print(f"\n  --kill-after {kill_after}: sending SIGKILL")
                save_manifest(backend, run_id, manifest)
                os.kill(os.getpid(), signal.SIGKILL)

        # Final report
        print("\n" + "=" * 64)
        print("Pipeline complete")
        print("=" * 64)
        print(f"\nManifest: workspace/{run_id}/manifest.json")
        print(f"Evidence: {manifest.evidence}")
        print(f"\n{run_metrics.report()}")

        # Save final manifest
        save_manifest(backend, run_id, manifest)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the multi-agent pipeline")
    parser.add_argument("--run-id", required=True, help="Unique run identifier")
    parser.add_argument(
        "--kill-after",
        type=int,
        default=None,
        help="SIGKILL after N stages complete (for kill test)",
    )
    args = parser.parse_args()
    run_pipeline(args.run_id, args.kill_after)


if __name__ == "__main__":
    main()
