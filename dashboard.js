document.addEventListener('DOMContentLoaded', () => {
    // This script contains functionality specific to the dashboard (index.html)

    // --- Animate Insight Cards on Load ---
    const insightCards = document.querySelectorAll('.insights .card');
    const animateInsights = () => {
        insightCards.forEach((card, index) => {
            // Stagger the animation by adding a delay
            card.style.transitionDelay = `${index * 100}ms`;
            card.classList.add('visible');
        });
    };

    // --- Animate Insight Numbers ---
    const animateInsightNumbers = () => {
        const insightNumbers = document.querySelectorAll('.insights .card h1');
        insightNumbers.forEach(h1 => {
            const targetValue = parseInt(h1.dataset.value);
            const prefix = h1.textContent.startsWith('₱') ? '₱' : '';
            let currentValue = 0;
            const increment = targetValue / 50; // Control animation speed

            const updateCount = () => {
                if (currentValue < targetValue) {
                    currentValue += increment;
                    h1.textContent = prefix + Math.ceil(currentValue).toLocaleString();
                    requestAnimationFrame(updateCount);
                } else {
                    h1.textContent = prefix + targetValue.toLocaleString();
                }
            };

            updateCount();
        });
    };

    // --- Pagination State for Dashboard Tables ---
    let appointmentsCurrentPage = 1;
    const appointmentsRowsPerPage = 5;
    let walkinsCurrentPage = 1;
    const walkinsRowsPerPage = 5;

    // --- Table Filtering and Population ---
    // This section is being added to handle the dashboard's specific table filtering needs.
    // It's designed to be self-contained to avoid conflicts with other pages.

    const fetchDashboardData = async () => {
        const loader = document.querySelector('#dashboard .table-loader');
        if (loader) loader.style.display = 'flex';

        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('bookings').orderBy('dateTime', 'desc').get();

            let scheduledAppointments = [];
            let walkinAppointments = [];

            if (snapshot.empty) {
                console.log('No booking documents found in Firestore for dashboard.');
                window.appData.appointments = [];
                window.appData.walkins = [];
            } else {
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const scheduleDate = data.scheduleDate?.toDate(); // Corrected from dateTime
                    const formattedDateTime = scheduleDate
                        ? scheduleDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(',', ' -')
                        : 'No Date';

                    const commonData = {
                        ...data,
                        serviceId: doc.id,
                        plate: data.plateNumber,
                        service: data.serviceNames,
                        datetime: formattedDateTime,
                    };

                    if (data.isWalkin) { // Assuming a field 'isWalkin' exists in your Firestore booking documents
                        walkinAppointments.push({
                            ...commonData,
                            customerName: data.customerName || 'Walk-in Customer', // Use customerName for walk-ins
                        });
                    } else {
                        scheduledAppointments.push({
                            ...commonData,
                            customer: data.customerName, // Use 'customer' for scheduled appointments
                        });
                    }
                });
                window.appData.appointments = scheduledAppointments;
                window.appData.walkins = walkinAppointments;
            }
        } catch (error) {
            console.error("Error fetching bookings for dashboard:", error);
        } finally {
            if (loader) loader.style.display = 'none';
            // Now that data is fetched, populate the tables
            populateAppointmentsTable();
            populateWalkinsTable();
        }
    };

    const populateAppointmentsTable = () => {
        // Target only the dashboard's appointment table
        const tableBody = document.querySelector('#dashboard .recent-appointments:not(.walk-in-appointments) tbody');
        if (!tableBody) return;
        const fragment = document.createDocumentFragment();
 
        // Use the global data source from all-data.js
        let appointments = window.appData.appointments || [];

        // Filter based on dashboard controls
        const searchInput = document.getElementById('appointment-search');
        const statusFilter = document.getElementById('status-filter');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const selectedStatus = statusFilter ? statusFilter.value : 'all';

        appointments = appointments.filter(appt => {
            const matchesSearch = searchTerm === '' || appt.customer.toLowerCase().includes(searchTerm) || appt.plate.toLowerCase().includes(searchTerm) || appt.service.toLowerCase().includes(searchTerm);
            const matchesStatus = selectedStatus === 'all' || appt.status.toLowerCase() === selectedStatus;
            return matchesSearch && matchesStatus;
        });

        // --- Pagination Logic ---
        const totalPages = Math.ceil(appointments.length / appointmentsRowsPerPage);
        appointmentsCurrentPage = Math.max(1, Math.min(appointmentsCurrentPage, totalPages));

        const startIndex = (appointmentsCurrentPage - 1) * appointmentsRowsPerPage;
        const endIndex = startIndex + appointmentsRowsPerPage;
        const paginatedAppointments = appointments.slice(startIndex, endIndex);

        paginatedAppointments.forEach(appt => {
            const row = document.createElement('tr');
            const statusClass = appt.status.toLowerCase().replace(' ', '-');
            row.dataset.appointmentId = appt.serviceId; // Use a unique ID for lookup
            // The customer's profile picture is hardcoded for this example.
            // In a real app, this would come from the customer's data.
            const customerProfilePic = './images/redicon.png';
            row.innerHTML = `
                <td class="customer-cell">
                    <div class="profile-photo"><img src="${customerProfilePic}" alt="${appt.customer}"></div>
                    <span>${appt.customer}</span>
                </td>
                <td>${appt.plate}</td>
                <td>${appt.service}</td>
                <td class="text-center"><span class="${statusClass}">${appt.status}</span></td>
            `;
            fragment.appendChild(row);
        });

        tableBody.innerHTML = ''; // Clear existing rows before prepending
        tableBody.prepend(fragment);

        // Show/hide 'no results' row
        const noResultsRow = tableBody.querySelector('.no-results-row') || tableBody.parentElement.querySelector('.no-results-row');
        if (noResultsRow) {
            noResultsRow.style.display = appointments.length === 0 ? 'table-row' : 'none';
        }

        // --- Update Pagination UI ---
        const paginationContainer = document.querySelector('#dashboard .recent-appointments:not(.walk-in-appointments) .table-pagination');
        if (paginationContainer) {
            const pageInfo = paginationContainer.querySelector('.page-info');
            const prevBtn = paginationContainer.querySelector('[data-action="prev"]');
            const nextBtn = paginationContainer.querySelector('[data-action="next"]');
            pageInfo.textContent = `Page ${appointmentsCurrentPage} of ${totalPages || 1}`;
            prevBtn.disabled = appointmentsCurrentPage === 1;
            nextBtn.disabled = appointmentsCurrentPage === totalPages || totalPages === 0;
        }
    };

    const populateWalkinsTable = () => {
        const tableBody = document.querySelector('.walk-in-appointments tbody');
        if (!tableBody) return;
        const fragment = document.createDocumentFragment();

        // Use the global data source from all-data.js
        let walkins = window.appData.walkins || [];

        // Filter based on dashboard controls
        const searchInput = document.getElementById('walkin-appointment-search');
        const statusFilter = document.getElementById('walkin-status-filter');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const selectedStatus = statusFilter ? statusFilter.value : 'all';

        walkins = walkins.filter(walkin => {
            const matchesSearch = searchTerm === '' || walkin.plate.toLowerCase().includes(searchTerm) || walkin.service.toLowerCase().includes(searchTerm);
            const matchesStatus = selectedStatus === 'all' || walkin.status.toLowerCase() === selectedStatus;
            return matchesSearch && matchesStatus;
        });

        // --- Pagination Logic ---
        const totalPages = Math.ceil(walkins.length / walkinsRowsPerPage);
        walkinsCurrentPage = Math.max(1, Math.min(walkinsCurrentPage, totalPages));

        const startIndex = (walkinsCurrentPage - 1) * walkinsRowsPerPage;
        const endIndex = startIndex + walkinsRowsPerPage;
        const paginatedWalkins = walkins.slice(startIndex, endIndex);

        paginatedWalkins.forEach(walkin => {
            const row = document.createElement('tr');
            const statusClass = walkin.status.toLowerCase().replace(/\s+/g, '-');
            row.innerHTML = `
                <td>${walkin.customerName}</td>
                <td>${walkin.plate}</td>
                <td>${walkin.service}</td>
                <td class="text-center"><span class="${statusClass}">${walkin.status}</span></td>
            `;
            fragment.appendChild(row);
        });

        tableBody.innerHTML = ''; // Clear existing rows
        tableBody.prepend(fragment);

        // Show/hide 'no results' row
        const noResultsRow = tableBody.querySelector('.no-results-row') || tableBody.parentElement.querySelector('.no-results-row');
        if (noResultsRow) {
            noResultsRow.style.display = walkins.length === 0 ? 'table-row' : 'none';
        }

        // --- Update Pagination UI ---
        const paginationContainer = document.querySelector('.walk-in-appointments .table-pagination');
        if (paginationContainer) {
            const pageInfo = paginationContainer.querySelector('.page-info');
            const prevBtn = paginationContainer.querySelector('[data-action="prev"]');
            const nextBtn = paginationContainer.querySelector('[data-action="next"]');
            pageInfo.textContent = `Page ${walkinsCurrentPage} of ${totalPages || 1}`;
            prevBtn.disabled = walkinsCurrentPage === 1;
            nextBtn.disabled = walkinsCurrentPage === totalPages || totalPages === 0;
        }
    };

    const populateServiceReviews = () => {
        const reviewsContainer = document.querySelector('.reviews-container');
        if (!reviewsContainer) return;

        const sampleReviews = window.appData.reviews || [];
        const fragment = document.createDocumentFragment();
        sampleReviews.slice(0, 3).forEach(review => { // Show only 3 on dashboard
            const reviewCard = document.createElement('div');
            reviewCard.classList.add('review-card');

            let stars = '';
            for (let i = 0; i < 5; i++) {
                stars += `<span class="material-symbols-outlined ${i < review.rating ? 'filled' : ''}">star</span>`;
            }

        // Add a reply button if the review doesn't already have a reply
            const replyButtonHTML = !review.reply
                ? `<button class="btn-primary-outline quick-reply-btn" data-review-id="${review.transactionId}">
                       <span class="material-symbols-outlined">reply</span> Reply
                   </button>`
                : `<div class="admin-reply-indicator text-muted">
                       <span class="material-symbols-outlined">check_circle</span> Replied
                   </div>`;

            reviewCard.innerHTML = `
                <div class="review-header">
                    <div class="review-customer-info">
                        <h3>${review.customer}</h3>
                        <small>${review.service}</small>
                    </div>
                    <div class="review-actions">
                        ${replyButtonHTML}
                    </div>
                </div>
                <p class="review-comment">"${review.comment}"</p>
                <small class="review-date text-muted">Reviewed on: ${review.date}</small>
            `;
            fragment.appendChild(reviewCard);
        });
        reviewsContainer.innerHTML = ''; // Clear existing
        reviewsContainer.appendChild(fragment);

        // --- Add event listeners for the new reply buttons ---
        reviewsContainer.querySelectorAll('.quick-reply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering other click listeners
                const reviewId = btn.dataset.reviewId;
                openQuickReplyModal(reviewId);
            });
        });
    };

    // --- Quick Reply Modal Logic ---
    const openQuickReplyModal = (reviewId) => {
        const modal = document.getElementById('app-modal');
        const modalTitle = modal.querySelector('#modal-title');
        const replyForm = document.getElementById('quick-reply-form');
        const replyTextarea = document.getElementById('quick-reply-textarea');
        const cancelBtn = document.getElementById('quick-reply-cancel-btn');

        const review = (window.appData.reviews || []).find(r => r.transactionId === reviewId);
        if (!review) return;

        modalTitle.textContent = `Reply to ${review.customer}`;
        replyTextarea.value = ''; // Clear previous text

        // Store the review ID on the form for submission
        replyForm.dataset.reviewId = reviewId;

        // Show the correct modal content
        document.querySelectorAll('.modal-content').forEach(mc => mc.classList.remove('active'));
        document.getElementById('quick-reply-content').classList.add('active');
        document.getElementById('modal-overlay').classList.add('show');
        document.body.classList.add('modal-open');

        // Handle form submission
        const handleSubmit = (e) => {
            e.preventDefault();
            const replyText = replyTextarea.value.trim();
            if (replyText) {
                review.reply = replyText; // Save the reply to the data object
                if (typeof showSuccessToast === 'function') showSuccessToast('Reply submitted successfully!');
                if (typeof closeModal === 'function') closeModal();
                populateServiceReviews(); // Re-render reviews to update the button
            }
            replyForm.removeEventListener('submit', handleSubmit); // Clean up listener
        };
        replyForm.addEventListener('submit', handleSubmit);

        // Handle cancel button
        cancelBtn.addEventListener('click', () => closeModal(), { once: true });
    };

    // --- Populate Status Filters ---
    const populateStatusFilters = () => {
        const statuses = ['All', 'Pending', 'In Progress', 'Completed', 'Cancelled'];
        const appointmentFilter = document.getElementById('status-filter');
        const walkinFilter = document.getElementById('walkin-status-filter');

        const createOptions = () => {
            return statuses.map(status =>
                `<option value="${status.toLowerCase()}">${status}</option>`
            ).join('');
        };

        if (appointmentFilter) {
            appointmentFilter.innerHTML = createOptions();
        }
        if (walkinFilter) {
            walkinFilter.innerHTML = createOptions();
        }
    };

    // --- Event Listeners for Filters ---
    const appointmentSearch = document.getElementById('appointment-search');
    const appointmentStatusFilter = document.getElementById('status-filter');
    const walkinSearch = document.getElementById('walkin-appointment-search');
    const walkinStatusFilter = document.getElementById('walkin-status-filter');

    if (appointmentSearch) appointmentSearch.addEventListener('input', () => {
        appointmentsCurrentPage = 1;
        populateAppointmentsTable();
    });
    if (appointmentStatusFilter) appointmentStatusFilter.addEventListener('change', () => {
        appointmentsCurrentPage = 1;
        populateAppointmentsTable();
    });
    if (walkinSearch) walkinSearch.addEventListener('input', () => {
        walkinsCurrentPage = 1;
        populateWalkinsTable();
    });
    if (walkinStatusFilter) walkinStatusFilter.addEventListener('change', () => {
        walkinsCurrentPage = 1;
        populateWalkinsTable();
    });

    // --- Event Listeners for Pagination ---
    const appointmentsPagination = document.querySelector('#dashboard .recent-appointments:not(.walk-in-appointments) .table-pagination');
    if (appointmentsPagination) {
        appointmentsPagination.querySelector('[data-action="prev"]').addEventListener('click', () => {
            if (appointmentsCurrentPage > 1) { appointmentsCurrentPage--; populateAppointmentsTable(); }
        });
        appointmentsPagination.querySelector('[data-action="next"]').addEventListener('click', () => {
            appointmentsCurrentPage++; populateAppointmentsTable();
        });
    }

    const walkinsPagination = document.querySelector('.walk-in-appointments .table-pagination');
    if (walkinsPagination) {
        walkinsPagination.querySelector('[data-action="prev"]').addEventListener('click', () => {
            if (walkinsCurrentPage > 1) { walkinsCurrentPage--; populateWalkinsTable(); }
        });
        walkinsPagination.querySelector('[data-action="next"]').addEventListener('click', () => {
            walkinsCurrentPage++; populateWalkinsTable();
        });
    }
    // --- Event Listener for Table Row Clicks ---
    const setupRowClickNavigation = () => {
        const appointmentsTableBody = document.querySelector('#dashboard .recent-appointments:not(.walk-in-appointments) tbody');
        if (!appointmentsTableBody) return;

        appointmentsTableBody.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            // Ensure it's a data row and not the 'no results' row
            if (row && row.dataset.appointmentId) {
                const appointmentId = row.dataset.appointmentId;
                // Find the full appointment object from the global data source
                const appointmentData = (window.appData.appointments || []).find(appt => appt.serviceId === appointmentId);

                if (appointmentData) {
                    // **THE FIX**: Clear previous session data *before* setting the new one.
                    sessionStorage.removeItem('selectedProfileData');
                    // Store the current page URL to enable a correct "back" navigation
                    sessionStorage.setItem('previousPage', window.location.href);
                    // The customer-profile.js script expects data in sessionStorage with this key
                    sessionStorage.setItem('selectedProfileData', JSON.stringify(appointmentData));
                    window.location.href = 'customer-profile.html';
                }
            }
        });
    };


    // --- Initial Dashboard Load ---
    // We wrap the initialization in a function to call it.
    const initializeDashboard = async () => {
        animateInsights();
        populateStatusFilters();
        await fetchDashboardData(); // Fetch data first
        populateServiceReviews();
        animateInsightNumbers();
        setupRowClickNavigation(); // Set up the click listener
    };

    initializeDashboard();
});