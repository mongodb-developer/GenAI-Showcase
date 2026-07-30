const state = {
  sessionId: localStorage.getItem("ambientInventorySessionId"),
  activeTab: "dashboard",
  selectedAlertId: null,
  snapshot: null,
  pollHandle: null,
  lastSignature: null,
  prevActiveAlerts: 0,
  // Streaming chat
  streaming: false,
  streamText: "",
  streamTools: [],
  streamError: null,
  pendingOwnerMessage: null,
  submitting: false,
  banner: null,
};

const els = {
  view: document.getElementById("view"),
  pageTitle: document.getElementById("pageTitle"),
  alertBadge: document.getElementById("alertBadge"),
  navItems: Array.from(document.querySelectorAll(".nav-item")),
};

// Shown as a timeline while the demo starts. Wording tracks what the server is
// actually doing in /api/demo/start.
const START_STEPS = [
  "Connecting to MongoDB Remote MCP",
  "Authenticating the service account",
  "Opening the Atlas cluster connection",
  "Starting the scheduled inventory sweep",
];

// Paced for narration, not for speed: each step needs to stay on screen long enough
// to be talked through. Raise these to slow the opening down further.
const CURTAIN_STEP_MS = 2600;
const CURTAIN_SETTLE_MS = 900;

// Medium is the healthy case for this demo — a reorder point reached with time to
// spare. Only High warrants red.
const SEVERITY_CLASS = { High: "danger", Medium: "warning", Low: "neutral" };

const PAGE_TITLES = {
  dashboard: "Dashboard",
  alerts: "Inbox",
  products: "Products",
  purchase_orders: "Purchase orders",
  suppliers: "Suppliers",
};

// Labels say where each line actually came from: the deterministic monitor, a
// driver query, or a real Remote MCP tool call made by the model.
const EVENT_META = {
  agent_plan: { label: "Agent · plan", cls: "plan" },
  mcp_tool: { label: "Agent · MCP", cls: "mcp" },
  agent_finding: { label: "Agent · finding", cls: "response" },
  agent_response: { label: "Agent · answer", cls: "response" },
  owner_message: { label: "Owner · asked", cls: "plan" },
  agent_message: { label: "Agent · replied", cls: "response" },
  approval: { label: "Owner · approved", cls: "plan" },
  db_write: { label: "MongoDB · write", cls: "db" },
  error: { label: "Error", cls: "danger" },
};

/* ---------- API ---------- */
async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return response.json();
}

/* ---------- Formatting ---------- */
/* Activity times in the viewer's own timezone. The server sends UTC with an
   offset, so the browser converts; seconds matter because sweep events land a
   second or two apart. */
function fmtDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function fmtDay(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function money(value) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value || 0);
}

function titleCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Treat "close enough to the bottom" as pinned. An exact comparison fails on
// fractional scroll heights from zoom or a trackpad's sub-pixel scrolling, which would
// silently turn auto-follow off and look like the feed had frozen.
const PIN_SLACK_PX = 24;
function isPinnedToBottom(el) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= PIN_SLACK_PX;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------- Derived helpers ---------- */
function activeAlerts() {
  return (state.snapshot?.alerts || []).filter(
    (alert) => !["Resolved", "Dismissed"].includes(alert.status),
  );
}

function currentAlert() {
  return (state.snapshot?.alerts || []).find((alert) => alert._id === state.selectedAlertId);
}

/* Every product an open alert touches — the one it is attributed to, plus every
   other SKU sharing the blocking component. A shared-component shortage affects
   them all equally, so they should all read as alerted. */
function atRiskProductIds() {
  const ids = new Set();
  const bySku = new Map(
    (state.snapshot?.products || []).map((product) => [product.sku, product._id]),
  );
  activeAlerts().forEach((alert) => {
    if (alert.risk?.product_id) ids.add(alert.risk.product_id);
    (alert.risk?.blocker_shared_with || []).forEach((sku) => {
      const id = bySku.get(sku);
      if (id) ids.add(id);
    });
  });
  return ids;
}

/* Products whose shortage has been ordered but not yet received.
   Placing an order resolves the alert, which would otherwise flip these SKUs
   straight back to "Healthy" — but nothing has arrived: the stock on hand is
   unchanged and the supplier is still days out. They stay distinct from healthy
   until the order's status leaves "ordered". */
function inboundInventoryIds() {
  const ids = new Set();
  (state.snapshot?.purchase_orders || [])
    .filter((po) => po.status === "ordered")
    .forEach((po) => {
      (po.line_items || []).forEach((line) => {
        if (line.inventory_id) ids.add(line.inventory_id);
      });
    });
  return ids;
}

function onOrderProductIds() {
  const inbound = inboundInventoryIds();
  if (!inbound.size) return new Set();

  // Any product drawing on an inbound component is waiting on it. Derived from the
  // bill of materials rather than a cached list, same as the sweep does.
  const ids = new Set();
  (state.snapshot?.products || []).forEach((product) => {
    const waiting = (product.components || []).some((component) =>
      inbound.has(component.inventory_id),
    );
    if (waiting) ids.add(product._id);
  });
  return ids;
}

function blockerInventoryIds() {
  return new Set(activeAlerts().map((alert) => alert.risk?.blocker_inventory_id).filter(Boolean));
}

function supplierName(supplierId) {
  const supplier = (state.snapshot?.suppliers || []).find((item) => item._id === supplierId);
  return supplier ? supplier.name : "—";
}

/* Status comes from the server's cover calculation (finished units plus what the
   limiting component can still make), so this can never contradict the inbox. */
function productStatus(product, riskIds, onOrderIds) {
  // Only the agent's findings colour this. The server can compute reorder status
  // itself, but showing it would answer the question before the agent does and
  // spoil the reveal — the point of the demo is that the risk is invisible until
  // something goes looking for it.
  if (riskIds.has(product._id)) return { label: "Reorder", cls: "warning" };
  // Ordered but not arrived. Placing the order resolves the alert, and without this
  // the SKU would claim to be "Healthy" while the stock on hand is unchanged and the
  // supplier is still days out.
  if (onOrderIds && onOrderIds.has(product._id)) {
    return { label: "On order", cls: "info" };
  }
  return { label: "Healthy", cls: "success" };
}

/* "402" rather than "402 each": a count needs no unit, but a weight does. */
function onHand(item) {
  const quantity = (item.quantity_on_hand ?? 0).toLocaleString();
  const unit = item.unit && item.unit !== "each" ? ` ${item.unit}` : "";
  return `${quantity}${escapeHtml(unit)}`;
}

function coverDays(product) {
  const cover = (state.snapshot?.cover || {})[product._id];
  return cover ? `${cover.days_of_cover} days` : "—";
}

/* One line stating the problem and the fix, written by the agent. */
function alertHeadline(alert) {
  return alert.summary || "";
}

/* The agent chooses which figures matter, so render what it filed rather than a
   fixed set of tiles. Falls back to the rule's fields when a rule authored the
   alert (MCP unavailable). */
function alertStats(alert) {
  const stats = alert.risk?.stats;
  if (Array.isArray(stats) && stats.length) return stats;

  // Last resort only: both the agent and the rule now supply `stats` directly.
  const risk = alert.risk || {};
  const affected = 1 + (risk.blocker_shared_with || []).length;
  const fallback = [
    { label: "SKUs affected", value: `${affected} products`, emphasis: "critical" },
    {
      label: "Stock vs reorder",
      value:
        risk.blocker_quantity_on_hand != null && risk.component_reorder_point != null
          ? `${risk.blocker_quantity_on_hand} / ${risk.component_reorder_point} units`
          : "—",
      emphasis: "critical",
    },
    {
      label: "Days left",
      value:
        risk.component_days_left != null
          ? `${Math.floor(risk.component_days_left)} days`
          : "—",
      emphasis: "warning",
    },
  ];
  return fallback.filter((stat) => stat.value !== "—");
}


/* What closed the alert. Without this the card just collapses and it is not
   obvious an order was actually placed. */
function resolvedNote(alert) {
  const order = (state.snapshot?.purchase_orders || []).find(
    (po) => po.alert_id === alert._id && po.status === "ordered",
  );
  if (!order) return "";
  const line = (order.line_items || [])[0] || {};
  return `
    <span class="alert-resolved">
      Ordered ${(line.quantity || 0).toLocaleString()} ${escapeHtml(line.name || "units")}
      from ${escapeHtml(order.supplier_name || "supplier")} · ${escapeHtml(order._id)}
    </span>`;
}



/* Whether the order on file is the one recommended here. If the owner ordered from
   someone else in the chat, this recommendation was never acted on — so the button
   keeps offering it rather than claiming credit for a different purchase. */
function recommendationOrdered(alert) {
  const order = (state.snapshot?.purchase_orders || []).find(
    (po) => po.alert_id === alert._id && po.status === "ordered",
  );
  return Boolean(order && order.supplier_id === (alert.recommendation || {}).supplier_id);
}

function statTiles(alert) {
  const tiles = alertStats(alert)
    .map(
      (stat) => `
        <div class="risk-tile ${escapeHtml(stat.emphasis || "neutral")}">
          <span>${escapeHtml(stat.label)}</span>
          <strong>${escapeHtml(stat.value)}</strong>
        </div>`,
    )
    .join("");
  return `<div class="risk-grid">${tiles}</div>`;
}

/* ---------- Session ---------- */
/* Boot into the start curtain and run nothing. Pressing Enter resets the scenario
   and starts the sweep, so opening the app is always safe — no URL parameter to
   remember, and a rehearsal leaves nothing behind for the real run.

   An in-progress demo survives a reload: if this session already has activity, skip
   the curtain and rejoin it. */
async function startSession() {
  const resumed = state.sessionId
    ? await api("/api/demo/session", {
        method: "POST",
        body: JSON.stringify({ session_id: state.sessionId }),
      }).catch(() => null)
    : null;

  if (resumed) {
    state.sessionId = resumed.session_id;
    await refreshState();
  }
  state.pollHandle = setInterval(refreshState, 2500);

  if ((state.snapshot?.history || []).length) {
    render(true);
  } else {
    renderCurtain();
  }
}

/* Full-screen start curtain. Reconnects Remote MCP before sweeping, because a
   long-idle laptop may be holding an expired OAuth token and connectionId. */
function renderCurtain() {
  if (document.getElementById("curtain")) return;
  const node = document.createElement("div");
  node.id = "curtain";
  node.className = "curtain";
  node.innerHTML = `
    <div class="curtain-card">
      <img src="/static/mongodb-logo.png" alt="" class="curtain-logo" />
      <h2>Leafy Roasters</h2>
      <button id="curtainStart" type="button" class="btn--primary curtain-btn">
        Start demo
      </button>
      <ol id="curtainSteps" class="steps hidden">
        ${START_STEPS.map(
          (label) => `<li class="step"><span class="step-dot"></span>${escapeHtml(label)}</li>`,
        ).join("")}
      </ol>
    </div>`;
  document.body.appendChild(node);

  const button = node.querySelector("#curtainStart");
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Starting…";

    // Progress as a timeline rather than one replaced line: the MCP handshake takes
    // a few seconds, and seeing completed steps accumulate reads as work rather
    // than a hang.
    const list = node.querySelector("#curtainSteps");
    const items = Array.from(list.querySelectorAll(".step"));
    list.classList.remove("hidden");

    let step = 0;
    const advance = () => {
      items.forEach((item, index) => {
        item.classList.toggle("done", index < step);
        item.classList.toggle("active", index === step);
      });
    };
    advance();
    const ticker = setInterval(() => {
      if (step < items.length - 1) {
        step += 1;
        advance();
      }
    }, CURTAIN_STEP_MS);

    try {
      const started = await api("/api/demo/start", {
        method: "POST",
        body: JSON.stringify({}),
      });
      state.sessionId = started.session_id;
      localStorage.setItem("ambientInventorySessionId", state.sessionId);

      // The handshake often finishes before the timeline has walked through every
      // step. Dropping the curtain at that moment skips past steps the presenter is
      // still narrating, so let the remaining ones play out first. Capped so a fast
      // connection cannot stall the demo for long.
      const remaining = items.length - 1 - step;
      if (remaining > 0) {
        await sleep(Math.min(remaining, 2) * CURTAIN_STEP_MS);
      }

      clearInterval(ticker);
      step = items.length;
      advance();
      // Beat on the completed timeline: every step ticked, before the dashboard.
      await sleep(CURTAIN_SETTLE_MS);
      node.remove();
      await refreshState();
      render(true);
    } catch (error) {
      clearInterval(ticker);
      items.forEach((item) => item.classList.remove("active", "done"));
      items[step].classList.add("failed");
      items[step].append(` — ${String(error.message || error).slice(0, 120)}`);
      button.disabled = false;
      button.textContent = "Retry";
    }
  });
}

async function refreshState() {
  if (!state.sessionId) return;
  try {
    const snapshot = await api(`/api/state?session_id=${encodeURIComponent(state.sessionId)}`);
    state.snapshot = snapshot;
    // Only overwrite when there is something to say; otherwise an action's message
    // (like "this alert already has an order") would be wiped by the next poll.
    const health = snapshotBanner(snapshot);
    if (health || !state.banner?.sticky) state.banner = health;
  } catch (error) {
    state.banner = { kind: "danger", text: `Cannot reach the server: ${error.message}` };
    renderBanner();
    return;
  }

  const active = activeAlerts().length;
  const isNewAlert = active > state.prevActiveAlerts;
  state.prevActiveAlerts = active;
  // A full re-render mid-stream would destroy the live message node, so only the
  // chrome updates here. The stream's own completion handler re-renders, which is
  // what reflects an order the agent placed during the turn.
  if (state.streaming) {
    renderBadge(isNewAlert);
    renderBanner();
    return;
  }
  render(false, isNewAlert);
}

function snapshotBanner(snapshot) {
  const mcp = snapshot.mcp || {};
  if (!mcp.configured) {
    return {
      kind: "danger",
      text: "Remote MCP is not configured. Set MDB_MCP_API_CLIENT_ID / _SECRET and MDB_MCP_PROJECT_ID in .env — the agent has no tools without it.",
    };
  }
  if (!mcp.ready) {
    return {
      kind: "danger",
      text: `Remote MCP is not connected${mcp.error ? `: ${mcp.error}` : "."} The agent cannot answer until it is.`,
    };
  }
  return null;
}

function renderBanner() {
  let node = document.getElementById("banner");
  if (!state.banner) {
    if (node) node.remove();
    return;
  }
  if (!node) {
    node = document.createElement("div");
    node.id = "banner";
    document.querySelector(".content").prepend(node);
  }
  node.className = `banner ${state.banner.kind}`;
  node.textContent = state.banner.text;
}

/* ---------- Notification badge ---------- */
function renderBadge(pulse) {
  const count = activeAlerts().length;
  els.alertBadge.textContent = count;
  els.alertBadge.classList.toggle("hidden", count === 0);
  if (pulse && count > 0) {
    els.alertBadge.classList.remove("pulse");
    // reflow so the animation restarts
    void els.alertBadge.offsetWidth;
    els.alertBadge.classList.add("pulse");
  }
}

function renderNav() {
  els.navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === state.activeTab);
  });
  els.pageTitle.textContent = PAGE_TITLES[state.activeTab] || "";
}

/* ---------- Render dispatch ---------- */
function signature() {
  const snap = state.snapshot || {};
  // Include the recommendation: the agent can revise it mid-conversation without
  // the status changing, and the proposal tiles have to follow.
  const alerts = (snap.alerts || [])
    .map((alert) => {
      const rec = alert.recommendation || {};
      return `${alert._id}:${alert.status}:${rec.supplier_id}:${rec.quantity}`;
    })
    .join(",");
  const pos = (snap.purchase_orders || []).map((po) => `${po._id}:${po.status}`).join(",");
  const messages = (snap.dialogue || []).length;
  const events = (snap.history || []).length;
  return [state.activeTab, state.selectedAlertId, alerts, pos, messages, events].join("|");
}

function render(force = false, pulse = false) {
  renderNav();
  renderBadge(pulse);
  renderBanner();
  const sig = signature();
  if (!force && sig === state.lastSignature) return;
  state.lastSignature = sig;

  const views = {
    dashboard: dashboardView,
    alerts: alertsView,
    products: productsView,
    purchase_orders: purchaseOrdersView,
    suppliers: suppliersView,
  };
  // Read the feed's scroll position BEFORE the rebuild below throws the old node
  // away: whether to auto-scroll depends on where the reader was, and after
  // innerHTML there is nothing left to ask.
  const oldFeed = els.view.querySelector(".activity-list");
  const wasPinned = oldFeed ? isPinnedToBottom(oldFeed) : true;
  const priorScroll = oldFeed ? oldFeed.scrollTop : 0;

  els.view.innerHTML = (views[state.activeTab] || dashboardView)();
  if (state.activeTab === "alerts") wireAlertsView();

  // The feed appears on both Dashboard and Inbox. Follow the newest event only while
  // the reader is already at the bottom; if they have scrolled up to read an earlier
  // tool call, hold their position instead of yanking them back down every poll.
  const feed = els.view.querySelector(".activity-list");
  if (feed) {
    if (wasPinned) feed.scrollTop = feed.scrollHeight;
    else feed.scrollTop = priorScroll;
  }
}

/* ---------- Dashboard ---------- */
function dashboardView() {
  const snap = state.snapshot || {};
  const products = snap.products || [];
  const riskIds = atRiskProductIds();
  const onOrderIds = onOrderProductIds();

  const rows = products
    .map((product) => {
      const status = productStatus(product, riskIds, onOrderIds);
      return `
        <tr>
          <td>
            <span class="cell-main">${escapeHtml(product.name)}</span>
            <span class="cell-sub">${escapeHtml(product.sku)} · ${escapeHtml(product.category)}</span>
          </td>
          <td class="num">${product.finished_units_on_hand}</td>
          <td class="num">${product.daily_demand}/day</td>
          <td class="num">${coverDays(product)}</td>
          <td><span class="pill ${status.cls}">${status.label}</span></td>
        </tr>`;
    })
    .join("");

  return `
    <div class="grid-2">
      <div class="card">
        <div class="card-head">
          <h2>Inventory health</h2>
        </div>
        <table class="table">
          <thead>
            <tr><th>Product</th><th>On hand</th><th>Demand</th><th>Cover</th><th>Status</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-head"><h2>Agent activity</h2></div>
        ${activityFeed()}
      </div>
    </div>`;
}

/* One activity row — tag, time, message, command. Shared between the dashboard
   feed and the chat panel so the agent's actions look the same everywhere. */
function eventRow({ kind, message, command, time, pending }) {
  const meta = EVENT_META[kind] || { label: titleCase(kind), cls: "neutral" };
  return `
    <div class="event${pending ? " pending" : ""}">
      <div class="event-head">
        <span class="event-tag ${meta.cls}">${meta.label}</span>
        ${time ? `<span class="event-time">${fmtDate(time)}</span>` : ""}
      </div>
      ${message ? `<span class="event-msg">${escapeHtml(message)}</span>` : ""}
      ${command ? `<code class="event-cmd">${escapeHtml(command)}</code>` : ""}
    </div>`;
}

/* The MCP calls behind one chat answer, rendered as an activity trace. */
function chatActivity(rawQueries, { pendingTool, answered, thinking, fromMemory } = {}) {
  // Normalise once: a persisted turn that needed no queries has no `queries` field
  // at all, and an unguarded read here throws and takes the whole alert expansion
  // down with it.
  const queries = Array.isArray(rawQueries) ? rawQueries : [];
  const rows = [];
  if (thinking) {
    rows.push(eventRow({ kind: "agent_plan", message: thinking, pending: true }));
  }
  // An answer with no queries means it came from what the agent already knew this
  // session. Worth stating rather than leaving the trace blank.
  if (fromMemory && !queries.length) {
    rows.push(
      eventRow({
        kind: "agent_plan",
        message: "Answered from what this session had already read — no new queries.",
      }),
    );
  }
  queries.forEach((query) =>
    rows.push(eventRow({ kind: "mcp_tool", message: mcpSummary(query), command: query })),
  );
  if (pendingTool) {
    rows.push(
      eventRow({
        kind: "mcp_tool",
        message: `Calling MCP ${pendingTool} — building the query…`,
        pending: true,
      }),
    );
  }
  // Close the trace so the answer below is visibly the agent's conclusion rather
  // than another log line.
  if (answered && rows.length && queries.length) {
    rows.push(
      eventRow({
        kind: "agent_response",
        message: `Answered from ${queries.length} live MongoDB ${
          queries.length === 1 ? "read" : "reads"
        } via Remote MCP.`,
      }),
    );
  }
  return rows.length ? `<div class="chat-activity">${rows.join("")}</div>` : "";
}

/* "find(\"products\", …)" -> "Queried products via MCP." */
function mcpSummary(command) {
  const verb = String(command || "").split("(")[0] || "MCP";
  const collection = (String(command).match(/"([a-z_]+)"/) || [])[1];
  const labels = {
    find: "Queried",
    aggregate: "Aggregated",
    count: "Counted",
    getSchema: "Read the schema for",
    getIndexes: "Read the indexes for",
    insertMany: "Inserted into",
    updateMany: "Updated",
    listCollections: "Listed the collections",
  };
  const label = labels[verb] || verb;
  if (verb === "listCollections") return "Listed the collections.";
  return collection ? `${label} ${collection}.` : `${label}.`;
}

function activityFeed() {
  const events = state.snapshot?.history || [];
  if (!events.length) {
    return `<div class="activity-list"><div class="event"><span class="event-msg">No activity yet.</span></div></div>`;
  }
  // Snapshot returns newest-first; show as a chronological trace.
  const items = events
    .slice(0, 24)
    .reverse()
    .map((event) =>
      eventRow({
        kind: event.event_type,
        message: event.message,
        command: event.metadata && event.metadata.command,
        time: event.created_at,
      }),
    )
    .join("");
  return `<div class="activity-list">${items}</div>`;
}

/* While the scheduled sweep is running, say so in the inbox — the wait is the
   agent working, and the activity feed shows what it is doing. */
function sweepRunning() {
  const events = state.snapshot?.history || [];
  if (!events.length) return false;
  const startedSweep = events.some((event) => event.event_type === "agent_plan");
  const finished = events.some(
    (event) => event.event_type === "agent_finding" || event.event_type === "error",
  );
  return startedSweep && !finished;
}

function sweepBanner() {
  if (!sweepRunning()) return "";
  const queries = (state.snapshot?.history || []).filter(
    (event) => event.event_type === "mcp_tool",
  ).length;
  return `
    <div class="sweep-banner">
      <span class="sweep-dot"></span>
      Scheduled sweep running — the agent is querying MongoDB over MCP
      ${queries ? `(${queries} ${queries === 1 ? "query" : "queries"} so far)` : ""}.
      The Dashboard shows each call as it happens.
    </div>`;
}

/* ---------- Alerts (Inbox) ---------- */
function alertsView() {
  const alerts = state.snapshot?.alerts || [];
  const cards = alerts.length
    ? alerts
        .map((alert) => {
          const resolved = ["Resolved", "Dismissed"].includes(alert.status);
          const isOpen = alert._id === state.selectedAlertId;
          // Colour by severity, not by "is an alert": Medium means caught in good
          // time, which is the normal case and should not read as an emergency.
          const pillCls = resolved
            ? "success"
            : SEVERITY_CLASS[alert.severity] || "warning";
          return `
            <div class="alert-card ${isOpen ? "open" : ""} ${resolved ? "resolved" : ""}">
              <button class="alert-card-head" data-alert-id="${alert._id}" aria-expanded="${isOpen}">
                <div class="alert-card-top">
                  <span class="pill ${pillCls}">${escapeHtml(resolved ? alert.status : alert.severity || "Alert")}</span>
                  <span class="mono alert-date">${fmtDay(alert.created_at)}</span>
                </div>
                <strong>${escapeHtml(alert.title)}</strong>
                <span class="alert-summary">${escapeHtml(alertHeadline(alert))}</span>
                ${resolved ? resolvedNote(alert) : ""}
                <span class="alert-chevron" aria-hidden="true"></span>
              </button>
              ${isOpen ? alertExpansion(alert) : ""}
            </div>`;
        })
        .join("")
    : `<div class="alert-empty">No alerts. Inventory, open POs, and supplier lead times are being monitored.</div>`;

  return `
    <div class="inbox">
      <div class="section-title">Inbox</div>
      ${sweepBanner()}
      <div class="alert-list">${cards}</div>
    </div>`;
}

function alertExpansion(alert) {
  const proposal = alert.recommendation || {};
  const total = (proposal.quantity || 0) * (proposal.unit_cost || 0);
  const resolved = alert.status === "Resolved";

  const messages = (state.snapshot?.dialogue || []).filter((message) => message.alert_id === alert._id);
  const allMessages = messages.length
    ? messages
    : [{ role: "agent", content: "Ask me about the cause, supplier timing, affected SKUs, or order size — I'll query MongoDB through the MCP server to answer." }];
  const chat = allMessages
    .map((message) => {
      // Keep the MCP queries visible after the stream ends: they are the
      // evidence for the answer above them.
      const activity =
        message.role === "agent"
          ? chatActivity(message.queries, { answered: true, fromMemory: true })
          : "";
      return `<div class="message ${message.role}">${activity}${escapeHtml(message.content)}</div>`;
    })
    .join("");

  return `
    <div class="alert-expand">
      ${statTiles(alert)}

      <div class="proposal">
        <span class="proposal-label">Agent's recommendation</span>
        <div class="proposal-facts">
          <div><span>Supplier</span><strong>${escapeHtml(proposal.supplier_name || "—")}</strong></div>
          <div><span>Item</span><strong>${escapeHtml(proposal.item_name || "—")}</strong></div>
          <div><span>Quantity</span><strong>${(proposal.quantity || 0).toLocaleString()}</strong></div>
          <div><span>Lead time</span><strong>${proposal.lead_time_days ?? "—"} days</strong></div>
          <div><span>Est. cost</span><strong>${money(total)}</strong></div>
        </div>
        ${proposal.rationale ? `<div class="risk-note">${escapeHtml(proposal.rationale)}</div>` : ""}
        <button id="approveButton" type="button" class="btn--primary" ${
          recommendationOrdered(alert) ? "disabled" : ""
        }>
          ${recommendationOrdered(alert) ? "Purchase order placed" : "Submit purchase order"}
        </button>
      </div>

      <section class="chat-panel">
        <div id="chatMessages" class="chat-messages">${chat}</div>
        <div class="quick-prompts">
          <button class="btn" data-prompt="Why did this come up now?">Why now?</button>
          <button class="btn" data-prompt="Is there a cheaper or faster supplier we should use instead?">Supplier options?</button>
          <button class="btn" data-prompt="Which other products depend on this component?">Affected SKUs?</button>
          <button class="btn" data-prompt="Is the recommended quantity right, given everything that uses this component?">Order quantity?</button>
        </div>
        <form id="chatForm" class="chat-form">
          <input id="chatInput" type="text" placeholder="Ask about suppliers, timing, or order size" autocomplete="off" />
          <button type="submit" class="btn">Send</button>
        </form>
      </section>
    </div>`;
}

function wireAlertsView() {
  els.view.querySelectorAll("[data-alert-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.alertId;
      if (id === state.selectedAlertId) {
        state.selectedAlertId = null;
        render(true);
      } else {
        selectAlert(id);
      }
    });
  });

  const chatForm = els.view.querySelector("#chatForm");
  if (chatForm) {
    const input = chatForm.querySelector("#chatInput");
    chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = input.value.trim();
      if (!message) return;
      input.value = "";
      await sendChat(message);
    });
  }

  els.view.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => sendChat(button.dataset.prompt));
  });

  const approve = els.view.querySelector("#approveButton");
  if (approve) approve.addEventListener("click", approveOrder);

  const messages = els.view.querySelector("#chatMessages");
  if (messages) messages.scrollTop = messages.scrollHeight;
}

async function selectAlert(alertId) {
  state.selectedAlertId = alertId;
  await api("/api/alerts/open", {
    method: "POST",
    body: JSON.stringify({ session_id: state.sessionId, alert_id: alertId }),
  });
  await refreshState();
  render(true);
}

/* Streamed chat: render tokens and MCP tool calls as they arrive so the stage
   audience sees the agent working rather than a spinner. */
async function sendChat(message) {
  const alert = currentAlert();
  if (!alert || state.streaming) return;

  state.streaming = true;
  state.pendingOwnerMessage = message;
  state.streamText = "";
  state.streamTools = [];
  state.streamError = null;
  renderStream();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: state.sessionId, alert_id: alert._id, message }),
    });
    if (!response.ok || !response.body) {
      throw new Error((await response.text()) || response.statusText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() || "";
      for (const frame of frames) {
        const line = frame.split("\n").find((part) => part.startsWith("data:"));
        if (!line) continue;
        let event;
        try {
          event = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        handleStreamEvent(event);
      }
    }
  } catch (error) {
    state.streamError = String(error.message || error);
    renderStream();
  } finally {
    state.streaming = false;
    state.pendingOwnerMessage = null;
    state.streamText = "";
    state.streamTools = [];
    await refreshState();
    render(true);
  }
}

function handleStreamEvent(event) {
  if (event.type === "token") {
    state.streamText += event.text;
  } else if (event.type === "reset_answer") {
    // That text was the model narrating before another query, not the answer.
    state.streamText = "";
  } else if (event.type === "tool_start") {
    // Placeholder shown while the model is still writing the arguments; the
    // matching tool_call event replaces it with the real query.
    state.streamTools.push({ tool: event.tool, command: null, pending: true });
  } else if (event.type === "tool_call") {
    // Resolve the oldest pending placeholder for this tool. Argument streaming
    // and call finalization can interleave, so match on tool name only.
    const pending = state.streamTools.find(
      (entry) => entry.pending && entry.tool === event.tool,
    );
    if (pending) {
      pending.command = event.command;
      pending.pending = false;
    } else {
      state.streamTools.push({ tool: event.tool, command: event.command });
    }
    // Any placeholder still pending for a tool that has now reported a real
    // command is a duplicate from argument streaming; drop it.
    state.streamTools = state.streamTools.filter(
      (entry, index) =>
        !entry.pending ||
        !state.streamTools.some(
          (other, otherIndex) =>
            otherIndex !== index && !other.pending && other.tool === entry.tool,
        ),
    );
  } else if (event.type === "error") {
    state.streamError = event.message;
  }
  renderStream();
}

/* Patch just the live message node instead of re-rendering the whole view, so
   the input keeps focus and the accordion does not flicker on every token. */
function renderStream() {
  const container = els.view.querySelector("#chatMessages");
  if (!container) return;
  // Sampled before the live message is mutated below, for the same reason as the
  // activity feed: a reader scrolled up mid-answer should stay where they are.
  const wasPinned = isPinnedToBottom(container);

  let pending = container.querySelector(".message.owner.pending");
  if (state.pendingOwnerMessage && !pending) {
    pending = document.createElement("div");
    pending.className = "message owner pending";
    pending.textContent = state.pendingOwnerMessage;
    container.appendChild(pending);
  }

  let live = container.querySelector(".message.agent.live");
  if (!live) {
    live = document.createElement("div");
    live.className = "message agent live";
    container.appendChild(live);
  }

  const pendingTool = state.streamTools.find((entry) => entry.pending)?.tool;
  const issued = state.streamTools
    .filter((entry) => !entry.pending)
    .map((entry) => entry.command);
  const tools = chatActivity(issued, {
    pendingTool,
    answered: Boolean(state.streamText),
    thinking: issued.length || pendingTool ? "" : "Working out what to query…",
  });

  let body;
  if (state.streamError) {
    body = `<span class="stream-error">${escapeHtml(state.streamError)}</span>`;
  } else if (state.streamText) {
    body = escapeHtml(state.streamText);
  } else if (tools) {
    body = "";
  } else {
    body = `<span class="stream-wait">Thinking</span>`;
  }
  live.innerHTML = `${tools}${body}`;
  if (wasPinned) container.scrollTop = container.scrollHeight;
}

async function approveOrder() {
  const alert = currentAlert();
  // Gate on the recommendation, not on the alert being resolved: an alert closed by
  // an order from a different supplier has still never had this one placed.
  if (!alert || recommendationOrdered(alert) || state.submitting) return;
  state.submitting = true;
  const button = els.view.querySelector("#approveButton");
  if (button) {
    button.disabled = true;
    button.textContent = "Submitting…";
  }
  try {
    const result = await api("/api/purchase_orders/submit", {
      method: "POST",
      body: JSON.stringify({ session_id: state.sessionId, alert_id: alert._id }),
    });
    // One order per alert. If the owner already ordered from a different supplier in
    // the chat, say why nothing happened rather than silently doing nothing.
    if (!result.created) {
      const placed = result.purchase_order || {};
      state.banner = {
        kind: "danger",
        sticky: true,
        text:
          `This alert already has an order: ${placed._id} with ` +
          `${placed.supplier_name}. Only one purchase order can be raised per alert.`,
      };
    }
  } catch (error) {
    state.banner = { kind: "danger", text: `Could not submit the order: ${error.message}` };
  } finally {
    state.submitting = false;
    await refreshState();
    render(true);
  }
}

/* ---------- Products ---------- */
function productsView() {
  const snap = state.snapshot || {};
  const products = snap.products || [];
  const items = snap.inventory_items || [];
  const riskIds = atRiskProductIds();
  const onOrderIds = onOrderProductIds();
  const blockerIds = blockerInventoryIds();

  const productRows = products
    .map((product) => {
      const status = productStatus(product, riskIds, onOrderIds);
      return `
        <tr>
          <td>
            <span class="cell-main">${escapeHtml(product.name)}</span>
            <span class="cell-sub">${escapeHtml(product.channel)}</span>
          </td>
          <td class="mono">${escapeHtml(product.sku)}</td>
          <td>${escapeHtml(product.category)}</td>
          <td class="num">${product.finished_units_on_hand}</td>
          <td class="num">${product.reorder_point}</td>
          <td><span class="pill ${status.cls}">${status.label}</span></td>
        </tr>`;
    })
    .join("");

  // Which products consume each component, derived from the bill of materials
  // rather than a denormalized list that can go stale.
  const usedBy = {};
  products.forEach((product) => {
    (product.components || []).forEach((component) => {
      usedBy[component.inventory_id] = usedBy[component.inventory_id] || [];
      usedBy[component.inventory_id].push(product.sku);
    });
  });

  // Components with an order raised but nothing delivered yet. Same reason as the
  // products table: the order closes the alert, but the quantity on hand has not
  // moved, so "In stock" would overstate it.
  const inboundIds = inboundInventoryIds();

  const itemRows = items
    .map((item) => {
      const isBlocker = blockerIds.has(item._id);
      let status;
      if (isBlocker) status = { label: "Blocking", cls: "danger" };
      else if (inboundIds.has(item._id)) status = { label: "On order", cls: "info" };
      else status = { label: "In stock", cls: "success" };
      const sharers = usedBy[item._id] || [];
      return `
        <tr>
          <td>
            <span class="cell-main">${escapeHtml(item.name)}</span>
            <span class="cell-sub">${escapeHtml(titleCase(item.kind))}</span>
          </td>
          <td class="num">${onHand(item)}</td>
          <td><span class="cell-sub">${sharers.length ? escapeHtml(sharers.join(", ")) : "—"}</span></td>
          <td>${escapeHtml(supplierName(item.supplier_id))}</td>
          <td><span class="pill ${status.cls}">${status.label}</span></td>
        </tr>`;
    })
    .join("");

  return `
    <div class="stack">
      <div class="card">
        <div class="card-head"><h2>Finished goods</h2></div>
        <table class="table">
          <thead>
            <tr><th>Product</th><th>SKU</th><th>Category</th><th>On hand</th><th>Reorder point</th><th>Status</th></tr>
          </thead>
          <tbody>${productRows}</tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-head"><h2>Components &amp; packaging</h2></div>
        <table class="table">
          <thead>
            <tr><th>Item</th><th>On hand</th><th>Used by</th><th>Supplier</th><th>Status</th></tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
    </div>`;
}

/* Colour by where the order is in its life: placed and in transit, or landed. */
const PO_STATUS_CLASS = {
  ordered: "warning",
  received: "success",
  cancelled: "danger",
};

/* ---------- Purchase orders ---------- */
function purchaseOrdersView() {
  const orders = state.snapshot?.purchase_orders || [];
  if (!orders.length) {
    return `<div class="card"><div class="placeholder">No purchase orders yet.</div></div>`;
  }
  const rows = orders
    .map((order) => {
      const items = (order.line_items || [])
        .map((line) => `${line.quantity?.toLocaleString?.() || line.quantity} × ${escapeHtml(line.name)}`)
        .join(", ");
      const cls = PO_STATUS_CLASS[order.status] || "neutral";
      return `
        <tr>
          <td class="mono cell-main">${escapeHtml(order._id)}</td>
          <td>${escapeHtml(order.supplier_name)}</td>
          <td><span class="pill ${cls}">${escapeHtml(titleCase(order.status))}</span></td>
          <td>${items}</td>
          <td>${fmtDay(order.expected_arrival)}</td>
        </tr>`;
    })
    .join("");

  return `
    <div class="card">
      <div class="card-head"><h2>Purchase orders</h2></div>
      <table class="table">
        <thead>
          <tr><th>PO</th><th>Supplier</th><th>Status</th><th>Line items</th><th>ETA</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ---------- Suppliers ---------- */
function suppliersView() {
  const suppliers = state.snapshot?.suppliers || [];
  if (!suppliers.length) {
    return `<div class="card"><div class="placeholder">No suppliers found.</div></div>`;
  }
  const rows = suppliers
    .map((supplier) => {
      const reliability = Math.round((supplier.reliability || 0) * 100);
      return `
        <tr>
          <td>
            <span class="cell-main">${escapeHtml(supplier.name)}</span>
            <span class="cell-sub">${escapeHtml(supplier.vendor_type || "")}</span>
          </td>
          <td class="num">${supplier.default_lead_time_days} days</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="reliability-bar"><span style="width:${reliability}%"></span></span>
              <span class="num">${reliability}%</span>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <div class="card">
      <div class="card-head"><h2>Suppliers</h2></div>
      <table class="table">
        <thead>
          <tr><th>Supplier</th><th>Lead time</th><th>Reliability</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ---------- Nav wiring ---------- */
els.navItems.forEach((item) => {
  item.addEventListener("click", () => {
    if (state.activeTab === item.dataset.tab) return;
    state.activeTab = item.dataset.tab;
    render(true);
  });
});

/* ---------- Boot ---------- */
render(true);
startSession().catch((error) => {
  // Never leave an empty shell on stage: say what failed.
  console.error(error);
  state.banner = {
    kind: "danger",
    text: `Could not start the demo: ${error.message}. Check MONGODB_URI and the server log.`,
  };
  renderBanner();
});
