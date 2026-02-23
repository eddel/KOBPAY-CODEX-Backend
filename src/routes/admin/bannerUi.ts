import { Router } from "express";

const router = Router();

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>KOBPAY Admin Console</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #0f172a;
        --panel: #ffffff;
        --muted: #64748b;
        --text: #0f172a;
        --accent: #1f40e0;
        --border: #e2e8f0;
        --danger: #e11d48;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
        background: #f8fafc;
        color: var(--text);
      }
      header {
        padding: 20px 24px;
        background: var(--bg);
        color: white;
      }
      header h1 { margin: 0; font-size: 20px; }
      header p { margin: 6px 0 0; font-size: 13px; color: #cbd5f5; }
      main { padding: 24px; max-width: 1200px; margin: 0 auto; }
      .panel {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 20px;
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.05);
      }
      .row { display: flex; gap: 12px; flex-wrap: wrap; }
      label { font-size: 12px; color: var(--muted); }
      input, select, button, textarea {
        font: inherit;
      }
      input, textarea {
        padding: 8px 10px;
        border: 1px solid var(--border);
        border-radius: 8px;
        width: 100%;
      }
      .field { flex: 1; min-width: 180px; }
      .field small { color: var(--muted); }
      button {
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 14px;
        cursor: pointer;
      }
      button.secondary {
        background: #f1f5f9;
        color: var(--text);
        border: 1px solid var(--border);
      }
      button.danger {
        background: var(--danger);
      }
      button.small {
        padding: 6px 10px;
        font-size: 12px;
      }
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        border-bottom: 1px solid var(--border);
        padding: 10px 6px;
        vertical-align: top;
      }
      th { font-size: 12px; color: var(--muted); text-transform: uppercase; }
      .thumb { width: 140px; }
      .thumb img { width: 120px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); }
      .actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .notice { font-size: 13px; color: var(--muted); }
      .error { color: var(--danger); }
      .tabs {
        display: flex;
        gap: 8px;
        margin: 0 0 16px 0;
        flex-wrap: wrap;
      }
      .tab-btn {
        background: #f8fafc;
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 8px 14px;
        cursor: pointer;
      }
      .tab-btn.active {
        background: var(--accent);
        border-color: var(--accent);
        color: white;
      }
      .tab-panel { display: none; }
      .tab-panel.active { display: block; }
      .table-wrap { overflow-x: auto; }
      details { margin-top: 8px; }
      details summary { cursor: pointer; color: var(--accent); font-size: 12px; }
      pre {
        margin: 8px 0 0;
        padding: 10px;
        background: #f8fafc;
        border: 1px solid var(--border);
        border-radius: 8px;
        font-size: 12px;
        white-space: pre-wrap;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>KOBPAY Admin Console</h1>
      <p>Banners + Exchange approvals</p>
    </header>
    <main>
      <section class="panel">
        <div class="row" style="align-items: flex-end;">
          <div class="field" style="max-width: 320px;">
            <label>Admin Key</label>
            <input id="adminKey" type="password" placeholder="x-admin-key" />
          </div>
          <button id="saveKey">Save Key</button>
          <span class="notice" id="keyStatus"></span>
        </div>
      </section>

      <div class="tabs">
        <button class="tab-btn active" data-tab="banners">Banners</button>
        <button class="tab-btn" data-tab="exchange">Exchange</button>
      </div>

      <div id="tab-banners" class="tab-panel active">
        <section class="panel">
          <h3>Create Banner</h3>
          <div class="row">
            <div class="field">
              <label>Image (JPG/PNG/WEBP, max 5MB)</label>
              <input id="createImage" type="file" accept="image/*" />
            </div>
            <div class="field">
              <label>Title</label>
              <input id="createTitle" type="text" />
            </div>
            <div class="field">
              <label>Subtitle</label>
              <input id="createSubtitle" type="text" />
            </div>
            <div class="field">
              <label>Link URL</label>
              <input id="createLink" type="text" placeholder="https://..." />
            </div>
            <div class="field" style="max-width: 120px;">
              <label>Sort Order</label>
              <input id="createSort" type="number" value="0" />
            </div>
            <div class="field" style="max-width: 120px;">
              <label>Active</label>
              <select id="createActive">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
            <div class="field">
              <label>Start At (ISO, optional)</label>
              <input id="createStart" type="text" placeholder="2026-02-15T12:00:00Z" />
            </div>
            <div class="field">
              <label>End At (ISO, optional)</label>
              <input id="createEnd" type="text" placeholder="2026-02-20T12:00:00Z" />
            </div>
          </div>
          <div style="margin-top: 12px;">
            <button id="createBtn">Create Banner</button>
            <span class="notice" id="createStatus"></span>
          </div>
        </section>

        <section class="panel">
          <div class="row" style="justify-content: space-between; align-items: center;">
            <h3 style="margin: 0;">Existing Banners</h3>
            <button class="secondary" id="refreshBtn">Refresh</button>
          </div>
          <div class="notice" id="listStatus"></div>
          <div class="table-wrap">
            <table id="bannerTable">
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Info</th>
                  <th>Schedule</th>
                  <th>Controls</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </section>
      </div>

      <div id="tab-exchange" class="tab-panel">
        <section class="panel">
          <div class="row" style="justify-content: space-between; align-items: flex-end;">
            <div>
              <h3 style="margin: 0;">Exchange Trades</h3>
              <div class="notice">Use this tab to confirm payments and complete trades.</div>
            </div>
            <div class="row" style="align-items: flex-end;">
              <div class="field" style="max-width: 260px;">
                <label>Status Filter</label>
                <select id="exchangeStatus">
                  <option value="">All</option>
                  <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
                  <option value="PAID_AWAITING_CONFIRMATION">PAID_AWAITING_CONFIRMATION</option>
                  <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
                  <option value="EXCHANGE_COMPLETED">EXCHANGE_COMPLETED</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
              <button class="secondary" id="exchangeRefreshBtn">Refresh</button>
            </div>
          </div>
          <div class="notice" id="exchangeStatusMsg"></div>
          <div class="table-wrap">
            <table id="exchangeTable">
              <thead>
                <tr>
                  <th>Trade</th>
                  <th>Amounts</th>
                  <th>Status</th>
                  <th>Receipt</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </section>
      </div>
    </main>

    <script>
      const apiBase = window.location.origin;
      const keyInput = document.getElementById("adminKey");
      const keyStatus = document.getElementById("keyStatus");
      const createStatus = document.getElementById("createStatus");
      const listStatus = document.getElementById("listStatus");
      const tableBody = document.querySelector("#bannerTable tbody");

      const exchangeStatus = document.getElementById("exchangeStatus");
      const exchangeStatusMsg = document.getElementById("exchangeStatusMsg");
      const exchangeTableBody = document.querySelector("#exchangeTable tbody");

      const loadKey = () => {
        const stored = localStorage.getItem("kobpay_admin_key") || "";
        keyInput.value = stored;
        return stored;
      };

      const saveKey = () => {
        localStorage.setItem("kobpay_admin_key", keyInput.value.trim());
        keyStatus.textContent = "Saved";
        setTimeout(() => (keyStatus.textContent = ""), 1200);
      };

      const getKey = () => keyInput.value.trim();

      const headers = () => ({
        "x-admin-key": getKey()
      });

      const showError = (target, err) => {
        target.textContent = err?.message || String(err);
        target.classList.add("error");
      };

      const clearStatus = (target) => {
        target.textContent = "";
        target.classList.remove("error");
      };

      const formatDate = (value) => {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleString();
      };

      const formatMoney = (minor, currency) => {
        if (minor === null || minor === undefined) return "-";
        const major = Number(minor) / 100;
        if (!Number.isFinite(major)) return "-";
        try {
          return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: currency || "NGN"
          }).format(major);
        } catch (_) {
          return (currency || "NGN") + " " + major.toFixed(2);
        }
      };

      const formatJson = (value) => {
        try {
          return JSON.stringify(value ?? {}, null, 2);
        } catch (_) {
          return "{}";
        }
      };

      const fetchBanners = async () => {
        clearStatus(listStatus);
        const resp = await fetch(apiBase + "/api/admin/banners", {
          headers: headers()
        });
        if (!resp.ok) {
          throw new Error("Failed to load banners (check admin key)");
        }
        const data = await resp.json();
        return data.banners || [];
      };

      const createBanner = async () => {
        clearStatus(createStatus);
        const file = document.getElementById("createImage").files[0];
        if (!file) {
          showError(createStatus, "Image is required");
          return;
        }
        const form = new FormData();
        form.append("image", file);
        form.append("title", document.getElementById("createTitle").value);
        form.append("subtitle", document.getElementById("createSubtitle").value);
        form.append("linkUrl", document.getElementById("createLink").value);
        form.append("sortOrder", document.getElementById("createSort").value);
        form.append("isActive", document.getElementById("createActive").value);
        form.append("startAt", document.getElementById("createStart").value);
        form.append("endAt", document.getElementById("createEnd").value);

        const resp = await fetch(apiBase + "/api/admin/banners", {
          method: "POST",
          headers: headers(),
          body: form
        });
        if (!resp.ok) {
          throw new Error("Failed to create banner");
        }
        createStatus.textContent = "Created";
        await renderBanners();
      };

      const updateBanner = async (id, row) => {
        const form = new FormData();
        form.append("title", row.querySelector("[data-field='title']").value);
        form.append("subtitle", row.querySelector("[data-field='subtitle']").value);
        form.append("linkUrl", row.querySelector("[data-field='linkUrl']").value);
        form.append("sortOrder", row.querySelector("[data-field='sortOrder']").value);
        form.append("isActive", row.querySelector("[data-field='isActive']").value);
        form.append("startAt", row.querySelector("[data-field='startAt']").value);
        form.append("endAt", row.querySelector("[data-field='endAt']").value);
        const file = row.querySelector("[data-field='image']").files[0];
        if (file) {
          form.append("image", file);
        }

        const resp = await fetch(apiBase + "/api/admin/banners/" + id, {
          method: "PATCH",
          headers: headers(),
          body: form
        });
        if (!resp.ok) {
          throw new Error("Failed to update banner");
        }
      };

      const deleteBanner = async (id) => {
        const resp = await fetch(apiBase + "/api/admin/banners/" + id, {
          method: "DELETE",
          headers: headers()
        });
        if (!resp.ok) {
          throw new Error("Failed to delete banner");
        }
      };

      const renderBanners = async () => {
        clearStatus(listStatus);
        tableBody.innerHTML = "";
        let banners = [];
        try {
          banners = await fetchBanners();
        } catch (err) {
          showError(listStatus, err);
          return;
        }

        if (!banners.length) {
          listStatus.textContent = "No banners yet.";
          return;
        }

        for (const banner of banners) {
          const row = document.createElement("tr");
          row.innerHTML = \`
            <td class="thumb">
              <img src="\${banner.imageUrl}" alt="banner"/>
              <div style="margin-top:8px;">
                <input data-field="image" type="file" accept="image/*" />
              </div>
            </td>
            <td>
              <div class="field"><label>Title</label><input data-field="title" type="text" value="\${banner.title || ""}"/></div>
              <div class="field" style="margin-top:8px;"><label>Subtitle</label><input data-field="subtitle" type="text" value="\${banner.subtitle || ""}"/></div>
              <div class="field" style="margin-top:8px;"><label>Link URL</label><input data-field="linkUrl" type="text" value="\${banner.linkUrl || ""}"/></div>
            </td>
            <td>
              <div class="field"><label>Active</label>
                <select data-field="isActive">
                  <option value="true" \${banner.isActive ? "selected" : ""}>true</option>
                  <option value="false" \${!banner.isActive ? "selected" : ""}>false</option>
                </select>
              </div>
              <div class="field" style="margin-top:8px;"><label>Sort Order</label><input data-field="sortOrder" type="number" value="\${banner.sortOrder ?? 0}"/></div>
              <div class="field" style="margin-top:8px;"><label>Start At</label><input data-field="startAt" type="text" value="\${banner.startAt || ""}"/></div>
              <div class="field" style="margin-top:8px;"><label>End At</label><input data-field="endAt" type="text" value="\${banner.endAt || ""}"/></div>
            </td>
            <td>
              <div class="actions">
                <button data-action="save">Save</button>
                <button data-action="delete" class="danger">Delete</button>
              </div>
              <div class="notice" data-field="status"></div>
            </td>
          \`;
          row.querySelector("[data-action='save']").addEventListener("click", async () => {
            const status = row.querySelector("[data-field='status']");
            status.textContent = "Saving...";
            try {
              await updateBanner(banner.id, row);
              status.textContent = "Saved";
              await renderBanners();
            } catch (err) {
              status.textContent = err?.message || String(err);
              status.classList.add("error");
            }
          });
          row.querySelector("[data-action='delete']").addEventListener("click", async () => {
            if (!confirm("Delete this banner?")) return;
            const status = row.querySelector("[data-field='status']");
            status.textContent = "Deleting...";
            try {
              await deleteBanner(banner.id);
              status.textContent = "Deleted";
              await renderBanners();
            } catch (err) {
              status.textContent = err?.message || String(err);
              status.classList.add("error");
            }
          });
          tableBody.appendChild(row);
        }
      };

      const fetchTrades = async () => {
        clearStatus(exchangeStatusMsg);
        const status = exchangeStatus.value.trim();
        const url = new URL(apiBase + "/api/admin/exchange/trades");
        if (status) {
          url.searchParams.set("status", status);
        }
        const resp = await fetch(url.toString(), {
          headers: headers()
        });
        if (!resp.ok) {
          throw new Error("Failed to load trades (check admin key)");
        }
        const data = await resp.json();
        return data.trades || [];
      };

      const markPaymentReceived = async (id) => {
        const resp = await fetch(
          apiBase + "/api/admin/exchange/trades/" + id + "/payment-received",
          {
            method: "POST",
            headers: headers()
          }
        );
        if (!resp.ok) {
          throw new Error("Failed to mark payment received");
        }
      };

      const completeTrade = async (id) => {
        const resp = await fetch(
          apiBase + "/api/admin/exchange/trades/" + id + "/complete",
          {
            method: "POST",
            headers: headers()
          }
        );
        if (!resp.ok) {
          throw new Error("Failed to complete trade");
        }
      };

      const openReceipt = async (trade) => {
        if (!trade.receiptFileUrl) return;
        const win = window.open("", "_blank");
        const resp = await fetch(apiBase + trade.receiptFileUrl, {
          headers: headers()
        });
        if (!resp.ok) {
          if (win) win.close();
          throw new Error("Failed to fetch receipt");
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        if (win) {
          win.location.href = url;
        } else {
          window.open(url, "_blank");
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      };

      const renderTrades = async () => {
        clearStatus(exchangeStatusMsg);
        exchangeTableBody.innerHTML = "";
        let trades = [];
        try {
          trades = await fetchTrades();
        } catch (err) {
          showError(exchangeStatusMsg, err);
          return;
        }

        if (!trades.length) {
          exchangeStatusMsg.textContent = "No trades found.";
          return;
        }

        for (const trade of trades) {
          const row = document.createElement("tr");
          const canMark = trade.status === "PAID_AWAITING_CONFIRMATION";
          const canComplete = trade.status === "PAYMENT_RECEIVED";
          const hasReceipt = Boolean(trade.receiptFileUrl);
          const rateText = Number.isFinite(trade.rate) ? trade.rate.toFixed(6) : "-";

          row.innerHTML = \`
            <td>
              <div><strong>\${trade.id}</strong></div>
              <div class="notice">User: \${trade.userId}</div>
              <div class="notice">Created: \${formatDate(trade.createdAt)}</div>
            </td>
            <td>
              <div>From: \${formatMoney(trade.fromAmountMinor, trade.fromCurrency)}</div>
              <div>To: \${formatMoney(trade.toAmountMinor, trade.toCurrency)}</div>
              <div class="notice">Rate: \${rateText} (\${trade.rateSource || "manual"})</div>
              <details>
                <summary>Receiving details</summary>
                <pre>\${formatJson(trade.receivingDetailsJson)}</pre>
              </details>
              <details>
                <summary>Pay-to details</summary>
                <pre>\${formatJson(trade.payToDetailsJson)}</pre>
              </details>
            </td>
            <td>
              <div><strong>Status:</strong> \${trade.status}</div>
              <div class="notice">Expires: \${formatDate(trade.expiresAt)}</div>
              <div class="notice">Paid: \${formatDate(trade.paidAt)}</div>
              <div class="notice">Payment received: \${formatDate(trade.paymentReceivedAt)}</div>
              <div class="notice">Completed: \${formatDate(trade.completedAt)}</div>
              <div class="notice">Cancelled: \${formatDate(trade.cancelledAt)}</div>
            </td>
            <td>
              <button data-action="receipt" class="secondary small" \${hasReceipt ? "" : "disabled"}>View Receipt</button>
            </td>
            <td>
              <div class="actions">
                <button data-action="mark" class="small" \${canMark ? "" : "disabled"}>Payment Received</button>
                <button data-action="complete" class="small" \${canComplete ? "" : "disabled"}>Complete</button>
              </div>
              <div class="notice" data-field="status"></div>
            </td>
          \`;

          const statusEl = row.querySelector("[data-field='status']");
          const markBtn = row.querySelector("[data-action='mark']");
          const completeBtn = row.querySelector("[data-action='complete']");
          const receiptBtn = row.querySelector("[data-action='receipt']");

          markBtn.addEventListener("click", async () => {
            statusEl.textContent = "Updating...";
            try {
              await markPaymentReceived(trade.id);
              statusEl.textContent = "Updated";
              await renderTrades();
            } catch (err) {
              statusEl.textContent = err?.message || String(err);
              statusEl.classList.add("error");
            }
          });

          completeBtn.addEventListener("click", async () => {
            statusEl.textContent = "Completing...";
            try {
              await completeTrade(trade.id);
              statusEl.textContent = "Completed";
              await renderTrades();
            } catch (err) {
              statusEl.textContent = err?.message || String(err);
              statusEl.classList.add("error");
            }
          });

          receiptBtn.addEventListener("click", async () => {
            if (!hasReceipt) return;
            statusEl.textContent = "Opening receipt...";
            try {
              await openReceipt(trade);
              statusEl.textContent = "";
            } catch (err) {
              statusEl.textContent = err?.message || String(err);
              statusEl.classList.add("error");
            }
          });

          exchangeTableBody.appendChild(row);
        }
      };

      const switchTab = (tab) => {
        const buttons = document.querySelectorAll(".tab-btn");
        const panels = document.querySelectorAll(".tab-panel");
        buttons.forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.tab === tab);
        });
        panels.forEach((panel) => {
          panel.classList.toggle("active", panel.id === "tab-" + tab);
        });
        localStorage.setItem("kobpay_admin_tab", tab);
        if (tab === "exchange") {
          renderTrades();
        }
      };

      document.getElementById("saveKey").addEventListener("click", saveKey);
      document.getElementById("createBtn").addEventListener("click", () => {
        createBanner().catch((err) => showError(createStatus, err));
      });
      document.getElementById("refreshBtn").addEventListener("click", renderBanners);
      document.getElementById("exchangeRefreshBtn").addEventListener("click", renderTrades);
      exchangeStatus.addEventListener("change", renderTrades);

      document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
      });

      loadKey();
      renderBanners();
      const initialTab = localStorage.getItem("kobpay_admin_tab") || "banners";
      switchTab(initialTab);
    </script>
  </body>
</html>`;

router.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(page);
});

export default router;
