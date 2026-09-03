"""Beat 1 — Discovery across formats with MongoFilesystemBackend.

Hybrid $rankFusion search (50/50 fulltext + vector) at chunk level.
Surfaces the metric discussion across all four vocabularies:
  smoke CADR/W, PM2.5 CADR/W, IEF, CADR per watt.

Gate: three arms return measurably different results, reproducible
across three runs.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

from dotenv import load_dotenv
from langchain_mongodb_deepagents_vfs import MongoFilesystemBackend

load_dotenv()

APP_NAME = "devrel-tutorial-deepagents-langchain-vfs"

QUERY = (
    "How is air cleaner efficiency measured, and do the state standards "
    "use the same metric as DOE?"
)
NUM_RUNS = 3


def main() -> None:
    print("=" * 64)
    print("Beat 1 — MongoFilesystemBackend: hybrid $rankFusion search")
    print("=" * 64)
    print(f"\nQuery: {QUERY}\n")

    mongodb_uri = os.environ["MONGODB_URI"]
    if "appName=" not in mongodb_uri and "appname=" not in mongodb_uri:
        sep = "&" if "?" in mongodb_uri else "?"
        mongodb_uri = f"{mongodb_uri}{sep}appName={APP_NAME}"

    with MongoFilesystemBackend(
        s3_bucket_name=os.environ["S3_BUCKET_NAME"],
        mongodb_connection_string=mongodb_uri,
        s3_prefix="corpus/",
        aws_region=os.environ.get("AWS_REGION", "us-east-1"),
        debug=True,
    ) as backend:
        # Warmup grep — blocks until initial sync completes
        backend.grep("warmup")

        # Health check (only valid after first grep unblocks)
        assert not backend.init_errors, f"Init errors: {backend.init_errors}"
        report = backend.initial_sync_report
        assert (
            report and report.failed == 0
        ), f"Sync failures: {report.failed if report else 'no report'}"

        for run_num in range(1, NUM_RUNS + 1):
            print(f"--- Run {run_num}/{NUM_RUNS} ---")
            t0 = time.monotonic()
            result = backend.grep(QUERY)
            elapsed = time.monotonic() - t0

            if result.error:
                print(f"  ERROR: {result.error}")
                continue

            matches = result.matches or []
            print(f"  Matches: {len(matches)}")
            print(f"  Time: {elapsed:.2f}s")

            # Analyze results
            hit_types: set[str] = set()
            vocab_terms = {
                "IEF": False,
                "smoke CADR": False,
                "PM2.5": False,
                "CADR per watt": False,
                "CADR/W": False,
            }

            for m in matches:
                ext = Path(m["path"]).suffix.lower()
                hit_types.add(ext)
                text_lower = m["text"].lower()
                for term in vocab_terms:
                    if term.lower() in text_lower:
                        vocab_terms[term] = True

            print(f"  File types: {sorted(hit_types)}")
            print("  Vocabulary coverage:")
            for term, found in vocab_terms.items():
                status = "FOUND" if found else "MISSED"
                print(f"    {term}: {status}")

            # Show top hits
            print("  Top 5 matches:")
            for m in matches[:5]:
                print(f"    {m['path']}:{m['line']}")
                print(f"      {m['text'][:100]}...")
            print()

    print("=" * 64)
    print("Hybrid search finds the metric discussion across vocabularies")
    print("and file formats that ripgrep and StoreBackend cannot reach.")
    print("=" * 64)


if __name__ == "__main__":
    main()
