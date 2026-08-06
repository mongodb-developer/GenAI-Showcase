"""Leafy Electronics checkout page — the demo's opening act, and a real reproduction
of the bug.

Nothing here is simulated except the payment processor. The page runs the SAME
status-poll query the demo is about, against the SAME unindexed collection:

    db.payments.findOne({ session_id: ..., status: "completed" })

Pre-index that poll is a multi-second COLLSCAN, so the page genuinely blows its
client-side budget and genuinely fails. Post-index it returns in milliseconds and
the page succeeds. The hang is not staged; it is the bug.

Flow when you click "Submit payment":
  1. POST /api/pay      inserts a real payment doc with status="pending", and
                        schedules a background task to flip it to "completed"
                        after GATEWAY_DELAY_S (stands in for the processor webhook).
  2. GET  /api/status   runs the real poll query. The browser calls this in a loop
                        and shows each attempt's latency in the status panel.
  3. On timeout, the browser calls POST /api/incident, which sends the PagerDuty
                        incident to the ChatGPT Workspace Agent — ONCE per page
                        load, so a rehearsal doesn't spend the demo.

The ChatGPT access token stays server-side; the browser never sees it.

The pre-index failure depends on scans being slower than POLL_DEADLINE_MS, which
holds only while the collection stays too big for the cluster's WiredTiger cache.
A startup preflight times one real scan and warns when that no longer holds —
swapping clusters or reseeding less data otherwise turns the hang into a silent
success that still pages the agent. Startup therefore costs one slow scan.

Usage:
    python checkout_app.py                 # http://127.0.0.1:8000
    python checkout_app.py --port 9000
    python checkout_app.py --no-incident   # rehearse without paging anyone
"""

import argparse
import asyncio
import os
import secrets
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import uvicorn
    from dotenv import load_dotenv
    from fastapi import FastAPI
    from fastapi.responses import HTMLResponse, JSONResponse
    from fastapi.staticfiles import StaticFiles
    from pymongo import MongoClient
    from pymongo.errors import ExecutionTimeout
except ImportError:
    sys.exit("Missing deps. Run: pip install -r requirements.txt")

# Reuse the incident builder and API client rather than duplicating the payload.
import trigger_chatgpt

load_dotenv()

DB_NAME = "ecommerce"
COLLECTION_NAME = "payments"

# How long the fake processor takes to confirm — realistic for a real gateway, and
# well under CLIENT_TIMEOUT_S so post-index the page succeeds fast.
GATEWAY_DELAY_S = 3.0

# The user-facing budget: how long the shopper watches the spinner before the page
# gives up. Real checkouts often allow 30 s, but that is a long silence to narrate
# on stage. Correctness does not depend on this value (see POLL_DEADLINE_MS), so it
# is safe to tune for pacing, as long as it stays comfortably above GATEWAY_DELAY_S
# or the post-index SUCCESS case breaks.
CLIENT_TIMEOUT_S = 12.0

# Gap between polls. Real checkout pages pace their polls rather than hammering.
POLL_INTERVAL_MS = 2_500

# Per-request deadline for ONE poll, applied as maxTimeMS. Real services set a
# per-call deadline (API gateway, service SLO) below the overall user budget, so
# having one is normal — and it is also what makes the pre-index failure
# deterministic: it must sit below the FASTEST scan the cluster can produce.
#
# It must beat the fastest scan, not the typical one. Any single poll that
# completes after the gateway has confirmed finds the record and turns a
# should-fail checkout into a success — one lucky poll is enough to kill the demo.
#
# This value is NOT independently tunable: it is only safe while the collection is
# sized to stay disk-bound (see seed_payments.py, which targets ~2x the WiredTiger
# cache). Scan time is a function of cache residency, not of the query, so a
# roomier cluster or a smaller collection makes scans fast and this deadline stops
# separating the two cases. Lowering it to compensate is a trap: it keeps the demo
# failing but the status panel then shows a ~100 ms request being cut off instead
# of a genuinely slow scan, which is the one thing the panel exists to show.
#
# The startup preflight verifies the relationship still holds and warns when it
# does not — reseed larger rather than lowering this.
POLL_DEADLINE_MS = 2_500

app = FastAPI(title="Leafy Electronics Checkout")

# Resolved relative to this file, not the working directory, so the app can be
# started from anywhere.
STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Module state. Single-process, single-presenter demo; no locking needed.
state = {"incident_armed": True, "incident_enabled": True}

client: MongoClient | None = None

# Strong references to in-flight "processor confirms the payment" tasks: asyncio only
# holds a weak one, so an unreferenced task can be garbage-collected mid-sleep — which
# here means the payment is never confirmed and even post-index checkout fails.
_gateway_tasks: set[asyncio.Task] = set()


def coll():
    return client[DB_NAME][COLLECTION_NAME]


ORDER = [
    {"sku": "SKU-1001", "name": "Wireless Headphones", "qty": 1, "unit_price": 14900},
    {"sku": "SKU-1002", "name": "USB-C Cable", "qty": 1, "unit_price": 1200},
]
ORDER_TOTAL = sum(i["qty"] * i["unit_price"] for i in ORDER)


async def confirm_payment_later(session_id: str):
    """Stand in for the payment processor's confirmation webhook."""
    await asyncio.sleep(GATEWAY_DELAY_S)
    await asyncio.to_thread(
        coll().update_one,
        {"session_id": session_id},
        {"$set": {"status": "completed", "updated_at": datetime.now(timezone.utc)}},
    )


@app.post("/api/pay")
async def pay():
    """Create a real pending payment, then let the 'processor' confirm it."""
    session_id = f"sess_{secrets.token_hex(12)}"
    now = datetime.now(timezone.utc)
    doc = {
        "session_id": session_id,
        "order_id": f"ord_{secrets.randbelow(900000) + 100000}",
        "user_id": "usr_408122",
        "amount": ORDER_TOTAL,
        "currency": "USD",
        "status": "pending",
        "payment_method": "card",
        "card": {
            "brand": "visa",
            "last4": "4242",
            "exp_month": 11,
            "exp_year": 2029,
            "fingerprint": secrets.token_hex(8),
        },
        "billing_address": {
            "city": "Seattle",
            "state": "WA",
            "country": "US",
            "postal_code": "98104",
        },
        "line_items": ORDER,
        "gateway": "stripe",
        "risk_score": 4,
        "created_at": now,
        "updated_at": now,
    }
    await asyncio.to_thread(coll().insert_one, doc)
    task = asyncio.create_task(confirm_payment_later(session_id))
    _gateway_tasks.add(task)
    task.add_done_callback(_gateway_tasks.discard)
    return {"session_id": session_id, "amount": ORDER_TOTAL}


@app.get("/api/status")
async def status(session_id: str, budget_ms: int = POLL_DEADLINE_MS):
    """The checkout poll. THIS is the slow query the whole demo is about.

    Bounded by whichever is smaller: this poll's own deadline (POLL_DEADLINE_MS,
    the service's request SLO, which makes the pre-index failure deterministic) or
    the checkout's remaining budget passed in as budget_ms, which stops the last
    poll of a run from overrunning the user-facing timeout.
    """
    budget_ms = max(1, min(budget_ms, POLL_DEADLINE_MS, 60_000))
    t0 = time.perf_counter()
    try:
        found = await asyncio.to_thread(
            coll().find_one,
            {"session_id": session_id, "status": "completed"},
            max_time_ms=budget_ms,
        )
        killed = False
    except ExecutionTimeout:
        found, killed = None, True
    elapsed_ms = (time.perf_counter() - t0) * 1000
    return {
        "confirmed": found is not None,
        "timed_out": killed,
        "elapsed_ms": round(elapsed_ms, 1),
        "order_id": found.get("order_id") if found else None,
    }


@app.post("/api/incident")
async def incident():
    """Page the on-call via the ChatGPT Workspace Agent — once per arming."""
    if not state["incident_enabled"]:
        return JSONResponse({"fired": False, "reason": "disabled"}, status_code=200)
    if not state["incident_armed"]:
        return JSONResponse(
            {"fired": False, "reason": "already_fired"}, status_code=200
        )

    token = os.environ.get("AGENT_ACCESS_TOKEN")
    trigger_id = os.environ.get("WORKSPACE_AGENT_TRIGGER_ID")
    if not token or not trigger_id:
        return JSONResponse(
            {"fired": False, "reason": "missing_credentials"}, status_code=200
        )

    # Build the same PagerDuty resource the CLI sends, with the same defaults.
    args = trigger_chatgpt.main_defaults()
    incident_id = trigger_chatgpt.pagerduty_id()
    event_id = secrets.token_hex(16)
    payload = trigger_chatgpt.build_pagerduty_incident(args, incident_id)

    try:
        response = await asyncio.to_thread(
            trigger_chatgpt.trigger_agent,
            trigger_id,
            token,
            payload,
            f"pagerduty-{incident_id}",
            event_id,
        )
    except (RuntimeError, KeyError) as exc:
        return JSONResponse({"fired": False, "reason": str(exc)}, status_code=200)

    state["incident_armed"] = False
    return {
        "fired": True,
        "incident_id": incident_id,
        "conversation_url": response.get("conversation_url"),
    }


@app.get("/api/config")
async def config():
    return {
        "client_timeout_s": CLIENT_TIMEOUT_S,
        "poll_interval_ms": POLL_INTERVAL_MS,
        "incident_enabled": state["incident_enabled"],
    }


@app.get("/", response_class=HTMLResponse)
async def index():
    # Loading the checkout page re-arms the incident, so a browser refresh is the
    # reset — no demo control on the shopper's screen. Deliberately scoped to this
    # HTML route: /api/* calls never re-arm, so the polling loop can't rearm
    # mid-run and fire a second incident.
    state["incident_armed"] = True
    return PAGE


PAGE_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Leafy Electronics — Checkout</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;500;600&family=Source+Sans+3:wght@300;400;500;600;700&display=swap");

  :root {
    --mongodb-forest:#00684a; --mongodb-slate:#001e2b;
    --ink:#001e2b; --muted:#5c6c75; --subtle:#889397;
    --line:#e4e8eb; --bg:#f4f6f8; --surface:#ffffff;
    --accent:var(--mongodb-forest); --bad:#d0271d; --good:var(--mongodb-forest);
    --panel:var(--mongodb-slate);
  }
  * { box-sizing:border-box; }
  body { margin:0; font-size:15px; line-height:1.5;
         font-family:"Source Sans 3",Inter,ui-sans-serif,system-ui,-apple-system,
                     BlinkMacSystemFont,"Segoe UI",sans-serif;
         -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
         color:var(--ink); background:var(--bg); }
  header { background:var(--surface); border-bottom:1px solid var(--line); padding:14px 28px; }
  .brand { display:flex; align-items:center; gap:10px; }
  .brand-logo { width:30px; height:30px; object-fit:contain; }
  .brand-text { display:flex; flex-direction:column; line-height:1.15; }
  .brand-text strong { font-size:15px; font-weight:700; color:var(--ink); }
  .brand-text span { font-size:12px; color:var(--subtle); }
  main { max-width:940px; margin:32px auto; padding:0 20px;
         display:grid; grid-template-columns:1fr 1fr; gap:22px; align-items:start; }
  .card { background:#fff; border:1px solid var(--line); border-radius:10px; padding:22px; }
  h2 { margin:0 0 16px; font-size:15px; font-weight:650; }
  .row { display:flex; justify-content:space-between; padding:7px 0; }
  .row .n { color:var(--muted); }
  .total { border-top:1px solid var(--line); margin-top:10px; padding-top:12px; font-weight:650; }
  .field { margin:14px 0; }
  label { display:block; font-size:12px; color:var(--muted); margin-bottom:5px; }
  .fake-input { border:1px solid var(--line); border-radius:7px; padding:10px 12px;
                background:#fafafb; font-variant-numeric:tabular-nums; }
  button.pay { width:100%; margin-top:8px; padding:13px; font-size:15px; font-weight:600;
        color:#fff; background:var(--accent); border:0; border-radius:7px; cursor:pointer; }
  button.pay:disabled { background:#9db8d4; cursor:not-allowed; }
  .status { margin-top:18px; padding-top:16px; border-top:1px solid var(--line);
            display:none; }
  .status.show { display:block; }
  .spinner { display:inline-block; width:13px; height:13px; margin-right:8px;
             border:2px solid #cfd8e3; border-top-color:var(--accent);
             border-radius:50%; animation:spin .8s linear infinite; vertical-align:-2px; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .msg { font-weight:600; }
  .msg.fail { color:var(--bad); }
  .msg.ok { color:var(--good); }
  .sub { color:var(--muted); font-size:13px; margin-top:5px; }
  .panel { background:var(--panel); border-radius:10px; padding:18px 20px; color:#e8e8ee;
           font:12.5px/1.7 "Source Code Pro",ui-monospace,SFMono-Regular,Menlo,monospace; }
  .panel h3 { margin:0 0 12px; font:600 11px/1 -apple-system,sans-serif;
              letter-spacing:.09em; text-transform:uppercase; color:#8b8b99; }
  .log { min-height:190px; }
  .log div { display:flex; gap:10px; white-space:pre; }
  .log .lbl { color:#8b8b99; }
  .log .ms { color:#ffd479; font-variant-numeric:tabular-nums; }
  .log .res { color:#8b8b99; }
  .log .hit { color:#7ee08a; }
  .log .to  { color:#ff8a8a; }
</style>
</head>
<body>
<header>
  <div class="brand">
    <img src="/static/mongodb-logo.png" alt="MongoDB" class="brand-logo" />
    <div class="brand-text">
      <strong>Leafy Electronics</strong>
      <span>Checkout</span>
    </div>
  </div>
</header>
<main>
  <div class="card">
    <h2>Order summary</h2>
    __ORDER_ROWS__
    <div class="field" style="margin-top:20px">
      <label>Card number</label>
      <div class="fake-input">•••• •••• •••• 4242</div>
    </div>
    <button class="pay" id="pay">Submit payment</button>
    <div class="status" id="status">
      <div class="msg" id="msg"><span class="spinner"></span>Processing your payment…</div>
      <div class="sub" id="sub">Please don't close this window.</div>
    </div>
  </div>

  <div class="panel">
    <h3>Checkout status poll</h3>
    <div class="log" id="log"><div class="lbl">idle — awaiting payment</div></div>
  </div>
</main>
<script>
const $ = id => document.getElementById(id);
let cfg = { client_timeout_s: 12, poll_interval_ms: 2500 };

// Incident state is intentionally NOT shown on the page — this is a shopper's
// checkout, not a demo console. Loading this page re-armed the incident, so a
// browser refresh is the reset. Dispatch details go to the console below.
fetch('/api/config').then(r => r.json()).then(c => {
  cfg = c;
  console.log('[demo] checkout config', c);
});

function line(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  $('log').appendChild(d);
  $('log').scrollTop = $('log').scrollHeight;
}

const sleep = ms => new Promise(z => setTimeout(z, ms));

$('pay').onclick = async () => {
  $('pay').disabled = true;
  $('log').innerHTML = '';
  $('status').className = 'status show';
  $('msg').className = 'msg';
  $('msg').innerHTML = '<span class="spinner"></span>Processing your payment…';
  $('sub').textContent = "Please don't close this window.";

  // Everything below is wrapped. An unhandled rejection anywhere in the poll loop
  // would leave the spinner spinning forever, the button disabled, and the incident
  // never dispatched — a silent hang with no failure and no alert, which on stage is
  // indistinguishable from "the demo broke".
  let confirmed = null;
  try {
    const { session_id } = await (await fetch('/api/pay', { method:'POST' })).json();
    line('<span class="lbl">payment created</span> <span class="res">' + session_id + '</span>');

    const deadline = Date.now() + cfg.client_timeout_s * 1000;
    let n = 0;

    while (Date.now() < deadline) {
      n++;
      try {
        // Hand the server our remaining budget so the last poll of a run can't
        // overrun the checkout timeout.
        const budget = Math.round(deadline - Date.now());
        const r = await (await fetch('/api/status?session_id=' + session_id +
                                     '&budget_ms=' + budget)).json();
        const ms = r.elapsed_ms.toLocaleString(undefined, {maximumFractionDigits:0});
        if (r.confirmed) {
          line('<span class="lbl">poll ' + n + '</span><span class="ms">' + ms +
               ' ms</span><span class="hit">confirmed</span>');
          confirmed = r; break;
        }
        line('<span class="lbl">poll ' + n + '</span><span class="ms">' + ms +
             ' ms</span><span class="res">' +
             (r.timed_out ? 'gave up' : 'no result') + '</span>');
      } catch (err) {
        // One failed request is not a failed checkout: log it and keep polling
        // until the budget runs out, exactly as a real page would.
        console.error('[demo] poll ' + n + ' failed:', err);
        line('<span class="lbl">poll ' + n + '</span><span class="to">request failed</span>');
      }
      // Real checkout pages pace their polls rather than hammering. Also keeps the
      // panel readable post-index, where polls return in milliseconds.
      //
      // Log the wait too. Without it the panel only shows query time, so the poll
      // latencies visibly sum to less than the "timed out after Ns" line that
      // follows them — an audience adding up the numbers sees a discrepancy that
      // looks like a bug in the demo rather than deliberate pacing.
      const left = deadline - Date.now();
      if (left > 0) {
        const wait = Math.min(cfg.poll_interval_ms, left);
        line('<span class="lbl">waiting</span><span class="ms">' +
             wait.toLocaleString(undefined, {maximumFractionDigits:0}) +
             ' ms</span><span class="res">before next poll</span>');
        await sleep(wait);
      }
    }
  } catch (err) {
    // Couldn't even create the payment. Show the shopper a failure rather than an
    // eternal spinner, and let the incident fire as it would for a timeout.
    console.error('[demo] checkout aborted:', err);
    line('<span class="to">checkout error: ' + err.message + '</span>');
  }

  if (confirmed) {
    $('msg').className = 'msg ok';
    $('msg').textContent = '✓ Payment confirmed';
    $('sub').textContent = 'Order ' + confirmed.order_id + ' is on its way.';
  } else {
    $('msg').className = 'msg fail';
    $('msg').textContent = "✗ We couldn't confirm your payment";
    $('sub').textContent = 'Please try again or use a different card.';
    line('<span class="to">timed out after ' + cfg.client_timeout_s + 's</span>');

    // Dispatch happens silently: the shopper's page shouldn't narrate PagerDuty.
    // Everything lands in the console so you can still debug from devtools.
    try {
      const inc = await (await fetch('/api/incident', { method:'POST' })).json();
      if (inc.fired) {
        console.log('[demo] incident ' + inc.incident_id + ' dispatched →', inc.conversation_url);
      } else if (inc.reason === 'already_fired') {
        console.log('[demo] incident already fired this session — refresh the page to re-arm');
      } else if (inc.reason === 'disabled') {
        console.log('[demo] incident dispatch disabled (--no-incident)');
      } else {
        console.error('[demo] incident dispatch FAILED:', inc.reason);
      }
    } catch (err) {
      // The checkout has already failed visibly; don't let a dispatch error strand
      // the page. Re-run trigger_chatgpt.py by hand if this fires.
      console.error('[demo] incident dispatch threw:', err);
    }
  }
  // Always re-enable, whatever happened above: a disabled button with a dead
  // spinner is the one state you can't recover from on stage without a refresh.
  $('pay').disabled = false;
};
</script>
</body>
</html>
"""


def _order_rows():
    """Render the order summary from ORDER, so prices can't drift from the doc."""
    rows = [
        f'<div class="row"><span class="n">{item["name"]}</span>'
        f"<span>${item['qty'] * item['unit_price'] / 100:,.2f}</span></div>"
        for item in ORDER
    ]
    rows.append(
        f'<div class="row total"><span>Total</span>'
        f"<span>${ORDER_TOTAL / 100:,.2f}</span></div>"
    )
    return "\n    ".join(rows)


PAGE = PAGE_TEMPLATE.replace("__ORDER_ROWS__", _order_rows())


def preflight():
    """Check that the cluster can still produce the demo's failure, and say so.

    The pre-index checkout only fails if EVERY poll is killed at
    POLL_DEADLINE_MS — which requires scans slower than that deadline. Scan speed
    is a property of how much of the collection is resident in the WiredTiger
    cache, so swapping clusters, resizing a tier, or reseeding less data silently
    turns the failure into a success. This has broken the demo more than once, and
    always at showtime, because nothing checked it at launch.

    Times one real poll-shaped query and reports what it implies. Warns rather
    than exits: a slow first scan on a cold cache is normal, and being wrong here
    should not block a presenter minutes before going on.
    """
    # This costs one full COLLSCAN (seconds), so say so before blocking on it —
    # otherwise startup looks hung. flush=True because stdout is block-buffered
    # when piped or redirected, which is exactly how setup_demo.sh runs this.
    print("Preflight: timing one unindexed scan ...", flush=True)

    coll_ = coll()
    indexes = list(coll_.index_information())
    demo_index = "session_id_1_status_1"
    if demo_index in indexes:
        print(
            f"WARNING: index {demo_index} EXISTS — checkout will SUCCEED and the "
            "incident is bogus.\n"
            "         Reset first: python seed_payments.py --drop-index",
            flush=True,
        )
        return

    q = {"session_id": f"sess_{secrets.token_hex(12)}", "status": "completed"}
    t0 = time.perf_counter()
    try:
        coll_.find_one(q, max_time_ms=30_000)
    except ExecutionTimeout:
        print("Preflight: scan exceeded 30 s — comfortably slow enough.", flush=True)
        return
    scan_ms = (time.perf_counter() - t0) * 1000

    print(
        f"Preflight: unindexed scan took {scan_ms:,.0f} ms (deadline {POLL_DEADLINE_MS} ms).",
        flush=True,
    )
    if scan_ms > POLL_DEADLINE_MS * 1.5:
        print(
            "           Comfortably slower than the deadline — checkout will fail.",
            flush=True,
        )
        return

    print(
        f"WARNING: scans are FAST relative to the {POLL_DEADLINE_MS} ms deadline, so a "
        "poll can\n"
        "         complete after the gateway confirms and checkout will SUCCEED —\n"
        "         no hang, and any incident it fires is bogus.\n"
        "         Cause is usually cache residency: the collection now fits in the\n"
        "         WiredTiger cache (a roomier cluster, or less data than expected).\n"
        "         Fix: reseed bigger so storage stays ~2x the cache, e.g.\n"
        "         python seed_payments.py --drop --blob-bytes <larger>",
        flush=True,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument(
        "--no-incident",
        action="store_true",
        help="rehearse the checkout without paging the agent",
    )
    args = parser.parse_args()

    uri = os.environ.get("MONGODB_URI")
    if not uri:
        sys.exit("ERROR: set MONGODB_URI in .env")

    global client
    client = MongoClient(uri, appname="perf-triage-demo-checkout")
    client.admin.command("ping")  # fail fast, before the stage

    state["incident_enabled"] = not args.no_incident
    if args.no_incident:
        print("Incident dispatch DISABLED (--no-incident): checkout will fail quietly.")
    elif not os.environ.get("AGENT_ACCESS_TOKEN"):
        print("WARNING: AGENT_ACCESS_TOKEN unset — checkout will fail but page no one.")

    preflight()

    print(f"Checkout page: http://{args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
