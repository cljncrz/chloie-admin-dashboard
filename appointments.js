document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to initialize
    await window.firebaseInitPromise;

    // This script is now for the main appointments page
    const mainAppointmentsContainer = document.getElementById('main-appointments-table');

    // --- Pagination & Filter State for Appointment Page Tables ---
    let apptCurrentPage = 1;
    const apptRowsPerPage = 25;
    let walkinCurrentPage = 1;
    const walkinRowsPerPage = 25;
    let archivedCurrentPage = 1;
    const archivedRowsPerPage = 25;
    let currentSort = { column: 'datetime', direction: 'desc' }; // Default sort


     // --- Animate Insight Numbers ---
    // This function is reused for the new quick stats
    const animateInsightNumbers = (element) => {
        const targetValue = parseInt(element.dataset.value);
        // No currency prefix for appointment counts, so removed the prefix logic
        
        let currentValue = 0;
        const increment = targetValue / 50; // Control animation speed

        const updateCount = () => {
            if (currentValue < targetValue) {
                currentValue += increment;
                element.textContent = Math.ceil(currentValue).toLocaleString();
                requestAnimationFrame(updateCount);
            } else {
                element.textContent = targetValue.toLocaleString();
            }
        };
        updateCount();
    };

    // --- Get current logged-in user's full name (if available) ---
    let currentUserFullName = null;
    let currentUserRole = null;
    let currentUserUid = null;
    const fetchCurrentUserFullName = async () => {
        try {
            const auth = window.firebase.auth();
            if (!auth || !auth.currentUser) return null;
            const uid = auth.currentUser.uid;
            currentUserUid = uid;
            const db = window.firebase.firestore();
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                const data = userDoc.data() || {};
                currentUserFullName = data.fullName || null;
                currentUserRole = data.role || null;
                // expose globally in case other scripts want to use it
                window.currentUserFullName = currentUserFullName;
                window.currentUserRole = currentUserRole;
                window.currentUserUid = currentUserUid;
                return currentUserFullName;
            }
        } catch (e) {
            console.warn('Could not fetch current user full name', e);
        }
        return null;
    };
    // Helper: get a server timestamp if Firestore FieldValue is available, otherwise use JS Date
    const getServerTimestamp = () => {
        try {
            if (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue && typeof window.firebase.firestore.FieldValue.serverTimestamp === 'function') {
                return window.firebase.firestore.FieldValue.serverTimestamp();
            }
            if (window.firebase && window.firebase.firestore && window.firebase.firestore.Timestamp && typeof window.firebase.firestore.Timestamp.now === 'function') {
                return window.firebase.firestore.Timestamp.now();
            }
        } catch (e) {
            // fall through
        }
        return new Date();
    };
    // --- New function to update the quick stats on the appointment page ---
    const updateAppointmentPageStats = () => {
        if (!document.getElementById('total-appointments-stat')) return; // Only run on appointments page
        const totalEl = document.getElementById('total-appointments-stat');
        const pendingEl = document.getElementById('pending-appointments-stat');
        const inProgressEl = document.getElementById('inprogress-appointments-stat');
        const completedEl = document.getElementById('completed-appointments-stat');
        const cancelledEl = document.getElementById('cancelled-appointments-stat');

        // Ensure all elements exist before proceeding
        if (!totalEl || !pendingEl || !inProgressEl || !completedEl || !cancelledEl) {
            console.warn("One or more appointment stat elements not found. Skipping stat update.");
            return;
        }

        // Combine appointments and walk-ins from global appData
        const allAppointments = [
            ...(window.appData.appointments || []),
            ...(window.appData.walkins || [])
        ];

            const counts = allAppointments.reduce((acc, appt) => {
                     acc.total++;
                     const status = appt.status.toLowerCase();
                     if (status === 'pending') acc.pending++;
                     else if (status === 'in progress') acc.inProgress++;
                     else if (status === 'completed') acc.completed++;
                     else if (status === 'cancelled') acc.cancelled++;
                     else if (status === 'approve') acc.approve = (acc.approve || 0) + 1;
                     return acc;
                 }, { total: 0, pending: 0, inProgress: 0, completed: 0, cancelled: 0, approve: 0 });

        // Set data-value for animation and update text content
        totalEl.dataset.value = counts.total;
        pendingEl.dataset.value = counts.pending;
        inProgressEl.dataset.value = counts.inProgress;
        completedEl.dataset.value = counts.completed;
        cancelledEl.dataset.value = counts.cancelled;

        // Animate numbers for each stat card
        animateInsightNumbers(totalEl);
        animateInsightNumbers(pendingEl);
        animateInsightNumbers(inProgressEl);
        animateInsightNumbers(completedEl);
        animateInsightNumbers(cancelledEl);
    };

    // This function will now be defined here to ensure it uses live data from Firestore
    window.appData.createTechnicianDropdown = (selectedTechnician, disabled = false) => {
        const technicians = window.appData.technicians || [];
        // Filter for active technicians, and always include the currently selected one even if they are inactive
        const activeTechnicians = technicians.filter(tech => tech.status === 'Active' || tech.name === selectedTechnician);

        let options = '<option value="Unassigned">Unassigned</option>';
        activeTechnicians.forEach(tech => {
            // Skip the system "Unassigned" user if it exists in the collection
            if (tech.name === 'Unassigned') return;
            const isSelected = tech.name === selectedTechnician ? 'selected' : '';
            options += `<option value="${tech.name}" ${isSelected}>${tech.name}</option>`;
        });

        const disabledAttr = disabled ? 'disabled' : '';
        return `<select class="technician-select" ${disabledAttr}>${options}</select>`;
    };


    if (mainAppointmentsContainer) { // This condition now only checks if we are on the main appointments page
        // The previous updateAppointmentWidgets function is no longer needed
        // as the HTML structure and IDs have changed.

        // --- Fetch and Populate Table from Firestore ---
        const fetchAndPopulateAppointments = async () => {
            const tableBody = mainAppointmentsContainer.querySelector('tbody');
            const loader = mainAppointmentsContainer.querySelector('.table-loader');
            if (loader) loader.classList.add('loading');

            try {
                const db = window.firebase.firestore();
                // Fetch bookings, walkins, and technicians simultaneously for better performance
                const [bookingsSnapshot, walkinsSnapshot, techniciansSnapshot] = await Promise.all([
                    db.collection('bookings').get(),
                    db.collection('walkins').get(),
                    db.collection('technicians').get()
                ]);

                // Process and store technicians data globally
                window.appData.technicians = techniciansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Process bookings data
                if (bookingsSnapshot.empty) {
                    const noResultsRow = mainAppointmentsContainer.querySelector('.no-results-row');
                    if (noResultsRow) noResultsRow.style.display = 'table-row';
                    console.log('No booking documents found in Firestore.');
                    // Continue — we still want to process walkins and technicians if available
                }

                // Replace sample data with Firestore data
                window.appData.appointments = bookingsSnapshot.docs.map(doc => {
                    const data = doc.data() || {};

                    // helper: parse various firestore-like date shapes into Date or null
                    const parseFirestoreDate = (val) => {
                        if (!val && val !== 0) return null;
                        try {
                            // Firestore Timestamp with toDate()
                            if (val && typeof val.toDate === 'function') return val.toDate();

                            // Firestore-like object: { seconds, nanoseconds } or { seconds, nanos }
                            if (val && (typeof val.seconds === 'number')) {
                                const nanos = val.nanoseconds ?? val.nanosecond ?? val.nanos ?? val.nanoseconds ?? 0;
                                return new Date(val.seconds * 1000 + Math.floor(nanos / 1e6));
                            }

                            // JS Date instance
                            if (val instanceof Date) return val;

                            // number: could be seconds or milliseconds
                            if (typeof val === 'number') {
                                // Heuristic: if <= 1e12 treat as seconds, else milliseconds
                                if (val < 1e12) return new Date(val * 1000);
                                return new Date(val);
                            }

                            // string
                            if (typeof val === 'string') {
                                const parsed = new Date(val);
                                if (!isNaN(parsed)) return parsed;
                            }
                        } catch (e) {
                            // fall through to null
                            console.debug('parseFirestoreDate error', e);
                        }
                        return null;
                    };

                    const possibleDateFields = ['time', 'scheduleDate', 'dateTime', 'datetime', 'date', 'scheduledAt', 'appointmentDate', 'timestamp', 'bookingDate', 'createdAt'];
                    let dateSource = null;
                    let selectedField = null;

                    for (const f of possibleDateFields) {
                        if (data[f] !== undefined && data[f] !== null) {
                            dateSource = data[f];
                            selectedField = f;
                            break;
                        }
                    }

                    // If not found on known keys, scan top-level values for anything that looks like a date/timestamp
                    if (!dateSource) {
                        for (const [k, v] of Object.entries(data)) {
                            const maybe = parseFirestoreDate(v);
                            if (maybe) {
                                dateSource = v;
                                selectedField = k;
                                break;
                            }
                        }
                    }

                    const scheduleDateObj = parseFirestoreDate(dateSource);

                    // Parse bookingTime if available
                    if (scheduleDateObj && data.bookingTime) {
                        const timeRange = data.bookingTime.split(' - ')[0]; // e.g., "1:20 PM"
                        const timeMatch = timeRange.match(/(\d+):(\d+)\s*(AM|PM)/i);
                        if (timeMatch) {
                            let hours = parseInt(timeMatch[1]);
                            const minutes = parseInt(timeMatch[2]);
                            const ampm = timeMatch[3].toUpperCase();
                            if (ampm === 'PM' && hours !== 12) hours += 12;
                            if (ampm === 'AM' && hours === 12) hours = 0;
                            scheduleDateObj.setHours(hours, minutes, 0, 0);
                        }
                    }

                    let formattedDateTime = 'No Date';
                    if (scheduleDateObj) {
                        const datePart = scheduleDateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
                        const timePart = data.bookingTime || scheduleDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                        formattedDateTime = `${datePart} - ${timePart}`;
                    }


                    // Debug logging for documents that still don't resolve to a date
                    if (!scheduleDateObj) {
                        console.warn(`Booking doc ${doc.id} has no recognizable date. Available keys: ${Object.keys(data).join(', ')}`);
                        // For deeper debugging, optionally log the values (commented out to reduce noise):
                        // console.debug('doc data:', data);
                    } else {
                        console.debug(`Booking doc ${doc.id} -> date field: ${selectedField} -> ${scheduleDateObj.toISOString()}`);
                    }

                    return {
                        ...data,
                        serviceId: doc.id,
                        plate: data.plateNumber || data.plate || '',
                        service: data.serviceNames || data.service || '',
                        datetime: formattedDateTime,
                        datetimeRaw: scheduleDateObj ? scheduleDateObj.getTime() : null,
                    };
                });

                // Now that we have live bookings, render cancelled table as well
                renderCancelledTable();

                // --- Process walk-ins data ---
                if (!walkinsSnapshot.empty) {
                    window.appData.walkins = walkinsSnapshot.docs.map(doc => {
                        const data = doc.data() || {};

                        // Reuse the same parseFirestoreDate helper defined above
                        const parseFirestoreDate = (val) => {
                            if (!val && val !== 0) return null;
                            try {
                                if (val && typeof val.toDate === 'function') return val.toDate();
                                if (val && (typeof val.seconds === 'number')) {
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

                        const possibleDateFields = ['time', 'scheduleDate', 'dateTime', 'datetime', 'date', 'scheduledAt', 'appointmentDate', 'timestamp', 'bookingDate', 'createdAt'];
                        let dateSource = null;
                        let selectedField = null;
                        for (const f of possibleDateFields) {
                            if (data[f] !== undefined && data[f] !== null) {
                                dateSource = data[f];
                                selectedField = f;
                                break;
                            }
                        }
                        if (!dateSource) {
                            for (const [k, v] of Object.entries(data)) {
                                const maybe = parseFirestoreDate(v);
                                if (maybe instanceof Date) { // Ensure it's a valid Date object
                                    dateSource = v;
                                    break;
                                }
                            }
                        }

                        const scheduleDateObj = parseFirestoreDate(dateSource);
                        let formattedDateTime = 'No Date';
                        if (scheduleDateObj ) {
                            const datePart = scheduleDateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
                            const timePart = scheduleDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                            formattedDateTime = `${datePart} - ${timePart}`;
                        }

                        return {
                            id: doc.id,
                            ...data,
                            plate: data.plateNumber || data.plate || '',
                            service: data.serviceNames || data.service || data.serviceName || '',
                            datetime: formattedDateTime,
                            datetimeRaw: scheduleDateObj ? scheduleDateObj.getTime() : null,
                        };
                    });
                } else {
                    // Ensure walkins is at least an empty array when there are no documents
                    window.appData.walkins = [];
                }

                // Initial population of tables
                // Fetch archived records from Firestore (authoritative source)
                await fetchArchivedFromFirestore();

                populateAppointmentsTable();
                populateWalkinsTable(); // Assuming walk-ins might also come from bookings or a separate fetch
                renderArchivedTable();
                updateAppointmentPageStats(); // Update stats after fetching data

            } catch (error) {
                console.error("Error fetching bookings from Firestore:", error);
                const noResultsRow = mainAppointmentsContainer.querySelector('.no-results-row');
                if (noResultsRow) {
                    noResultsRow.style.display = 'table-row';
                    noResultsRow.querySelector('td').textContent = 'Error loading appointments.';
                }
            } finally {
                if (loader) loader.classList.remove('loading');
            }
        };

        // --- Populate Table ---
        const populateAppointmentsTable = () => {
            const tableBody = mainAppointmentsContainer.querySelector('tbody');
            const searchInput = document.getElementById('appointment-search'); // Main appointments search
            const statusFilter = document.querySelector('#main-appointments-table-container .status-filter'); // Main appointments filter
            if (!tableBody || !searchInput) return;

            const appointments = [...(window.appData.appointments || [])]; // Always get the latest data
            const fragment = document.createDocumentFragment();
            
            // 1. Filter Data
            const searchTerm = searchInput.value.toLowerCase();
            const selectedStatus = statusFilter ? statusFilter.value.toLowerCase() : 'all';

            // Only allow these statuses (include both 'approved' and 'approve')
            const allowedStatuses = ['pending', 'approved', 'approve', 'in progress', 'completed'];
            let filteredAppointments = appointments.filter(appt => {
                const status = (appt.status || '').toLowerCase();
                if (!allowedStatuses.includes(status)) return false;
                const matchesSearch = searchTerm === '' ||
                    Object.values(appt).some(val => String(val).toLowerCase().includes(searchTerm));
                const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
                return matchesSearch && matchesStatus;
            });

            // 2. Sort Data (using currentSort state)
            filteredAppointments.sort((a, b) => {
                // If sorting by datetime, prefer the raw timestamp (datetimeRaw) when available.
                if (currentSort.column === 'datetime') {
                    const aRaw = a.datetimeRaw != null ? a.datetimeRaw : (typeof a.datetime === 'string' ? new Date(a.datetime.replace(' - ', ' ')).getTime() : null);
                    const bRaw = b.datetimeRaw != null ? b.datetimeRaw : (typeof b.datetime === 'string' ? new Date(b.datetime.replace(' - ', ' ')).getTime() : null);

                    // Handle nulls so that items with no date come last when sorting ascending
                    if (aRaw === bRaw) return 0;
                    if (aRaw === null) return 1;
                    if (bRaw === null) return -1;

                    const diff = aRaw - bRaw;
                    return currentSort.direction === 'asc' ? diff : -diff;
                }

                let valA = a[currentSort.column] || '';
                let valB = b[currentSort.column] || '';
                const comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true });
                return currentSort.direction === 'asc' ? comparison : -comparison;
            });

            // 3. Paginate Data
            const totalPages = Math.ceil(filteredAppointments.length / apptRowsPerPage);
            apptCurrentPage = Math.max(1, Math.min(apptCurrentPage, totalPages));
            const startIndex = (apptCurrentPage - 1) * apptRowsPerPage;
            const endIndex = startIndex + apptRowsPerPage;
            const paginatedAppointments = filteredAppointments.slice(startIndex, endIndex);

            // 4. Render Rows
            paginatedAppointments.forEach(appt => {
                const row = document.createElement('tr');
                const statusClass = appt.status.toLowerCase().replace(' ', '-');
                row.dataset.serviceId = appt.serviceId;
                row.dataset.plate = appt.plate;
                row.dataset.carName = appt.carName;
                row.dataset.carType = appt.carType;
                row.dataset.service = appt.serviceNames;
                row.dataset.datetime = appt.datetime;
                row.dataset.price = appt.price;
                row.dataset.technicians = appt.technicians;
                row.dataset.status = appt.status;
                row.dataset.paymentStatus = appt.paymentStatus;

                // Action buttons
                let actionButtons = '';
                if (appt.status === 'Pending') {
                    const techAssigned = appt.technician && appt.technician !== 'Unassigned';
                    let chooseTechIndication = '';
                    if (!techAssigned) {
                        chooseTechIndication = `
                            <span class="choose-tech-indication" style="
                                display: inline-flex;
                                align-items: center;
                                gap: 0.3em;
                                background: #fff3cd;
                                color: #856404;
                                border-radius: 12px;
                                font-size: 0.92em;
                                padding: 2px 10px 2px 7px;
                                margin-top: 4px;
                                margin-left: 0;
                                border: 1px solid #ffeeba;
                                font-weight: 500;">
                                <span class="material-symbols-outlined" style="font-size:1.1em;vertical-align:middle;">info</span>
                                Choose technician first
                            </span>`;
                    }
                    actionButtons = `
                        <button class="action-icon-btn approve-btn" title="${techAssigned ? 'Approve Appointment' : 'Choose technician first'}" ${techAssigned ? '' : 'disabled'} data-service-id="${appt.serviceId}">
                            <span class="material-symbols-outlined">check_circle</span>
                        </button>
                        ${chooseTechIndication}`;
                } else if (appt.status === 'Approve') {
                    actionButtons = `
                        <button class="action-icon-btn start-service-btn" title="Start Service">
                            <span class="material-symbols-outlined">play_arrow</span>
                        </button>`;
                } else if (appt.status === 'In Progress') {
                    actionButtons = `
                        <button class="action-icon-btn complete-service-btn" title="Complete Service">
                            <span class="material-symbols-outlined">check</span>
                        </button>`;
                }

                const technicianDropdown = window.appData.createTechnicianDropdown(appt.technician, appt.status !== 'Pending');
                                // Add event listener to technician dropdown to enable/disable Approve button
                                setTimeout(() => {
                                    const rowEl = row;
                                    const techSelect = rowEl.querySelector('.technician-select');
                                    const approveBtn = rowEl.querySelector('.approve-btn');
                                    if (techSelect && approveBtn) {
                                        const updateApproveBtnState = () => {
                                            const selectedTech = techSelect.value;
                                            const enabled = selectedTech && selectedTech !== 'Unassigned';
                                            approveBtn.disabled = !enabled;
                                            approveBtn.title = enabled ? 'Approve Appointment' : 'Choose technician first';
                                        };
                                        techSelect.addEventListener('change', updateApproveBtnState);
                                        updateApproveBtnState();
                                    }
                                }, 0);
                const paymentStatus = appt.paymentStatus || 'Unpaid';
                const paymentStatusClass = paymentStatus.toLowerCase();
                const paymentBadge = `<span class="payment-status-badge ${paymentStatusClass}">${paymentStatus}</span>`;
                let paymentActionButton = '';
                if (paymentStatus === 'Unpaid') {
                    paymentActionButton = `
                        <button class="action-icon-btn mark-paid-btn" title="Approve Payment">
                            <span class="material-symbols-outlined">payments</span>
                        </button>`;
                }
                // --- Status badge design (copied from walk-in, with Approved hover) ---
                let statusDisplay = '';
                if (appt.status === 'Approve') {
                    statusDisplay = `<span class="status-badge approved" title="Technician is waiting for the vehicle">Approved!</span>`;
                } else if (appt.status === 'Pending') {
                    statusDisplay = `<span class="status-badge pending">Pending</span>`;
                } else if (appt.status === 'In Progress') {
                    statusDisplay = `<span class="status-badge in-progress">In Progress</span>`;
                } else if (appt.status === 'Completed') {
                    statusDisplay = `<span class="status-badge completed">Completed</span>`;
                } else {
                    statusDisplay = `<span class="status-badge ${statusClass}">${appt.status}</span>`;
                }
                const normalizedPaymentStatus = String(paymentStatus || 'Unpaid').toLowerCase();
                const cancelDisabledAttr = (String(appt.status || '').toLowerCase() === 'completed' && normalizedPaymentStatus === 'paid') ? 'disabled title="Cannot cancel a completed and paid appointment"' : '';

                row.innerHTML = `
                    <td>${appt.serviceId}</td>
                    <td>${appt.plate}</td>
                    <td>${appt.carName}</td>
                    <td>${appt.carType}</td>
                    <td>${appt.serviceNames}</td>
                    <td>${appt.datetime}</td>
                    <td>${appt.price}</td>
                    <td>${technicianDropdown}</td>
                    <td class="text-center">${statusDisplay}</td>
                    <td class="text-center">${paymentBadge}</td>
                    <td class="text-center">
                        ${actionButtons}
                        ${paymentActionButton}
                        <button class="action-icon-btn cancel-btn" title="Cancel Appointment" ${cancelDisabledAttr}>
                            <span class="material-symbols-outlined">cancel</span>
                        </button>
                    </td>
                `;
                fragment.appendChild(row);
            });

            tableBody.innerHTML = ''; // Clear existing rows
            tableBody.appendChild(fragment);

            // 5. Update UI (No results row, pagination)
            const noResultsRow = mainAppointmentsContainer.querySelector('.no-results-row');
            if (noResultsRow) {
                noResultsRow.style.display = paginatedAppointments.length === 0 ? 'table-row' : 'none';
            }

            const paginationContainer = mainAppointmentsContainer.querySelector('.table-pagination');
            if (paginationContainer) {
                const pageInfo = paginationContainer.querySelector('.page-info');
                const prevBtn = paginationContainer.querySelector('[data-action="prev"]');
                const nextBtn = paginationContainer.querySelector('[data-action="next"]');
                pageInfo.textContent = `Page ${apptCurrentPage} of ${totalPages || 1}`;
                prevBtn.disabled = apptCurrentPage === 1;
                nextBtn.disabled = apptCurrentPage === totalPages || totalPages === 0;
            }
        };

        // --- Add a single appointment to the top of the table ---
        const addAppointmentToTable = (appt) => {
            const tableBody = mainAppointmentsContainer.querySelector('tbody');
            if (!tableBody) return;
            
            // This function is now simpler: just re-render the table to ensure
            // sorting, filtering, and pagination are all correct.
            populateAppointmentsTable();
        }

        // --- Populate Walk-ins Table ---
        const populateWalkinsTable = () => {
            const tableContainer = document.getElementById('walk-in-appointments-table-container');
            const tableBody = tableContainer.querySelector('tbody');
            const searchInput = document.getElementById('walkin-appointment-search');
            const statusFilter = tableContainer.querySelector('.status-filter');
            if (!tableBody || !searchInput) return;

            const walkins = [...(window.appData.walkins || [])]; // Always get the latest data
            const fragment = document.createDocumentFragment();

            // 1. Filter Data
            const searchTerm = searchInput.value.toLowerCase();
            const selectedStatus = statusFilter ? statusFilter.value.toLowerCase() : 'all';
            // Only allow these statuses
            const allowedStatuses = ['pending', 'approved', 'in progress', 'completed'];
            let filteredWalkins = walkins.filter(walkin => {
                const status = (walkin.status || '').toLowerCase();
                if (!allowedStatuses.includes(status)) return false;
                const matchesSearch = searchTerm === '' ||
                    Object.values(walkin).some(val => String(val).toLowerCase().includes(searchTerm));
                const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
                return matchesSearch && matchesStatus;
            });

            // 2. Sort Data (using the same global sort state for simplicity)
            filteredWalkins.sort((a, b) => {
                if (currentSort.column === 'datetime') {
                    const aRaw = a.datetimeRaw != null ? a.datetimeRaw : (typeof a.datetime === 'string' ? new Date(a.datetime.replace(' - ', ' ')).getTime() : null);
                    const bRaw = b.datetimeRaw != null ? b.datetimeRaw : (typeof b.datetime === 'string' ? new Date(b.datetime.replace(' - ', ' ')).getTime() : null);

                    if (aRaw === bRaw) return 0;
                    if (aRaw === null) return 1;
                    if (bRaw === null) return -1;

                    const diff = aRaw - bRaw;
                    return currentSort.direction === 'asc' ? diff : -diff;
                }

                const valA = a[currentSort.column] || '';
                const valB = b[currentSort.column] || '';
                const comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true });
                return currentSort.direction === 'asc' ? comparison : -comparison;
            });

            // 3. Paginate Data
            const totalPages = Math.ceil(filteredWalkins.length / walkinRowsPerPage);
            walkinCurrentPage = Math.max(1, Math.min(walkinCurrentPage, totalPages));
            const startIndex = (walkinCurrentPage - 1) * walkinRowsPerPage;
            const endIndex = startIndex + walkinRowsPerPage;
            const paginatedWalkins = filteredWalkins.slice(startIndex, endIndex);

            // 4. Render Rows
            paginatedWalkins.forEach(walkin => {
                const row = document.createElement('tr');
                const statusClass = walkin.status.toLowerCase().replace(' ', '-');
                // Add data attributes for modal functionality
                row.dataset.plate = walkin.plate;
                row.dataset.serviceId = walkin.id; // Use the unique walkin ID
                row.dataset.carName = walkin.carName;
                row.dataset.carType = walkin.carType;
                row.dataset.service = walkin.service;
                row.dataset.datetime = walkin.datetime;
                row.dataset.price = walkin.price;
                row.dataset.technician = walkin.technician;
                row.dataset.status = walkin.status;
                row.dataset.paymentStatus = walkin.paymentStatus;

                let actionButtons = '';
                if (walkin.status === 'Pending') {
                    actionButtons = `
                        <button class="action-icon-btn start-service-btn" title="Start Service">
                            <span class="material-symbols-outlined">play_arrow</span>
                        </button>`;
                } else if (walkin.status === 'In Progress') {
                    actionButtons = `
                        <button class="action-icon-btn complete-service-btn" title="Complete Service">
                            <span class="material-symbols-outlined">check</span>
                        </button>`;
                }

                const technicianDropdown = window.appData.createTechnicianDropdown(walkin.technician, walkin.status !== 'Pending');

                const paymentStatusClass = walkin.paymentStatus.toLowerCase();
                const paymentBadge = `<span class="payment-status-badge ${paymentStatusClass}">${walkin.paymentStatus}</span>`;

                let paymentActionButton = '';
                if (walkin.paymentStatus === 'Unpaid') {
                    paymentActionButton = `
                        <button class="action-icon-btn mark-paid-btn" title="Mark as Paid">
                            <span class="material-symbols-outlined">payments</span>
                        </button>`;
                }
                // Determine cancel disabled state for walk-ins (Completed + Paid)
                const walkinPaymentStatus = String(walkin.paymentStatus || 'Unpaid').toLowerCase();
                const walkinCancelDisabledAttr = (String(walkin.status || '').toLowerCase() === 'completed' && walkinPaymentStatus === 'paid') ? 'disabled title="Cannot cancel a completed and paid appointment"' : '';

                row.innerHTML = `
                    <td>${walkin.plate}</td>
                    <td>${walkin.carName}</td>
                    <td>${walkin.carType}</td>
                    <td>${walkin.service}</td>
                    <td>${walkin.datetime}</td>
                    <td>${walkin.price}</td>
                    <td>${technicianDropdown}</td>
                    <td class="text-center"><span class="${statusClass}">${walkin.status}</span></td>
                    <td class="text-center">${paymentBadge}</td>
                    <td class="text-center">
                        ${actionButtons}
                        ${paymentActionButton}
                        <button class="action-icon-btn cancel-btn" title="Cancel Appointment" ${walkinCancelDisabledAttr}>
                            <span class="material-symbols-outlined">cancel</span>
                        </button>
                    </td>
                `;
                fragment.appendChild(row);
            });

            tableBody.innerHTML = ''; // Clear existing rows
            tableBody.appendChild(fragment);

            // 5. Update UI
            const noResultsRow = tableContainer.querySelector('.no-results-row');
            if (noResultsRow) {
                noResultsRow.style.display = paginatedWalkins.length === 0 ? 'table-row' : 'none';
            }

            const paginationContainer = tableContainer.querySelector('.table-pagination');
            if (paginationContainer) {
                const pageInfo = paginationContainer.querySelector('.page-info');
                const prevBtn = paginationContainer.querySelector('[data-action="prev"]');
                const nextBtn = paginationContainer.querySelector('[data-action="next"]');
                pageInfo.textContent = `Page ${walkinCurrentPage} of ${totalPages || 1}`;
                prevBtn.disabled = walkinCurrentPage === 1;
                nextBtn.disabled = walkinCurrentPage === totalPages || totalPages === 0;
            }
        };

        // --- Add a single walk-in to the top of the table ---
        const addWalkinToTable = (walkin) => {
            const tableBody = document.querySelector('#walk-in-appointments-table tbody');
            if (!tableBody) return;
            
            // Just re-render the table to ensure all logic is applied
            populateWalkinsTable();
        };

        // --- Populate Status Filters ---
        const populateStatusFilters = () => {
            const statuses = ['All', 'Pending', 'In Progress', 'Completed', 'Cancelled', 'Approve'];
            document.querySelectorAll('.status-filter').forEach(filterSelect => {
                filterSelect.innerHTML = statuses.map(status =>
                    `<option value="${status.toLowerCase()}">${status}</option>`
                ).join('');
            });
        };

        // --- Helper function to increase a technician's task count ---
        const increaseTechnicianTaskCount = (technicianName) => {
            if (!technicianName || technicianName === 'Unassigned') {
                return; // Do not increase for system or unassigned tasks
            }

            const technicians = window.appData.technicians || [];
            const technician = technicians.find(t => t.name === technicianName);

            if (technician) {
                technician.tasks++;
                console.log(`Task started by ${technician.name}. New task count: ${technician.tasks}`);
            } else {
                console.warn(`Could not find technician "${technicianName}" to increase task count.`);
            }
        };

        // --- Helper function to decrease a technician's task count ---
        const decreaseTechnicianTaskCount = (technicianName) => {
            if (!technicianName || technicianName === 'Unassigned') {
                return; // Do not decrease for system or unassigned tasks
            }

            const technicians = window.appData.technicians || [];
            const technician = technicians.find(t => t.name === technicianName);

            if (technician) {
                if (technician.tasks > 0) {
                    technician.tasks--;
                    console.log(`Task completed by ${technician.name}. New task count: ${technician.tasks}`);
                } else {
                    console.warn(`Attempted to decrease task count for ${technician.name}, but it was already 0.`);
                }
            }
        };

        // --- Open Appointment Details Modal on Row Click ---
        const appointmentTableBody = mainAppointmentsContainer.querySelector('tbody');
        if (appointmentTableBody) {
            appointmentTableBody.addEventListener('click', async (e) => {
                const cancelButton = e.target.closest('.cancel-btn');
                const approveButton = e.target.closest('.approve-btn');
                const startServiceButton = e.target.closest('.start-service-btn');
                const completeServiceButton = e.target.closest('.complete-service-btn');
                const markPaidButton = e.target.closest('.mark-paid-btn');
                const technicianSelect = e.target.closest('.technician-select');
                const isActionButtonClick = approveButton || startServiceButton || completeServiceButton || cancelButton || markPaidButton || technicianSelect;
                const row = e.target.closest('tr');

                if (!row || row.classList.contains('no-results-row')) return;

                // --- Walk-in Complete Service Button ---
                if (completeServiceButton && row.closest('#walk-in-appointments-table')) {
                    const walkins = window.appData.walkins || [];
                    const walkin = walkins.find(w => w.id === row.dataset.serviceId);
                    if (walkin && walkin.status === 'In Progress') {
                        await fetchCurrentUserFullName && fetchCurrentUserFullName();
                        if (currentUserFullName !== walkin.technician && window.currentUserRole !== 'admin') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Only the assigned technician can complete this service.', 'error');
                            else alert('Only the assigned technician can complete this service.');
                            return;
                        }
                        const db = window.firebase.firestore();
                        try {
                            await db.collection('walkins').doc(walkin.id).update({
                                status: 'Completed',
                                completedAt: window.firebase.firestore().FieldValue.serverTimestamp()
                            });
                        } catch (err) {
                            console.error('Error updating walk-in to Completed:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to complete service (database error).', 'error');
                            else alert('Failed to complete service (database error).');
                            return;
                        }
                        walkin.status = 'Completed';
                        row.dataset.status = 'Completed';
                        const statusCell = row.querySelector('td:nth-child(8)');
                        if (statusCell) statusCell.innerHTML = `<span class="completed">Completed</span>`;
                        if (typeof showSuccessToast === 'function') showSuccessToast(`Service for ${walkin.customer || walkin.plate} is complete.`);
                        completeServiceButton.remove();
                        // --- Send notification to mobile app user (if needed) ---
                        if (typeof sendServiceCompletedNotification === 'function') sendServiceCompletedNotification(walkin);
                    }
                    return;
                }

                // --- Appointment Complete Service Button ---
                if (approveButton) {
                    const appointments = window.appData.appointments || [];
                    const appointment = appointments.find(a => a.serviceId === row.dataset.serviceId);
                    if (appointment && appointment.status === 'Pending') {
                        // Require technician assignment before approving
                        if (!appointment.technician || appointment.technician === 'Unassigned') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Please assign a technician before approving this appointment.', 'error');
                            else alert('Please assign a technician before approving this appointment.');
                            return;
                        }
                        const db = window.firebase.firestore();
                        try {
                            await db.collection('bookings').doc(appointment.serviceId).update({
                                status: 'Approve',
                                technician: appointment.technician
                            });
                        } catch (err) {
                            console.error('Error updating booking to Approve:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to approve appointment (database error).', 'error');
                            else alert('Failed to approve appointment (database error).');
                            return;
                        }
                        appointment.status = 'Approve';
                        row.dataset.status = 'Approve';
                        // Persist selected technician to the row and disable technician select now that it's approved
                        row.dataset.technician = appointment.technician;
                        const techSelectElem = row.querySelector('.technician-select');
                        if (techSelectElem) {
                            try { techSelectElem.value = appointment.technician; techSelectElem.disabled = true; } catch (e) { /* ignore */ }
                        }
                        const statusCell = row.querySelector('td:nth-last-child(3)');
                        statusCell.innerHTML = `<span class="approve">Approved — Waiting for customer's vehicle</span>`;
                        if (typeof showSuccessToast === 'function') showSuccessToast(`Appointment for ${appointment.customer} has been approved.`);
                        updateAppointmentPageStats();
                        // --- Send notification to mobile app user ---
                        if (typeof NotificationService !== 'undefined' && typeof NotificationService.notifyAppointmentApproved === 'function') {
                            NotificationService.notifyAppointmentApproved(appointment.customerId || appointment.customer, appointment);
                        }
                        // Replace the approve button with a start button
                        const actionsCell = approveButton.parentElement;
                        approveButton.remove();
                        actionsCell.insertAdjacentHTML('afterbegin', `
                            <button class="action-icon-btn start-service-btn" title="Start Service">
                                <span class="material-symbols-outlined">play_arrow</span>
                            </button>
                        `);
                    }
                    return;
                }

                if (startServiceButton) {
                    const appointments = window.appData.appointments || [];
                    const appointment = appointments.find(a => a.serviceId === row.dataset.serviceId);

                    if (appointment && appointment.status === 'Approve') {
                        // Ensure we know who is logged in (name + role)
                        await fetchCurrentUserFullName();

                        // Admins may start regardless; others must be assigned technician
                        if (!appointment.technician || appointment.technician === 'Unassigned') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Cannot start service: no technician assigned.', 'error');
                            else alert('Cannot start service: no technician assigned.');
                            return;
                        }

                        if (currentUserFullName !== appointment.technician && window.currentUserRole !== 'admin') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Only the assigned technician can start this service.', 'error');
                            else alert('Only the assigned technician can start this service.');
                            return;
                        }

                        const originalStatus = appointment.status; // Capture original status
                        const db = window.firebase.firestore();
                        try {
                            // Persist change to Firestore first so mobile app updates
                            await db.collection('bookings').doc(appointment.serviceId).update({
                                status: 'In Progress',
                                startTime: window.firebase.firestore().FieldValue.serverTimestamp(),
                                technician: appointment.technician
                            });
                        } catch (err) {
                            console.error('Error updating booking to In Progress:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to start service (database error).', 'error');
                            else alert('Failed to start service (database error).');
                            return;
                        }

                        // Local/UI updates after successful DB update
                        const startTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); // prettier-ignore
                        appointment.status = 'In Progress';
                        appointment.startTime = startTime;
                        row.dataset.status = 'In Progress';
                        row.dataset.startTime = startTime;
                        const statusCell = row.querySelector('td:nth-last-child(3)'); // The 3rd cell from the end is Status
                        statusCell.innerHTML = `<span class="in-progress">In Progress</span>`;

                        if (originalStatus === 'Pending') increaseTechnicianTaskCount(appointment.technician);

                        updateAppointmentPageStats(); // Refresh stats
                        if (typeof showSuccessToast === 'function') showSuccessToast(`Service for ${appointment.customer} has started.`);

                        // --- Send notification to mobile app user ---
                        sendServiceStartedNotification(appointment);

                        // Replace the start button with a complete button
                        const actionsCell = startServiceButton.parentElement;
                        startServiceButton.remove();
                        actionsCell.insertAdjacentHTML('afterbegin', `
                            <button class="action-icon-btn complete-service-btn" title="Complete Service">
                                <span class="material-symbols-outlined">check</span>
                            </button>
                        `);

                        // Disable technician select for this row to prevent reassignment once started
                        const techSelect = row.querySelector('.technician-select');
                        if (techSelect) techSelect.disabled = true;
                    }
                    return;
                }

                if (completeServiceButton) {
                    const appointments = window.appData.appointments || [];
                    const appointment = appointments.find(a => a.serviceId === row.dataset.serviceId);

                    if (appointment && appointment.status === 'In Progress') {
                        await fetchCurrentUserFullName();
                        // Admins may complete; otherwise only assigned technician
                        if (currentUserFullName !== appointment.technician && window.currentUserRole !== 'admin') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Only the assigned technician can complete this service.', 'error');
                            else alert('Only the assigned technician can complete this service.');
                            return;
                        }

                        const db = window.firebase.firestore();
                        try {
                            await db.collection('bookings').doc(appointment.serviceId).update({
                                status: 'Completed',
                                completedAt: window.firebase.firestore().FieldValue.serverTimestamp()
                            });
                        } catch (err) {
                            console.error('Error updating booking to Completed:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to complete service (database error).', 'error');
                            else alert('Failed to complete service (database error).');
                            return;
                        }

                        appointment.status = 'Completed';
                        row.dataset.status = 'Completed';
                        const statusCell = row.querySelector('td:nth-last-child(3)'); // The 3rd cell from the end is Status
                        statusCell.innerHTML = `<span class="completed">Completed</span>`;

                        if (typeof showSuccessToast === 'function') showSuccessToast(`Service for ${appointment.customer} is complete.`);
                        updateAppointmentPageStats(); // Refresh stats
                        completeServiceButton.remove();

                        // Decrease the technician's task count
                        decreaseTechnicianTaskCount(appointment.technician);
                        // Only disable cancel button after completion if payment is Paid
                        try {
                            const cancelBtnRow = row.querySelector('.cancel-btn');
                            const currentPayment = String(appointment.paymentStatus || appointment.payment || 'Unpaid').toLowerCase();
                            if (cancelBtnRow && currentPayment === 'paid') {
                                cancelBtnRow.disabled = true;
                                cancelBtnRow.title = 'Cannot cancel a completed and paid appointment';
                            }
                        } catch (e) {
                            console.debug('Could not disable cancel button after completion', e);
                        }

                        // --- Send notification to mobile app user ---
                        sendServiceCompletedNotification(appointment);
                    }
                    return;
                }

                if (cancelButton) {
                    // Find the appointment in the data array and update its status
                    const appointments = window.appData.appointments || [];
                    const appointment = appointments.find(a => a.serviceId === row.dataset.serviceId);

                    if (appointment) {
                        const originalStatus = appointment.status;

                        // Only block cancellation when the appointment is both Completed and Paid
                        const currentPaymentStatus = String(appointment.paymentStatus || appointment.payment || 'Unpaid').toLowerCase();
                        if (String(originalStatus).toLowerCase() === 'completed' && currentPaymentStatus === 'paid') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Cannot cancel a completed and paid appointment.', 'error');
                            else alert('Cannot cancel a completed and paid appointment.');
                            return;
                        }

                        // Navigate to the dedicated cancel page so admin can provide reason/notes
                        // Store the appointment and its original status in sessionStorage for the cancel page
                        try {
                            sessionStorage.setItem('appointmentToCancel', JSON.stringify({ appointment, originalStatus }));
                            // Navigate to the cancel page
                            window.location.href = 'cancel-appointment.html';
                        } catch (err) {
                            console.error('Error preparing cancel page:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Could not open cancel page.', 'error');
                        }
                    } 
                    return;
                }

                if (markPaidButton) {
                    const appointments = window.appData.appointments || [];
                    const appointment = appointments.find(a => a.serviceId === row.dataset.serviceId);

                    // Normalize current payment status (treat undefined/null as 'Unpaid')
                    const currentPaymentStatus = (appointment && appointment.paymentStatus) ? String(appointment.paymentStatus) : 'Unpaid';

                    if (appointment && currentPaymentStatus.toLowerCase() === 'unpaid') {
                        // Require technician assignment before payment approval
                        if (!appointment.technician || appointment.technician === 'Unassigned') {
                            if (typeof showSuccessToast === 'function') {
                                showSuccessToast('Please assign a technician before approving payment.', 'error');
                            } else {
                                alert('Please assign a technician before approving payment.');
                            }
                            return;
                        }
                        // Approve payment directly, no modal
                        let paymentMethod = '';
                        let customerId = appointment.customerId || appointment.userId || appointment.customerUid;
                        (async () => {
                            try {
                                const db = window.firebase.firestore();
                                if (!customerId) {
                                    // Try to find by fullName if no ID
                                    const usersSnapshot = await db.collection('users').where('fullName', '==', appointment.customer).limit(1).get();
                                    if (!usersSnapshot.empty) {
                                        customerId = usersSnapshot.docs[0].id;
                                    }
                                }
                                if (customerId) {
                                    const userDoc = await db.collection('users').doc(customerId).get();
                                    if (userDoc.exists) {
                                        const userData = userDoc.data();
                                        paymentMethod = userData.paymentMethod || 'Not set';
                                    }
                                }
                            } catch (err) {
                                paymentMethod = 'Not set';
                                console.error('Error fetching user payment method:', err);
                            }

                            // Update payment status in Firestore
                            try {
                                const db = window.firebase.firestore();
                                if (!appointment.serviceId) {
                                    console.error('No serviceId found for appointment:', appointment);
                                }
                                await db.collection('bookings').doc(appointment.serviceId).update({
                                    paymentStatus: 'Paid',
                                    paymentMethod: paymentMethod,
                                    paidAt: window.firebase.firestore().FieldValue.serverTimestamp()
                                });
                                appointment.paymentStatus = 'Paid';
                                appointment.paymentMethod = paymentMethod;
                                row.dataset.paymentStatus = 'Paid';
                                const paymentCell = row.querySelector('td:nth-last-child(2)');
                                if (paymentCell) paymentCell.innerHTML = `<span class="payment-status-badge paid">Paid</span>`;
                                if (typeof showSuccessToast === 'function') {
                                    showSuccessToast(`Appointment ${appointment.serviceId} marked as paid with ${paymentMethod}.`);
                                }
                                // Remove the mark paid button
                                const markPaidBtn = row.querySelector('.mark-paid-btn');
                                if (markPaidBtn) markPaidBtn.remove();
                                // Send notification to mobile app user
                                if (typeof sendPaymentReceivedNotification === 'function') {
                                    sendPaymentReceivedNotification(appointment);
                                }
                                // If appointment is already completed, disable cancel button now that it's paid
                                try {
                                    const cancelBtnRow = row.querySelector('.cancel-btn');
                                    if (cancelBtnRow && String(appointment.status || '').toLowerCase() === 'completed') {
                                        cancelBtnRow.disabled = true;
                                        cancelBtnRow.title = 'Cannot cancel a completed and paid appointment';
                                    }
                                } catch (e) {
                                    console.debug('Could not disable cancel button after payment', e);
                                }
                            } catch (err) {
                                console.error('Error updating payment status:', err, {
                                    serviceId: appointment.serviceId,
                                    paymentMethod,
                                    appointment
                                });
                                if (typeof showSuccessToast === 'function') {
                                    showSuccessToast('Failed to process payment (database error). ' + (err && err.message ? err.message : ''), 'error');
                                } else {
                                    alert('Failed to process payment (database error). ' + (err && err.message ? err.message : ''));
                                }
                            }
                        })();
                    }
                    return;
                }

                // If the click was on the row itself (but not on a button), show details overlay
                if (row && !isActionButtonClick) {
                    const appointment = (window.appData.appointments || []).find(a => a.serviceId === row.dataset.serviceId);
 
                    if (appointment) {
                        // Store the appointment data for the details page
                        sessionStorage.removeItem('selectedAppointmentData');
                        // Store the full, current page URL to enable correct "back" navigation
                        sessionStorage.setItem('previousPage', window.location.href);
                        sessionStorage.setItem('selectedAppointmentData', JSON.stringify(appointment));
                        window.location.href = `appointment-details.html`;
                    }
                }

            });
        }

        // --- Helper function to find and assign the least busy technician ---
        const findAndAssignLeastBusyTechnician = () => {
            const technicians = window.appData.technicians || [];
            
            // Filter for active technicians, excluding the "Unassigned" system user
            const activeTechnicians = technicians.filter(tech => tech.status === 'Active' && tech.name !== 'Unassigned');
        
            if (activeTechnicians.length === 0) {
                console.warn("No active technicians available. Assigning to 'Unassigned'.");
                return "Unassigned";
            }
        
            // Sort by task count, ascending. The one with the fewest tasks will be first.
            activeTechnicians.sort((a, b) => a.tasks - b.tasks);
            
            const leastBusyTechnicianData = activeTechnicians[0];
            
            // Increment the task count for the assigned technician in the central data
            // This is crucial for the logic to work on subsequent assignments.
            const techInDataSource = technicians.find(t => t.id === leastBusyTechnicianData.id);
            if (techInDataSource) {
                techInDataSource.tasks++;
                console.log(`Assigned task to ${techInDataSource.name}. New task count: ${techInDataSource.tasks}`);
            } else {
                console.warn(`Could not find technician with ID ${leastBusyTechnicianData.id} in the main data source to update task count.`);
            }
            
            return leastBusyTechnicianData.name;
        };


        // --- Open Walk-in Details Modal & Handle Actions ---
        const walkinTableBody = document.querySelector('#walk-in-appointments-table tbody');
        if (walkinTableBody) {
            walkinTableBody.addEventListener('click', async (e) => {
                const cancelButton = e.target.closest('.cancel-btn');
                const startServiceButton = e.target.closest('.start-service-btn');
                const completeServiceButton = e.target.closest('.complete-service-btn');
                const markPaidButton = e.target.closest('.mark-paid-btn');
                const technicianSelect = e.target.closest('.technician-select');
                const isActionButtonClick = startServiceButton || completeServiceButton || cancelButton || markPaidButton || technicianSelect;
                const row = e.target.closest('tr');

                if (!row || row.classList.contains('no-results-row')) return;

                if (startServiceButton) {
                    const walkins = window.appData.walkins || [];
                    const walkin = walkins.find(w => w.plate === row.dataset.plate && w.service === row.dataset.service);

                    if (walkin && walkin.status === 'Pending') {
                        await fetchCurrentUserFullName();

                        // Admins may start regardless; others must be assigned technician
                        if (!walkin.technician || walkin.technician === 'Unassigned') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Cannot start service: no technician assigned.', 'error');
                            else alert('Cannot start service: no technician assigned.');
                            return;
                        }

                        if (currentUserFullName !== walkin.technician && window.currentUserRole !== 'admin') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Only the assigned technician can start this service.', 'error');
                            else alert('Only the assigned technician can start this service.');
                            return;
                        }

                        const originalStatus = walkin.status; // Capture original status
                        const db = window.firebase.firestore();
                        try {
                            await db.collection('walkins').doc(walkin.id).update({
                                status: 'In Progress',
                                startTime: window.firebase.firestore().FieldValue.serverTimestamp(),
                                technician: walkin.technician
                            });
                        } catch (err) {
                            console.error('Error updating walkin to In Progress:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to start walk-in (database error).', 'error');
                            else alert('Failed to start walk-in (database error).');
                            return;
                        }

                        const startTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); // prettier-ignore
                        walkin.status = 'In Progress';
                        walkin.startTime = startTime;
                        row.dataset.status = 'In Progress';
                        row.dataset.startTime = startTime; // prettier-ignore
                        const statusCell = row.querySelector('td:nth-last-child(3)'); // The 3rd cell from the end is Status
                        statusCell.innerHTML = `<span class="in-progress">In Progress</span>`;

                        if (originalStatus === 'Pending') increaseTechnicianTaskCount(walkin.technician);

                        updateAppointmentPageStats(); // Refresh stats
                        if (typeof showSuccessToast === 'function') showSuccessToast(`Service for walk-in ${walkin.plate} has started.`);

                        // Replace the start button with a complete button
                        const actionsCell = startServiceButton.parentElement;
                        startServiceButton.remove();
                        actionsCell.insertAdjacentHTML('afterbegin', `
                            <button class="action-icon-btn complete-service-btn" title="Complete Service">
                                <span class="material-symbols-outlined">check</span>
                            </button>
                        `);

                        // Disable technician select for this row to prevent reassignment once started
                        const techSelect = row.querySelector('.technician-select');
                        if (techSelect) techSelect.disabled = true;
                    }
                    return;
                }

                if (completeServiceButton) {
                    const walkins = window.appData.walkins || [];
                    const walkin = walkins.find(w => w.plate === row.dataset.plate && w.service === row.dataset.service);

                    if (walkin && walkin.status === 'In Progress') {
                        await fetchCurrentUserFullName();
                        if (currentUserFullName !== walkin.technician && window.currentUserRole !== 'admin') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Only the assigned technician can complete this service.', 'error');
                            else alert('Only the assigned technician can complete this service.');
                            return;
                        }

                        const db = window.firebase.firestore();
                        try {
                            await db.collection('walkins').doc(walkin.id).update({
                                status: 'Completed',
                                completedAt: window.firebase.firestore().FieldValue.serverTimestamp()
                            });
                        } catch (err) {
                            console.error('Error updating walkin to Completed:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to complete walk-in (database error).', 'error');
                            else alert('Failed to complete walk-in (database error).');
                            return;
                        }

                        walkin.status = 'Completed';
                        row.dataset.status = 'Completed';
                        const statusCell = row.querySelector('td:nth-last-child(3)'); // The 3rd cell from the end is Status
                        statusCell.innerHTML = `<span class="completed">Completed</span>`;

                        if (typeof showSuccessToast === 'function') showSuccessToast(`Service for walk-in ${walkin.plate} is complete.`);
                        updateAppointmentPageStats(); // Refresh stats
                        completeServiceButton.remove();

                        // Decrease the technician's task count
                        decreaseTechnicianTaskCount(walkin.technician);
                    }
                    return;
                }

                if (cancelButton) {
                    // Find walkin by plate and service to be more specific
                    const walkins = window.appData.walkins || [];
                    const walkin = walkins.find(w => w.plate === row.dataset.plate && w.service === row.dataset.service);

                    if (walkin) {
                        const originalStatus = walkin.status;

                        // Only block cancellation when the walk-in is Completed and Paid
                        const currentPaymentStatus = String(walkin.paymentStatus || walkin.payment || 'Unpaid').toLowerCase();
                        if (String(originalStatus).toLowerCase() === 'completed' && currentPaymentStatus === 'paid') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Cannot cancel a completed and paid appointment.', 'error');
                            else alert('Cannot cancel a completed and paid appointment.');
                            return;
                        }

                        const db = window.firebase.firestore();
                        try {
                            await db.collection('walkins').doc(walkin.id).update({
                                status: 'Cancelled',
                                cancelledAt: window.firebase.firestore().FieldValue.serverTimestamp()
                            });
                        } catch (err) {
                            console.error('Error updating walkin to Cancelled:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to cancel walk-in (database error).', 'error');
                            else alert('Failed to cancel walk-in (database error).');
                            return;
                        }

                        // Update status in data model
                        walkin.status = 'Cancelled';
                        row.dataset.status = 'Cancelled';

                        // Update status in UI
                        const statusCell = row.querySelector('td:nth-last-child(3)'); // The 3rd cell from the end is Status
                        statusCell.innerHTML = `<span class="cancelled">Cancelled</span>`;

                        // If it was a pending or in-progress task, free up the technician
                        if (originalStatus === 'Pending' || originalStatus === 'In Progress') {
                            decreaseTechnicianTaskCount(walkin.technician);
                        }
                        
                        cancelButton.disabled = true;
                        updateAppointmentPageStats(); // Refresh stats
                        // Re-render the table with current filters
                        populateWalkinsTable();
                    }
                    return;
                }

                if (markPaidButton) {
                    const walkins = window.appData.walkins || [];
                    const walkin = walkins.find(w => w.plate === row.dataset.plate && w.service === row.dataset.service);

                    // Normalize current payment status (treat undefined/null as 'Unpaid')
                    const currentPaymentStatus = (walkin && walkin.paymentStatus) ? String(walkin.paymentStatus) : 'Unpaid';

                    if (walkin && currentPaymentStatus.toLowerCase() === 'unpaid') {
                        const db = window.firebase.firestore();
                        try {
                            // Update payment status in Firestore
                            await db.collection('walkins').doc(walkin.id).update({
                                paymentStatus: 'Paid',
                                paidAt: window.firebase.firestore().FieldValue.serverTimestamp()
                            });
                        } catch (err) {
                            console.error('Error updating walk-in payment status:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to mark as paid (database error).', 'error');
                            else alert('Failed to mark as paid (database error).');
                            return;
                        }

                        // Local/UI updates after successful DB update
                        walkin.paymentStatus = 'Paid';
                        row.dataset.paymentStatus = 'Paid';

                        const paymentCell = row.querySelector('td:nth-last-child(2)');
                        if (paymentCell) paymentCell.innerHTML = `<span class="payment-status-badge paid">Paid</span>`;

                        if (typeof showSuccessToast === 'function') showSuccessToast(`Walk-in for ${walkin.plate} marked as paid.`);
                        
                        // Remove the button after it's clicked
                        markPaidButton.remove();
                                // If walk-in is already completed, disable cancel button now that it's paid
                                try {
                                    const cancelBtnRow = row.querySelector('.cancel-btn');
                                    if (cancelBtnRow && String(walkin.status || '').toLowerCase() === 'completed') {
                                        cancelBtnRow.disabled = true;
                                        cancelBtnRow.title = 'Cannot cancel a completed and paid appointment';
                                    }
                                } catch (e) {
                                    console.debug('Could not disable cancel button on walkin after payment', e);
                                }
                    }
                    return;
                }

                // If the click was on the row itself (but not on a button), show details overlay
                if (row && !isActionButtonClick) {
                    const walkins = window.appData.walkins || [];
                    const walkin = walkins.find(w => w.plate === row.dataset.plate && w.service === row.dataset.service);

                    if (walkin) {
                        sessionStorage.removeItem('selectedWalkinData');
                        // Store the full, current page URL to enable correct "back" navigation
                        sessionStorage.setItem('previousPage', window.location.href);
                        sessionStorage.setItem('selectedWalkinData', JSON.stringify(walkin));
                        window.location.href = `walk-in-details.html`;
                    }
                }
            });
        }
        
        // --- Event Listeners for Filters, Sorting, and Pagination ---
        const setupTableInteractions = () => {
            // Appointments Table
            const apptContainer = document.getElementById('main-appointments-table-container');
            apptContainer.querySelector('#appointment-search').addEventListener('input', () => { apptCurrentPage = 1; populateAppointmentsTable(); });
            apptContainer.querySelector('.status-filter')?.addEventListener('change', () => { apptCurrentPage = 1; populateAppointmentsTable(); });
            apptContainer.querySelector('.table-pagination [data-action="prev"]').addEventListener('click', () => { if (apptCurrentPage > 1) { apptCurrentPage--; populateAppointmentsTable(); } });
            apptContainer.querySelector('.table-pagination [data-action="next"]').addEventListener('click', () => { apptCurrentPage++; populateAppointmentsTable(); });

            // Handle Technician Re-assignment for Appointments
            apptContainer.querySelector('tbody').addEventListener('change', async (e) => { // Make the event listener async
                const technicianSelect = e.target.closest('.technician-select');
                if (!technicianSelect) return;

                const row = e.target.closest('tr');
                if (!row || !row.dataset.serviceId) return;

                const serviceId = row.dataset.serviceId;
                const newTechnicianName = technicianSelect.value;

                const appointment = window.appData.appointments.find(a => a.serviceId === serviceId);
                if (!appointment) return;

                const oldTechnicianName = appointment.technician;
                // Prevent changing technician once service is in progress or completed
                if (appointment.status === 'In Progress' || appointment.status === 'Completed') {
                    technicianSelect.value = oldTechnicianName;
                    if (typeof showSuccessToast === 'function') showSuccessToast('Cannot change technician after service started or completed.', 'error');
                    return;
                }

                appointment.technician = newTechnicianName;
                row.dataset.technician = newTechnicianName;

                try { // Add try...catch for the database operation
                    // --- Firestore Update ---
                    const db = window.firebase.firestore();
                    await db.collection('bookings').doc(serviceId).update({
                        technician: newTechnicianName
                    });

                    // Update task counts only after a successful database update
                    if (appointment.status === 'Pending' || appointment.status === 'In Progress') {
                        decreaseTechnicianTaskCount(oldTechnicianName);
                        increaseTechnicianTaskCount(newTechnicianName);
                    }

                    if (typeof showSuccessToast === 'function') showSuccessToast(`Technician for ${appointment.customer} changed to ${newTechnicianName}.`);
                } catch (error) {
                    console.error("Error updating technician in Firestore:", error);
                    // Revert local changes if DB update fails
                    appointment.technician = oldTechnicianName;
                    row.dataset.technician = oldTechnicianName;
                    if (typeof showSuccessToast === 'function') showSuccessToast(`Error: Could not assign technician.`, 'error');
                }
                // Re-render the table so the Approve button updates its enabled/disabled state
                populateAppointmentsTable();
            });

            // Walk-ins Table
            const walkinContainer = document.getElementById('walk-in-appointments-table-container');
            walkinContainer.querySelector('#walkin-appointment-search').addEventListener('input', () => { walkinCurrentPage = 1; populateWalkinsTable(); });
            walkinContainer.querySelector('.status-filter')?.addEventListener('change', () => { walkinCurrentPage = 1; populateWalkinsTable(); });
            walkinContainer.querySelector('.table-pagination [data-action="prev"]').addEventListener('click', () => { if (walkinCurrentPage > 1) { walkinCurrentPage--; populateWalkinsTable(); } });
            walkinContainer.querySelector('.table-pagination [data-action="next"]').addEventListener('click', () => { walkinCurrentPage++; populateWalkinsTable(); });

            // Archived Table: search + pagination
            const archivedContainerEl = document.getElementById('archived-appointments-table');
            if (archivedContainerEl) {
                const archivedSearch = archivedContainerEl.querySelector('#archived-appointment-search');
                if (archivedSearch) archivedSearch.addEventListener('input', () => { archivedCurrentPage = 1; archivedSearchTerm = archivedSearch.value || ''; renderArchivedTable(); });
                const archivedPrev = archivedContainerEl.querySelector('.table-pagination [data-action="prev"]');
                const archivedNext = archivedContainerEl.querySelector('.table-pagination [data-action="next"]');
                if (archivedPrev) archivedPrev.addEventListener('click', () => { if (archivedCurrentPage > 1) { archivedCurrentPage--; renderArchivedTable(); } });
                if (archivedNext) archivedNext.addEventListener('click', () => { archivedCurrentPage++; renderArchivedTable(); });
            }

            // Handle Technician Re-assignment for Walk-ins
            walkinContainer.querySelector('tbody').addEventListener('change', async (e) => { // Make the event listener async
                const technicianSelect = e.target.closest('.technician-select');
                if (!technicianSelect) return;

                const row = e.target.closest('tr');
                if (!row || !row.dataset.serviceId) return; // Use serviceId which holds the unique ID

                // Walk-ins are identified by their unique ID stored in the row's dataset
                const walkinId = row.dataset.serviceId; // Assuming walk-in rows also have data-service-id
                const walkin = window.appData.walkins.find(w => w.id === walkinId);
                if (!walkin) return;

                const oldTechnicianName = walkin.technician;
                const newTechnicianName = technicianSelect.value;
                // Prevent changing technician once service is in progress or completed
                if (walkin.status === 'In Progress' || walkin.status === 'Completed') {
                    technicianSelect.value = oldTechnicianName;
                    if (typeof showSuccessToast === 'function') showSuccessToast('Cannot change technician after service started or completed.', 'error');
                    return;
                }

                walkin.technician = newTechnicianName;
                row.dataset.technician = newTechnicianName;

                try { // Add try...catch for the database operation
                    // --- Firestore Update ---
                    const db = window.firebase.firestore();
                    await db.collection('walkins').doc(walkinId).update({
                        technician: newTechnicianName
                    });

                    // Update task counts only after a successful database update
                    if (walkin.status === 'Pending' || walkin.status === 'In Progress') {
                        decreaseTechnicianTaskCount(oldTechnicianName);
                        increaseTechnicianTaskCount(newTechnicianName);
                    }
                    if (typeof showSuccessToast === 'function') showSuccessToast(`Technician for walk-in ${walkin.plate} changed to ${newTechnicianName}.`);
                } catch (error) {
                    console.error("Error updating walk-in technician in Firestore:", error);
                    // Revert local changes if DB update fails
                    walkin.technician = oldTechnicianName;
                    row.dataset.technician = oldTechnicianName;
                    if (typeof showSuccessToast === 'function') showSuccessToast(`Error: Could not assign technician.`, 'error');
                }
            });

            // Sorting (applies to both tables)
            document.querySelectorAll('#appointments-page .sortable-header th[data-sortable="true"]').forEach(header => {
                header.addEventListener('click', () => {
                    const column = header.dataset.sortBy || header.textContent.toLowerCase().trim().replace(' ', '');
                    
                    if (currentSort.column === column) {
                        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        currentSort.column = column;
                        currentSort.direction = 'desc';
                    }

                    // Update header classes for visual feedback
                    document.querySelectorAll('#appointments-page th').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
                    header.classList.add(currentSort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');

                    // Re-render both tables with the new sort order
                    populateAppointmentsTable();
                    populateWalkinsTable();
                });
            });
        };

        // Initial Setup
        if (mainAppointmentsContainer) { // Only run these on the main appointments page
            populateStatusFilters();
            setupTableInteractions();
            // Add 'Clear Completed (Paid)' button to table controls
            try {
                const tableControls = document.querySelector('#main-appointments-table-container .table-controls');
                if (tableControls && !document.getElementById('clear-completed-paid-btn')) {
                    const clearBtn = document.createElement('button');
                    clearBtn.id = 'clear-completed-paid-btn';
                    clearBtn.className = 'btn-secondary';
                    clearBtn.style.marginLeft = '8px';
                    clearBtn.textContent = 'Clear Completed (Paid)';
                    tableControls.appendChild(clearBtn);

                    clearBtn.addEventListener('click', async () => {
                        const appointments = window.appData.appointments || [];
                        const walkins = window.appData.walkins || [];
                        const toArchiveBookings = appointments.filter(a => String(a.status || '').toLowerCase() === 'completed' && String(a.paymentStatus || a.payment || '').toLowerCase() === 'paid');
                        const toArchiveWalkins = walkins.filter(w => String(w.status || '').toLowerCase() === 'completed' && String(w.paymentStatus || w.payment || '').toLowerCase() === 'paid');
                        const count = toArchiveBookings.length + toArchiveWalkins.length;
                        if (count === 0) {
                            if (typeof showSuccessToast === 'function') showSuccessToast('No completed & paid appointments to archive.', 'info');
                            else alert('No completed & paid appointments to archive.');
                            return;
                        }

                        const confirmMsg = `Archive ${count} completed & paid appointment${count > 1 ? 's' : ''}? This will move them to the archive collections and remove the originals from active tables.`;
                        if (!confirm(confirmMsg)) return;

                        try {
                            const db = window.firebase.firestore();
                            const batch = db.batch();

                            toArchiveBookings.forEach(b => {
                                const id = b.serviceId || b.id;
                                if (!id) return;
                                const archiveRef = db.collection('archived_bookings').doc(id);
                                const originalRef = db.collection('bookings').doc(id);
                                const dataToWrite = { ...b, archivedAt: getServerTimestamp(), archivedFrom: 'bookings' };
                                batch.set(archiveRef, dataToWrite);
                                batch.delete(originalRef);
                            });

                            toArchiveWalkins.forEach(w => {
                                const id = w.id || w.serviceId;
                                if (!id) return;
                                const archiveRef = db.collection('archived_walkins').doc(id);
                                const originalRef = db.collection('walkins').doc(id);
                                const dataToWrite = { ...w, archivedAt: getServerTimestamp(), archivedFrom: 'walkins' };
                                batch.set(archiveRef, dataToWrite);
                                batch.delete(originalRef);
                            });

                            await batch.commit();

                            // Refresh archived lists from Firestore so UI matches persisted data
                            await fetchArchivedFromFirestore();

                            // Remove archived records from local model and re-render main tables
                            window.appData.appointments = appointments.filter(a => !(String(a.status || '').toLowerCase() === 'completed' && String(a.paymentStatus || a.payment || '').toLowerCase() === 'paid'));
                            window.appData.walkins = walkins.filter(w => !(String(w.status || '').toLowerCase() === 'completed' && String(w.paymentStatus || w.payment || '').toLowerCase() === 'paid'));
                            populateAppointmentsTable();
                            populateWalkinsTable();
                            renderArchivedTable();
                            updateAppointmentPageStats();
                            if (typeof showSuccessToast === 'function') showSuccessToast(`${count} appointment${count > 1 ? 's' : ''} archived.`);
                        } catch (err) {
                            // Enhanced diagnostics for permission/network issues
                            try {
                                console.error('Error archiving records:', err);
                                const auth = window.firebase && window.firebase.auth ? window.firebase.auth() : null;
                                const currentUser = auth && auth.currentUser ? auth.currentUser : null;
                                console.group('Archive diagnostic');
                                console.log('Current user object:', currentUser);
                                if (currentUser && typeof auth.getIdToken === 'function') {
                                    try {
                                        const token = await auth.getIdToken(true).catch(tErr => {
                                            console.warn('Could not refresh/get ID token:', tErr);
                                            return null;
                                        });
                                        if (token) {
                                            console.log('ID token (first 80 chars):', String(token).slice(0,80) + '...');
                                        } else {
                                            console.log('No ID token available (user may be unauthenticated)');
                                        }
                                    } catch (tErr) {
                                        console.warn('ID token retrieval error:', tErr);
                                    }
                                }

                                if (err && err.code) {
                                    console.log('Firestore error code:', err.code);
                                }
                                if (err && err.message) {
                                    console.log('Firestore error message:', err.message);
                                }
                                console.groupEnd();
                            } catch (diagErr) {
                                console.error('Diagnostic logging failed:', diagErr);
                            }

                            // Friendly UI feedback
                            const permMsg = err && (err.code === 'permission-denied' || (err.message && err.message.toLowerCase().includes('permission')));
                            if (permMsg) {
                                const userMsg = 'Archiving failed: Missing or insufficient permissions. Check Firestore security rules and that you are signed-in with an account that has admin rights.';
                                if (typeof showSuccessToast === 'function') showSuccessToast(userMsg, 'error');
                                else alert(userMsg);
                            } else {
                                if (typeof showSuccessToast === 'function') showSuccessToast('Failed to archive records. See console for details.', 'error');
                                else alert('Failed to archive records. See console for details.');
                            }
                        }
                    });
                }
            } catch (e) {
                console.debug('Could not insert Clear Completed button', e);
            }
            fetchAndPopulateAppointments(); // Fetch data from Firestore on initial load
            updateAppointmentPageStats(); // Call the new function to update stats
            if (typeof window.initializeTableFunctionality === 'function') {
                window.initializeTableFunctionality('#main-appointments-table');
                window.initializeTableFunctionality('#walk-in-appointments-table');
            }
            // Collapse toggle for archived table
            try {
                // Archive table redesign: show/hide with a single button
                const showArchivedBtn = document.getElementById('show-archived-btn');
                const archivedContainer = document.getElementById('archived-appointments-table-container');
                if (showArchivedBtn && archivedContainer) {
                    let visible = false;
                    showArchivedBtn.addEventListener('click', () => {
                        visible = !visible;
                        archivedContainer.style.display = visible ? '' : 'none';
                        showArchivedBtn.innerHTML = visible
                          ? '<span class="material-symbols-outlined">close</span> Hide Archived Services'
                          : '<span class="material-symbols-outlined">history</span> Show Archived Services';
                    });
                }
            } catch (e) {
                console.debug('Could not hook archived collapse toggle', e);
            }
        }

        // --- Add event listener to refresh data when page is shown ---
        // This handles cases where the user navigates back to this page.
        window.addEventListener('pageshow', (event) => {
            // The 'persisted' property is true if the page is from the back/forward cache.
            if (event.persisted) {
                if (mainAppointmentsContainer) fetchAndPopulateAppointments();
            }
        });
    }

    // ===== HELPER: GET CUSTOMER ID FROM NAME =====
    /**
     * Look up customer's Firestore ID using their name
     * Queries the 'users' collection for a customer with matching fullName
     */
    const getCustomerIdFromName = async (customerName) => {
        try {
            if (!customerName || typeof customerName !== 'string') {
                return null;
            }

            const db = window.firebase.firestore();
            const usersSnapshot = await db.collection('users')
                .where('fullName', '==', customerName.trim())
                .where('role', '!=', 'admin')
                .limit(1)
                .get();

            if (usersSnapshot.empty) {
                console.warn(`⚠️ No customer found with name: ${customerName}`);
                return null;
            }

            const customerId = usersSnapshot.docs[0].id;
            console.log(`✅ Found customer ID: ${customerId} for name: ${customerName}`);
            return customerId;
        } catch (error) {
            console.error(`❌ Error looking up customer ID: ${error.message}`);
            return null;
        }
    };

    // ===== NOTIFICATION FUNCTIONS TO SEND TO MOBILE USERS =====

    /**
     * Send "Service Started" notification to customer
     */
    const sendServiceStartedNotification = async (appointment) => {
        try {
            if (typeof NotificationService === 'undefined') {
                console.warn('NotificationService not available');
                return;
            }

            // Get customer ID from appointment data (could be any of these names)
            const customerName = appointment.customer || appointment.customerName || appointment.fullName;
            
            if (!customerName) {
                console.warn('⚠️ No customer name found in appointment data');
                return;
            }

            // Look up the actual Firestore user ID using the customer name
            const customerId = await getCustomerIdFromName(customerName);
            
            if (!customerId) {
                console.warn(`⚠️ Could not find Firestore ID for customer: ${customerName}`);
                return;
            }

            await NotificationService.notifyServiceStarted(customerId, {
                id: appointment.serviceId,
                serviceName: appointment.serviceNames || appointment.service,
                technician: appointment.technician
            });

            console.log(`✅ Service started notification sent to ${customerId}`);
        } catch (error) {
            console.error('❌ Error sending service started notification:', error.message);
        }
    };

    /**
     * Send "Service Completed" notification to customer
     */
    const sendServiceCompletedNotification = async (appointment) => {
        try {
            if (typeof NotificationService === 'undefined') {
                console.warn('NotificationService not available');
                return;
            }

            // Get customer ID from appointment data
            const customerName = appointment.customer || appointment.customerName || appointment.fullName;
            
            if (!customerName) {
                console.warn('⚠️ No customer name found in appointment data');
                return;
            }

            // Look up the actual Firestore user ID
            const customerId = await getCustomerIdFromName(customerName);
            
            if (!customerId) {
                console.warn(`⚠️ Could not find Firestore ID for customer: ${customerName}`);
                return;
            }

            await NotificationService.notifyServiceCompleted(customerId, {
                id: appointment.serviceId,
                serviceName: appointment.serviceNames || appointment.service
            });

            console.log(`✅ Service completed notification sent to ${customerId}`);
        } catch (error) {
            console.error('❌ Error sending service completed notification:', error.message);
        }
    };

    /**
     * Send "Payment Received" notification to customer
     */
    const sendPaymentReceivedNotification = async (appointment) => {
        try {
            if (typeof NotificationService === 'undefined') {
                console.warn('NotificationService not available');
                return;
            }

            // Get customer ID from appointment data
            const customerName = appointment.customer || appointment.customerName || appointment.fullName;
            
            if (!customerName) {
                console.warn('⚠️ No customer name found in appointment data');
                return;
            }

            // Look up the actual Firestore user ID
            const customerId = await getCustomerIdFromName(customerName);
            
            if (!customerId) {
                console.warn(`⚠️ Could not find Firestore ID for customer: ${customerName}`);
                return;
            }

            await NotificationService.notifyPaymentReceived(customerId, {
                id: appointment.serviceId,
                amount: appointment.price,
                serviceName: appointment.serviceNames || appointment.service
            });

            console.log(`✅ Payment received notification sent to ${customerId}`);
        } catch (error) {
            console.error('❌ Error sending payment received notification:', error.message);
        }
    };

    /**
     * Send "Appointment Cancelled" notification to customer
     */
    const sendAppointmentCancelledNotification = async (appointment) => {
        try {
            if (typeof NotificationService === 'undefined') {
                console.warn('NotificationService not available');
                return;
            }

            // Get customer ID from appointment data
            const customerName = appointment.customer || appointment.customerName || appointment.fullName;
            
            if (!customerName) {
                console.warn('⚠️ No customer name found in appointment data');
                return;
            }

            // Look up the actual Firestore user ID
            const customerId = await getCustomerIdFromName(customerName);
            
            if (!customerId) {
                console.warn(`⚠️ Could not find Firestore ID for customer: ${customerName}`);
                return;
            }

            await NotificationService.notifyAppointmentCancelled(customerId, {
                id: appointment.serviceId,
                serviceName: appointment.serviceNames || appointment.service,
                reason: appointment.cancellationReason || 'Your appointment was cancelled by the admin'
            });

            console.log(`✅ Appointment cancelled notification sent to ${customerId}`);
        } catch (error) {
            console.error('❌ Error sending appointment cancelled notification:', error.message);
        }
    };

    // TODO: Pending reschedule requests table removed - UI and handlers deleted

    // --- Payment Form Handler ---
    const paymentForm = document.getElementById('payment-form');
    const paymentCancelBtn = document.getElementById('payment-cancel-btn');
    const modalOverlay = document.getElementById('modal-overlay');

    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const paymentAmountInput = document.getElementById('payment-amount');
            const paymentMethodInput = document.getElementById('payment-method');
            const amount = parseFloat(paymentAmountInput?.value || 0);

            const appointment = window.pendingPaymentAppointment;
            const row = window.pendingPaymentRow;

            if (!appointment || !row) {
                alert('Error: Could not find appointment data.');
                return;
            }

            // Fetch the user's payment method from Firestore
            let paymentMethod = '';
            try {
                const db = window.firebase.firestore();
                let customerId = appointment.customerId || appointment.customer || appointment.customerUid;
                if (!customerId) {
                    // Try to look up by name if needed
                    const usersSnapshot = await db.collection('users').where('fullName', '==', appointment.customer).limit(1).get();
                    if (!usersSnapshot.empty) {
                        customerId = usersSnapshot.docs[0].id;
                    }
                }
                if (customerId) {
                    const userDoc = await db.collection('users').doc(customerId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        paymentMethod = userData.paymentMethod || '';
                    }
                }
            } catch (err) {
                console.error('Error fetching user payment method:', err);
            }

            if (!paymentMethod) {
                alert('No payment method found for this user.');
                return;
            }

            // Set the payment method in the modal (for display)
            if (paymentMethodInput) paymentMethodInput.value = paymentMethod;

            const db = window.firebase.firestore();
            try {
                // Update payment status in Firestore with paymentMethod and price
                await db.collection('bookings').doc(appointment.serviceId).update({
                    paymentStatus: 'Paid',
                    paymentMethod: paymentMethod,
                    price: amount,
                    paidAt: window.firebase.firestore.FieldValue.serverTimestamp()
                });

                // Local/UI updates after successful DB update
                appointment.paymentStatus = 'Paid';
                appointment.paymentMethod = paymentMethod;
                appointment.price = amount;
                row.dataset.paymentStatus = 'Paid';

                const paymentCell = row.querySelector('td:nth-last-child(2)');
                if (paymentCell) paymentCell.innerHTML = `<span class="payment-status-badge paid">Paid</span>`;

                if (typeof showSuccessToast === 'function') {
                    showSuccessToast(`Appointment ${appointment.serviceId} marked as paid with ${paymentMethod}.`);
                }

                // Remove the mark paid button
                const markPaidBtn = row.querySelector('.mark-paid-btn');
                if (markPaidBtn) markPaidBtn.remove();

                // Send notification to mobile app user
                if (typeof sendPaymentReceivedNotification === 'function') {
                    sendPaymentReceivedNotification(appointment);
                }

                // Close the modal
                if (modalOverlay) {
                    modalOverlay.style.display = 'none';
                }

                // Reset form
                paymentForm.reset();
                window.pendingPaymentAppointment = null;
                window.pendingPaymentRow = null;

            } catch (err) {
                console.error('Error updating payment status:', err);
                if (typeof showSuccessToast === 'function') {
                    showSuccessToast('Failed to process payment (database error).', 'error');
                } else {
                    alert('Failed to process payment (database error).');
                }
            }
        });
    }

    if (paymentCancelBtn) {
        paymentCancelBtn.addEventListener('click', () => {
            if (modalOverlay) {
                modalOverlay.style.display = 'none';
            }
            const paymentForm = document.getElementById('payment-form');
            if (paymentForm) {
                paymentForm.reset();
            }
            window.pendingPaymentAppointment = null;
            window.pendingPaymentRow = null;
        });
    }

    // Cancel flow has been moved to a dedicated page (`cancel-appointment.html`).
    // The old modal-based cancel logic was removed. When a cancel button is clicked
    // the code now navigates to the cancel page and stores the selected appointment
    // in sessionStorage under the key `appointmentToCancel` for the cancel page to handle.

    // Close modal when clicking outside of it
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.style.display = 'none';
                const paymentForm = document.getElementById('payment-form');
                if (paymentForm) {
                    paymentForm.reset();
                }
                window.pendingPaymentAppointment = null;
                window.pendingPaymentRow = null;
            }
        });
    }

    // --- Cancelled Appointments Table ---
    const cancelledContainer = document.getElementById('cancelled-appointments-table');
    const cancelledTableBody = cancelledContainer?.querySelector('tbody');
    let cancelledSearchTerm = '';

    function renderCancelledTable() {
        if (!cancelledTableBody) return;

        // Combine cancelled appointments and cancelled walk-ins
        const cancelledAppointments = (window.appData.appointments || [])
            .filter(a => String(a.status || '').toLowerCase() === 'cancelled' || String(a.status || '') === 'Cancelled')
            .map(a => ({
                ...a,
                customer: a.customer || a.customerName || a.fullName || a.carName || a.plate || 'N/A',
                service: a.service || a.serviceNames || a.serviceName || '',
                datetime: a.datetime || (a.datetimeRaw ? new Date(a.datetimeRaw).toLocaleString() : (a.cancelledAt ? new Date(a.cancelledAt.toDate ? a.cancelledAt.toDate() : a.cancelledAt).toLocaleString() : '')),
                cancellationReason: a.cancellationReason || '',
                cancellationNotes: a.cancellationNotes || '',
                cancelledAt: a.cancelledAt || ''
            }));

        const cancelledWalkins = (window.appData.walkins || [])
            .filter(w => String(w.status || '').toLowerCase() === 'cancelled' || String(w.status || '') === 'Cancelled')
            .map(w => ({
                serviceId: w.id || w.serviceId || '',
                customer: w.customer || w.customerName || w.fullName || w.carName || w.plate || 'Walk-in',
                service: w.service || w.serviceNames || '',
                datetime: w.datetime || (w.datetimeRaw ? new Date(w.datetimeRaw).toLocaleString() : (w.cancelledAt ? new Date(w.cancelledAt.toDate ? w.cancelledAt.toDate() : w.cancelledAt).toLocaleString() : '')),
                cancellationReason: w.cancellationReason || '',
                cancellationNotes: w.cancellationNotes || '',
                cancelledAt: w.cancelledAt || ''
            }));

        const cancelled = [...cancelledAppointments, ...cancelledWalkins];

        // Apply search filter
        const filtered = cancelled.filter(a => {
            const term = cancelledSearchTerm.toLowerCase();
            if (!term) return true;
            return (a.serviceId || '').toLowerCase().includes(term) ||
                   (a.customer || '').toLowerCase().includes(term) ||
                   (a.service || '').toLowerCase().includes(term) ||
                   (a.cancellationReason || '').toLowerCase().includes(term) ||
                   (a.cancellationNotes || '').toLowerCase().includes(term);
        });

        cancelledTableBody.innerHTML = '';

        if (filtered.length === 0) {
            const tr = document.createElement('tr');
            tr.classList.add('no-results-row');
            tr.innerHTML = `<td colspan="8" class="text-center text-muted">No cancelled appointments found.</td>`;
            cancelledTableBody.appendChild(tr);
            return;
        }

        filtered.forEach(a => {
            const row = document.createElement('tr');
            const cancelledAt = a.cancelledAt ? (new Date(a.cancelledAt)).toLocaleString() : 'N/A';
            row.innerHTML = `
                <td>${a.serviceId}</td>
                <td>${a.customer || 'N/A'}</td>
                <td>${a.service || 'N/A'}</td>
                <td>${a.datetime || 'N/A'}</td>
                <td>${a.cancellationReason || 'N/A'}</td>
                <td class="text-center">
                    <button class="action-icon-btn view-cancel-btn" data-id="${a.serviceId}" title="View"><span class="material-symbols-outlined">visibility</span></button>
                    <button class="action-icon-btn reinstate-btn" data-id="${a.serviceId}" title="Reinstate"><span class="material-symbols-outlined">restore</span></button>
                </td>
            `;
            cancelledTableBody.appendChild(row);
        });
    }

    const cancelledSearchInput = document.getElementById('cancelled-appointment-search');
    if (cancelledSearchInput) {
        cancelledSearchInput.addEventListener('input', (e) => {
            cancelledSearchTerm = e.target.value || '';
            renderCancelledTable();
        });
    }

    const cancelledTableEl = document.querySelector('#cancelled-appointments-table tbody');
    if (cancelledTableEl) {
        cancelledTableEl.addEventListener('click', async (e) => {
            const viewBtn = e.target.closest('.view-cancel-btn');
            const reinstateBtn = e.target.closest('.reinstate-btn');
            if (viewBtn) {
                const id = viewBtn.dataset.id;
                const appointment = (window.appData.appointments || []).find(a => a.serviceId === id);
                if (appointment) {
                    sessionStorage.setItem('previousPage', window.location.href);
                    sessionStorage.setItem('selectedAppointmentData', JSON.stringify(appointment));
                    window.location.href = 'appointment-details.html';
                }
            }

            if (reinstateBtn) {
                const id = reinstateBtn.dataset.id;
                if (!confirm('Reinstate this appointment? This will set the appointment status back to Pending.')) return;
                try {
                    const db = window.firebase.firestore();
                    await db.collection('bookings').doc(id).update({
                        status: 'Pending',
                        cancelledAt: window.firebase.firestore.FieldValue.delete(),
                        cancellationReason: window.firebase.firestore.FieldValue.delete(),
                        cancellationNotes: window.firebase.firestore.FieldValue.delete()
                    });
                    // Update local model
                    window.appData.appointments = (window.appData.appointments || []).map(a => a.serviceId === id ? ({ ...a, status: 'Pending', cancelledAt: null, cancellationReason: null, cancellationNotes: null }) : a);
                    renderCancelledTable();
                    populateAppointmentsTable();
                    updateAppointmentPageStats();
                    if (typeof showSuccessToast === 'function') showSuccessToast('Appointment reinstated.');
                } catch (err) {
                    console.error('Error reinstating appointment:', err);
                    if (typeof showSuccessToast === 'function') showSuccessToast('Failed to reinstate appointment.', 'error');
                }
            }
        });
    }

    // --- Archived Appointments Table ---
    // Fetch archived documents from Firestore and populate window.appData
    async function fetchArchivedFromFirestore() {
        try {
            const db = window.firebase.firestore();
            // Order by archivedAt if available so newest appear first
            const [archivedBookingsSnapshot, archivedWalkinsSnapshot] = await Promise.all([
                db.collection('archived_bookings').orderBy('archivedAt', 'desc').get(),
                db.collection('archived_walkins').orderBy('archivedAt', 'desc').get()
            ]);

            window.appData.archivedBookings = archivedBookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            window.appData.archivedWalkins = archivedWalkinsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.debug('Could not fetch archived collections from Firestore:', err);
            window.appData.archivedBookings = window.appData.archivedBookings || [];
            window.appData.archivedWalkins = window.appData.archivedWalkins || [];
        }
    }
    const archivedContainer = document.getElementById('archived-appointments-table');
    const archivedTableBody = archivedContainer?.querySelector('tbody');
    let archivedSearchTerm = '';

    function renderArchivedTable() {
        if (!archivedTableBody) return;

        const archivedBookings = (window.appData.archivedBookings || []).map(b => ({
            serviceId: b.id || b.serviceId || '',
            customer: b.customer || b.customerName || b.fullName || b.carName || b.plate || '',
            service: b.serviceNames || b.service || b.serviceName || '',
            datetime: b.datetime || (b.datetimeRaw ? new Date(b.datetimeRaw).toLocaleString() : (b.archivedAt ? new Date(b.archivedAt.toDate ? b.archivedAt.toDate() : b.archivedAt).toLocaleString() : '')),
            price: b.price || '',
            archivedAt: b.archivedAt || b.paidAt || ''
        }));

        const archivedWalkins = (window.appData.archivedWalkins || []).map(w => ({
            serviceId: w.id || w.serviceId || '',
            customer: w.customer || w.carName || w.plate || 'Walk-in',
            service: w.service || w.serviceNames || '',
            datetime: w.datetime || (w.datetimeRaw ? new Date(w.datetimeRaw).toLocaleString() : ''),
            price: w.price || '',
            archivedAt: w.archivedAt || w.paidAt || ''
        }));

        const combined = [...archivedBookings, ...archivedWalkins];

        const filtered = combined.filter(a => {
            const term = archivedSearchTerm.toLowerCase();
            if (!term) return true;
            return (a.serviceId || '').toLowerCase().includes(term) ||
                   (a.customer || '').toLowerCase().includes(term) ||
                   (a.service || '').toLowerCase().includes(term) ||
                   (String(a.price || '')).toLowerCase().includes(term);
        });

        // Pagination
        const totalPages = Math.max(1, Math.ceil(filtered.length / archivedRowsPerPage));
        archivedCurrentPage = Math.max(1, Math.min(archivedCurrentPage, totalPages));
        const startIndex = (archivedCurrentPage - 1) * archivedRowsPerPage;
        const endIndex = startIndex + archivedRowsPerPage;
        const paginated = filtered.slice(startIndex, endIndex);

        archivedTableBody.innerHTML = '';

        if (paginated.length === 0) {
            const tr = document.createElement('tr');
            tr.classList.add('no-results-row');
            tr.innerHTML = `<td colspan="7" class="text-center text-muted">No archived services found.</td>`;
            archivedTableBody.appendChild(tr);
        }

        paginated.forEach(a => {
            const row = document.createElement('tr');
            const archivedAtStr = a.archivedAt ? (typeof a.archivedAt === 'string' ? a.archivedAt : (a.archivedAt.toDate ? a.archivedAt.toDate().toLocaleString() : new Date(a.archivedAt).toLocaleString())) : 'N/A';
            row.innerHTML = `
                <td>${a.serviceId}</td>
                <td>${a.customer || 'N/A'}</td>
                <td>${a.service || 'N/A'}</td>
                <td>${a.datetime || 'N/A'}</td>
                <td>${a.price || 'N/A'}</td>
                <td>${archivedAtStr}</td>
                <td class="text-center">
                    <button class="action-icon-btn view-archive-btn" data-id="${a.serviceId}" title="View">
                        <span class="material-symbols-outlined">visibility</span>
                    </button>
                    <button class="action-icon-btn leave-review-btn" data-id="${a.serviceId}" title="Leave Review">
                        <span class="material-symbols-outlined">rate_review</span>
                    </button>
                </td>
            `;
            archivedTableBody.appendChild(row);
        });

        // Update pagination controls
        const paginationContainer = document.querySelector('#archived-appointments-table .table-pagination');
        if (paginationContainer) {
            const pageInfo = paginationContainer.querySelector('.page-info');
            const prevBtn = paginationContainer.querySelector('[data-action="prev"]');
            const nextBtn = paginationContainer.querySelector('[data-action="next"]');
            pageInfo.textContent = `Page ${archivedCurrentPage} of ${totalPages || 1}`;
            if (prevBtn) prevBtn.disabled = archivedCurrentPage === 1;
            if (nextBtn) nextBtn.disabled = archivedCurrentPage === totalPages;
        }
    }

    const archivedSearchInput = document.getElementById('archived-appointment-search');
    if (archivedSearchInput) {
        archivedSearchInput.addEventListener('input', (e) => {
            archivedSearchTerm = e.target.value || '';
            renderArchivedTable();
        });
    }

    const archivedTableEl = document.querySelector('#archived-appointments-table tbody');
    if (archivedTableEl) {
        archivedTableEl.addEventListener('click', (e) => {
            const viewBtn = e.target.closest('.view-archive-btn');
            const reviewBtn = e.target.closest('.leave-review-btn');
            if (viewBtn) {
                const id = viewBtn.dataset.id;
                // Try to find in archived bookings first, then archived walkins
                const appt = (window.appData.archivedBookings || []).find(a => (a.id || a.serviceId) === id) || (window.appData.archivedWalkins || []).find(w => (w.id || w.serviceId) === id);
                if (appt) {
                    sessionStorage.setItem('previousPage', window.location.href);
                    sessionStorage.setItem('selectedAppointmentData', JSON.stringify(appt));
                    // Use appointment details page for viewing archived items
                    window.location.href = 'appointment-details.html';
                }
            }
            if (reviewBtn) {
                const id = reviewBtn.dataset.id;
                // Try to find in archived bookings first, then archived walkins
                const appt = (window.appData.archivedBookings || []).find(a => (a.id || a.serviceId) === id) || (window.appData.archivedWalkins || []).find(w => (w.id || w.serviceId) === id);
                if (appt) {
                    sessionStorage.setItem('previousPage', window.location.href);
                    sessionStorage.setItem('selectedAppointmentData', JSON.stringify(appt));
                    // Redirect to a review submission page (or open a modal if you have one)
                    window.location.href = 'review-details.html?leaveReview=1';
                }
            }
        });
    }
});