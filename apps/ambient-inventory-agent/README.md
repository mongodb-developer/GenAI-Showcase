# Ambient Inventory Agent

A stage-ready demo of an inventory monitoring assistant for a regional specialty
coffee roaster. It shows one compressed monitoring cycle:

1. The presenter presses **Run sweep** on the inventory dashboard.
2. An agent sweeps the catalogue over MongoDB Remote MCP.
3. It finds a shared component below its reorder point and files an alert.
4. The owner asks the agent about suppliers, timing and quantities.
5. The owner approves the recommended purchase order.
6. The agent writes it to MongoDB — also over MCP.

## Architecture

**One agent, three jobs.** Same model, same MCP tool set, same MongoDB
connection; what differs is the prompt and when it runs.

| Job | When | File |
|---|---|---|
| **Monitor** | On **Run sweep** | `investigator.py` — sweeps, diagnoses, files the alert |
| **Assistant** | Owner asks | `agent.py` — answers from the database, streaming |
| **Order clerk** | Owner approves | `order_agent.py` — records the purchase order |

`graph.py` only schedules the monitoring run. Every judgement in the alert — which
component, which supplier, how many, how urgent — is the agent's, reached by
querying MongoDB over Remote MCP. There is no rule-based alternative: if the agent
cannot complete, no alert is raised and the failure is surfaced in the feed rather
than papered over with a fabricated one.

```
Browser ──SSE──► FastAPI ──► LangGraph ReAct agent ──► Claude (Bedrock)
                                    │
                                    └── MCP tools ──► MongoDB Remote MCP ──► Atlas
```

### MCP is required, and fails loudly

Every read and write the agent performs goes through Remote MCP, and no MCP call
is routed in application code — the model chooses the tool. If MCP is unavailable
the UI shows a banner and the agent declines rather than quietly using the driver
and implying MCP did the work.

The driver is used only for things no model should decide: seeding, the activity
log, the chat transcript, session state, and the UI's state snapshot.

MCP data tools require a `connectionId` from `remote-atlas-connect`. The app
performs that handshake at startup — and again when **Run sweep** is pressed, since
the service-account token lasts an hour and a laptop left open on a podium may be
holding an expired one — then injects
`connectionId` and `database` into every tool call so the model cannot target the
wrong cluster.

### How the agent authenticates

**`RemoteMCPProbe.service_account_token()` in `app/mcp_client.py` is the whole
story** — one function, and the code that actually runs.

The agent holds no database username or password. It holds an Atlas **service
account** (client id + secret, the same credential a CI job would use), sends it as
HTTP Basic in a standard OAuth 2.0 `client_credentials` grant, and gets back a
bearer token valid for one hour. That token authorizes every MCP tool call. Access
is exactly what the service account is granted in the Atlas project — revoke it
there and every tool call stops, with no redeploy.

The agent is scoped to eight of the ~41 tools, which keeps it out of Atlas
administration (`drop-database`, `create-cluster`, …) and keeps tool selection
fast:

- **Discovery** — `list-collections`, `collection-schema`, `collection-indexes`
- **Data** — `find`, `aggregate`, `count`, `insert-many`, `update-many`

### The agent discovers the schema

The system prompt does not hardcode the collection layout. It tells the agent
*how* to find its way around — list collections, read a schema before filtering
on its fields, verify a field exists rather than inferring it from its name —
and the agent introspects the live database. A hardcoded schema description is
one more thing that drifts from reality, and the whole point of the MCP story is
that the model can look.

Schema and index shape don't change between questions, so discovery results are
cached per process (and pre-warmed at startup, and invalidated on demo reset).
The agent still decides whether to call them; the cache just means the second
question isn't paying for round trips again. In practice a question costs 3–7
tool calls and 15–45s end to end.

### The agent complements the alert, it does not restate it

The alert tiles already render the headline figures. The chat agent is given only
the *identity* of the records in play (product, component, supplier `_id`s) and
told not to restate or recompute them — so its queries go to ground the tiles do
not cover: which other SKUs draw on the component, what inbound orders exist, how
suppliers compare on cost, lead time and reliability.

## Story

**Leafy Roasters** has three cafes, a Shopify storefront, subscriptions, and
wholesale accounts.

Every finished good looks healthy on the dashboard. Nothing is close to empty.

The risk is one level down: **12oz valve bags are shared by four SKUs**, so they
deplete at 39 units/day — four times faster than any single product's numbers
suggest. At 402 on hand against a reorder point of 429, they have just crossed the
line where a replacement has to be ordered.

That is the point of the demo. The shortage is invisible if you only watch
finished-goods levels, because no single product owns the component. And because
it was caught *at* the reorder point rather than in a crisis, the outcome is a
routine order from the cheaper supplier — Pacific BagWorks at \$0.31, whose 8-day
lead time still fits the ~10 days of stock left. The rush vendor at \$0.37 is the
option the agent considers and rejects.

    reorder point = combined daily draw x (supplier lead time + 3 days safety)
                  = 39 x (8 + 3) = 429

## Setup

### Prerequisites

- An Atlas cluster, plus a database user with read/write on the demo database.
- Atlas **service account** credentials for Remote MCP.
- AWS credentials with Bedrock access, and the Claude model enabled in your
  region.

### Install

```bash
cd apps/ambient-inventory-agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp env.example .env
```

### Configure

Edit `.env`:

```bash
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>/"
MONGODB_DATABASE="ambient_inventory_agent"

# Remote MCP — service-account credentials only.
MDB_MCP_API_BASE_URL="https://mcp-dev.mongodb.com"
MDB_MCP_API_CLIENT_ID="mdb_sa_id_..."
MDB_MCP_API_CLIENT_SECRET="mdb_sa_sk_..."
MDB_MCP_PROJECT_ID="<24-hex Atlas project id>"
MDB_MCP_CLUSTER_NAME="Cluster0"

# Bedrock
AWS_REGION="us-west-2"
BEDROCK_MODEL_ID="us.anthropic.claude-sonnet-5"

DEMO_ALERT_DELAY_SECONDS="0"
```

`MDB_MCP_PROJECT_ID` and `MDB_MCP_CLUSTER_NAME` are required — without them the
MCP data tools have no connection to run against. Find them with
`atlas-list-projects` / `atlas-list-clusters`, or in the Atlas UI URL.

The app authenticates to MCP with client credentials, discovered from the
endpoint's `WWW-Authenticate` response. There is no browser-based login flow.

AWS credentials come from the standard chain (`~/.aws/credentials`, environment,
or instance role).

### Run

```bash
./setup_demo.sh          # reseeds, then runs the app on :8008
```

Equivalent by hand, in this order — the reseed has to land while the server is down:

```bash
python seed_demo.py --reset
uvicorn app.main:app --port 8008
```

Startup opens the MCP session, which takes a few seconds; doing it up front keeps
the first chat message from stalling on stage. Check it worked:

```bash
curl -s localhost:8008/api/health | python -m json.tool
```

`mcp.ready` must be `true`. Then open `http://localhost:8008/` and press **Run
sweep** when you begin.

Reseeding is a pre-flight step, not something the page does, which is why
`setup_demo.sh` does it before starting the server. Neither loading the page nor
pressing **Run sweep** reseeds — `/api/demo/start` mints a new `session_id`, which
leaves the previous run's alert and transcript behind but does *not* clear
`purchase_orders`. That matters, because a leftover order for the shared component
makes the next sweep decide no alert is needed, so run `./setup_demo.sh` again
between runs. Refreshing mid-demo is safe.

Avoid `--reload` during a rehearsal: the pending alert lives in an in-process
task and a reload cancels it.

## Stage flow

Start it, then open the app and walk away:

```bash
./setup_demo.sh                      # wait for [mcp] connected
open http://localhost:8008/
```

1. The app opens straight into the inventory portal, showing the shop's real data
   with the agent idle. Nothing runs until you press play, so the laptop can sit on
   the podium indefinitely and there is no URL parameter to remember.
2. Press **Run sweep** in the Agent activity panel when you begin. It re-mints the
   service-account token, rebinds the cluster connection, and starts the sweep —
   about 6 seconds, narrated on the button itself. The control then becomes a live
   **Monitoring** indicator.
3. The Agent activity panel fills as it works: `Agent · plan`, then a live stream
   of `Agent · MCP` queries. This is the part to narrate; the badge pulses when
   the agent files its diagnosis, roughly 45 seconds in.
4. Open the alert. The stat tiles are the figures *the agent chose*, colour-coded
   by why they matter.
5. Ask a suggested question. Query chips appear within a few seconds, then the
   answer streams in.
6. Approve the order. The agent writes the purchase order over MCP (~17s).

Timing after **Run sweep**: ~6s to reconnect MCP, then the alert lands 40–65s later.
The activity feed populates throughout, so the wait is the demo rather than dead
air. A chat answer takes 15–45s depending on how many queries the model runs.

Do not run with `--reload`: the sweep lives in an in-process task and a reload
cancels it. `POST /api/monitor/run` re-runs a sweep during rehearsal without
restarting.

## Data model

| Collection | Notes |
|---|---|
| `products` | Finished goods with a `components` bill of materials |
| `inventory_items` | Coffee, packaging, labels |
| `suppliers` | Lead times, reliability, `unit_costs`, `minimum_order` |
| `purchase_orders` | Seeded inbound POs plus agent-submitted orders |
| `alerts` | Inbox alerts with the decision inputs that produced them |
| `session_history` | One timeline per session: owner questions, agent answers, and every tool call the agent made (TTL 24h) |
| `checkpoints`, `checkpoint_writes` | LangGraph short-term memory, one thread per sweep |
| `demo_sessions` | Session state and the seed marker |

Notes on the schema, following MongoDB's modeling guidance:

- **No denormalized `shared_by`.** Which products use a component is derived from
  `products.components.inventory_id`. The cached list went stale as soon as more
  12oz SKUs were added, and the agent read the stale value.
- **Alerts cache only what they need.** Suppliers are stored as extended
  references (`_id`, `name`, `default_lead_time_days`, `reliability`) rather than
  full documents.
- **Indexes match real queries only** — `(session_id, created_at)` for the
  session-scoped list views, plus a unique `(session_id, dedupe_key)` backing the
  alert upsert.
- **Approval is idempotent in the database.** A unique partial index on
  `{alert_id}` where `status: "submitted"` means a double-click cannot place two
  supplier orders.
- **Seeded documents carry `session_id: "seed"`** so session queries stay
  indexable equality matches instead of `{$exists: false}`.
- **`$jsonSchema` validators** are attached at `warn` level: drift shows up in the
  server log without ever hard-failing a live demo.

### Memory lives in MongoDB, keyed by sweep

A new agent is constructed for every turn, so its working memory is checkpointed
with `langgraph-checkpoint-mongodb`. The thread is keyed on the **sweep** — the
monitoring run — not on the browser session or the alert:

- The sweep is the investigation; the alert is what it publishes; the owner's
  follow-up questions continue that same investigation.
- The thread exists while the sweep is still working, so everything the monitor
  discovered is already in context when the first question arrives. In practice
  that takes the first question from ~9 tool calls to 0.
- The alert stores its `sweep_id`, so opening it resumes that thread. Nothing is
  held in the browser.

The order write runs nested inside a chat turn, so it deliberately has no
checkpointer — sharing the conversation's thread would resume it mid-tool-call.
Writing one document needs no memory.

### Overriding the recommendation

If the owner wants a different supplier, the agent records that as an `override`
beside the untouched `recommendation`. The alert keeps showing what the agent
advised — that is the record — and the override shows what will actually be
ordered. Nothing is written to `purchase_orders` until the owner says to place it,
either in words or with the button.

This is also why a phone would work in a real deployment: state is in MongoDB, so
a push notification deep-linking to an alert would resume the same conversation.
What the demo does *not* model is tenant identity — `session_id` is a per-browser
UUID, so opening the app on a second device starts a new inbox. A production
system would key on the shop or user instead; nothing in the architecture assumes
otherwise.

## Production notes

This is a demo, and a few things would change in production:

- The monitor runs once per browser session via an in-process `asyncio` task. A
  real deployment would run the same graph on a schedule (cron, worker, or
  managed LangGraph) independent of anyone viewing the page, and the alert would
  also go out as a push notification.
- Purchase orders are simulated — no supplier API is called.
- Alert detection is deliberately rule-based. Keeping the LLM out of detection
  is a reasonable production choice too: thresholds stay auditable and cheap,
  and the model is reserved for explanation and decision support.
