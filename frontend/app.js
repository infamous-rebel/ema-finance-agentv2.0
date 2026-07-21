const API_BASE = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {
  // 1. Navigation Tabs Management
  const navItems = document.querySelectorAll(".nav-item");
  const pages = {
    dashboard: document.getElementById("dashboardPage"),
    invoice: document.getElementById("invoicePage"),
    policy: document.getElementById("policyPage"),
    approval: document.getElementById("approvalPage"),
    audit: document.getElementById("auditPage")
  };

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");
      
      Object.values(pages).forEach(p => {
        if (p) p.classList.remove("activePage");
      });
      
      const selected = item.dataset.page;
      if (pages[selected]) pages[selected].classList.add("activePage");
    });
  });

  // 2. Real-Time Data Sync from FastAPI Backend
  async function refreshData() {
    try {
      const [invRes, auditRes] = await Promise.all([
        fetch(`${API_BASE}/invoices`),
        fetch(`${API_BASE}/audit/trail`)
      ]);

      if (invRes.ok && auditRes.ok) {
        const statusElem = document.getElementById("backendStatus");
        if (statusElem) {
          statusElem.innerText = "FASTAPI CONNECTED";
          statusElem.style.color = "var(--accent-green)";
        }

        const invData = await invRes.json();
        const auditData = await auditRes.json();

        renderInvoices(invData.invoices);
        renderAuditTrail(auditData.trail);
        updateKPIs(invData.invoices);
      }
    } catch (err) {
      const statusElem = document.getElementById("backendStatus");
      if (statusElem) {
        statusElem.innerText = "BACKEND DISCONNECTED";
        statusElem.style.color = "#ff4d4d";
      }
    }
  }

  // 3. Render Dashboard KPIs
  function updateKPIs(invoices) {
    const totalEl = document.getElementById("kpiTotal") || document.getElementById("invoiceCount");
    const pendingEl = document.getElementById("kpiPending") || document.getElementById("pendingCount");
    const approvedEl = document.getElementById("kpiApproved") || document.getElementById("approvedCount");

    if (totalEl) totalEl.innerText = invoices.length;
    if (pendingEl) pendingEl.innerText = invoices.filter(i => i.status === "Pending").length;
    if (approvedEl) approvedEl.innerText = invoices.filter(i => i.status === "Approved").length;
  }

  // 4. Render Dynamic Invoice Queue
  function renderInvoices(invoices) {
    const tbody = document.getElementById("invoiceTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    invoices.forEach(inv => {
      const tr = document.createElement("tr");

      let badge = `<span class="badge badge-amber">${inv.status}</span>`;
      if (inv.status === "Approved") badge = `<span class="badge badge-green">Approved</span>`;
      if (inv.status === "Rejected") badge = `<span class="badge badge-red">Rejected</span>`;

      const actions = inv.status === "Pending" ? `
        <button class="btn-approve" onclick="window.handleAction('${inv.invoice_id}', 'APPROVE')" style="background: rgba(0, 255, 135, 0.15); color: var(--accent-green); border: 1px solid var(--accent-green); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; margin-right: 4px;">Approve</button>
        <button class="btn-reject" onclick="window.handleAction('${inv.invoice_id}', 'REJECT')" style="background: rgba(255, 77, 77, 0.15); color: #ff4d4d; border: 1px solid #ff4d4d; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">Reject</button>
      ` : `<span style="color: var(--text-muted); font-size: 11px;">Done</span>`;

      tr.innerHTML = `
        <td><strong>${inv.invoice_id}</strong></td>
        <td>${inv.vendor}</td>
        <td>$${inv.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
        <td style="color: ${inv.confidence >= 0.95 ? 'var(--accent-green)' : 'var(--accent-amber)'};">
          ${(inv.confidence * 100).toFixed(1)}%
        </td>
        <td>${badge}</td>
        <td style="color: var(--accent-amber); font-size: 11px;">${inv.flagged_reason || "None"}</td>
        <td>${actions}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 5. Render Cryptographic Audit Ledger
  function renderAuditTrail(trail) {
    const tbody = document.getElementById("auditTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    trail.forEach(entry => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-size: 11px; color: var(--text-muted);">${entry.timestamp}</td>
        <td style="color: var(--accent-cyan); font-weight: 500;">${entry.actor}</td>
        <td><strong>${entry.action}</strong></td>
        <td>${entry.invoice_id}</td>
        <td style="font-size: 11px;">${entry.description}</td>
        <td style="color: var(--text-muted); font-family: var(--font-mono); font-size: 10px;">${entry.hash ? entry.hash.substring(0, 16) + '...' : 'N/A'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 6. Handle Action Approvals/Rejections
  window.handleAction = async (invoiceId, action) => {
    try {
      const res = await fetch(`${API_BASE}/invoice/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoiceId,
          action: action,
          actor: "Pavel [Finance Ops Lead]",
          notes: "Manager review completed."
        })
      });
      if (res.ok) await refreshData();
    } catch (err) {
      alert("Error updating invoice state.");
    }
  };

  // 7. File Ingestion Handling
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const dropZoneText = document.getElementById("dropZoneText");

  if (dropZone && fileInput) {
    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) uploadFile(fileInput.files[0]);
    });
  }

  async function uploadFile(file) {
    if (!dropZoneText) return;
    dropZoneText.innerHTML = `⚡ <strong style="color: var(--accent-cyan)">AI Scanning Document:</strong> ${file.name}...`;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/invoice/upload`, {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        dropZoneText.innerHTML = `✅ <strong style="color: var(--accent-green)">Extraction Complete:</strong> Ingestion successful.`;
        setTimeout(() => {
          dropZoneText.innerHTML = `📥 Drag & drop invoice (PDF / Image / JSON) here, or <span class="highlight" style="color: var(--accent-cyan);">click to browse</span>`;
        }, 3000);
        await refreshData();
      }
    } catch (err) {
      dropZoneText.innerHTML = `❌ <span style="color: #ff4d4d">Upload failed. Is FastAPI backend running at ${API_BASE}?</span>`;
    }
  }

  // 8. Start Initial Load & Set Dynamic Poll Interval
  refreshData();
  setInterval(refreshData, 3000);
});