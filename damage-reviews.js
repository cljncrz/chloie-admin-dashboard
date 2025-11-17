// damage-reviews.js
// Renders sample damage reports into the damage reviews table and
// provides a simple arrow action that stores the selected item
// in sessionStorage (for a details page).
(function () {
  console.log('damage-reviews.js loaded');

  // Simple DOM helpers
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Update total stat
  function updateTotals(count) {
    const el = $('#total-damage-reports-stat');
    if (el) el.textContent = String(count);
  }

  // Hide loader
  function hideLoader() {
    const loader = document.querySelector('#damage-reviews-table-container .table-loader');
    if (loader) loader.style.display = 'none';
  }

  // Ensure each row has an Actions cell with an arrow button
  function ensureArrowButtons() {
    const table = $('#damage-reviews-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    Array.from(tbody.querySelectorAll('tr')).forEach((tr) => {
      // skip the no-results-row
      if (tr.classList.contains('no-results-row')) return;

      let actionsCell = tr.querySelector('.actions-cell');
      if (!actionsCell) {
        // create actions cell at the end
        actionsCell = document.createElement('td');
        actionsCell.className = 'text-center actions-cell';
        tr.appendChild(actionsCell);
      }

      // If a view button already exists, skip
      if (actionsCell.querySelector('.view-btn')) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'action-icon-btn view-btn';
      btn.title = 'View Full Details';
      btn.innerHTML = `<span class="material-symbols-outlined">visibility</span>`;
      actionsCell.appendChild(btn);
    });
  }

  // Click handler for visibility buttons (delegated)
  function setupArrowHandler() {
    const table = $('#damage-reviews-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('.view-btn');
      if (!btn) return;
      const row = btn.closest('tr');
      if (!row) return;
      const reportId = row.dataset.reportId || row.dataset.reviewId || null;

      // Try to gather row data (best-effort)
      const cells = Array.from(row.querySelectorAll('td'));
      const customer = cells[1] ? cells[1].textContent.trim() : '';
      const service = cells[2] ? cells[2].textContent.trim() : '';
      const reportText = cells[3] ? cells[3].textContent.trim() : '';
      const date = cells[4] ? cells[4].textContent.trim() : '';

      const payload = { reportId, customer, service, reportText, date };
      try {
        sessionStorage.setItem('selectedDamageReport', JSON.stringify(payload));
      } catch (err) {
        console.warn('Could not save selected damage report to sessionStorage', err);
      }

      // Navigate to a details page if available
      const detailsPage = 'damage-review-details.html';
      window.location.href = detailsPage;
    });
  }

  // Observe tbody for new rows and inject arrow buttons
  function observeTableMutations() {
    const table = $('#damage-reviews-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const mo = new MutationObserver(() => {
      ensureArrowButtons();
      // update totals
      const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => !r.classList.contains('no-results-row'));
      updateTotals(rows.length);
    });
    mo.observe(tbody, { childList: true, subtree: true });
  }

  // --- Sample data and renderer (for development/demo) ---
  const sampleReports = [
    {
      reportId: 'dr_001',
      customer: 'TestingUser01',
      service: 'Underwash (7-seater)',
      reportText: 'Minor scratch on rear bumper',
      date: '11/17/2025'
    },
    {
      reportId: 'dr_002',
      customer: 'TestingUser01',
      service: 'Seat Cover (7-seater)',
      reportText: 'Stain on seat cover after wash',
      date: '11/17/2025'
    },
    {
      reportId: 'dr_003',
      customer: 'TestingUser01',
      service: 'Motorcycle (400cc above)',
      reportText: 'Left-side mirror loosened',
      date: '11/17/2025'
    }
  ];

  function renderSampleData() {
    const table = $('#damage-reviews-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    // clear existing rows except the no-results-row template
    tbody.querySelectorAll('tr').forEach(tr => {
      if (!tr.classList.contains('no-results-row')) tr.remove();
    });

    sampleReports.forEach((rep) => {
      const row = document.createElement('tr');
      row.dataset.reportId = rep.reportId;
      row.innerHTML = `
        <td><input type="checkbox" class="damage-review-checkbox"></td>
        <td>${rep.customer}</td>
        <td>${rep.service}</td>
        <td class="damage-comment" title="${rep.reportText}">${rep.reportText}</td>
        <td>${rep.date}</td>
        <td class="text-center actions-cell">
          <button type="button" class="action-icon-btn view-btn" title="View Full Details">
            <span class="material-symbols-outlined">visibility</span>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // update totals
    updateTotals(sampleReports.length);
  }

  window.addEventListener('DOMContentLoaded', () => {
    // Hide loader, render sample data, and wire handlers
    hideLoader();
    renderSampleData();
    ensureArrowButtons();
    setupArrowHandler();
    observeTableMutations();

    // Update totals based on current rows
    const tbody = document.querySelector('#damage-reviews-table tbody');
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => !r.classList.contains('no-results-row'));
      updateTotals(rows.length);
    }
  });
})();
