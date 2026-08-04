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
  // Set while /api/demo/start is in flight, so the play control can show the
  // MCP handshake is happening rather than looking like a dead click.
  starting: false,
  startError: null,
  // Latched once the server confirms the sweep is scheduled, so the control does
  // not fall back to "Run sweep" while waiting for the first poll or the agent's
  // first logged event.
  started: false,
};

const els = {
  view: document.getElementById("view"),
  pageTitle: document.getElementById("pageTitle"),
  alertBadge: document.getElementById("alertBadge"),
  navItems: Array.from(document.querySelectorAll(".nav-item")),
};

// The app opens straight into the portal — no start screen. It should read as
// software the shop already runs, with the agent as a feature of it, so the only
// demo affordance is the play control in the Agent activity card.
//
// Pressing it calls /api/demo/start, which re-mints the service-account token,
// reloads the MCP tools, binds a fresh connectionId, and schedules the sweep. That
// handshake is ~7s of real work (1.5s token + 2.5s tools + 3.2s connect), so the
// button narrates those steps while they happen rather than covering them with a
// curtain. No artificial pacing: what is on screen is what the server is doing.
const START_STEPS = [
  "Authenticating to Atlas",
  "Loading the MCP tools",
  "Connecting to the cluster",
];

// Roughly the measured duration of each handshake step, used only to advance the
// label on the button. The real completion is the API response, which cuts the
// sequence short or lets it sit on the last step until the server answers.
const START_STEP_MS = [1500, 2500, 3200];

// The sweep logs each MCP call the moment it happens, so this interval is the only
// thing standing between a real event and the feed showing it. At 2500ms calls arrived
// in clumps and the panel looked like it was catching up rather than keeping pace;
// /api/state measures ~150ms, so 1s leaves the request ~85% idle.
const POLL_MS = 1000;

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
/* Built here, not by the agent. These three tiles are pure formatting of figures the
   alert already carries, so asking the model to also emit a `stats` array made the
   filing turn markedly slower and gave the numbers two sources that could disagree.
   Alerts filed before that change still have `risk.stats`; prefer it so their tiles
   render as they did when they were written. */
function alertStats(alert) {
  const stats = alert.risk?.stats;
  if (Array.isArray(stats) && stats.length) return stats;

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
/* Boot straight into the portal with the shop's real data on screen and the agent
   idle. Nothing runs until the play control is pressed, so the laptop can sit on the
   podium indefinitely — and a rehearsal leaves nothing behind, because pressing play
   mints a new session id.

   A session is always created, even on a first load: the portal's tables come from
   /api/state, and without a session id there is nothing to fetch and the dashboard
   would render empty. An in-progress demo survives a reload for the same reason —
   the stored id is reused and its alert and feed come back with it. */
async function startSession() {
  const session = await api("/api/demo/session", {
    method: "POST",
    body: JSON.stringify({ session_id: state.sessionId }),
  });
  state.sessionId = session.session_id;
  localStorage.setItem("ambientInventorySessionId", state.sessionId);

  await refreshState();
  state.pollHandle = setInterval(refreshState, POLL_MS);
  render(true);
}

/* Is the sweep under way? Drives the play control: once it is, the button becomes
   a live status instead.

   Keyed on the server's `monitor.scheduled` flag rather than on the activity feed
   having events. The agent takes a few seconds to log its first line, and treating
   an empty feed as "not started" made the button flick back to "Run sweep" in that
   gap — which reads as though the click was lost. `started` covers the narrower gap
   between the API responding and the first poll carrying the new session's flag. */
function demoStarted() {
  if (state.started) return true;
  const monitor = state.snapshot?.monitor || {};
  return Boolean(
    monitor.scheduled || monitor.ran || (state.snapshot?.history || []).length,
  );
}

/* The play control, in the Agent activity card head. Reads as a feature of the
   portal rather than a demo prop: idle, then the live handshake steps, then a
   pulsing "Monitoring" once the agent is working. */
function playControl() {
  if (state.starting) {
    return `
      <span class="agent-status working">
        <span class="sweep-dot"></span>
        <span id="startStep">${escapeHtml(START_STEPS[0])}…</span>
      </span>`;
  }
  if (state.startError) {
    return `
      <span class="agent-status">
        <button id="playButton" type="button" class="play-btn" title="Retry">
          <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4" /></svg>
          Retry
        </button>
      </span>`;
  }
  if (demoStarted()) {
    return `
      <span class="agent-status live">
        <span class="sweep-dot"></span>
        Monitoring
      </span>`;
  }
  return `
    <button id="playButton" type="button" class="play-btn" title="Run the inventory sweep">
      <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4" /></svg>
      Run sweep
    </button>`;
}

/* Start the agent: re-mint the service-account token, rebind the cluster
   connection, and schedule the sweep. The button walks the handshake steps while
   the request is in flight — no padding, so it lands on the real response. */
async function startDemo() {
  if (state.starting) return;
  state.starting = true;
  state.startError = null;
  // Drop any banner from an earlier attempt: a sticky failure message would
  // otherwise sit there through the retry it is no longer describing.
  state.banner = null;
  render(true);

  const label = () => document.getElementById("startStep");
  let step = 0;
  let timer = null;
  const advance = () => {
    step += 1;
    const node = label();
    if (node && step < START_STEPS.length) {
      node.textContent = `${START_STEPS[step]}…`;
      timer = setTimeout(advance, START_STEP_MS[step]);
    }
  };
  timer = setTimeout(advance, START_STEP_MS[0]);

  try {
    const started = await api("/api/demo/start", {
      method: "POST",
      body: JSON.stringify({}),
    });
    // A fresh session id, so a previous run's alert and transcript stay behind.
    state.sessionId = started.session_id;
    localStorage.setItem("ambientInventorySessionId", state.sessionId);
    state.selectedAlertId = null;
    state.prevActiveAlerts = 0;
    // The sweep is scheduled server-side now. Latch it locally so the control goes
    // straight to "Monitoring" instead of waiting on the next poll to say so — the
    // snapshot in hand is still the previous session's.
    state.started = true;
    // Drop the old session's feed and alerts rather than showing them under the new
    // session for a poll or two.
    state.snapshot = null;
  } catch (error) {
    state.startError = String(error.message || error);
    // Nothing was scheduled, so clear the latch or the control would claim to be
    // monitoring a sweep that never began.
    state.started = false;
    state.banner = {
      kind: "danger",
      sticky: true,
      text: `Could not start the agent: ${state.startError}`,
    };
  } finally {
    clearTimeout(timer);
    state.starting = false;
    await refreshState();
    render(true);
  }
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
  // Only complain when the handshake has actually FAILED, which the server tells
  // us by setting `error`. Two normal situations have `ready === false` with no
  // error, and both used to flash a red banner: the server's own startup connect
  // on first page load, and the ~6s after pressing play, which drops the old
  // session before minting a new token. The play control already narrates that.
  if (!mcp.ready && mcp.error && !state.starting) {
    return {
      kind: "danger",
      text: `Remote MCP is not connected: ${mcp.error} The agent cannot answer until it is.`,
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
  // The play control's state is part of the view: without it, flipping to
  // "starting" would not repaint until some other field happened to change.
  return [
    state.activeTab,
    state.selectedAlertId,
    alerts,
    pos,
    messages,
    events,
    state.starting,
    state.startError,
    demoStarted(),
  ].join("|");
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
  // Read scroll positions BEFORE the rebuild below throws the old nodes away: after
  // innerHTML there is nothing left to ask.
  //
  // TWO scrollers matter here. `.activity-list` is the feed's own overflow box, and
  // `.view` — the element being rebuilt — scrolls as well, so replacing its contents
  // resets the page's scroll position on every poll. Restoring only the inner one
  // still leaves the view jumping.
  const oldFeed = els.view.querySelector(".activity-list");
  const feedWasPinned = oldFeed ? isPinnedToBottom(oldFeed) : true;
  const feedScroll = oldFeed ? oldFeed.scrollTop : 0;
  const viewScroll = els.view.scrollTop;

  els.view.innerHTML = (views[state.activeTab] || dashboardView)();
  if (state.activeTab === "alerts") wireAlertsView();
  const play = els.view.querySelector("#playButton");
  if (play) play.addEventListener("click", startDemo);

  // Put the page back where it was, unconditionally: a re-render is a data update, and
  // it should never move the reader.
  els.view.scrollTop = viewScroll;

  // The feed appears on both Dashboard and Inbox. Follow the newest event only while
  // the reader is already at the bottom; if they have scrolled up to read an earlier
  // tool call, hold their position instead of yanking them back down every poll.
  const feed = els.view.querySelector(".activity-list");
  if (feed) feed.scrollTop = feedWasPinned ? feed.scrollHeight : feedScroll;
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
        <div class="card-head">
          <h2>Agent activity</h2>
          ${playControl()}
        </div>
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
function chatActivity(rawQueries, { pendingTool, answered, thinking } = {}) {
  // Normalise once: a persisted turn that needed no queries has no `queries` field
  // at all, and an unguarded read here throws and takes the whole alert expansion
  // down with it.
  const queries = Array.isArray(rawQueries) ? rawQueries : [];
  const rows = [];
  if (thinking) {
    rows.push(eventRow({ kind: "agent_plan", message: thinking, pending: true }));
  }
  // A turn that needed no queries simply renders no trace. Saying so out loud is
  // implementation detail the owner does not need.
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
  const ordered = events.slice(0, 24).reverse();

  // The sweep logs one placeholder: "Writing up the diagnosis…" when the agent starts
  // composing the alert, a turn that runs ~30s and would otherwise log nothing until the
  // alert appears. It is persisted like any other event, so drop it once the insert that
  // publishes the alert has landed — otherwise it lingers beside the row that replaced it.
  const superseded = new Set();
  ordered.forEach((event, index) => {
    if (!event.metadata?.pending) return;
    const replaced = ordered
      .slice(index + 1)
      .some((later) => later.metadata?.collection === "alerts");
    if (replaced) superseded.add(index);
  });

  const items = ordered
    .map((event, index) =>
      superseded.has(index)
        ? ""
        : eventRow({
            kind: event.event_type,
            message: event.message,
            command: event.metadata && event.metadata.command,
            time: event.created_at,
            pending: Boolean(event.metadata?.pending),
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
  // Done when the alert exists or the sweep failed. This used to look for an
  // `agent_finding` event, which no longer exists — the alert itself is the
  // conclusion, so its presence is the more direct signal.
  const finished =
    (state.snapshot?.alerts || []).length > 0 ||
    events.some((event) => event.event_type === "error");
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
    : [{ role: "agent", content: "Ask me about the cause, supplier timing, affected SKUs, or order size." }];
  const chat = allMessages
    .map((message) => {
      // Keep the MCP queries visible after the stream ends: they are the
      // evidence for the answer above them.
      const activity =
        message.role === "agent"
          ? chatActivity(message.queries, { answered: true })
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
