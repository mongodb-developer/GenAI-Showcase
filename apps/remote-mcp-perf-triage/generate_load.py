"""
Generate checkout status-poll traffic against the unindexed `payments` collection.

This stands in for real production traffic. It runs the checkout page's status-poll
query on an interval so that (a) Atlas Performance Advisor observes the slow query
pattern and surfaces an index recommendation, and (b) the pattern stays fresh in the
Advisor's rolling ~24h window right up to demo time.

The query mirrors what a checkout page runs while waiting for a payment to confirm:
    db.payments.findOne({ session_id: <id>, status: "completed" })

It queries session_ids with no completed record yet (still "pending") — realistic,
since the page polls before the processor webhook flips the status. With no index on
session_id, every poll is a full COLLSCAN.

No maxTimeMS here: we WANT each query to complete slowly so it lands in the slow-query
log (>100 ms) that Performance Advisor analyzes. The "checkout timing out" symptom is
demonstrated for real by checkout_app.py, which runs this same query and genuinely
exceeds its timeout.

TRICKLE MODE (default): recency matters more than volume for Performance Advisor, and
the M10 has a burstable CPU, so by default this runs a small BURST of queries every
INTERVAL seconds rather than hammering continuously. That keeps the recommendation
alive and the cache warm while being gentle on the cluster.

Usage:
    export MONGODB_URI="mongodb+srv://<user>:<pass>@host/"

    # Default trickle: 3 queries every 5 minutes, forever (Ctrl+C to stop).
    python generate_load.py

    # Custom trickle cadence.
    python generate_load.py --burst 5 --interval 900

    # Continuous (hammer) mode: back-to-back queries, no sleep between bursts.
    python generate_load.py --interval 0

    # Run unattended in the background, logging to a file (or use ./trickle.sh):
    nohup python generate_load.py > load.log 2>&1 &
    # ...check on it later:  tail -f load.log ;  stop it:  kill %1  (or the PID)
"""

import argparse
import os
import secrets
import sys
import time
from datetime import datetime

try:
    from dotenv import load_dotenv
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError
except ImportError:
    sys.exit("pymongo not installed. Run: pip install -r requirements.txt")

load_dotenv()

DB_NAME = "ecommerce"
COLLECTION_NAME = "payments"

# Latency above which Atlas logs a query as slow — the threshold that decides
# whether a poll feeds Performance Advisor at all.
SLOW_QUERY_MS = 100


def run_query(coll):
    """Run one checkout status-poll query; return its latency in ms.

    A random session_id that has no 'completed' record forces a full COLLSCAN.
    Raises PyMongoError on connection trouble; the caller decides whether to
    keep going.
    """
    session_id = f"sess_{secrets.token_hex(12)}"
    t0 = time.perf_counter()
    coll.find_one({"session_id": session_id, "status": "completed"})
    return (time.perf_counter() - t0) * 1000


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--burst", type=int, default=3, help="number of queries to run per cycle"
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=300,
        help="seconds between the start of each burst "
        "(0 = continuous / no sleep between bursts)",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=0,
        help="total seconds to run (0 = run until Ctrl+C)",
    )
    args = parser.parse_args()

    uri = os.environ.get("MONGODB_URI")
    if not uri:
        sys.exit(
            'ERROR: set MONGODB_URI, e.g.\n  export MONGODB_URI="mongodb+srv://user:pass@host/"'
        )

    client = MongoClient(uri, appname="perf-triage-demo-load")
    coll = client[DB_NAME][COLLECTION_NAME]
    # Fail loudly at launch on a bad URI or firewall — that's a config error to fix,
    # not something to retry. Mid-run failures are handled in the loop below.
    try:
        client.admin.command("ping")
    except PyMongoError as exc:
        sys.exit(f"ERROR: cannot reach MongoDB — {type(exc).__name__}: {exc}")

    mode = (
        "continuous"
        if args.interval == 0
        else f"trickle ({args.burst} queries / {args.interval:.0f}s)"
    )
    limit = "until Ctrl+C" if args.duration == 0 else f"{args.duration:.0f}s"
    print(
        f"Polling {DB_NAME}.{COLLECTION_NAME} — {mode}, {limit}. "
        "Each query is a full COLLSCAN (no index on session_id)."
    )

    deadline = time.time() + args.duration if args.duration > 0 else None
    total = 0
    errors = 0
    try:
        while deadline is None or time.time() < deadline:
            cycle_start = time.time()
            ts = datetime.now().strftime("%H:%M:%S")

            # Survive transient trouble instead of dying: this runs unattended for
            # hours across laptop sleep, wifi handoffs and Atlas blips, any of which
            # raises PyMongoError. A failed burst is logged and skipped, never
            # fatal — pymongo reconnects on its own; we just keep asking.
            latencies = []
            failures = []
            for _ in range(args.burst):
                try:
                    latencies.append(run_query(coll))
                except PyMongoError as exc:
                    failures.append(type(exc).__name__)

            total += len(latencies)
            errors += len(failures)

            if latencies:
                avg = sum(latencies) / len(latencies)
                slow = sum(x > SLOW_QUERY_MS for x in latencies) / len(latencies)
                suffix = f"  |  {len(failures)} failed" if failures else ""
                print(
                    f"  {ts}  burst of {len(latencies)}: avg {avg:7.1f} ms  |  "
                    f"{slow:3.0%} over {SLOW_QUERY_MS} ms  |  {total:,} total{suffix}",
                    flush=True,
                )
            else:
                # Whole burst failed — almost always a dropped connection.
                print(
                    f"  {ts}  burst FAILED ({', '.join(sorted(set(failures)))}) — "
                    f"will retry next cycle  |  {total:,} total, {errors} errors",
                    flush=True,
                )

            if args.interval > 0:
                sleep_for = args.interval - (time.time() - cycle_start)
                if sleep_for > 0 and (
                    deadline is None or time.time() + sleep_for < deadline
                ):
                    time.sleep(sleep_for)
                elif deadline is not None:
                    break  # not enough time left for another cycle
            elif not latencies:
                # Continuous mode with a dead connection would spin as fast as the
                # driver can fail. Back off so the log stays readable.
                time.sleep(5)
    except KeyboardInterrupt:
        pass
    tail = f", {errors} errors" if errors else ""
    print(f"\nStopped after {total:,} queries{tail}.")


if __name__ == "__main__":
    main()
