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
a narrative prop delivered via the staged Slack alert (post_alert.py).

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

    # Run unattended in the background, logging to a file:
    nohup python generate_load.py > load.log 2>&1 &
    # ...check on it later:  tail -f load.log ;  stop it:  kill %1  (or the PID)

    # Or via cron — a burst every 15 minutes (no long-running process):
    #   */15 * * * * cd /path/to/apps/remote-mcp-perf-triage && \
    #     MONGODB_URI="mongodb+srv://..." python generate_load.py --burst 3 --interval 0 --duration 30
"""

import argparse
import os
import secrets
import sys
import time
from datetime import datetime

try:
    from pymongo import MongoClient
except ImportError:
    sys.exit("pymongo not installed. Run: pip install -r requirements.txt")

DB_NAME = "ecommerce"
COLLECTION_NAME = "payments"

POLL_FILTER_STATUS = "completed"


def run_query(coll):
    """Run one checkout status-poll query; return its latency in ms.

    A random session_id that has no 'completed' record forces a full COLLSCAN.
    """
    session_id = f"sess_{secrets.token_hex(12)}"
    t0 = time.perf_counter()
    coll.find_one({"session_id": session_id, "status": POLL_FILTER_STATUS})
    return (time.perf_counter() - t0) * 1000


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--burst", type=int, default=3,
                        help="number of queries to run per cycle")
    parser.add_argument("--interval", type=float, default=300,
                        help="seconds between the start of each burst "
                             "(0 = continuous / no sleep between bursts)")
    parser.add_argument("--duration", type=float, default=0,
                        help="total seconds to run (0 = run until Ctrl+C)")
    args = parser.parse_args()

    uri = os.environ.get("MONGODB_URI")
    if not uri:
        sys.exit('ERROR: set MONGODB_URI, e.g.\n  export MONGODB_URI="mongodb+srv://user:pass@host/"')

    client = MongoClient(uri, appname="perf-triage-demo-load")
    coll = client[DB_NAME][COLLECTION_NAME]
    client.admin.command("ping")

    mode = "continuous" if args.interval == 0 else f"trickle ({args.burst} queries / {args.interval:.0f}s)"
    limit = "until Ctrl+C" if args.duration == 0 else f"{args.duration:.0f}s"
    print(f"Polling {DB_NAME}.{COLLECTION_NAME} — {mode}, {limit}. "
          "Each query is a full COLLSCAN (no index on session_id).")

    deadline = time.time() + args.duration if args.duration > 0 else None
    total = 0
    try:
        while deadline is None or time.time() < deadline:
            cycle_start = time.time()
            latencies = [run_query(coll) for _ in range(args.burst)]
            total += len(latencies)

            avg = sum(latencies) / len(latencies)
            slow = 100 * sum(1 for x in latencies if x > 100) / len(latencies)
            ts = datetime.now().strftime("%H:%M:%S")
            print(f"  {ts}  burst of {len(latencies)}: avg {avg:7.1f} ms  |  "
                  f"{slow:3.0f}% over 100 ms  |  {total:,} total", flush=True)

            if args.interval > 0:
                sleep_for = args.interval - (time.time() - cycle_start)
                if sleep_for > 0 and (deadline is None or time.time() + sleep_for < deadline):
                    time.sleep(sleep_for)
                elif deadline is not None:
                    break  # not enough time left for another cycle
    except KeyboardInterrupt:
        pass
    print(f"\nStopped after {total:,} queries.")


if __name__ == "__main__":
    main()
