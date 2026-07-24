# Ambient Inventory Agent

A stage-ready demo of an ambient inventory monitoring assistant for a regional
specialty coffee roaster. The app shows one compressed monitoring cycle:

1. The owner opens the inventory console.
2. A local LangGraph monitor runs after a short delay.
3. A low-stock alert lands in the in-app inbox.
4. The owner chats with the agent about the blocker and restock options.
5. The owner approves a simulated supplier order.
6. MongoDB records the submitted purchase order and audit events.

The demo is intentionally local-first. In production, the same graph could be run
hourly from a worker, cron job, or managed LangGraph deployment, and the inbox
alert could also be sent as a mobile push notification.

## Story

The seller is **Leafy Roasters**, a regional roaster with three cafes,
a Shopify storefront, subscriptions, and a few wholesale accounts.

The key inventory scenario is realistic for coffee:

- Espresso Blend 12oz bags are projected to stock out.
- Roasted coffee is still available.
- The actual blocker is 12oz one-way valve bags, a shared packaging component.
- The primary packaging supplier has an open PO arriving too late.
- A rush packaging vendor can deliver fast enough at a higher unit cost.

## MongoDB permissions

Use a MongoDB database user or service account with read/write permissions for the
demo database. The app does not pretend writes are safe by making the database
read-only. If the credential cannot insert or update records, the monitor/order
flow will fail with the database permission error.

For a live MongoDB Remote MCP story, point the MCP server at the same database and
credential. This app uses the MongoDB driver directly for deterministic UI
behavior while logging agent/tool events in MongoDB so the same data is inspectable
through Remote MCP.

For MCP auth, use service-style credentials only. The app reads the same
environment variables used by the Remote MCP package:

```bash
MDB_MCP_API_BASE_URL="https://mcp-dev.mongodb.com" # dev only; use the prod MCP URL when available
MDB_MCP_API_CLIENT_ID="mdb_sa_id_..."
MDB_MCP_API_CLIENT_SECRET="mdb_sa_sk_..."
```

It does not implement a browser-based user login or authorization-code flow. The
probe attempts OAuth discovery from the MCP endpoint's `WWW-Authenticate`
response and then uses client credentials.

## Setup

```bash
cd apps/ambient-inventory-agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp env.example .env
```

Edit `.env`:

```bash
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>/<options>"
MONGODB_DATABASE="ambient_inventory_agent"
MONGODB_SERVER_SELECTION_TIMEOUT_MS="5000"
MDB_MCP_API_BASE_URL="https://mcp-dev.mongodb.com"
MDB_MCP_API_CLIENT_ID=""
MDB_MCP_API_CLIENT_SECRET=""
DEMO_ALERT_DELAY_SECONDS="20"
```

Then seed and run:

```bash
python seed_demo.py --reset
uvicorn app.main:app --reload --port 8008
```

Open `http://localhost:8008/?fresh=1` for a clean stage run. The `fresh=1`
launch path resets the scenario, clears any prior browser session, and starts a
new delayed alert reveal.

## Stage flow

1. Open the app on stage.
2. Leave the inbox visible. It starts in a quiet monitoring state.
3. After `DEMO_ALERT_DELAY_SECONDS`, a new alert arrives automatically.
4. Click the alert.
5. Ask one or more suggested questions.
6. Approve the proposed rush packaging order.

## Collections

- `products`
- `inventory_items`
- `suppliers`
- `purchase_orders`
- `alerts`
- `chat_messages`
- `agent_events`
- `demo_sessions`
- `demo_meta`
