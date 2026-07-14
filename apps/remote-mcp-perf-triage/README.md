# Remote MCP — Performance Triage Demo

A live demo of an AI agent triaging a production performance incident end-to-end,
entirely through the **MongoDB Remote MCP** plugin. A vague, cluster-level alert
lands in Slack; the agent connects to Atlas, pinpoints the offending collection and
query, consults the Atlas **Performance Advisor**, creates the missing index, and
verifies the fix — without the developer ever leaving the chat or writing a query
by hand.

## The story

**Setup (world before the incident):** An e-commerce app uses MongoDB Atlas as the
system of record for payments. After a user clicks *Pay*, the checkout page polls
MongoDB until the payment status flips to `completed`:

```js
db.payments.findOne({ session_id: "sess_...", status: "completed" })
```

The `payments` collection has grown to millions of documents, and there is **no
index on `session_id`**. Every poll is a full collection scan.

**Incident:** Checkout hangs on "Processing your payment…" and times out. A
**Query Targeting** alert (scanned objects / returned too high) fires from Atlas
into a Slack channel. The alert is cluster-level and vague — it does *not* name the
collection, query, or index. Pinpointing that is the agent's job.

**Triage (live, via MCP):**
1. Agent inspects the slow query and runs `explain()` → `COLLSCAN`, every document examined (~3.5–4 s).
2. Agent consults the **Performance Advisor** → confirms a missing index on `session_id`.
3. Agent creates the index `{ session_id: 1, status: 1 }`.
4. Agent re-runs `explain()` → `IXSCAN`, ~1 doc examined, sub-millisecond. Checkout recovers.

**Takeaway:** a conversational agent traversed from a *business symptom* (failed
checkouts in Slack) to a *database root cause* and fix — cross-layer triage that
would normally require a developer who knows exactly where to look.

## What's real vs. staged

- **Real:** the seeded collection, the slow query, the `explain()` output, the
  Performance Advisor recommendation, and the index creation. The agent does
  genuine work against a live M10 cluster over MCP.
- **Staged:** only the *delivery* of the Slack alert (`post_alert.py`). We mimic the
  appearance of an Atlas alert rather than configuring Atlas alerting, so the alert
  fires on cue with no evaluation lag. The demo begins from "the alert has arrived."

## Files

| File | Purpose |
|------|---------|
| `seed_payments.py` | Seeds a large, realistic `payments` collection (no index on `session_id`). |
| `generate_load.py` | Runs the checkout status-poll query repeatedly to feed Performance Advisor. |
| `post_alert.py` | Posts an Atlas-styled "Query Targeting" alert to Slack via an incoming webhook. |
| `requirements.txt` | `pymongo` (for the seed and load scripts). |

## Prerequisites

- An Atlas **M10** cluster (dedicated tier — required for the full Performance Advisor).
- A **read-write database user** + connection string for the seed/load scripts.
  This is a direct MongoDB connection, separate from the Remote MCP OAuth grant.
- The **Remote MCP** plugin connected to the same Atlas org/project, with MCP access
  enabled for the org (Org Admin → App Authorizations).
- A **Slack incoming webhook** URL for the alert (a personal workspace works fine).

## Setup

```bash
pip install -r requirements.txt
export MONGODB_URI="mongodb+srv://<user>:<pass>@cluster0.<...>.mongodb-dev.net/"
```

### 1. Seed the data

```bash
python seed_payments.py               # ~300,000 docs, ~1.6 KB gateway payload each
```

**Sizing (measured on M10):** 300k docs of ~2 KB is the sweet spot. A COLLSCAN of
the poll query runs **~30 s cold** and settles to **~3.5–4 s warm** — clearly slow
and dramatic in `explain()`, yet safely under the MongoDB MCP server's **60 s
`maxTimeMS` cap**. Do **not** seed millions: a scan that large can exceed the 60 s
cap, which makes the agent's `explain()`/`find()` **error out** during the demo
instead of returning stats. Bigger is worse, not better.

Document size lives in a realistic `gateway_response` field (an opaque base64
payload — screenshot-safe, and high-entropy so WiredTiger's compression can't shrink
the collection and let it be served entirely from cache).

### 2. Keep the slow-query pattern fresh (trickle load)

Performance Advisor builds its recommendation from slow queries in a rolling ~24h
window. The recommendation only persists while slow queries **keep recurring** AND
the index is **still absent** — so keep a gentle trickle running until showtime, and
**do not create the index before the demo**.

```bash
python generate_load.py               # default trickle: 3 queries every 5 min, until Ctrl+C
```

Recency matters more than volume, and the M10 has a burstable CPU, so a light trickle
is enough (and kinder to the cluster) — no need to hammer it. To run unattended:

```bash
nohup python generate_load.py > load.log 2>&1 &   # background; tail -f load.log to watch
```

Notes:
- Give Performance Advisor ~15–30 min of traffic to first surface the recommendation.
- Warm the cache before demoing (let the trickle run a bit) so scans are ~4 s, not ~30 s.
- Confirm readiness with `atlas-get-performance-advisor` (expect a suggested index on
  `{ session_id: 1, status: 1 }` for `ecommerce.payments`).

## Running the demo

1. Post the alert to Slack:
   ```bash
   export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/XXX/YYY/ZZZ"
   python post_alert.py
   ```
2. In the AI client (Claude Code / Codex) connected via Remote MCP, hand the agent
   the incident and let it triage: inspect the query, `explain()`, read the
   Performance Advisor, create the index, and re-verify with `explain()`.
3. (Optional closing beat) Post a resolved/green alert to mirror Atlas detecting recovery.

## The fix

```js
db.payments.createIndex({ session_id: 1, status: 1 })
```

`session_id` is the selective field; the compound index also covers the `status`
predicate. After creation the poll query uses `IXSCAN`, examines ~1 document, and
completes sub-millisecond — well under any checkout timeout.

## Reset (to re-run the demo)

### Light reset (usual case)

If the collection is intact and you just created the index during the demo, drop the
index so the slow condition returns:

```js
db.payments.dropIndex("session_id_1_status_1")
```

Then make sure the trickle is running again ahead of the next run:

```bash
nohup python generate_load.py > load.log 2>&1 &   # background; tail -f load.log to watch
```

### Full reseed ritual (fresh data)

If you need to rebuild the collection from scratch:

```bash
python seed_payments.py --drop                    # drop, then seed a fresh 300k
nohup python generate_load.py > load.log 2>&1 &   # warm cache + rebuild Advisor recommendation
```

**Always use `--drop` when reseeding.** Running `seed_payments.py` without it *appends*
another 300k (→ 600k total), which roughly doubles scan time and pushes the cold case
into the MCP server's 60 s `maxTimeMS` cap — the failure mode 300k is sized to avoid.

After any reseed, remember:
- The cache is cold again (first scans ~30 s, settling to ~4 s) — let the trickle warm it.
- The Performance Advisor recommendation resets with the collection — give the trickle
  ~15–30 min to rebuild it, then confirm with `atlas-get-performance-advisor` before going live.
