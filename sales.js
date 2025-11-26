// sales.fixed.js - cleaned, single-file implementation for Sales page
// Loads all bookings, walkins and archived bookings (not only paid) from Firestore
// and builds unified sales records used in table, charts, insights and CSV export.
// Insights and charts are calculated based on Paid transactions to reflect real revenue.

document.addEventListener('DOMContentLoaded', () => {
  const id = (s) => document.getElementById(s);
  const salesTbody = id('sales-tbody');
  if (!salesTbody) return; // page doesn't use this script

  const searchInput = id('sales-search');
  const startDateInput = id('sales-start-date');
  const endDateInput = id('sales-end-date');
  const quickSelectButtons = Array.from(document.querySelectorAll('.quick-select-btn'));
  const clearFiltersBtn = id('clear-filters-btn');
  const exportCsvBtn = id('export-csv-btn');

  const transactionModalOverlay = id('transaction-modal-overlay');
  const transactionModalCloseBtn = id('transaction-modal-close-btn');
  const printTransactionBtn = id('print-transaction-btn');
  const transactionDetailsContent = id('transaction-details-content');

  const totalRevenueEl = document.querySelector('#sales-page-insights .card:nth-child(1) h1');
  const totalTransactionsEl = document.querySelector('#sales-page-insights .card:nth-child(2) h1');
  const avgSaleEl = document.querySelector('#sales-page-insights .card:nth-child(3) h1');
  const totalProfitEl = document.querySelector('#sales-page-insights .card:nth-child(4) h1');

  let appointments = [];
  let walkins = [];
  let servicesData = [];
  let allSales = [];

  const safeText = (v) => (v == null ? '' : String(v));

  // Normalize service input - string or object - to an object with name and id
  const normalizeService = (service) => {
    if (!service) return { name: '', id: '' };
    if (typeof service === 'string') return { name: service, id: '' };
    // if service is an object, try to extract name or id
    const name = service.service || service.name || service.serviceName || service.title || '';
    const id = service.id || service.serviceId || '';
    return { name: String(name || ''), id: String(id || '') };
  };

  const getPriceForService = (serviceArg) => {
    if (!serviceArg) return 0;
    const svc = normalizeService(serviceArg);
    const svcName = (svc.name || '').toLowerCase();
    const svcId = svc.id || '';
    // Try matching by explicit id if available else fallback to name
    let s = null;
    if (svcId) {
      s = (servicesData || []).find(x => String(x.id || x.serviceId || '').toLowerCase() === svcId.toLowerCase());
    }
    if (!s && svcName) {
      s = (servicesData || []).find(x => {
        const name = (x.service || x.serviceName || x.name || '');
        return String(name).toLowerCase() === svcName;
      });
    }
    if (s && typeof s.price === 'number') return s.price;
    if (s && s.price) return Number(s.price) || 250;
    return 250;
  };

  async function loadSalesDataFromFirestore() {
    try {
      if (!window.firebase || !window.firebaseInitPromise) throw new Error('firebase-not-initialized');
      await window.firebaseInitPromise;
      const db = window.firebase.firestore();

      // load all bookings (do not filter by paymentStatus here)
      const bookingsSnap = await db.collection('bookings').get();
      appointments = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const walkinsSnap = await db.collection('walkins').get();
      walkins = walkinsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      try {
        const archivedSnap = await db.collection('archive_bookings').get();
        const archived = archivedSnap.docs.map(d => ({ id: d.id, ...d.data(), archived: true }));
        if (archived.length) appointments = appointments.concat(archived);
      } catch (err) {
        console.warn('archive_bookings not available', err && err.message ? err.message : err);
      }

      const servicesSnap = await db.collection('services').get();
      servicesData = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      window.appData = window.appData || {};
      window.appData.services = servicesData;
      // update appData with the fetched bookings and walkins so other modules can read it
      window.appData.appointments = appointments;
      window.appData.walkins = walkins;
      window.appData.archiveBookings = (appointments || []).filter(a => Boolean(a.archived));
      console.info(`Sales: loaded ${appointments.length || 0} bookings, ${walkins.length || 0} walkins, ${window.appData.archiveBookings.length || 0} archived`);
      return true;
    } catch (err) {
      console.warn('Could not load from Firestore, falling back to window.appData:', err && err.message ? err.message : err);
      const fallbackAppts = (window.appData.appointments || []);
      const fallbackWalkins = (window.appData.walkins || []);
      const archived = Array.isArray(window.appData.archiveBookings) ? window.appData.archiveBookings.map(a => ({ ...a, archived: true })) : [];
      appointments = fallbackAppts.concat(archived);
      walkins = fallbackWalkins;
      servicesData = window.appData.services || [];
      console.info(`Sales: using fallback ${appointments.length || 0} bookings, ${walkins.length || 0} walkins, ${archived.length || 0} archived`);
      window.appData.appointments = appointments;
      window.appData.walkins = walkins = fallbackWalkins;
      window.appData.archiveBookings = archived;
      return false;
    }
  }

  function buildAllSales() {
    const appts = (appointments || []).map((a, i) => {
      const svcSource = a.service || a.serviceName || a.serviceObj || a;
      const svc = normalizeService(svcSource);
      return {
        transactionId: safeText(a.serviceId) || safeText(a.id) || `APP-${1001 + i}`,
        date: a.datetime ? new Date(String(a.datetime).split(' - ')[0]) : new Date(a.createdAt || Date.now()),
        customer: safeText(a.customer || a.customerName || 'Customer'),
        service: safeText(svc.name || 'Service'),
        amount: Number(a.amount != null ? a.amount : (getPriceForService(svc) || 0)),
        payment: safeText(a.paymentStatus || 'Unknown'),
        technician: safeText(a.technician || 'Unassigned'),
        archived: Boolean(a.archived || a.isArchived)
      };
    });

    const walkinRecords = (walkins || []).map((w, i) => {
      const svc = normalizeService(w.service || w.serviceName || w.serviceObj || w);
      return {
        transactionId: safeText(w.id) || `WLK-${1001 + i}`,
        date: w.datetime ? new Date(String(w.datetime).split(' - ')[0]) : new Date(w.createdAt || Date.now()),
        customer: safeText(w.customer || 'Walk-in Customer'),
        service: safeText(svc.name || 'Service'),
        amount: Number(w.amount != null ? w.amount : (getPriceForService(svc) || 0)),
        payment: safeText(w.paymentStatus || 'Unknown'),
        technician: safeText(w.technician || 'Unassigned'),
        archived: Boolean(w.archived || w.isArchived)
      };
    });

    allSales = [...appts, ...walkinRecords];
    allSales.sort((a, b) => b.date - a.date);
  }

  function populateSalesTable(sales) {
    salesTbody.innerHTML = '';
    if (!sales || sales.length === 0) {
      const r = document.createElement('tr');
      r.innerHTML = '<td colspan="8" class="text-center text-muted" style="padding:2rem;">No sales transactions found.</td>';
      salesTbody.appendChild(r);
      return;
    }

    const frag = document.createDocumentFragment();
    sales.forEach(s => {
      const row = document.createElement('tr');
      row.className = 'clickable-row';
      row.dataset.transactionId = s.transactionId;
      row.innerHTML = `
        <td>${s.transactionId}</td>
        <td>${s.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
        <td>${s.customer}</td>
        <td>${s.service}</td>
        <td>₱${Number(s.amount || 0).toLocaleString()}</td>
        <td><span class="payment-status-badge ${(s.payment || '').toLowerCase()}">${s.payment}</span></td>
        <td>${s.technician}</td>
        <td>${s.archived ? 'Yes' : 'No'}</td>
      `;
      frag.appendChild(row);
    });
    salesTbody.appendChild(frag);
  }

  function openTransactionModal(sale) {
    if (!sale || !transactionDetailsContent || !transactionModalOverlay) return;
    transactionDetailsContent.innerHTML = '';
    const addDetail = (label, value) => {
      const wrap = document.createElement('div');
      wrap.className = 'detail-item';
      const small = document.createElement('small');
      small.className = 'text-muted';
      small.textContent = label;
      const p = document.createElement('p');
      p.textContent = value;
      wrap.appendChild(small);
      wrap.appendChild(p);
      transactionDetailsContent.appendChild(wrap);
    };

    addDetail('Transaction ID', sale.transactionId);
    addDetail('Date', sale.date.toLocaleString());
    addDetail('Customer', sale.customer);
    addDetail('Technician', sale.technician);
    addDetail('Service', sale.service);
    addDetail('Amount', `₱${Number(sale.amount).toLocaleString()}`);
    addDetail('Payment Status', sale.payment);
    if (sale.archived) addDetail('Archived', 'Yes');

    transactionModalOverlay.classList.add('show');
    document.body.classList.add('modal-open');
  }

  function closeTransactionModal() {
    if (!transactionModalOverlay) return;
    transactionModalOverlay.classList.remove('show');
    document.body.classList.remove('modal-open');
  }

  function calculateInsights(salesData) {
    // Calculate metrics based only on 'Paid' transactions to avoid inflating revenue
    const paidOnly = (salesData || []).filter(x => String(x.payment || '').toLowerCase() === 'paid');
    const totalRevenue = (paidOnly || []).reduce((s, x) => s + Number(x.amount || 0), 0);
    const totalTransactions = (paidOnly || []).length;
    const avg = totalTransactions ? totalRevenue / totalTransactions : 0;
    const profit = totalRevenue * 0.3;

    const update = (el, val) => { if (!el) return; el.textContent = val; };
    update(totalRevenueEl, `₱${totalRevenue.toLocaleString()}`);
    update(totalTransactionsEl, totalTransactions.toLocaleString());
    update(avgSaleEl, `₱${avg.toLocaleString()}`);
    update(totalProfitEl, `₱${profit.toLocaleString()}`);
  }

  function renderSalesChart(salesData) {
    if (typeof renderChart !== 'function') return;
    const paidOnly = (salesData || []).filter(x => String(x.payment || '').toLowerCase() === 'paid');
    const byDate = (paidOnly || []).reduce((acc, s) => {
      const d = s.date.toISOString().split('T')[0];
      acc[d] = (acc[d] || 0) + Number(s.amount || 0);
      return acc;
    }, {});
    const dates = Object.keys(byDate).sort();
    const labels = dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const data = dates.map(d => byDate[d]);

    const cfg = {
      type: 'line',
      data: { labels, datasets: [{ label: 'Revenue', data, borderColor: getCssVar('--color-primary'), backgroundColor: `${getCssVar('--color-primary')}33`, tension: 0.3, fill: true }] },
      options: { responsive: true, maintainAspectRatio: false }
    };

    renderChart('sales-chart', cfg);
  }

  function renderTechnicianChart(salesData) {
    if (typeof renderChart !== 'function') return;
    const paidOnly = (salesData || []).filter(x => String(x.payment || '').toLowerCase() === 'paid');
    const byTech = (paidOnly || []).reduce((acc, s) => { acc[s.technician] = (acc[s.technician] || 0) + Number(s.amount || 0); return acc; }, {});
    const sorted = Object.entries(byTech).sort(([, a], [, b]) => b - a);
    const labels = sorted.map(i => i[0]);
    const data = sorted.map(i => i[1]);

    const cfg = {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: [getCssVar('--color-primary'), getCssVar('--color-success-variant'), getCssVar('--color-warning-variant')], borderColor: getCssVar('--color-background'), borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false }
    };

    renderChart('technician-revenue-chart', cfg);
  }

  function renderServiceCategoryChart(salesData) {
    if (typeof renderChart !== 'function') return;
    const svcMap = (window.appData.services || []).reduce((acc, s) => {
      const name = s.service || s.serviceName || s.name || '';
      const id = s.id || s.serviceId || '';
      if (name) acc[name] = s.category || 'Other';
      else if (id) acc[id] = s.category || 'Other';
      return acc;
    }, {});
    const paidOnly = (salesData || []).filter(x => String(x.payment || '').toLowerCase() === 'paid');
    const byCat = (paidOnly || []).reduce((acc, s) => { const c = svcMap[s.service] || 'Other'; acc[c] = (acc[c] || 0) + Number(s.amount || 0); return acc; }, {});

    const cfg = {
      type: 'pie',
      data: { labels: Object.keys(byCat), datasets: [{ data: Object.values(byCat), backgroundColor: [getCssVar('--color-primary'), getCssVar('--color-success-variant'), getCssVar('--color-warning-variant')], borderColor: getCssVar('--color-background'), borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false }
    };

    renderChart('category-revenue-chart', cfg);
  }

  function renderTopServices(salesData) {
    const container = document.getElementById('top-services-container');
    if (!container) return;
    const paidOnly = (salesData || []).filter(x => String(x.payment || '').toLowerCase() === 'paid');
    const counts = (paidOnly || []).reduce((acc, s) => { acc[s.service] = (acc[s.service] || 0) + 1; return acc; }, {});
    const top = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5);
    if (!top.length) { container.innerHTML = '<p class="text-muted" style="text-align:center;padding:1rem 0;">No sales data for this period.</p>'; return; }
    const max = top[0][1];
    container.innerHTML = top.map(([name, count]) => `<div class="service-item"><div class="service-info"><h3>${name}</h3><small class="text-muted">${count} transactions</small></div><div class="progress-bar"><span style="width:${(count / max) * 100}%"></span></div></div>`).join('');
  }

  function getActiveDateRangeText() {
    const active = document.querySelector('.quick-select-btn.active');
    if (active) {
      const r = active.dataset.range;
      if (r === 'today') return 'Today';
      if (r === '7d') return '7D';
      if (r === '30d') return '30D';
    }
    if (startDateInput && (startDateInput.value || endDateInput.value)) return 'Custom';
    return '30D';
  }

  function updateDisplay() {
    let startDate = startDateInput && startDateInput.value ? new Date(startDateInput.value) : null;
    let endDate = endDateInput && endDateInput.value ? new Date(endDateInput.value) : null;
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    const dateFiltered = (allSales || []).filter(s => {
      const sd = s.date;
      if (startDate && endDate) return sd >= startDate && sd <= endDate;
      if (startDate) return sd >= startDate;
      if (endDate) return sd <= endDate;
      return true;
    });

    calculateInsights(dateFiltered);
    renderSalesChart(dateFiltered);
    renderTechnicianChart(dateFiltered);
    renderServiceCategoryChart(dateFiltered);
    renderTopServices(dateFiltered);

    const term = (searchInput && searchInput.value || '').toLowerCase().trim();
    const final = term ? dateFiltered.filter(s => (s.transactionId || '').toLowerCase().includes(term) || (s.customer || '').toLowerCase().includes(term) || (s.service || '').toLowerCase().includes(term) || (s.technician || '').toLowerCase().includes(term)) : dateFiltered;
    populateSalesTable(final);
  }

  function exportToCSV() {
    let dataToExport = allSales || [];
    let startDate = startDateInput && startDateInput.value ? new Date(startDateInput.value) : null;
    let endDate = endDateInput && endDateInput.value ? new Date(endDateInput.value) : null;
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);
    dataToExport = dataToExport.filter(s => {
      if (startDate && endDate) return s.date >= startDate && s.date <= endDate;
      if (startDate) return s.date >= startDate;
      if (endDate) return s.date <= endDate;
      return true;
    });
    const term = (searchInput && searchInput.value || '').toLowerCase().trim();
    if (term) dataToExport = dataToExport.filter(s => (s.transactionId || '').toLowerCase().includes(term) || (s.customer || '').toLowerCase().includes(term) || (s.service || '').toLowerCase().includes(term) || (s.technician || '').toLowerCase().includes(term));

    const headers = ['Transaction ID', 'Date', 'Customer', 'Service', 'Amount', 'Payment', 'Technician', 'Archived'];
    const rows = [headers.join(',')].concat(dataToExport.map(s => [s.transactionId, s.date.toISOString().split('T')[0], s.customer, s.service, s.amount, s.payment, s.technician, s.archived ? 'Yes' : 'No'].map(v => {
      const str = String(v || '');
      return str.includes(',') ? `"${str.replace(/"/g, '""')}` : str;
    }).join(',')));

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kingsley-sales-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleQuickSelect(e) {
    const range = e.currentTarget?.dataset?.range || e.target?.dataset?.range;
    if (!range) return;
    const today = new Date();
    let startDate = new Date();
    quickSelectButtons.forEach(b => b.classList.remove('active'));
    const btn = (e.currentTarget || e.target);
    btn.classList.add('active');
    if (range === 'today') startDate = today;
    else if (range === '7d') startDate.setDate(today.getDate() - 6);
    else if (range === '30d') startDate.setDate(today.getDate() - 29);
    if (startDateInput) startDateInput.value = startDate.toISOString().split('T')[0];
    if (endDateInput) endDateInput.value = today.toISOString().split('T')[0];
    updateDisplay();
  }

  function clearFilters() {
    if (searchInput) searchInput.value = '';
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
    quickSelectButtons.forEach(b => b.classList.remove('active'));
    const d30 = document.querySelector('.quick-select-btn[data-range="30d"]');
    if (d30) d30.click(); else updateDisplay();
  }

  // listeners
  if (searchInput) searchInput.addEventListener('input', updateDisplay);
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCSV);
  if (startDateInput) startDateInput.addEventListener('change', () => { quickSelectButtons.forEach(btn => btn.classList.remove('active')); updateDisplay(); });
  if (endDateInput) endDateInput.addEventListener('change', () => { quickSelectButtons.forEach(btn => btn.classList.remove('active')); updateDisplay(); });
  quickSelectButtons.forEach(btn => btn.addEventListener('click', handleQuickSelect));
  if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
  if (printTransactionBtn) printTransactionBtn.addEventListener('click', () => window.print());
  if (transactionModalCloseBtn) transactionModalCloseBtn.addEventListener('click', closeTransactionModal);
  if (transactionModalOverlay) transactionModalOverlay.addEventListener('click', (e) => { if (e.target === transactionModalOverlay) closeTransactionModal(); });

  salesTbody.addEventListener('click', (e) => {
    const row = e.target.closest && e.target.closest('tr.clickable-row');
    if (!row) return;
    const tid = row.dataset.transactionId;
    const sale = (allSales || []).find(s => s.transactionId === tid);
    if (sale) openTransactionModal(sale);
  });

  // initial load
  (async () => {
    await loadSalesDataFromFirestore();
    buildAllSales();
    const defaultBtn = document.querySelector('.quick-select-btn[data-range="30d"]');
    if (defaultBtn) defaultBtn.click(); else updateDisplay();
  })();

});
