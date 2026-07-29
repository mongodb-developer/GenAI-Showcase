"""
Seed a large, realistic `payments` collection on an Atlas M10 for the
performance-triage demo.

Goal: make a full collection scan genuinely slow so that (a) the checkout
status-poll query trips the slow-query log that feeds Performance Advisor, and
(b) a live explain() shows a real COLLSCAN examining every document.

Two design constraints, satisfied together:

1. The scan must be reliably slow. Empirically on an M10 with 2 GB RAM (measured),
   300,000 documents of ~2 KB is the sweet spot: a COLLSCAN runs ~9 s cold and
   settles to ~5 s once the cache is warm. That is clearly slow and dramatic in
   explain(), yet stays safely under the MongoDB MCP server's 60 s maxTimeMS cap.
   NOTE: do NOT seed millions here — a scan of that size can exceed the 60 s cap,
   making the agent's explain()/find() ERROR out during the demo instead of
   returning stats. Bigger is worse, not better.

   What makes the scan slow is that the collection (~0.63 GB) OUTGROWS the
   WiredTiger cache (~50% of host RAM, so ~537 MB on a 2 GB M10), forcing reads
   from disk. On a bigger tier the collection fits entirely in cache and the same
   query returns in ~200 ms — measured at 222 ms on a 4 GB host — which kills the
   demo. If scans come back suspiciously fast, check hostInfo.memSizeMB: the fix
   is a smaller tier, NOT more documents.

   The document bytes live in a realistic `gateway_response` field (an opaque
   base64 payload — exactly what payment processors return and apps store for
   reconciliation). It is high-entropy so WiredTiger's snappy compression can't
   shrink the collection, AND screenshot-safe: if a document appears on screen
   during the demo, it reads as a real payment record, not obvious junk padding.

2. There is deliberately NO index on `session_id` (the field the checkout poll
   filters on). Only the default _id index exists.

Tip: after seeding, warm the cache (run generate_load.py or a few scans) so the
demo sees the ~4 s warm time rather than the ~30 s cold time.

Usage:
    export MONGODB_URI="mongodb+srv://<user>:<pass>@cluster0.z7basj.mongodb-dev.net/"
    python seed_payments.py                 # defaults: 300,000 docs, ~1.6 KB gateway blob
    python seed_payments.py --docs 300000 --blob-bytes 1600
    python seed_payments.py --drop          # drop the collection first (fresh reseed)
    python seed_payments.py --drop-index    # light reset: drop the demo index, keep the data
"""

import argparse
import base64
import os
import random
import secrets
import sys
import time
from datetime import datetime, timedelta, timezone

try:
    from pymongo import MongoClient, InsertOne
    from dotenv import load_dotenv
except ImportError:
    sys.exit("pymongo not installed. Run: pip install -r requirements.txt")

load_dotenv()

DB_NAME = "ecommerce"
COLLECTION_NAME = "payments"

# The index the agent creates during the demo, and that --drop-index removes to
# restore the slow condition. Name is MongoDB's default for { session_id: 1, status: 1 }.
DEMO_INDEX_NAME = "session_id_1_status_1"

# Realistic reference data. These enum-ish fields are a small fraction of each
# document, so their compressibility doesn't matter — the bulk is the random blob.
STATUS_WEIGHTS = [("completed", 0.92), ("pending", 0.05), ("failed", 0.03)]
PAYMENT_METHODS = ["card", "paypal", "apple_pay", "google_pay", "bank_transfer"]
CURRENCIES = ["USD", "EUR", "GBP", "CAD"]
CARD_BRANDS = ["visa", "mastercard", "amex", "discover"]
GATEWAYS = ["stripe", "adyen", "braintree"]
CITIES = [
    ("Austin", "TX", "US"), ("Seattle", "WA", "US"), ("Denver", "CO", "US"),
    ("London", "", "GB"), ("Toronto", "ON", "CA"), ("Berlin", "", "DE"),
    ("Dublin", "", "IE"), ("New York", "NY", "US"),
]
PRODUCTS = [
    ("SKU-1001", "Wireless Headphones"), ("SKU-1002", "USB-C Cable"),
    ("SKU-1003", "Laptop Stand"), ("SKU-1004", "Mechanical Keyboard"),
    ("SKU-1005", "4K Monitor"), ("SKU-1006", "Webcam"),
    ("SKU-1007", "Desk Lamp"), ("SKU-1008", "Notebook"),
]


def weighted_status():
    r = random.random()
    cumulative = 0.0
    for status, weight in STATUS_WEIGHTS:
        cumulative += weight
        if r <= cumulative:
            return status
    return "completed"


def gateway_blob(blob_bytes):
    """An opaque, high-entropy base64 payload — realistic AND incompressible.

    base64 of random bytes has no repeated structure, so WiredTiger's snappy
    compression can't shrink it: the collection stays large on disk.
    """
    raw = os.urandom(max(1, blob_bytes * 3 // 4))  # base64 expands ~4/3
    return base64.b64encode(raw).decode("ascii")


def make_doc(blob_bytes, base_time):
    """Build one realistic payment document."""
    city, state, country = random.choice(CITIES)
    n_items = random.randint(1, 3)
    line_items = []
    for _ in range(n_items):
        sku, name = random.choice(PRODUCTS)
        line_items.append({
            "sku": sku,
            "name": name,
            "qty": random.randint(1, 4),
            "unit_price": random.randint(500, 20_000),
        })
    amount = sum(i["qty"] * i["unit_price"] for i in line_items)
    created = base_time - timedelta(seconds=random.randint(0, 90 * 24 * 3600))
    return {
        # High-cardinality session id — the checkout poll filters on this (unindexed).
        "session_id": f"sess_{secrets.token_hex(12)}",
        "order_id": f"ord_{random.randint(100000, 999999)}",
        "user_id": f"usr_{random.randint(1, 500_000)}",
        "amount": amount,
        "currency": random.choice(CURRENCIES),
        "status": weighted_status(),
        "payment_method": random.choice(PAYMENT_METHODS),
        "card": {
            "brand": random.choice(CARD_BRANDS),
            "last4": f"{random.randint(0, 9999):04d}",
            "exp_month": random.randint(1, 12),
            "exp_year": random.randint(2026, 2031),
            "fingerprint": secrets.token_hex(8),
        },
        "billing_address": {
            "city": city, "state": state, "country": country,
            "postal_code": f"{random.randint(10000, 99999)}",
        },
        "line_items": line_items,
        "gateway": random.choice(GATEWAYS),
        # The bulk of the document size: an opaque processor response payload.
        "gateway_response": gateway_blob(blob_bytes),
        "risk_score": random.randint(0, 99),
        "created_at": created,
        "updated_at": created + timedelta(seconds=random.randint(1, 30)),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--docs", type=int, default=300_000, help="number of documents to insert")
    parser.add_argument("--blob-bytes", type=int, default=1600,
                        help="approx size of the gateway_response payload per doc")
    parser.add_argument("--batch", type=int, default=5000, help="insert batch size")
    parser.add_argument("--drop", action="store_true", help="drop the collection before seeding")
    parser.add_argument("--drop-index", action="store_true",
                        help="drop the demo index and exit WITHOUT reseeding "
                             "(the light reset after a demo has created it)")
    args = parser.parse_args()

    uri = os.environ.get("MONGODB_URI")
    if not uri:
        sys.exit('ERROR: set MONGODB_URI, e.g.\n  export MONGODB_URI="mongodb+srv://user:pass@host/"')

    client = MongoClient(uri, appname="perf-triage-demo-seed")
    coll = client[DB_NAME][COLLECTION_NAME]

    # Fail fast on bad credentials / network before the long insert loop.
    client.admin.command("ping")

    if args.drop_index:
        # Light reset: restore the slow condition on an intact collection. Exits
        # before the insert loop, so the existing 300k documents are untouched.
        if args.drop:
            sys.exit("ERROR: --drop-index and --drop are mutually exclusive. "
                     "--drop-index keeps the data; --drop destroys it.")
        existing = list(coll.index_information().keys())
        if DEMO_INDEX_NAME in existing:
            print(f"Dropping index {DEMO_INDEX_NAME} from {DB_NAME}.{COLLECTION_NAME} ...")
            coll.drop_index(DEMO_INDEX_NAME)
        else:
            print(f"Index {DEMO_INDEX_NAME} not present — nothing to drop.")
        print(f"Indexes now: {list(coll.index_information().keys())}  (expect only _id_)")
        print(f"Documents kept: {coll.estimated_document_count():,}")
        print("Next: make sure generate_load.py is running so Performance Advisor "
              "rebuilds its recommendation before the next demo.")
        return

    if args.drop:
        print(f"Dropping {DB_NAME}.{COLLECTION_NAME} ...")
        coll.drop()

    print(f"Seeding {args.docs:,} docs (~{args.blob_bytes}B gateway payload each) into "
          f"{DB_NAME}.{COLLECTION_NAME} — NO index on session_id.")
    base_time = datetime.now(timezone.utc)
    start = time.time()
    inserted = 0

    while inserted < args.docs:
        n = min(args.batch, args.docs - inserted)
        ops = [InsertOne(make_doc(args.blob_bytes, base_time)) for _ in range(n)]
        coll.bulk_write(ops, ordered=False)
        inserted += n
        if inserted % 100_000 == 0 or inserted == args.docs:
            elapsed = time.time() - start
            rate = inserted / elapsed if elapsed else 0
            print(f"  {inserted:,}/{args.docs:,}  ({rate:,.0f} docs/s, {elapsed:,.0f}s elapsed)")

    stats = client[DB_NAME].command("collstats", COLLECTION_NAME)
    size_gb = stats.get("size", 0) / 1e9
    storage_gb = stats.get("storageSize", 0) / 1e9
    print(f"\nDone. Logical size ~{size_gb:.2f} GB, on-disk storage ~{storage_gb:.2f} GB.")
    print(f"Indexes present: {list(coll.index_information().keys())}  (expect only _id_)")
    print("Next: run generate_load.py to warm the cache and feed Performance Advisor, "
          "then confirm scan time with an explain() (expect ~9 s cold, ~5 s warm on a 2 GB M10).")


if __name__ == "__main__":
    main()
