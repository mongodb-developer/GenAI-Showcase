# Remote MCP — Performance Triage Demo

A live demo of a ChatGPT Workspace Agent triaging a production performance incident
end-to-end through the **MongoDB Remote MCP** plugin. A simulated PagerDuty incident
triggers the agent through the Workspace Agents API. The agent connects to Atlas,
pinpoints the offending collection and query, consults the Atlas **Performance
Advisor**, proposes the missing index, and verifies the approved fix.

## The story

**Setup (world before the incident):** An e-commerce app uses MongoDB Atlas as the
system of record for payments. After a user clicks *Pay*, the checkout page polls
MongoDB until the payment status flips to `completed`:

```js
db.payments.findOne({ session_id: "sess_...", status: "completed" })
```

The `payments` collection has grown to hundreds of thousands of documents, and there is **no
index on `session_id`**. Every poll is a full collection scan.

**Incident:** Checkout hangs on "Processing your payment…" and times out. A Datadog
monitor observes an elevated payment-confirmation timeout rate, causing
PagerDuty to open a SEV-2 incident. The incident contains application symptoms but
does *not* identify MongoDB, a collection, a query, or an index. Pinpointing the
database cause is the agent's job.

**Triage (live, via MCP):**
1. Agent inspects the slow query and runs `explain()` → `COLLSCAN`, every document examined.
2. Agent consults the **Performance Advisor** → confirms a missing index on `session_id`.
3. Agent proposes the index `{ session_id: 1, status: 1 }` and waits for approval.
4. After approval, the agent creates the index and re-runs `explain()` → `IXSCAN`,
   ~1 doc examined, sub-millisecond. Checkout recovers.

**Takeaway:** a conversational agent traversed from a *business symptom* (failed
checkouts in PagerDuty) to a *database root cause* and fix — cross-layer triage that
would normally require a developer who knows exactly where to look.

## What's real vs. staged

- **Real:** the seeded collection, the slow query, the `explain()` output, the
  Performance Advisor recommendation, and the index creation. The agent does
  genuine work against a live M10 cluster over MCP. The checkout page's hang is also
  real — it runs the same unindexed poll query and genuinely exceeds its timeout.
- **Staged:** PagerDuty itself. `trigger_chatgpt.py` acts as the adapter that sends a
  PagerDuty incident resource to the Workspace Agents API. The incident contains
  application symptoms, but no database namespace, query shape, root cause, or index
  recommendation. Also staged: the payment processor's confirmation webhook, which
  `checkout_app.py` simulates with a short delay, and PagerDuty's on-call resolution —
  the assignee is a fixed name, not resolved from a real schedule.

## Files

| File | Purpose |
|------|---------|
| `setup_demo.sh` | Resets the demo, then runs the checkout page. `--drop` for a full reseed. |
| `trickle.sh` | `start`/`stop`/`status` for the Performance Advisor trickle. |
| `checkout_app.py` | The Leafy Electronics checkout page. Really hangs on the slow poll, then fires the incident to ChatGPT. |
| `seed_payments.py` | Seeds a large, realistic `payments` collection (no index on `session_id`); `--drop-index` resets the demo. |
| `generate_load.py` | Runs the checkout status-poll query repeatedly to feed Performance Advisor. |
| `trigger_chatgpt.py` | Sends a realistic PagerDuty-style incident to a published ChatGPT Workspace Agent and prints the conversation URL. |
| `requirements.txt` | `pymongo`, `python-dotenv`, and FastAPI/uvicorn for the checkout page. |

## Prerequisites

- An Atlas **M10** cluster (dedicated tier — required for the full Performance Advisor).
- A **read-write database user** + connection string for the seed/load scripts.
  This is a direct MongoDB connection, separate from the Remote MCP OAuth grant.
- The **Remote MCP** plugin connected to the same Atlas org/project, with MCP access
  enabled for the org (Org Admin → App Authorizations).
- A published ChatGPT Workspace Agent with an API channel and the MongoDB MCP plugin.
- A Workspace Agent access token. An admin must enable Workspace Agents and
  **Allow users to create personal access tokens** under Admin > Permissions & roles.

## Setup

```bash
pip install -r requirements.txt
```

Add the direct database connection used by the seed and load scripts to `.env`:

```dotenv
MONGODB_URI="mongodb+srv://<user>:<pass>@cluster0.<...>.mongodb.net/"
```

This URI must point to the same Atlas cluster exposed to the Workspace Agent through
MongoDB MCP.

### 1. Seed the data

```bash
python seed_payments.py               # 300,000 docs, ~1.6 KB gateway payload each
```

**Sizing:** 300k docs of ~2 KB is the sweet spot on an M10 with 2 GB RAM. A COLLSCAN
of the poll query takes several seconds — clearly slow and dramatic in `explain()`,
yet safely under the MongoDB MCP server's **60 s `maxTimeMS` cap**. Do **not** seed
millions: a scan that large can exceed the cap, which makes the agent's
`explain()`/`find()` **error out** during the demo instead of returning stats. Bigger
is worse, not better.

**The scan is only slow if the collection outgrows the WiredTiger cache.** That cache
is ~50% of host RAM, so a 2 GB M10 gives ~537 MB against this collection's ~0.63 GB —
scans hit disk and take seconds. On a larger tier the whole collection fits in cache
and the same query returns in a couple hundred milliseconds, which quietly kills the
demo's drama. Check `hostInfo.memSizeMB` if the scan comes back suspiciously fast; the
fix is a smaller tier, not more documents.

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
- Warm the cache before demoing (let the trickle run a bit) so scans are at their
  faster warm time rather than the slower cold one.
- Confirm readiness with `atlas-get-performance-advisor` (expect a suggested index on
  `{ session_id: 1, status: 1 }` for `ecommerce.payments`).

## Running the demo

### The checkout page (recommended opening)

`checkout_app.py` gives the demo a visual first act with no terminal on screen. It
serves a Leafy Electronics checkout that runs the **real** status-poll query against the **real**
unindexed collection — so the hang isn't staged, it's the bug:

```bash
./setup_demo.sh                        # resets, then serves http://127.0.0.1:8000
python checkout_app.py --no-incident   # rehearse without paging the agent
```

Click **Submit payment**. A real `pending` payment is inserted, a simulated processor
confirms it a few seconds later, and the page polls for the confirmation. Pre-index
every poll is a multi-second COLLSCAN, so the page blows its budget and fails — then
fires the PagerDuty incident to the Workspace Agent automatically. The status panel
shows each poll's latency, so the audience sees *why* it hung.

After the agent's index is approved, click **Submit payment** again: polls drop to
milliseconds and checkout confirms as soon as the processor does. That's the demo's
closing beat.

The incident fires **once**, so a rehearsal or a double-click doesn't spend the demo or
litter your workspace with conversations. Reloading the page re-arms it. The ChatGPT
token stays server-side; the browser never sees it.

Each poll passes its *remaining* budget as `maxTimeMS`, so a slow scan can't outlive the
checkout timeout — otherwise a scan that started near the deadline could finish after
the gateway confirmed the payment, and a checkout that should fail would succeed.

Because the page is a server, it survives laptop sleep: start it before you leave, wake
the machine on stage with the tab already open, and click. Nothing to type.

### Triggering from the CLI instead

1. In ChatGPT, publish the incident agent to an API channel and copy its stable
   `agtch_...` trigger identifier. Connect the MongoDB MCP plugin to the agent. Keep
   its instructions generic: investigate incoming MongoDB incidents, gather evidence,
   and require human approval before changes. Do not give it this demo's root cause.
2. Create a ChatGPT access token under Admin > Access tokens with the **Workspace
   Agents** scope, then add both values to the git-ignored `.env` file:
   ```dotenv
   AGENT_ACCESS_TOKEN="..."
   WORKSPACE_AGENT_TRIGGER_ID="agtch_..."
   ```
3. Trigger a new incident conversation:
   ```bash
   python trigger_chatgpt.py --wait
   ```
   Open the printed `https://chatgpt.com/c/...` URL. The agent receives only the
   simulated alert fields and must discover the database issue through MongoDB MCP.
4. Approve the proposed database action in that conversation, then let the agent
   re-run `explain()` and summarize the result.

Preview the complete PagerDuty incident resource and Workspace Agents request without
credentials or a network call:

```bash
python trigger_chatgpt.py --dry-run
```

The Workspace Agents API accepts a caller-defined `conversation_key`. The simulator
uses the PagerDuty incident ID for that key, so future webhook events for the same
incident can continue in one conversation. The separate event ID becomes the
`Idempotency-Key`, preventing a retried webhook from creating a duplicate task:

```bash
python trigger_chatgpt.py \
  --incident-id QDEMO123456789 \
  --event-id 01DEMO123456789 \
  --wait
```

## The fix

```js
db.payments.createIndex({ session_id: 1, status: 1 })
```

`session_id` is the selective field; the compound index also covers the `status`
predicate. After creation the poll query uses `IXSCAN`, examines ~1 document, and
completes sub-millisecond — well under any checkout timeout.

## Reset (to re-run the demo)

`setup_demo.sh` does the reset and then runs the checkout page, so one command per
demo run is enough:

```bash
./setup_demo.sh          # light reset: drops the index, keeps the 300k docs
./setup_demo.sh --drop   # full reseed: fresh 300k, several minutes
```

The trickle is managed separately, since it runs for hours across many demo runs:

```bash
./trickle.sh start       # kills any existing trickle, then starts one fresh
./trickle.sh status
./trickle.sh stop        # end of day
```

### Light reset (usual case)

If the collection is intact and you just created the index during the demo, dropping
the index restores the slow condition — that is all `./setup_demo.sh` does. By hand:

```bash
python seed_payments.py --drop-index      # drops the index, keeps the 300k docs
```

This exits before the insert loop, so your data is untouched. (Equivalent in the shell:
`db.payments.dropIndex("session_id_1_status_1")`.)

Keep the trickle running ahead of the next run — `./trickle.sh start`, or by hand:

```bash
nohup python generate_load.py > load.log 2>&1 &   # background; tail -f load.log to watch
```

### Full reseed ritual (fresh data)

To rebuild the collection from scratch, `./setup_demo.sh --drop`. By hand:

```bash
python seed_payments.py --drop                    # drop, then seed a fresh 300k
nohup python generate_load.py > load.log 2>&1 &   # warm cache + rebuild Advisor recommendation
```

**Always use `--drop` when reseeding.** Running `seed_payments.py` without it *appends*
another 300k (→ 600k total), which roughly doubles scan time and pushes the cold case
into the MCP server's 60 s `maxTimeMS` cap — the failure mode 300k is sized to avoid.

After any reseed, remember:
- The cache is cold again, so the first scans are slower — let the trickle warm it.
- The Performance Advisor recommendation resets with the collection — give the trickle
  ~15–30 min to rebuild it, then confirm with `atlas-get-performance-advisor` before going live.
