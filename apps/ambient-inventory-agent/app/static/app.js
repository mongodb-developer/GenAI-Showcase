const state = {
  sessionId: localStorage.getItem("ambientInventorySessionId"),
  activeTab: "dashboard",
  selectedAlertId: null,
  snapshot: null,
  pollHandle: null,
  lastSignature: null,
  prevActiveAlerts: 0,
};

const params = new URLSearchParams(window.location.search);
const freshLaunch = params.get("fresh") === "1";
if (freshLaunch) {
  localStorage.removeItem("ambientInventorySessionId");
  state.sessionId = null;
}

const els = {
  view: document.getElementById("view"),
  pageTitle: document.getElementById("pageTitle"),
  alertBadge: document.getElementById("alertBadge"),
  navItems: Array.from(document.querySelectorAll(".nav-item")),
};

const PAGE_TITLES = {
  dashboard: "Dashboard",
  alerts: "Inbox",
  products: "Products",
  purchase_orders: "Purchase orders",
  suppliers: "Suppliers",
};

const EVENT_META = {
  thinking: { label: "Thinking", cls: "think" },
  plan: { label: "Plan", cls: "plan" },
  mcp_tool: { label: "MCP", cls: "mcp" },
  mongodb_read: { label: "MCP · read", cls: "mcp" },
  mongodb_write: { label: "MCP · write", cls: "mcp" },
  agent_response: { label: "Response", cls: "response" },
  monitor: { label: "Monitor", cls: "neutral" },
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
function fmtDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
  return String(value || "").replaceAll("_", " ");
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
    (alert) => !["Submitted", "Dismissed"].includes(alert.status),
  );
}

function currentAlert() {
  return (state.snapshot?.alerts || []).find((alert) => alert._id === state.selectedAlertId);
}

function atRiskProductIds() {
  return new Set(activeAlerts().map((alert) => alert.risk?.product_id).filter(Boolean));
}

function blockerInventoryIds() {
  return new Set(activeAlerts().map((alert) => alert.risk?.blocker_inventory_id).filter(Boolean));
}

function supplierName(supplierId) {
  const supplier = (state.snapshot?.suppliers || []).find((item) => item._id === supplierId);
  return supplier ? supplier.name : "—";
}

function productStatus(product, riskIds) {
  if (riskIds.has(product._id)) return { label: "At risk", cls: "danger" };
  if (product.finished_units_on_hand <= product.reorder_point) return { label: "Reorder", cls: "warning" };
  return { label: "Healthy", cls: "success" };
}

/* ---------- Session ---------- */
async function startSession() {
  if (freshLaunch) {
    const result = await api("/api/demo/reset", { method: "POST", body: JSON.stringify({}) });
    state.sessionId = result.session_id;
  } else {
    const payload = state.sessionId ? { session_id: state.sessionId } : {};
    const result = await api("/api/demo/session", { method: "POST", body: JSON.stringify(payload) });
    state.sessionId = result.session_id;
  }
  localStorage.setItem("ambientInventorySessionId", state.sessionId);
  await refreshState();
  state.pollHandle = setInterval(refreshState, 2500);
}

async function refreshState() {
  if (!state.sessionId) return;
  const snapshot = await api(`/api/state?session_id=${encodeURIComponent(state.sessionId)}`);
  state.snapshot = snapshot;

  const active = activeAlerts().length;
  const isNewAlert = active > state.prevActiveAlerts;
  state.prevActiveAlerts = active;
  render(false, isNewAlert);
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
  const alerts = (snap.alerts || []).map((alert) => `${alert._id}:${alert.status}`).join(",");
  const pos = (snap.purchase_orders || []).map((po) => `${po._id}:${po.status}`).join(",");
  const messages = (snap.chat_messages || []).length;
  const events = (snap.agent_events || []).length;
  return [state.activeTab, state.selectedAlertId, alerts, pos, messages, events].join("|");
}

function render(force = false, pulse = false) {
  renderNav();
  renderBadge(pulse);
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
  els.view.innerHTML = (views[state.activeTab] || dashboardView)();
  if (state.activeTab === "alerts") wireAlertsView();
  if (state.activeTab === "dashboard") {
    const feed = els.view.querySelector(".activity-list");
    if (feed) feed.scrollTop = feed.scrollHeight;
  }
}

/* ---------- Dashboard ---------- */
function dashboardView() {
  const snap = state.snapshot || {};
  const products = snap.products || [];
  const riskIds = atRiskProductIds();

  const rows = products
    .map((product) => {
      const status = productStatus(product, riskIds);
      const cover = product.daily_demand ? Math.round(product.finished_units_on_hand / product.daily_demand) : "—";
      return `
        <tr>
          <td>
            <span class="cell-main">${escapeHtml(product.name)}</span>
            <span class="cell-sub">${escapeHtml(product.sku)} · ${escapeHtml(product.category)}</span>
          </td>
          <td class="num">${product.finished_units_on_hand}</td>
          <td class="num">${product.reorder_point}</td>
          <td class="num">${cover} days</td>
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
            <tr><th>Product</th><th>On hand</th><th>Reorder point</th><th>Cover</th><th>Status</th></tr>
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

function activityFeed() {
  const events = state.snapshot?.agent_events || [];
  if (!events.length) {
    return `<div class="activity-list"><div class="event"><span class="event-msg">No agent activity yet.</span></div></div>`;
  }
  // Snapshot returns newest-first; show as a chronological trace.
  const items = events
    .slice(0, 24)
    .reverse()
    .map((event) => {
      const meta = EVENT_META[event.event_type] || { label: titleCase(event.event_type), cls: "neutral" };
      const command = event.metadata && event.metadata.command;
      return `
        <div class="event">
          <div class="event-head">
            <span class="event-tag ${meta.cls}">${meta.label}</span>
            <span class="event-time">${fmtDate(event.created_at)}</span>
          </div>
          <span class="event-msg">${escapeHtml(event.message)}</span>
          ${command ? `<code class="event-cmd">${escapeHtml(command)}</code>` : ""}
        </div>`;
    })
    .join("");
  return `<div class="activity-list">${items}</div>`;
}

/* ---------- Alerts (Inbox) ---------- */
function alertsView() {
  const alerts = state.snapshot?.alerts || [];
  const cards = alerts.length
    ? alerts
        .map((alert) => {
          const resolved = ["Submitted", "Dismissed"].includes(alert.status);
          const isOpen = alert._id === state.selectedAlertId;
          const pillCls = resolved ? "success" : "danger";
          return `
            <div class="alert-card ${isOpen ? "open" : ""} ${resolved ? "resolved" : ""}">
              <button class="alert-card-head" data-alert-id="${alert._id}" aria-expanded="${isOpen}">
                <div class="alert-card-top">
                  <span class="pill ${pillCls}">${escapeHtml(resolved ? alert.status : alert.severity || "Alert")}</span>
                  <span class="mono alert-date">${fmtDay(alert.created_at)}</span>
                </div>
                <strong>${escapeHtml(alert.title)}</strong>
                <span class="alert-summary">${escapeHtml(alert.summary)}</span>
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
      <div class="alert-list">${cards}</div>
    </div>`;
}

function alertExpansion(alert) {
  const proposal = alert.recommendation || {};
  const total = (proposal.quantity || 0) * (proposal.unit_cost || 0);
  const submitted = alert.status === "Submitted";

  const messages = (state.snapshot?.chat_messages || []).filter((message) => message.alert_id === alert._id);
  const allMessages = messages.length
    ? messages
    : [{ role: "agent", content: `${alert.summary} I can compare supplier timing, explain the blocker, or prepare the purchase order.` }];
  const chat = allMessages
    .map((message) => `<div class="message ${message.role}">${escapeHtml(message.content)}</div>`)
    .join("");

  return `
    <div class="alert-expand">
      <div class="risk-grid">
        <div class="risk-tile"><span>Stockout window</span><strong>${alert.risk?.days_until_stockout ?? "—"} days</strong></div>
        <div class="risk-tile"><span>Blocking item</span><strong>${escapeHtml(alert.risk?.blocker_name || "—")}</strong></div>
        <div class="risk-tile"><span>Recommended supplier</span><strong>${escapeHtml(proposal.supplier_name || "—")}</strong></div>
      </div>

      <div class="proposal">
        <div class="proposal-facts">
          <div><span>Supplier</span><strong>${escapeHtml(proposal.supplier_name || "—")}</strong></div>
          <div><span>Item</span><strong>${escapeHtml(proposal.item_name || "—")}</strong></div>
          <div><span>Quantity</span><strong>${(proposal.quantity || 0).toLocaleString()}</strong></div>
          <div><span>ETA</span><strong>${proposal.lead_time_days ?? "—"} days</strong></div>
          <div><span>Est. cost</span><strong>${money(total)}</strong></div>
        </div>
        <button id="approveButton" type="button" class="btn--primary" ${submitted ? "disabled" : ""}>
          ${submitted ? "Purchase order submitted" : "Submit purchase order"}
        </button>
      </div>

      <section class="chat-panel">
        <div id="chatMessages" class="chat-messages">${chat}</div>
        <div class="quick-prompts">
          <button class="btn" data-prompt="What caused this?">What caused this?</button>
          <button class="btn" data-prompt="Can we avoid the rush fee?">Avoid rush fee?</button>
          <button class="btn" data-prompt="What other SKUs are affected?">Affected SKUs?</button>
          <button class="btn" data-prompt="How many should we order?">Order quantity?</button>
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

async function sendChat(message) {
  const alert = currentAlert();
  if (!alert) return;
  await api("/api/chat", {
    method: "POST",
    body: JSON.stringify({ session_id: state.sessionId, alert_id: alert._id, message }),
  });
  await refreshState();
}

async function approveOrder() {
  const alert = currentAlert();
  if (!alert || alert.status === "Submitted") return;
  await api("/api/purchase_orders/submit", {
    method: "POST",
    body: JSON.stringify({ session_id: state.sessionId, alert_id: alert._id }),
  });
  await refreshState();
}

/* ---------- Products ---------- */
function productsView() {
  const snap = state.snapshot || {};
  const products = snap.products || [];
  const items = snap.inventory_items || [];
  const riskIds = atRiskProductIds();
  const blockerIds = blockerInventoryIds();

  const productRows = products
    .map((product) => {
      const status = productStatus(product, riskIds);
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

  const itemRows = items
    .map((item) => {
      const isBlocker = blockerIds.has(item._id);
      const status = isBlocker
        ? { label: "At risk", cls: "danger" }
        : { label: "In stock", cls: "success" };
      return `
        <tr>
          <td>
            <span class="cell-main">${escapeHtml(item.name)}</span>
            <span class="cell-sub">${escapeHtml(titleCase(item.kind))}</span>
          </td>
          <td class="num">${item.quantity_on_hand} ${escapeHtml(item.unit)}</td>
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
            <tr><th>Item</th><th>On hand</th><th>Supplier</th><th>Status</th></tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
    </div>`;
}

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
      const cls = order.status === "submitted" ? "info" : "neutral";
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
            <span class="cell-sub">${escapeHtml(supplier.notes || "")}</span>
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
  console.error("Connection issue. Check MongoDB connection.", error);
});
