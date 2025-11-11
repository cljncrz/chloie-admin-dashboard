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
                return acc;
             }, { total: 0, pending: 0, inProgress: 0, completed: 0, cancelled: 0 });

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
    window.appData.createTechnicianDropdown = (selectedTechnician) => {
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

        return `<select class="technician-select">${options}</select>`;
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
                const db = firebase.firestore();
                // Fetch bookings and technicians simultaneously for better performance
                const [bookingsSnapshot, techniciansSnapshot] = await Promise.all([
                    db.collection('bookings').get(),
                    db.collection('technicians').get()
                ]);

                // Process and store technicians data globally
                window.appData.technicians = techniciansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Process bookings data
                if (bookingsSnapshot.empty) {
                    const noResultsRow = mainAppointmentsContainer.querySelector('.no-results-row');
                    if (noResultsRow) noResultsRow.style.display = 'table-row';
                    console.log('No booking documents found in Firestore.');
                    return;
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

                    const possibleDateFields = ['scheduleDate', 'dateTime', 'datetime', 'date', 'scheduledAt', 'appointmentDate', 'timestamp', 'bookingDate'];
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

                    const formattedDateTime = scheduleDateObj
                        ? scheduleDateObj.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(',', ' -')
                        : 'No Date';

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

                // Initial population of tables
                populateAppointmentsTable();
                populateWalkinsTable(); // Assuming walk-ins might also come from bookings or a separate fetch
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

            let filteredAppointments = appointments.filter(appt => {
                const matchesSearch = searchTerm === '' ||
                    Object.values(appt).some(val => String(val).toLowerCase().includes(searchTerm));
                const matchesStatus = selectedStatus === 'all' || appt.status.toLowerCase() === selectedStatus;
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
                // Add data attributes for modal functionality if needed later
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

                // Conditionally add action buttons based on status
                let actionButtons = '';
                if (appt.status === 'Pending') {
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

                const technicianDropdown = window.appData.createTechnicianDropdown(appt.technician);

                const paymentStatus = appt.paymentStatus || 'Unpaid'; // Default to 'Unpaid' if undefined
                const paymentStatusClass = paymentStatus.toLowerCase();
                const paymentBadge = `<span class="payment-status-badge ${paymentStatusClass}">${paymentStatus}</span>`;

                let paymentActionButton = '';
                if (paymentStatus === 'Unpaid') {
                    paymentActionButton = `
                        <button class="action-icon-btn mark-paid-btn" title="Mark as Paid">
                            <span class="material-symbols-outlined">payments</span>
                        </button>`;
                }
                row.innerHTML = `
                    <td>${appt.serviceId}</td>
                    <td>${appt.plate}</td>
                    <td>${appt.carName}</td>
                    <td>${appt.carType}</td>
                    <td>${appt.serviceNames}</td>
                    <td>${appt.datetime}</td>
                    <td>${appt.price}</td>
                    <td>${technicianDropdown}</td>
                    <td class="text-center"><span class="${statusClass}">${appt.status}</span></td>
                    <td class="text-center">${paymentBadge}</td>
                    <td class="text-center">
                        ${actionButtons}
                        ${paymentActionButton}
                        <button class="action-icon-btn cancel-btn" title="Cancel Appointment">
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
            let filteredWalkins = walkins.filter(walkin => {
                const matchesSearch = searchTerm === '' ||
                    Object.values(walkin).some(val => String(val).toLowerCase().includes(searchTerm));
                const matchesStatus = selectedStatus === 'all' || walkin.status.toLowerCase() === selectedStatus;
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

                const technicianDropdown = window.appData.createTechnicianDropdown(walkin.technician);

                const paymentStatusClass = walkin.paymentStatus.toLowerCase();
                const paymentBadge = `<span class="payment-status-badge ${paymentStatusClass}">${walkin.paymentStatus}</span>`;

                let paymentActionButton = '';
                if (walkin.paymentStatus === 'Unpaid') {
                    paymentActionButton = `
                        <button class="action-icon-btn mark-paid-btn" title="Mark as Paid">
                            <span class="material-symbols-outlined">payments</span>
                        </button>`;
                }
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
                        <button class="action-icon-btn cancel-btn" title="Cancel Appointment">
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
            const statuses = ['All', 'Pending', 'In Progress', 'Completed', 'Cancelled'];
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
            appointmentTableBody.addEventListener('click', (e) => {
                const cancelButton = e.target.closest('.cancel-btn');
                const startServiceButton = e.target.closest('.start-service-btn');
                const completeServiceButton = e.target.closest('.complete-service-btn');
                const markPaidButton = e.target.closest('.mark-paid-btn');
                const technicianSelect = e.target.closest('.technician-select');
                const isActionButtonClick = startServiceButton || completeServiceButton || cancelButton || markPaidButton || technicianSelect;
                const row = e.target.closest('tr');

                if (!row || row.classList.contains('no-results-row')) return;

                if (startServiceButton) {
                    const appointments = window.appData.appointments || [];
                    const appointment = appointments.find(a => a.serviceId === row.dataset.serviceId);

                    if (appointment && appointment.status === 'Pending') {
                        const startTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); // prettier-ignore
                        appointment.status = 'In Progress';
                        appointment.startTime = startTime;
                        row.dataset.status = 'In Progress';
                        row.dataset.startTime = startTime;
                        const statusCell = row.querySelector('td:nth-last-child(3)'); // The 3rd cell from the end is Status
                        statusCell.innerHTML = `<span class="in-progress">In Progress</span>`;

                        // Show success toast
                        // If the task was 'Pending', starting it now officially assigns it and increases the count.
                        // We check for 'Pending' to avoid double-counting if the status was changed differently.
                        if (originalStatus === 'Pending') increaseTechnicianTaskCount(appointment.technician);

                        updateAppointmentPageStats(); // Refresh stats
                        if (typeof showSuccessToast === 'function') showSuccessToast(`Service for ${appointment.customer} has started.`);

                        // Replace the start button with a complete button
                        const actionsCell = startServiceButton.parentElement;
                        startServiceButton.remove();
                        actionsCell.insertAdjacentHTML('afterbegin', `
                            <button class="action-icon-btn complete-service-btn" title="Complete Service">
                                <span class="material-symbols-outlined">check</span>
                            </button>
                        `);
                    }
                    return;
                }

                if (completeServiceButton) {
                    const appointments = window.appData.appointments || [];
                    const appointment = appointments.find(a => a.serviceId === row.dataset.serviceId);

                    if (appointment && appointment.status === 'In Progress') {
                        appointment.status = 'Completed';
                        row.dataset.status = 'Completed';
                        const statusCell = row.querySelector('td:nth-last-child(3)'); // The 3rd cell from the end is Status
                        statusCell.innerHTML = `<span class="completed">Completed</span>`;

                        if (typeof showSuccessToast === 'function') showSuccessToast(`Service for ${appointment.customer} is complete.`);
                        updateAppointmentPageStats(); // Refresh stats
                        completeServiceButton.remove();

                        // Decrease the technician's task count
                        decreaseTechnicianTaskCount(appointment.technician);
                    }
                    return;
                }

                if (cancelButton) {
                    // Find the appointment in the data array and update its status
                    const appointments = window.appData.appointments || [];
                    const appointment = appointments.find(a => a.serviceId === row.dataset.serviceId);

                    if (appointment) {
                        const originalStatus = appointment.status;

                        // Update status in data model
                        appointment.status = 'Cancelled';
                        row.dataset.status = 'Cancelled';

                        // Update status in UI
                        const statusCell = row.querySelector('td:nth-last-child(3)'); // The 3rd cell from the end is Status
                        statusCell.innerHTML = `<span class="cancelled">Cancelled</span>`;

                        // If it was a pending or in-progress task, free up the technician
                        if (originalStatus === 'Pending' || originalStatus === 'In Progress') {
                            decreaseTechnicianTaskCount(appointment.technician);
                        }

                        // Re-render the table to reflect filter/sort changes if needed
                        // Just re-render the table with current filters
                        updateAppointmentPageStats(); // Refresh stats
                        populateAppointmentsTable();
                    } 
                    return;
                }

                if (markPaidButton) {
                    const appointments = window.appData.appointments || [];
                    const appointment = appointments.find(a => a.serviceId === row.dataset.serviceId);

                    if (appointment && appointment.paymentStatus === 'Unpaid') {
                        appointment.paymentStatus = 'Paid';
                        row.dataset.paymentStatus = 'Paid';

                        const paymentCell = row.querySelector('td:nth-last-child(2)');
                        paymentCell.innerHTML = `<span class="payment-status-badge paid">Paid</span>`;

                        if (typeof showSuccessToast === 'function') showSuccessToast(`Appointment ${appointment.serviceId} marked as paid.`);
                        
                        // Remove the button after it's clicked
                        markPaidButton.remove();
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
            walkinTableBody.addEventListener('click', (e) => {
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
                        const startTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); // prettier-ignore
                        walkin.status = 'In Progress';
                        walkin.startTime = startTime;
                        row.dataset.status = 'In Progress';
                        row.dataset.startTime = startTime; // prettier-ignore
                        const statusCell = row.querySelector('td:nth-last-child(3)'); // The 3rd cell from the end is Status
                        statusCell.innerHTML = `<span class="in-progress">In Progress</span>`;

                        // If the task was 'Pending', starting it now officially assigns it and increases the count.
                        // We check for 'Pending' to avoid double-counting if the status was changed differently.
                        if (originalStatus === 'Pending') increaseTechnicianTaskCount(walkin.technician);

                        updateAppointmentPageStats(); // Refresh stats
                        // Show success toast
                        if (typeof showSuccessToast === 'function') showSuccessToast(`Service for walk-in ${walkin.plate} has started.`);

                        // Replace the start button with a complete button
                        const actionsCell = startServiceButton.parentElement;
                        startServiceButton.remove();
                        actionsCell.insertAdjacentHTML('afterbegin', `
                            <button class="action-icon-btn complete-service-btn" title="Complete Service">
                                <span class="material-symbols-outlined">check</span>
                            </button>
                        `);
                    }
                    return;
                }

                if (completeServiceButton) {
                    const walkins = window.appData.walkins || [];
                    const walkin = walkins.find(w => w.plate === row.dataset.plate && w.service === row.dataset.service);

                    if (walkin && walkin.status === 'In Progress') {
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

                    if (walkin && walkin.paymentStatus === 'Unpaid') {
                        walkin.paymentStatus = 'Paid';
                        row.dataset.paymentStatus = 'Paid';

                        const paymentCell = row.querySelector('td:nth-last-child(2)');
                        paymentCell.innerHTML = `<span class="payment-status-badge paid">Paid</span>`;

                        if (typeof showSuccessToast === 'function') showSuccessToast(`Walk-in for ${walkin.plate} marked as paid.`);
                        
                        // Remove the button after it's clicked
                        markPaidButton.remove();
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
                appointment.technician = newTechnicianName;
                row.dataset.technician = newTechnicianName;

                try { // Add try...catch for the database operation
                    // --- Firestore Update ---
                    const db = firebase.firestore();
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
            });

            // Walk-ins Table
            const walkinContainer = document.getElementById('walk-in-appointments-table-container');
            walkinContainer.querySelector('#walkin-appointment-search').addEventListener('input', () => { walkinCurrentPage = 1; populateWalkinsTable(); });
            walkinContainer.querySelector('.status-filter')?.addEventListener('change', () => { walkinCurrentPage = 1; populateWalkinsTable(); });
            walkinContainer.querySelector('.table-pagination [data-action="prev"]').addEventListener('click', () => { if (walkinCurrentPage > 1) { walkinCurrentPage--; populateWalkinsTable(); } });
            walkinContainer.querySelector('.table-pagination [data-action="next"]').addEventListener('click', () => { walkinCurrentPage++; populateWalkinsTable(); });

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
                walkin.technician = newTechnicianName;
                row.dataset.technician = newTechnicianName;

                try { // Add try...catch for the database operation
                    // --- Firestore Update ---
                    const db = firebase.firestore();
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
            fetchAndPopulateAppointments(); // Fetch data from Firestore on initial load
            updateAppointmentPageStats(); // Call the new function to update stats
            if (typeof window.initializeTableFunctionality === 'function') {
                window.initializeTableFunctionality('#main-appointments-table');
                window.initializeTableFunctionality('#walk-in-appointments-table');
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
});