document.addEventListener('DOMContentLoaded', () => {
    const paymentsTable = document.getElementById('payments-table');

    // Only run if the main table element exists
    if (!paymentsTable) return;

    const tableBody = paymentsTable.querySelector('tbody');
    const searchInput = document.getElementById('payment-search');
    const methodFilter = document.getElementById('payment-method-filter');
    const exportBtn = document.getElementById('export-payments-csv-btn');
    const noResultsRow = paymentsTable.querySelector('.no-results-row');
    const loader = document.querySelector('#payments-table-container .table-loader');
    const themeToggler = document.querySelector('.theme-toggler');

    // Stat Card Elements
    const totalPaidEl = document.getElementById('total-paid-stat');
    const gcashTotalEl = document.getElementById('gcash-total-stat');
    const mayaTotalEl = document.getElementById('maya-total-stat');
    const cashTotalEl = document.getElementById('cash-total-stat');

    // Pagination Elements
    const paginationContainer = document.querySelector('.table-pagination');
    const prevBtn = paginationContainer.querySelector('[data-action="prev"]');
    const nextBtn = paginationContainer.querySelector('[data-action="next"]');
    const pageInfo = paginationContainer.querySelector('.page-info');
    const rowsPerPage = 10;
    let currentPage = 1;

    let currentSortBy = 'date';
    let currentSortDir = 'desc';

    // --- Data Preparation ---
    // **FIXED**: The data source is now aligned with the 'sales.js' page for complete accuracy.
    // It combines all paid appointments and walk-ins.
    const getCombinedSalesData = () => {
        // Helper to get price from the services list, similar to sales.js
        const getPriceForService = (serviceName, carType) => {
            const serviceData = (window.appData.services || []).find(s => s.service === serviceName);
            if (!serviceData) return 250 + Math.floor(Math.random() * 1000); // Fallback

            const carTypeLower = carType.toLowerCase();
            let priceCategory = 'medium';
            if (['sedan', 'hatchback'].includes(carTypeLower)) priceCategory = 'small';
            if (['suv', 'pickup'].includes(carTypeLower)) priceCategory = 'large';
            if (['van', 'truck'].includes(carTypeLower)) priceCategory = 'xLarge';

            return serviceData[priceCategory] || serviceData.medium || serviceData.small || serviceData.large || serviceData.xLarge || 250;
        };

        // Helper to get payment method. Prioritize review data, otherwise simulate.
        const getPaymentMethod = (transactionId) => {
            const review = (window.appData.reviews || []).find(r => r.transactionId === transactionId);
            if (review && review.paymentMethod) {
                return review.paymentMethod;
            }
            // Simulate if not found in reviews
            return ['GCash', 'Cash', 'PayMaya'][Math.floor(Math.random() * 3)];
        };

        const paidAppointments = (window.appData.appointments || [])
            .filter(appt => appt.paymentStatus === 'Paid')
            .map(appt => ({
                transactionId: appt.serviceId,
                date: new Date(appt.datetime.split(' - ')[0]),
                customer: appt.customer,
                service: appt.service,
                amount: getPriceForService(appt.service, appt.carType),
                paymentMethod: getPaymentMethod(appt.serviceId),
                // Include other relevant data for potential future use
                technician: appt.technician,
                carType: appt.carType,
            }));

        const paidWalkins = (window.appData.walkins || [])
            .filter(walkin => walkin.paymentStatus === 'Paid')
            .map((walkin, index) => {
                const transactionId = `WLK-${1001 + index}`; // Create a consistent ID
                return {
                    transactionId: transactionId,
                    // Simulate recent dates for walk-ins for realistic data
                    date: new Date(Date.now() - index * 24 * 3600 * 1000),
                    customer: 'Walk-in Customer',
                    service: walkin.service,
                    amount: getPriceForService(walkin.service, walkin.carType),
                    paymentMethod: getPaymentMethod(transactionId), // Use a dummy ID
                    technician: walkin.technician,
                    carType: walkin.carType,
                };
            });

        // Combine all sources into one master list
        const allPayments = [...paidAppointments, ...paidWalkins];

        return allPayments.sort((a, b) => b.date - a.date);
    };
    const paymentData = getCombinedSalesData();

    const formatCurrency = (amount) => {
        return `₱${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // --- Reusable Data Calculation ---
    const getPaymentTotals = () => {
        const totals = paymentData.reduce((acc, payment) => {
            acc.total += payment.amount;
            if (payment.paymentMethod === 'GCash') {
                acc.gcash += payment.amount;
            } else if (payment.paymentMethod === 'PayMaya') {
                acc.maya += payment.amount;
            } else if (payment.paymentMethod === 'Cash') {
                acc.cash += payment.amount;
            }
            return acc;
        }, { total: 0, gcash: 0, maya: 0, cash: 0 });
        return totals;
    };

    const calculateAndDisplayStats = () => {
        if (!totalPaidEl || !gcashTotalEl || !mayaTotalEl || !cashTotalEl) return;

        const totals = getPaymentTotals();

        totalPaidEl.textContent = formatCurrency(totals.total);
        gcashTotalEl.textContent = formatCurrency(totals.gcash);
        mayaTotalEl.textContent = formatCurrency(totals.maya);
        cashTotalEl.textContent = formatCurrency(totals.cash);
    };

    // --- Render Payment Distribution Chart ---
    const renderPaymentDistributionChart = () => {
        const textColor = getCssVar('--chart-text-color');

        const totals = getPaymentTotals();

        const chartLabels = ['GCash', 'Maya', 'Cash'];
        const chartData = [totals.gcash, totals.maya, totals.cash];

        const colorPalette = [
            '#007BFF', // A distinct blue for GCash
            '#00C6AE', // A teal/green for Maya
            getCssVar('--color-success-variant'), // Use existing theme color for Cash
        ];

        const chartConfig = {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Revenue by Payment Method',
                    data: chartData,
                    backgroundColor: colorPalette,
                    borderColor: getCssVar('--color-background'), // Use background for border to create spacing
                    borderWidth: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%', // Makes it a doughnut chart
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { 
                            color: textColor,
                            padding: 20,
                            font: {
                                size: 14
                            }
                        }
                    }
                }
            }
        };

        renderChart('payment-distribution-chart', chartConfig);
    };

     // --- Render Revenue by Service Chart ---
    const renderRevenueByServiceChart = () => {
        const textColor = getCssVar('--chart-text-color');
        const gridColor = getCssVar('--chart-grid-color');

        // 1. Calculate revenue per service
        const revenueByService = paymentData.reduce((acc, payment) => {
            const serviceName = payment.service || 'Unknown Service';
            acc[serviceName] = (acc[serviceName] || 0) + payment.amount;
            return acc;
        }, {});

        // 2. Sort and get top 5 services, group the rest
        const sortedServices = Object.entries(revenueByService).sort(([, a], [, b]) => b - a);
        const topServices = sortedServices.slice(0, 5);
        const otherServices = sortedServices.slice(5);
        const otherRevenue = otherServices.reduce((sum, [, amount]) => sum + amount, 0);

        const chartLabels = topServices.map(item => item[0]);
        const chartData = topServices.map(item => item[1]);

        if (otherRevenue > 0) {
            chartLabels.push('Other Services');
            chartData.push(otherRevenue);
        }

        // 4. Render new chart
        const chartConfig = {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Total Revenue',
                    data: chartData,
                    backgroundColor: getCssVar('--color-primary-variant'),
                    borderRadius: 4,
                }]
            },
            options: {
                indexAxis: 'y', // This makes it a horizontal bar chart
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false } // Hide legend as it's redundant for a single dataset
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: gridColor },
                        ticks: {
                            color: textColor,
                            callback: (value) => `₱${value / 1000}k` // Format ticks as thousands
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: textColor }
                    }
                }
            }
        };

        renderChart('revenue-by-service-chart', chartConfig);
    };

    const renderTablePage = () => {
        if (loader) loader.classList.add('loading');

        setTimeout(() => {
            // 1. Sort data
            paymentData.sort((a, b) => {
                let valA, valB;
                if (currentSortBy === 'date') {
                    valA = a.date;
                    valB = b.date;
                } else if (currentSortBy === 'amount') {
                    valA = a.amount;
                    valB = b.amount;
                } else { // String sort
                    valA = String(a[currentSortBy] || '').toLowerCase();
                    valB = String(b[currentSortBy] || '').toLowerCase();
                }

                if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
                if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
                return 0;
            });

            // 2. Filter data based on search and dropdown
            const searchTerm = searchInput.value.toLowerCase();
            const selectedMethod = methodFilter.value;

            const filteredPayments = paymentData.filter(payment => {
                const matchesMethod = selectedMethod === 'all' || payment.paymentMethod === selectedMethod;
                const paymentText = `${payment.customer} ${payment.service} ${payment.transactionId}`.toLowerCase();
                const matchesSearch = paymentText.includes(searchTerm);
                return matchesMethod && matchesSearch;
            });

            // 3. Paginate the filtered data
            const totalPages = Math.ceil(filteredPayments.length / rowsPerPage);
            currentPage = Math.max(1, Math.min(currentPage, totalPages));

            const startIndex = (currentPage - 1) * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            const paginatedPayments = filteredPayments.slice(startIndex, endIndex);

            // 4. Build the table rows
            tableBody.innerHTML = '';
            const fragment = document.createDocumentFragment();

            if (paginatedPayments.length > 0) {
                paginatedPayments.forEach((payment) => {
                    const row = document.createElement('tr');
                    row.classList.add('clickable-row');
                    row.innerHTML = /*html*/`
                        <td>${payment.transactionId}</td>
                        <td>${payment.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td>${payment.customer}</td>
                        <td>${payment.service}</td>
                        <td>${formatCurrency(payment.amount)}</td>
                        <td>${payment.paymentMethod}</td>
                        <td class="text-center actions-cell">
                            <button class="action-icon-btn view-btn" title="View Full Details">
                                <span class="material-symbols-outlined">visibility</span>
                            </button>
                        </td>
                    `;
                    fragment.appendChild(row);
                });
            }

            tableBody.appendChild(fragment);

            // 5. Update UI elements
            noResultsRow.style.display = filteredPayments.length === 0 ? 'table-row' : 'none';
            pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
            prevBtn.disabled = currentPage === 1;
            nextBtn.disabled = currentPage === totalPages || totalPages === 0;

            if (loader) loader.classList.remove('loading');
        }, 300);
    };

    const exportToCSV = () => {
        const headers = ['Transaction ID', 'Date', 'Customer', 'Service', 'Amount', 'Payment Method'];
        const rows = paymentData.map(p => [
            p.transactionId,
            p.date.toISOString().split('T')[0],
            `"${p.customer.replace(/"/g, '""')}"`, // Escape quotes
            `"${p.service.replace(/"/g, '""')}"`,
            p.amount,
            p.paymentMethod
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `payment-monitoring-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Event Listeners ---

    searchInput.addEventListener('input', () => {
        currentPage = 1;
        renderTablePage();
    });

    methodFilter.addEventListener('change', () => {
        currentPage = 1;
        renderTablePage();
    });

    exportBtn.addEventListener('click', exportToCSV);

    paymentsTable.querySelectorAll('th[data-sortable="true"]').forEach(header => {
        header.addEventListener('click', () => {
            const sortBy = header.dataset.sortBy;
            if (currentSortBy === sortBy) {
                currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortBy = sortBy;
                currentSortDir = 'desc';
            }

            paymentsTable.querySelectorAll('th').forEach(th => th.classList.remove('sorted-asc', 'sorted-desc'));
            header.classList.add(currentSortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');

            currentPage = 1;
            renderTablePage();
        });
    });

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTablePage();
        }
    });

    nextBtn.addEventListener('click', () => {
        currentPage++;
        renderTablePage();
    });

    if (themeToggler) {
        themeToggler.addEventListener('click', () => {
            // A small delay ensures the new theme's CSS variables are applied before the chart is redrawn
            setTimeout(() => {
                renderPaymentDistributionChart();
                renderRevenueByServiceChart();
            }, 50);
        });
    }

    // --- Handle Row Click to View Details ---
    tableBody.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-btn');
        const row = e.target.closest('tr');

        if (!row) return;

        // Allow clicking the whole row or the specific button
        if (!viewBtn && !row.classList.contains('clickable-row')) return;

        // Find the full data object for the clicked row
        const transactionId = row.querySelector('td:first-child').textContent;
        // The `paymentData` is derived from `reviews`, which has all the necessary details.
        const reviewData = paymentData.find(p => p.transactionId === transactionId);

        if (reviewData) {
            // Clear previous data before setting new data to prevent conflicts.
            sessionStorage.removeItem('selectedReviewData');
            // The review-details.html page expects data in sessionStorage under this key.
            sessionStorage.setItem('selectedReviewData', JSON.stringify(reviewData));
            window.location.href = 'review-details.html';
        }
    });

    // --- Initial Load ---
    const initialSortHeader = paymentsTable.querySelector('th[data-sort-by="date"]');
    if (initialSortHeader) initialSortHeader.classList.add('sorted-desc');

    calculateAndDisplayStats();
    renderPaymentDistributionChart();
    renderRevenueByServiceChart();
    renderTablePage();
});