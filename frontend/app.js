const API_BASE = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {
  // Navigation Tabs
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
      Object.values(pages).forEach(p => p.classList.remove("activePage"));
      const selected = item.dataset.page;
      if (pages[selected]) pages[selected].classList.add("activePage");
    });
  });

  // Real-Time Data Sync
  async function refreshData() {
    try {
      const [invRes, auditRes] = await Promise.all([
        fetch(`${API_BASE}/invoices`),
        fetch(`${API_BASE}/audit/trail`)
      ]);

      if (invRes.ok && auditRes.ok) {
        document.getElementById("backendStatus").innerText = "FASTAPI CONNECTED";
        document.getElementById("backendStatus").style.color = "var(--accent-green)";
        const invData = await invRes.json();
        const auditData = await auditRes.json();

        renderInvoices(invData.invoices);
        renderAuditTrail(auditData.trail);
        updateKPIs(invData.invoices);
      }
    } catch (err) {
      document.getElementById("backendStatus").innerText = "BACKEND DISCONNECTED";
      document.getElementById("backendStatus").style.color = "var(--accent-red)";
    }
  }

  function updateKPIs(invoices) {
    document.getElementById("kpiTotal").innerText = invoices.length;
    document.getElementById("kpiPending").innerText = invoices.filter(i => i.status === "Pending").length;
    document.getElementById("kpiApproved").innerText = invoices.filter(i => i.status === "Approved").length;
  }

  function renderInvoices(invoices) {
    const tbody = document.getElementById("invoiceTableBody");
    tbody.innerHTML = "";

    invoices.forEach(inv => {
      const tr = document.createElement("tr");

      let badge = `<span class="badge badge-amber">${inv.status}</span>`;
      if (inv.status === "Approved") badge = `<span class="badge badge-green">Approved</span>`;
      if (inv.status === "Rejected") badge = `<span class="badge badge-red">Rejected</span>`;

      const actions = inv.status === "Pending" ? `
        <button class="btn-approve" onclick="handleAction('${inv.invoice_id}', 'APPROVE')">Approve</button>
        <button class="btn-reject" onclick="handleAction('${inv.invoice_id}', 'REJECT')">Reject</button>
      ` : `<span style="color: var(--text-muted);">Done</span>`;

      tr.innerHTML = `
        <td><strong>${inv.invoice_id}</strong></td>
        <td>${inv.vendor}</td>
        <td>$${inv.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
        <td style="color: ${inv.confidence >= 0.95 ? 'var(--accent-green)' : 'var(--accent-amber)'};">
          ${(inv.confidence * 100).toFixed(1)}%
        </td>
        <td>${badge}</td>
        <td style="color: var(--accent-amber);">${inv.flagged_reason || "None"}</td>
        <td>${actions}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderAuditTrail(trail) {
    const tbody = document.getElementById("auditTableBody");
    tbody.innerHTML = "";

    trail.forEach(entry => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${entry.timestamp}</td>
        <td style="color: var(--accent-cyan);">${entry.actor}</td>
        <td><strong>${entry.action}</strong></td>
        <td>${entry.invoice_id}</td>
        <td>${entry.description}</td>
        <td style="color: var(--text-muted);">${entry.hash.substring(0, 16)}...</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Handle Approve / Reject Actions
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

  // Upload Handling
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const dropZoneText = document.getElementById("dropZoneText");

  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) uploadFile(fileInput.files[0]);
  });

  async function uploadFile(file) {
    dropZone.classList.add("processing");
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
          dropZoneText.innerHTML = `📥 Drag & drop invoice (PDF / Image / JSON) here, or <span class="highlight">click to browse</span>`;
        }, 3000);
        await refreshData();
      }
    } catch (err) {
      dropZoneText.innerHTML = `❌ <span style="color: var(--accent-red)">Upload failed. Is FastAPI backend running?</span>`;
    } finally {
      dropZone.classList.remove("processing");
    }
  }

  // Initial Sync & Auto Poll
  refreshData();
  setInterval(refreshData, 3000);
});