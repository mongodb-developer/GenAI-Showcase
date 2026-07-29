"""Contoso checkout page — the demo's opening act, and a real reproduction of the bug.

Nothing here is simulated except the payment processor. The page runs the SAME
status-poll query the demo is about, against the SAME unindexed collection:

    db.payments.findOne({ session_id: ..., status: "completed" })

Pre-index that poll is a ~6 s COLLSCAN, so the page genuinely blows its client-side
budget and genuinely fails. Post-index it returns in ~1 ms and the page succeeds.
The hang is not staged; it is the bug.

Flow when you click "Submit payment":
  1. POST /api/pay      inserts a real payment doc with status="pending", and
                        schedules a background task to flip it to "completed"
                        after GATEWAY_DELAY_S (stands in for the processor webhook).
  2. GET  /api/status   runs the real poll query. The browser calls this in a loop
                        and shows each attempt's latency in the status panel.
  3. On timeout, the browser calls POST /api/incident, which sends the PagerDuty
                        incident to the ChatGPT Workspace Agent — ONCE. A "Re-arm"
                        control resets it so a rehearsal doesn't spend the demo.

The ChatGPT access token stays server-side; the browser never sees it.

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
from datetime import datetime, timedelta, timezone

try:
    from fastapi import FastAPI
    from fastapi.responses import HTMLResponse, JSONResponse
    from pymongo import MongoClient
    from pymongo.errors import ExecutionTimeout
    from dotenv import load_dotenv
    import uvicorn
except ImportError:
    sys.exit("Missing deps. Run: pip install -r requirements.txt")

# Reuse the incident builder and API client rather than duplicating the payload.
import trigger_chatgpt

load_dotenv()

DB_NAME = "ecommerce"
COLLECTION_NAME = "payments"

# How long the fake processor takes to confirm. Realistic (real gateways take
# 1-3 s) and well under CLIENT_TIMEOUT_S, so post-index the page succeeds fast.
GATEWAY_DELAY_S = 3.0

# The user-facing budget: how long the shopper watches the spinner before the page
# gives up. Real checkouts often allow 30 s, but that is a long silence to narrate
# on stage — 12 s reads as clearly broken while staying brisk. Correctness does not
# depend on this value (see POLL_DEADLINE_MS), so it is safe to tune for pacing.
# Must stay comfortably above GATEWAY_DELAY_S or the post-index SUCCESS case breaks.
CLIENT_TIMEOUT_S = 12.0

# Gap between polls. Real checkout pages poll every 2-3 s rather than hammering.
# With a 12 s budget this yields 3 visible poll lines, ~5 s apart.
POLL_INTERVAL_MS = 2_500

# Per-request deadline for ONE poll, applied as maxTimeMS. Real services set a
# per-call deadline (API gateway, service SLO) far below the overall user budget,
# so having one is normal — but this VALUE is calibrated deliberately:
#
#   Measured COLLSCANs on this cluster range 4.0-9.0 s. 2.5 s sits below the
#   fastest of them, so EVERY pre-index poll is killed server-side before it can
#   complete. No poll ever observes the gateway's confirmation, so checkout
#   ALWAYS fails — regardless of cluster load on the day.
#
# Without this, the outcome depends on scan time vs. the overall budget: a poll
# that completes after the gateway confirms would find the record and checkout
# would SUCCEED, silently killing the demo. A 4.0 s burst was measured, so that
# edge is real, not theoretical. Post-index polls take ~20 ms and are unaffected.
POLL_DEADLINE_MS = 2_500

app = FastAPI(title="Contoso Checkout")

# Module state. Single-process, single-presenter demo; no locking needed.
state = {
    "incident_armed": True,
    "incident_enabled": True,
    "last_incident": None,
}

client: MongoClient | None = None


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
        "card": {"brand": "visa", "last4": "4242", "exp_month": 11,
                 "exp_year": 2029, "fingerprint": secrets.token_hex(8)},
        "billing_address": {"city": "Seattle", "state": "WA",
                            "country": "US", "postal_code": "98104"},
        "line_items": ORDER,
        "gateway": "stripe",
        "risk_score": 4,
        "created_at": now,
        "updated_at": now,
    }
    await asyncio.to_thread(coll().insert_one, doc)
    asyncio.create_task(confirm_payment_later(session_id))
    return {"session_id": session_id, "amount": ORDER_TOTAL}


@app.get("/api/status")
async def status(session_id: str, budget_ms: int = POLL_DEADLINE_MS):
    """The checkout poll. THIS is the slow query the whole demo is about.

    The query is bounded by whichever is SMALLER: this poll's own deadline
    (POLL_DEADLINE_MS) or the checkout's remaining budget passed in as budget_ms.
    Two different limits, both real:

      * the per-poll deadline is the service's own request SLO, and it's what
        makes the pre-index failure deterministic (see POLL_DEADLINE_MS);
      * the remaining-budget cap stops the last poll of a run from overrunning
        the user-facing timeout, which would let a scan finish AFTER the gateway
        confirms and turn a should-fail checkout into a success.
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
        return JSONResponse({"fired": False, "reason": "already_fired"}, status_code=200)

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
            trigger_id, token, payload, f"pagerduty-{incident_id}", event_id,
        )
    except (RuntimeError, KeyError) as exc:
        return JSONResponse({"fired": False, "reason": str(exc)}, status_code=200)

    state["incident_armed"] = False
    state["last_incident"] = {
        "incident_id": incident_id,
        "conversation_url": response.get("conversation_url"),
    }
    return {
        "fired": True,
        "incident_id": incident_id,
        "conversation_url": response.get("conversation_url"),
    }


@app.post("/api/rearm")
async def rearm():
    state["incident_armed"] = True
    return {"armed": True}


@app.get("/api/config")
async def config():
    return {
        "client_timeout_s": CLIENT_TIMEOUT_S,
        "poll_interval_ms": POLL_INTERVAL_MS,
        "incident_enabled": state["incident_enabled"],
        "incident_armed": state["incident_armed"],
    }


@app.get("/", response_class=HTMLResponse)
async def index():
    # Loading the checkout page re-arms the incident, so a browser refresh is the
    # reset — no demo control on the shopper's screen. Deliberately scoped to this
    # HTML route: /api/* calls never re-arm, so the polling loop can't rearm
    # mid-run and fire a second incident.
    state["incident_armed"] = True
    return PAGE


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Contoso — Checkout</title>
<style>
  :root {
    --ink:#1a1a1c; --muted:#6b6b73; --line:#e4e4e8; --bg:#f6f6f8;
    --accent:#0b6bcb; --bad:#c62828; --good:#1b7f3b; --panel:#12141a;
  }
  * { box-sizing:border-box; }
  body { margin:0; font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
         color:var(--ink); background:var(--bg); }
  header { background:#fff; border-bottom:1px solid var(--line); padding:14px 28px; }
  .brand { font-weight:650; font-size:17px; letter-spacing:-.2px; }
  .brand span { color:var(--accent); }
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
           font:12.5px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace; }
  .panel h3 { margin:0 0 12px; font:600 11px/1 -apple-system,sans-serif;
              letter-spacing:.09em; text-transform:uppercase; color:#8b8b99; }
  .log { min-height:190px; }
  .log div { display:flex; gap:10px; white-space:pre; }
  .log .lbl { color:#8b8b99; }
  .log .ms { color:#ffd479; font-variant-numeric:tabular-nums; }
  .log .res { color:#8b8b99; }
  .log .hit { color:#7ee08a; }
  .log .to  { color:#ff8a8a; }
  .log .fire { color:#9fc4ff; }
  a { color:#9fc4ff; }
</style>
</head>
<body>
<header><div class="brand">contoso<span>.</span></div></header>
<main>
  <div class="card">
    <h2>Order summary</h2>
    <div class="row"><span class="n">Wireless Headphones</span><span>$149.00</span></div>
    <div class="row"><span class="n">USB-C Cable</span><span>$12.00</span></div>
    <div class="row total"><span>Total</span><span>$161.00</span></div>
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
let cfg = { client_timeout_s: 30, poll_interval_ms: 3000 };

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
      // Hand the server our remaining budget so the last poll of a run can't
      // overrun the checkout timeout.
      const budget = deadline - Date.now();
      let r;
      try {
        r = await (await fetch('/api/status?session_id=' + session_id +
                               '&budget_ms=' + Math.round(budget))).json();
      } catch (err) {
        // One failed request is not a failed checkout: log it and keep polling
        // until the budget runs out, exactly as a real page would.
        console.error('[demo] poll ' + n + ' failed:', err);
        line('<span class="lbl">poll ' + n + '</span><span class="to">request failed</span>');
        const left = deadline - Date.now();
        if (left > 0) await new Promise(z => setTimeout(z, Math.min(cfg.poll_interval_ms, left)));
        continue;
      }
      const ms = r.elapsed_ms.toLocaleString(undefined, {maximumFractionDigits:0});
      if (r.confirmed) {
        line('<span class="lbl">poll ' + n + '</span><span class="ms">' + ms +
             ' ms</span><span class="hit">confirmed</span>');
        confirmed = r; break;
      }
      line('<span class="lbl">poll ' + n + '</span><span class="ms">' + ms +
           ' ms</span><span class="res">' +
           (r.timed_out ? 'gave up' : 'no result') + '</span>');
      // Real checkout pages pace their polls rather than hammering. Also keeps the
      // panel readable post-index, where polls take ~20 ms.
      const left = deadline - Date.now();
      if (left > 0) await new Promise(z => setTimeout(z, Math.min(cfg.poll_interval_ms, left)));
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-incident", action="store_true",
                        help="rehearse the checkout without paging the agent")
    args = parser.parse_args()

    uri = os.environ.get("MONGODB_URI")
    if not uri:
        sys.exit('ERROR: set MONGODB_URI in .env')

    global client
    client = MongoClient(uri, appname="perf-triage-demo-checkout")
    client.admin.command("ping")  # fail fast, before the stage

    state["incident_enabled"] = not args.no_incident
    if args.no_incident:
        print("Incident dispatch DISABLED (--no-incident): checkout will fail quietly.")
    elif not os.environ.get("AGENT_ACCESS_TOKEN"):
        print("WARNING: AGENT_ACCESS_TOKEN unset — checkout will fail but page no one.")

    print(f"Checkout page: http://{args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
