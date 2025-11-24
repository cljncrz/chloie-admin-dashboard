document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to initialize
    await window.firebaseInitPromise;
    
    const db = window.firebase.firestore();
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

    const updateDashboardInsights = () => {
        const salesEl = document.querySelector('#dashboard .insights .card.sales h1');
        const bookingsEl = document.querySelector('#dashboard .insights .card.bookings h1');
        const completedEl = document.querySelector('#dashboard .insights .card.completed h1');

        // Ensure we are on the dashboard and elements exist
        if (!salesEl || !bookingsEl || !completedEl) {
            return;
        }

        const allAppointments = [
            ...(window.appData.appointments || []),
            ...(window.appData.walkins || [])
        ];

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

        let totalSalesToday = 0;
        let todaysBookingsCount = 0;
        let servicesCompletedToday = 0;

        allAppointments.forEach(appt => {
            const apptDate = appt.datetimeRaw ? new Date(appt.datetimeRaw) : null;

            // Check if the appointment is for today
            if (apptDate && apptDate >= today && apptDate < tomorrow) {
                todaysBookingsCount++;

                if (appt.status && appt.status.toLowerCase() === 'completed') {
                    servicesCompletedToday++;
                    totalSalesToday += parseFloat(appt.price) || 0;
                }
            }
        });

        salesEl.dataset.value = totalSalesToday;
        bookingsEl.dataset.value = todaysBookingsCount;
        completedEl.dataset.value = servicesCompletedToday;

        // Animate the numbers after updating their values
        animateInsightNumbers();
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
            // Fetch both bookings and walkins in parallel
            const [bookingsSnapshot, walkinsSnapshot] = await Promise.all([
                db.collection('bookings').get(),
                db.collection('walkins').get()
            ]);

            let scheduledAppointments = [];
            let walkinAppointments = [];

            // Process scheduled appointments from 'bookings'
            if (bookingsSnapshot.empty) {
                console.log('No booking documents found.');
                window.appData.appointments = [];
            } else {
                bookingsSnapshot.docs.forEach(doc => {
                    const data = doc.data() || {};
                    // Skip documents that are marked as walk-ins, as they are handled by the 'walkins' collection
                    if (data.isWalkin) return;

                    let scheduleDate = data.scheduleDate?.toDate();

                    // Parse bookingTime if available
                    if (scheduleDate && data.bookingTime) {
                        const timeRange = data.bookingTime.split(' - ')[0]; // e.g., "1:20 PM"
                        const timeMatch = timeRange.match(/(\d+):(\d+)\s*(AM|PM)/i);
                        if (timeMatch) {
                            let hours = parseInt(timeMatch[1]);
                            const minutes = parseInt(timeMatch[2]);
                            const ampm = timeMatch[3].toUpperCase();
                            if (ampm === 'PM' && hours !== 12) hours += 12;
                            if (ampm === 'AM' && hours === 12) hours = 0;
                            scheduleDate.setHours(hours, minutes, 0, 0);
                        }
                    }

                    const formattedDateTime = scheduleDate
                        ? scheduleDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(',', ' -')
                        : 'No Date';

                    scheduledAppointments.push({
                        ...data,
                        datetimeRaw: scheduleDate ? scheduleDate.getTime() : 0, // Add a raw timestamp for sorting
                        serviceId: doc.id,
                        plate: data.plateNumber,
                        service: data.serviceNames,
                        datetime: formattedDateTime,
                        customer: data.userId,
                    });
                });
                scheduledAppointments.sort((a, b) => b.datetimeRaw - a.datetimeRaw); // Sort by date descending
                window.appData.appointments = scheduledAppointments;
            }

            // Process walk-in appointments from 'walkins' collection
            if (walkinsSnapshot.empty) {
                console.log('No walk-in documents found.');
                window.appData.walkins = [];
            } else {
                walkinAppointments = walkinsSnapshot.docs.map(doc => {
                    const data = doc.data() || {};
                    const scheduleDate = data.dateTime?.toDate ? data.dateTime.toDate() : (data.dateTime ? new Date(data.dateTime) : null);
                    return { 
                        ...data, 
                        id: doc.id, // Add the document ID to each walk-in object
                        datetimeRaw: scheduleDate ? scheduleDate.getTime() : 0 // Add raw timestamp for sorting
                    }; 
                });
                // Sort walk-ins by date descending. Handle cases where dateTime might be missing.
                walkinAppointments.sort((a, b) => b.datetimeRaw - a.datetimeRaw);
                window.appData.walkins = walkinAppointments;
            }
        } catch (error) {
            console.error("Error fetching dashboard data from Firestore:", error);
        } finally {
            if (loader) loader.style.display = 'none';
            // Populate tables with the newly fetched data
            populateAppointmentsTable();
            populateWalkinsTable();
            updateDashboardInsights(); // Update the top widget stats
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
            
            // Get creation timestamp - show when the appointment was created
            let createdTime = 'N/A';
            if (appt.createdAt) {
                const createdDate = appt.createdAt instanceof Date ? appt.createdAt : (typeof appt.createdAt.toDate === 'function' ? appt.createdAt.toDate() : new Date(appt.createdAt));
                createdTime = new Date(createdDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            } else if (appt.datetimeRaw) {
                // Fallback to appointment datetime if createdAt not available
                createdTime = new Date(appt.datetimeRaw).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
            
            row.innerHTML = `
                <td class="customer-cell">
                    <span>${appt.serviceId}</span>
                </td>
                <td>${appt.plateNumber}</td>
                <td>${appt.serviceNames}</td>
                <td><small>${createdTime}</small></td>
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
                <td>${walkin.id}</td>
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
                    // Clear any potentially conflicting session data before setting the new one.
                    sessionStorage.removeItem('selectedAppointmentData');
                    // Store the current page URL to enable a correct "back" navigation
                    sessionStorage.setItem('previousPage', window.location.href);
                    // The appointment-details.js script expects data in sessionStorage with this key
                    sessionStorage.setItem('selectedAppointmentData', JSON.stringify(appointmentData));
                    window.location.href = 'appointment-details.html';
                }
            }
        });
    };


    // --- Load and Display To-Do Items ---
    const loadDashboardTodos = () => {
        const todoContainer = document.getElementById('dashboard-todo-list');
        if (!todoContainer) return;

        const noResultsRow = todoContainer.querySelector('.no-results-row');

        // Listen for real-time updates from Firestore
        db.collection('todos')
            .where('archived', '==', false)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .onSnapshot((snapshot) => {
                const fragment = document.createDocumentFragment();
                let todoCount = 0;

                // Clear existing items except no-results message
                todoContainer.querySelectorAll('.todo-item').forEach(item => item.remove());

                snapshot.forEach((doc) => {
                    const todo = doc.data();
                    todoCount++;

                    const todoItem = document.createElement('div');
                    todoItem.className = `todo-item ${todo.completed ? 'completed' : ''}`;
                    todoItem.dataset.id = doc.id;

                    // Format due date if available
                    let dueDateText = '';
                    if (todo.dueDate) {
                        const dueDateTime = todo.dueTime ? `${todo.dueDate}T${todo.dueTime}` : todo.dueDate;
                        const due = new Date(dueDateTime);
                        const today = new Date();
                        const tomorrow = new Date(today);
                        tomorrow.setDate(tomorrow.getDate() + 1);

                        if (due.toDateString() === today.toDateString()) {
                            dueDateText = 'Due: Today';
                        } else if (due.toDateString() === tomorrow.toDateString()) {
                            dueDateText = 'Due: Tomorrow';
                        } else {
                            dueDateText = `Due: ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                        }
                    }

                    // Create icon based on priority or completion status
                    let iconName = 'check_circle';
                    if (!todo.completed) {
                        if (todo.priority === 'high') iconName = 'priority_high';
                        else if (todo.priority === 'low') iconName = 'low_priority';
                        else iconName = 'radio_button_unchecked';
                    }

                    todoItem.innerHTML = `
                        <div class="icon" style="cursor: pointer;" title="${todo.completed ? 'Mark as incomplete' : 'Mark as complete'}">
                            <span class="material-symbols-outlined">${iconName}</span>
                        </div>
                        <div class="details" style="flex: 1;">
                            <h3>${todo.text}</h3>
                            ${dueDateText ? `<small class="text-muted">${dueDateText}</small>` : ''}
                        </div>
                        <button class="delete-todo-btn" title="Delete task">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    `;

                    // Add click handler for toggle completion
                    const iconDiv = todoItem.querySelector('.icon');
                    iconDiv.addEventListener('click', async () => {
                        try {
                            await db.collection('todos').doc(doc.id).update({
                                completed: !todo.completed
                            });
                        } catch (error) {
                            console.error('Error toggling todo:', error);
                        }
                    });

                    // Add click handler for delete
                    const deleteBtn = todoItem.querySelector('.delete-todo-btn');
                    deleteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (confirm('Delete this task?')) {
                            try {
                                await db.collection('todos').doc(doc.id).delete();
                            } catch (error) {
                                console.error('Error deleting todo:', error);
                            }
                        }
                    });

                    fragment.appendChild(todoItem);
                });

                // Update UI
                if (todoCount === 0) {
                    noResultsRow.style.display = 'block';
                } else {
                    noResultsRow.style.display = 'none';
                    todoContainer.appendChild(fragment);
                }
            }, (error) => {
                console.error('Error loading todos:', error);
            });
    };

    // --- Event Listener for Add To-Do Button ---
    const setupAddTodoButton = () => {
        const addTodoLink = document.querySelector('.add-item-link[href="add-to-do.html"]');
        if (addTodoLink) {
            addTodoLink.addEventListener('click', (e) => {
                // The default behavior will navigate to add-to-do.html
                // You can add any additional logic here if needed
                console.log('Navigating to Add To-Do page...');
            });
        }
    };

    // --- Initial Dashboard Load ---
    // We wrap the initialization in a function to call it.
    const initializeDashboard = async () => {
        animateInsights();
        populateStatusFilters();
        await fetchDashboardData(); // Fetch data first
        populateServiceReviews();
        setupRowClickNavigation(); // Set up the click listener
        setupRealtimeUpdates(); // Set up real-time listeners
        setupAddTodoButton(); // Set up Add To-Do button listener
        loadDashboardTodos(); // Load to-do items from Firebase
    };

    // --- Real-Time Updates for Dashboard Cards ---
    const setupRealtimeUpdates = () => {
        try {
            if (!window.firebase || !window.firebase.firestore) {
                console.warn('Firebase Firestore not available for real-time updates');
                return;
            }

            const db = window.firebase.firestore();

            // Helper function to show update animation on cards
            const showUpdateAnimation = (cardClass) => {
                const card = document.querySelector(`.insights > .card.${cardClass}`);
                if (card) {
                    card.classList.add('updating');
                    // Remove animation class after animation completes
                    setTimeout(() => card.classList.remove('updating'), 1200);
                }
            };

            // Listen for real-time changes in bookings collection
            db.collection('bookings').onSnapshot(snapshot => {
                console.log('📊 Real-time update: Bookings collection changed');
                showUpdateAnimation('bookings');
                updateDashboardInsights();
                populateAppointmentsTable();
            }, error => {
                console.warn('Error listening to bookings:', error);
            });

            // Listen for real-time changes in walkins collection
            db.collection('walkins').onSnapshot(snapshot => {
                console.log('📊 Real-time update: Walk-ins collection changed');
                showUpdateAnimation('completed');
                updateDashboardInsights();
                populateWalkinsTable();
            }, error => {
                console.warn('Error listening to walkins:', error);
            });

        } catch (error) {
            console.warn('Could not set up real-time updates:', error);
        }
    };

    initializeDashboard();
});