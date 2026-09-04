"""Beat 3 — Resume a killed pipeline run.

Reads the manifest from workspace/<run_id>/manifest.json, identifies
which stages completed before the kill, and runs only the remaining ones.

Usage:
    python scripts/04_resume.py --run-id aircleaners-002

Gate: resumed run skips completed stages and produces the same memo.
"""

from __future__ import annotations

import argparse
import os
import sys
import time

from dotenv import load_dotenv
from langchain_mongodb_deepagents_vfs import AdapterError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from vfs_demo.agents import (
    STAGE_OUTPUT_PATHS,
    STAGE_SUBAGENTS,
    create_coordinator,
)
from vfs_demo.backend import create_backend
from vfs_demo.manifest import load_manifest, save_manifest
from vfs_demo.metrics import RunMetrics, StageMetrics

load_dotenv()


def resume_pipeline(run_id: str) -> None:
    print("=" * 64)
    print(f"Resuming pipeline: {run_id}")
    print("=" * 64)

    with create_backend() as backend:
        # Load manifest — must exist for a resume
        manifest = load_manifest(backend, run_id)
        if not manifest:
            print(f"ERROR: no manifest found for run_id={run_id}")
            print(f"  Expected: workspace/{run_id}/manifest.json")
            print("  Run 03_pipeline.py first to start a run.")
            sys.exit(1)

        print(f"\nQuestion: {manifest.question}")
        print(f"Woke up by: {manifest.woke_up_by}")

        completed = manifest.completed_stages()
        pending = manifest.pending_stages()
        print(f"\nCompleted stages ({len(completed)}):")
        for s in completed:
            print(f"  {s.name}: {s.output} ({s.tokens:,} tokens, ${s.usd:.4f})")
        print(f"\nPending stages ({len(pending)}):")
        for s in pending:
            print(f"  {s.name}: {s.output}")

        if not pending:
            print("\nAll stages already complete — nothing to resume.")
            return

        # Check what evidence survived the kill
        existing = []
        try:
            ls_result = backend.ls(f"workspace/{run_id}/")
            if not ls_result.error and ls_result.entries:
                existing = [e["path"] for e in ls_result.entries if not e.get("is_dir")]
        except AdapterError:
            pass  # debug=True re-raises on empty prefix
        print(f"\nFiles surviving in workspace: {len(existing)}")
        for f in existing:
            print(f"  {f}")

        # Update manifest with inherited state
        manifest.inherited_state = (
            f"workspace/{run_id}/ "
            f"({len(completed)} stages complete, "
            f"{len(existing)} files present at resume)"
        )
        manifest.woke_up_by = f"cli:04_resume.py --run-id {run_id}"
        save_manifest(backend, run_id, manifest)

        # Create coordinator
        coordinator = create_coordinator(backend)

        # Run metrics for the resumed portion
        run_metrics = RunMetrics(run_id=run_id, run_type="resumed")
        run_metrics.start()

        for stage in manifest.stages:
            if stage.status == "complete":
                print(f"\n  Skipping {stage.name} (already complete)")
                continue

            print(f"\n  Running stage: {stage.name}...")
            stage.mark_started()
            save_manifest(backend, run_id, manifest)

            t0 = time.monotonic()
            output_path = f"workspace/{run_id}/{STAGE_OUTPUT_PATHS[stage.name]}"
            subagent_name = STAGE_SUBAGENTS[stage.name]

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
                result = coordinator.invoke({"messages": task_msg})
                elapsed = time.monotonic() - t0

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

        # Final report
        print("\n" + "=" * 64)
        print("Resume complete")
        print("=" * 64)
        print(f"\nManifest: workspace/{run_id}/manifest.json")
        print(f"Evidence: {manifest.evidence}")
        print(f"\n{run_metrics.report()}")

        # Read and display the memo
        memo_path = f"workspace/{run_id}/memo.md"
        try:
            memo_result = backend.read(memo_path)
            if not memo_result.error and memo_result.file_data:
                print("\n" + "=" * 64)
                print("MEMO")
                print("=" * 64)
                print(memo_result.file_data["content"])
        except AdapterError:
            print("\nWARNING: memo not found — pipeline may not have completed")


def main() -> None:
    parser = argparse.ArgumentParser(description="Resume a killed pipeline run")
    parser.add_argument("--run-id", required=True, help="Run ID to resume")
    args = parser.parse_args()
    resume_pipeline(args.run_id)


if __name__ == "__main__":
    main()
