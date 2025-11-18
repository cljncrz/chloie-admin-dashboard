document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Firebase to initialize
  await window.firebaseInitPromise;

  const salesTbody = document.getElementById('sales-tbody');
  const searchInput = document.getElementById('sales-search');
  const startDateInput = document.getElementById('sales-start-date');
  const endDateInput = document.getElementById('sales-end-date');
  const quickSelectButtons = document.querySelectorAll('.quick-select-btn');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  const themeToggler = document.querySelector('.theme-toggler');

  // Transaction Modal Elements
  const transactionModalOverlay = document.getElementById('transaction-modal-overlay');
  const transactionModalCloseBtn = document.getElementById('transaction-modal-close-btn');
  const printTransactionBtn = document.getElementById('print-transaction-btn');
  const transactionDetailsContent = document.getElementById('transaction-details-content');

  // Insight card elements
  const totalRevenueEl = document.querySelector('#sales-page-insights .card:nth-child(1) h1');
  const totalTransactionsEl = document.querySelector('#sales-page-insights .card:nth-child(2) h1');
  const avgSaleEl = document.querySelector('#sales-page-insights .card:nth-child(3) h1');
  const totalProfitEl = document.querySelector('#sales-page-insights .card:nth-child(4) h1');

  if (!salesTbody) return;

  // Global array to hold all sales data
  let allSales = [];

  // --- Fetch Data from Firebase ---
  const fetchSalesData = async () => {
    try {
      const db = window.firebase.firestore();
      
      // Fetch bookings, walkins, and services simultaneously
      const [bookingsSnapshot, walkinsSnapshot, servicesSnapshot] = await Promise.all([
        db.collection('bookings').get(),
        db.collection('walkins').get(),
        db.collection('services').get()
      ]);

      // Store services data globally
      window.appData.services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Helper function to parse Firestore dates
      const parseFirestoreDate = (val) => {
        if (!val && val !== 0) return null;
        try {
          if (val && typeof val.toDate === 'function') return val.toDate();
          if (val && typeof val.seconds === 'number') {
            const nanos = val.nanoseconds ?? val.nanosecond ?? val.nanos ?? 0;
            return new Date(val.seconds * 1000 + Math.floor(nanos / 1e6));
          }
          if (val instanceof Date) return val;
          if (typeof val === 'number') {
            if (val < 1e12) return new Date(val * 1000);
            return new Date(val);
          }
          if (typeof val === 'string') {
            const parsed = new Date(val);
            if (!isNaN(parsed)) return parsed;
          }
        } catch (e) {
          console.debug('parseFirestoreDate error', e);
        }
        return null;
      };

      // Helper function to get price based on service and car type
      const getPriceForService = (serviceName, carType, amountField) => {
        // If amount is directly provided, use it
        if (amountField && typeof amountField === 'number' && amountField > 0) {
          return amountField;
        }

        const serviceData = (window.appData.services || []).find(
          (s) => s.service === serviceName || s.name === serviceName
        );
        
        if (!serviceData) return 500; // Default fallback

        const carTypeLower = (carType || 'medium').toLowerCase();
        let priceCategory = 'medium';
        
        if (['sedan', 'hatchback', 'small'].includes(carTypeLower)) priceCategory = 'small';
        if (['suv', 'pickup', 'large'].includes(carTypeLower)) priceCategory = 'large';
        if (['van', 'truck', 'xlarge', 'x-large'].includes(carTypeLower)) priceCategory = 'xLarge';

        return (
          serviceData[priceCategory] ||
          serviceData.medium ||
          serviceData.small ||
          serviceData.large ||
          serviceData.xLarge ||
          serviceData.price ||
          500
        );
      };

      // Process bookings (only paid ones)
      const bookingsData = bookingsSnapshot.docs
        .map(doc => {
          const data = doc.data() || {};
          
          // Only include paid transactions
          if (data.paymentStatus !== 'Paid') return null;

          // Try to find a date field
          const possibleDateFields = ['time', 'scheduleDate', 'dateTime', 'datetime', 'date', 'scheduledAt', 'appointmentDate', 'timestamp', 'bookingDate', 'createdAt'];
          let dateObj = null;
          
          for (const field of possibleDateFields) {
            if (data[field]) {
              dateObj = parseFirestoreDate(data[field]);
              if (dateObj) break;
            }
          }

          if (!dateObj) {
            dateObj = new Date(); // Fallback to current date
          }

          return {
            transactionId: data.serviceId || data.bookingId || doc.id,
            date: dateObj,
            customer: data.customer || data.customerName || data.name || 'Unknown Customer',
            service: data.service || data.serviceName || 'Unknown Service',
            amount: getPriceForService(data.service || data.serviceName, data.carType || data.vehicleType, data.amount || data.price || data.totalAmount),
            payment: data.paymentStatus || 'Paid',
            technician: data.technician || data.assignedTechnician || 'Unassigned',
            carType: data.carType || data.vehicleType || 'Unknown',
            category: data.category || 'Service'
          };
        })
        .filter(item => item !== null);

      // Process walkins (only paid ones)
      const walkinsData = walkinsSnapshot.docs
        .map(doc => {
          const data = doc.data() || {};
          
          // Only include paid transactions
          if (data.paymentStatus !== 'Paid') return null;

          const possibleDateFields = ['time', 'scheduleDate', 'dateTime', 'datetime', 'date', 'scheduledAt', 'appointmentDate', 'timestamp', 'createdAt'];
          let dateObj = null;
          
          for (const field of possibleDateFields) {
            if (data[field]) {
              dateObj = parseFirestoreDate(data[field]);
              if (dateObj) break;
            }
          }

          if (!dateObj) {
            dateObj = new Date();
          }

          return {
            transactionId: `WLK-${doc.id}`,
            date: dateObj,
            customer: data.customer || data.customerName || 'Walk-in Customer',
            service: data.service || data.serviceName || 'Unknown Service',
            amount: getPriceForService(data.service || data.serviceName, data.carType || data.vehicleType, data.amount || data.price || data.totalAmount),
            payment: data.paymentStatus || 'Paid',
            technician: data.technician || data.assignedTechnician || 'Unassigned',
            carType: data.carType || data.vehicleType || 'Unknown',
            category: data.category || 'Service'
          };
        })
        .filter(item => item !== null);

      // Combine and sort all sales
      allSales = [...bookingsData, ...walkinsData];
      allSales.sort((a, b) => b.date - a.date);

      // Store in global appData for other scripts
      window.appData.appointments = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      window.appData.walkins = walkinsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      console.log(`Loaded ${allSales.length} sales transactions (${bookingsData.length} bookings + ${walkinsData.length} walkins)`);
      
      return allSales;
    } catch (error) {
      console.error('Error fetching sales data:', error);
      showToast('Error loading sales data', 'error');
      return [];
    }
  };

  // --- Populate Sales Table ---
  const populateSalesTable = (sales) => {
    salesTbody.innerHTML = ''; // Clear existing rows
    const fragment = document.createDocumentFragment();

    if (sales.length === 0) {
      const noResultsRow = document.createElement('tr');
      noResultsRow.innerHTML = `<td colspan="7" class="text-center text-muted" style="padding: 2rem;">No sales transactions found.</td>`;
      fragment.appendChild(noResultsRow);
    } else {
      sales.forEach((sale) => {
        const row = document.createElement('tr');
        row.classList.add('clickable-row');
        row.dataset.transactionId = sale.transactionId;
        const paymentStatusClass = sale.payment.toLowerCase();

        row.innerHTML = `
            <td>${sale.transactionId}</td>
            <td>${sale.date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}</td>
            <td>${sale.customer}</td>
            <td>${sale.service}</td>
            <td>₱${sale.amount.toLocaleString()}</td>
            <td><span class="payment-status-badge ${paymentStatusClass}">${
          sale.payment
        }</span></td>
            <td>${sale.technician}</td>
        `;
        fragment.appendChild(row);
      });
    }
    salesTbody.appendChild(fragment);
  };

  // --- Transaction Modal Logic ---
  const openTransactionModal = (sale) => {
    if (!sale || !transactionDetailsContent || !transactionModalOverlay) return;

    transactionDetailsContent.innerHTML = `
      <div class="detail-item">
        <small class="text-muted">Transaction ID</small>
        <p>${sale.transactionId}</p>
      </div>
      <div class="detail-item">
        <small class="text-muted">Date</small>
        <p>${sale.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div class="detail-item">
        <small class="text-muted">Customer</small>
        <p>${sale.customer}</p>
      </div>
      <div class="detail-item">
        <small class="text-muted">Technician</small>
        <p>${sale.technician}</p>
      </div>
      <div class="detail-item">
        <small class="text-muted">Service</small>
        <p>${sale.service}</p>
      </div>
      <div class="detail-item">
        <small class="text-muted">Amount</small>
        <p>₱${sale.amount.toLocaleString()}</p>
      </div>
      <div class="detail-item">
        <small class="text-muted">Payment Status</small>
        <p><span class="payment-status-badge ${sale.payment.toLowerCase()}">${sale.payment}</span></p>
      </div>
    `;

    transactionModalOverlay.classList.add('show');
    document.body.classList.add('modal-open');
  };

  const closeTransactionModal = () => {
    if (!transactionModalOverlay) return;
    transactionModalOverlay.classList.remove('show');
    document.body.classList.remove('modal-open');
  };


  // --- Calculate and Populate Insight Cards ---
  const calculateInsights = (salesData) => {
    const totalRevenue = salesData.reduce((sum, sale) => sum + sale.amount, 0);
    const totalTransactions = salesData.length;
    const averageSale = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const totalProfit = totalRevenue * 0.30; // Assuming a 30% profit margin

    // Helper function to update card and trigger animation
    const updateCard = (element, value) => {
        if (!element) return;

        // Only animate if the value has changed
        if (element.textContent !== value) {
            element.textContent = value;
            const card = element.closest('.card');
            if (card) {
                card.classList.remove('card-flash'); // Remove to allow re-triggering
                void card.offsetWidth; // Trigger a reflow, which is a trick to restart the animation
                card.classList.add('card-flash');
            }
        }
    };

    document.getElementById('analytics-title').textContent = `Revenue Trend (${getActiveDateRangeText()})`;

    updateCard(totalRevenueEl, `₱${totalRevenue.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })}`);
    
    updateCard(totalTransactionsEl, totalTransactions.toLocaleString());
    
    updateCard(avgSaleEl, `₱${averageSale.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`);

    updateCard(totalProfitEl, `₱${totalProfit.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`);
  };

  // --- Render Sales Chart ---
  const renderSalesChart = (salesData) => {
    const primaryColor = getCssVar('--color-primary');
    const gridColor = getCssVar('--chart-grid-color');
    const textColor = getCssVar('--chart-text-color'); // This is the correct variable

    // Group sales by date
    const salesByDate = salesData.reduce((acc, sale) => {
      const date = sale.date.toISOString().split('T')[0]; // YYYY-MM-DD format
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date] += sale.amount;
      return acc;
    }, {});

    // Sort dates and create labels and data points
    const sortedDates = Object.keys(salesByDate).sort();
    const chartLabels = sortedDates.map((date) =>
      new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
    const chartData = sortedDates.map((date) => salesByDate[date]);

    // Create the chart
    const chartConfig = {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: 'Revenue',
            data: chartData,
            borderColor: primaryColor,
            backgroundColor: `${primaryColor}33`, // Add 20% opacity (hex 33)
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            display: true,
            labels: { color: textColor }
          }
        },
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
            },
          },
          x: {
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
            },
          },
        },
      },
    };

    renderChart('sales-chart', chartConfig);
  };

  // --- Render Top Selling Services ---
  const renderTopServices = (salesData) => {
    const container = document.getElementById('top-services-container');
    if (!container) return;

    // Count occurrences of each service
    const serviceCounts = salesData.reduce((acc, sale) => {
      acc[sale.service] = (acc[sale.service] || 0) + 1;
      return acc;
    }, {});

    // Sort services by count and take the top 5
    const topServices = Object.entries(serviceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (topServices.length === 0) {
      container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 1rem 0;">No sales data for this period.</p>';
      return;
    }

    const maxCount = topServices[0][1]; // Count of the top service
    let content = '';

    topServices.forEach(([serviceName, count]) => {
      const percentage = (count / maxCount) * 100;
      content += `
        <div class="service-item">
          <div class="service-info">
            <h3>${serviceName}</h3>
            <small class="text-muted">${count} transactions</small>
          </div>
          <div class="progress-bar">
            <span style="width: ${percentage}%"></span>
          </div>
        </div>
      `;
    });
    container.innerHTML = content;
  };

// --- Render Revenue by Technician Chart ---
  const renderTechnicianChart = (salesData) => {
    const textColor = getCssVar('--chart-text-color'); // This is the correct variable

    // Group revenue by technician
    const revenueByTechnician = salesData.reduce((acc, sale) => {
      acc[sale.technician] = (acc[sale.technician] || 0) + sale.amount;
      return acc;
    }, {});

    const sortedTechnicians = Object.entries(revenueByTechnician)
      .sort(([, a], [, b]) => b - a);

    const chartLabels = sortedTechnicians.map(item => item[0]);
    const chartData = sortedTechnicians.map(item => item[1]);

    // Define a color palette
    const colorPalette = [
        getCssVar('--color-primary'),
        getCssVar('--color-success-variant'),
        getCssVar('--color-warning-variant'),
        '#6C63FF',
        '#FF6B6B',
        '#4ECDC4',
    ];

    const chartConfig = {
      type: 'doughnut',
      data: {
        labels: chartLabels,
        datasets: [{
          label: 'Revenue by Technician',
          data: chartData,
          backgroundColor: colorPalette,
          borderColor: getCssVar('--color-background'),
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: textColor, padding: 20, font: { size: 12 } }
          }
        }
      }
    };

    renderChart('technician-revenue-chart', chartConfig);
  };

  // --- Render Revenue by Service Category Chart ---
  const renderServiceCategoryChart = (salesData) => {
    const textColor = getCssVar('--chart-text-color'); // This is the correct variable

    // Create a lookup map for service categories for efficiency
    const serviceCategoryMap = (window.appData.services || []).reduce((acc, service) => {
      acc[service.service] = service.category;
      return acc;
    }, {});

    // Group revenue by category
    const revenueByCategory = salesData.reduce((acc, sale) => {
      const category = serviceCategoryMap[sale.service] || 'Other';
      acc[category] = (acc[category] || 0) + sale.amount;
      return acc;
    }, {});

    const chartLabels = Object.keys(revenueByCategory);
    const chartData = Object.values(revenueByCategory);

    const chartConfig = {
      type: 'pie',
      data: {
        labels: chartLabels,
        datasets: [{
          label: 'Revenue by Category',
          data: chartData,
          backgroundColor: [
            getCssVar('--color-primary'),
            getCssVar('--color-success-variant'),
            getCssVar('--color-warning-variant'),
          ],
          borderColor: getCssVar('--color-background'),
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: textColor, padding: 20, font: { size: 12 } }
          }
        }
      }
    };
    renderChart('category-revenue-chart', chartConfig);
  };

  // --- Helper to get active date range for titles ---
  const getActiveDateRangeText = () => {
    const activeButton = document.querySelector('.quick-select-btn.active');
    if (activeButton) {
        const range = activeButton.dataset.range;
        if (range === 'today') return 'Today';
        if (range === '7d') return '7D';
        if (range === '30d') return '30D';
    }
    if (startDateInput.value || endDateInput.value) {
        return 'Custom';
    }
    return '30D'; // Default text
  };

  // --- Main Update Function ---
  const updateDisplay = () => {
    // 1. Filter by Date Range
    let startDate = startDateInput.value ? new Date(startDateInput.value) : null;
    let endDate = endDateInput.value ? new Date(endDateInput.value) : null;

    // Adjust dates to be inclusive
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    let dateFilteredSales = allSales.filter(sale => {
        const saleDate = sale.date;
        if (startDate && endDate) return saleDate >= startDate && saleDate <= endDate;
        if (startDate) return saleDate >= startDate;
        if (endDate) return saleDate <= endDate;
        return true; // No date filter applied
    });

    // 2. Update Insights and Chart with date-filtered data
    calculateInsights(dateFilteredSales);
    renderSalesChart(dateFilteredSales);
    renderTechnicianChart(dateFilteredSales);
    renderServiceCategoryChart(dateFilteredSales);
    renderTopServices(dateFilteredSales); // Render the new widget

    // 3. Filter by Search Term
    const searchTerm = searchInput.value.toLowerCase().trim();
    const finalFilteredSales = !searchTerm ? dateFilteredSales : dateFilteredSales.filter(sale => {
        return (
            sale.transactionId.toLowerCase().includes(searchTerm) ||
            sale.customer.toLowerCase().includes(searchTerm) ||
            sale.service.toLowerCase().includes(searchTerm) ||
            sale.technician.toLowerCase().includes(searchTerm)
        );
    });

    // 4. Populate Table
    populateSalesTable(finalFilteredSales);
  };

  // --- Export to CSV Functionality ---
  const exportToCSV = () => {
    // Get the currently displayed data by running the full filter logic
    let dataToExport = allSales; // Start with all data
    let startDate = startDateInput.value ? new Date(startDateInput.value) : null;
    let endDate = endDateInput.value ? new Date(endDateInput.value) : null;
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    dataToExport = allSales.filter(sale => {
        const saleDate = sale.date;
        if (startDate && endDate) return saleDate >= startDate && saleDate <= endDate;
        if (startDate) return saleDate >= startDate;
        if (endDate) return saleDate <= endDate;
        return true;
    });

    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
      dataToExport = dataToExport.filter((sale) => {
          return (
            sale.transactionId.toLowerCase().includes(searchTerm) ||
            sale.customer.toLowerCase().includes(searchTerm) ||
            sale.service.toLowerCase().includes(searchTerm) ||
            sale.technician.toLowerCase().includes(searchTerm)
          );
        });
    }
    
    const headers = ['Transaction ID', 'Date', 'Customer', 'Service', 'Amount', 'Payment', 'Technician'];
    
    // Escape commas in data by wrapping the value in double quotes
    const escapeCsvValue = (value) => {
        const stringValue = String(value || '');
        if (stringValue.includes(',')) {
            return `"${stringValue}"`;
        }
        return stringValue;
    };

    const csvRows = [
      headers.join(','),
      ...dataToExport.map(sale => [
        escapeCsvValue(sale.transactionId),
        escapeCsvValue(sale.date.toISOString().split('T')[0]), // Format as YYYY-MM-DD
        escapeCsvValue(sale.customer),
        escapeCsvValue(sale.service),
        sale.amount, // No need to escape numbers
        escapeCsvValue(sale.payment),
        escapeCsvValue(sale.technician)
      ].join(','))
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `kingsley-sales-${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Date Quick Select Logic ---
  const handleQuickSelect = (e) => {
    const range = e.target.dataset.range;
    const today = new Date();
    let startDate = new Date();

    // Deactivate all buttons first
    quickSelectButtons.forEach(btn => btn.classList.remove('active'));
    // Activate the clicked button
    e.target.classList.add('active');

    switch(range) {
        case 'today':
            startDate = today;
            break;
        case '7d':
            startDate.setDate(today.getDate() - 6); // 6 days ago to today = 7 days
            break;
        case '30d':
            startDate.setDate(today.getDate() - 29); // 29 days ago to today = 30 days
            break;
    }

    // Set the date inputs and trigger update
    startDateInput.value = startDate.toISOString().split('T')[0];
    endDateInput.value = today.toISOString().split('T')[0];
    updateDisplay();
  };

  // --- Clear Filters Logic ---
  const clearFilters = () => {
    searchInput.value = '';
    startDateInput.value = '';
    endDateInput.value = '';
    quickSelectButtons.forEach(btn => btn.classList.remove('active'));
    // Set back to default 30 days
    const default30dButton = document.querySelector('.quick-select-btn[data-range="30d"]');
    if (default30dButton) {
      default30dButton.click();
    } else {
      updateDisplay();
    }
  };

  // --- Event Listeners ---
  searchInput.addEventListener('input', updateDisplay);
  document.getElementById('export-csv-btn')?.addEventListener('click', exportToCSV);
  startDateInput.addEventListener('change', () => {
    quickSelectButtons.forEach(btn => btn.classList.remove('active'));
    updateDisplay();
  });
  endDateInput.addEventListener('change', () => {
    quickSelectButtons.forEach(btn => btn.classList.remove('active'));
    updateDisplay();
  });
  quickSelectButtons.forEach(btn => btn.addEventListener('click', handleQuickSelect));
  clearFiltersBtn?.addEventListener('click', clearFilters);
  
  if (printTransactionBtn) {
    printTransactionBtn.addEventListener('click', () => window.print());
  }
  // Modal Event Listeners
  if (transactionModalCloseBtn) {
    transactionModalCloseBtn.addEventListener('click', closeTransactionModal);
  }
  if (transactionModalOverlay) {
    transactionModalOverlay.addEventListener('click', (e) => {
      if (e.target === transactionModalOverlay) {
        closeTransactionModal();
      }
    });
  }

  if (themeToggler) {
    themeToggler.addEventListener('click', () => {
      // A small delay ensures the new theme's CSS variables are applied before the chart is redrawn
      setTimeout(updateDisplay, 50);
    });
  }

  // Table Row Click Listener
  salesTbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr.clickable-row');
    if (!row) return;

    const transactionId = row.dataset.transactionId;
    const saleData = allSales.find(sale => sale.transactionId === transactionId);
    if (saleData) openTransactionModal(saleData);
  });

  // Helper function to show toast messages
  const showToast = (message, type = 'success') => {
    const toast = document.getElementById('success-toast');
    if (toast) {
      const icon = toast.querySelector('.material-symbols-outlined');
      const text = toast.querySelector('p');
      
      if (type === 'error') {
        icon.textContent = 'error';
        toast.style.background = 'var(--color-danger)';
      } else {
        icon.textContent = 'check_circle';
        toast.style.background = 'var(--color-success)';
      }
      
      text.textContent = message;
      toast.classList.add('show');
      
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  };

  // --- Initial Load ---
  const initializeSalesPage = async () => {
    // Show loading state
    if (salesTbody) {
      salesTbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;"><div class="loader"></div><p>Loading sales data...</p></td></tr>';
    }

    // Fetch data from Firebase
    await fetchSalesData();

    // Set default to 30 days and trigger display update
    document.querySelector('.quick-select-btn[data-range="30d"]')?.click();
  };

  // Start initialization
  initializeSalesPage();
});