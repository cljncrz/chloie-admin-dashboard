document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to initialize
    await window.firebaseInitPromise;

    const schedulerContainer = document.querySelector('.scheduler-container');
    if (!schedulerContainer) return;

    // --- DOM Elements ---
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const calendarDays = document.getElementById('calendar-days');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const timeSlotsContainer = document.getElementById('time-slots-container');
    const timeSlotsDate = document.getElementById('time-slots-date');
    const queueList = document.getElementById('queue-list');
    const bookNewAppointmentBtn = document.getElementById('book-new-appointment-btn');
    if (bookNewAppointmentBtn) {
        bookNewAppointmentBtn.style.display = 'none';
    }

    // --- Modal Elements ---
    const modalOverlay = document.getElementById('modal-overlay');
    const bookingModalContent = document.getElementById('book-appointment-content');
    const customerSearchInput = document.getElementById('booking-customer-search');
    const serviceSearchInput = document.getElementById('booking-service-search');
    const serviceOptionsContainer = document.getElementById('booking-service-options');
    const customerOptionsContainer = document.getElementById('booking-customer-options');
    const bookingCustomerSelect = document.getElementById('booking-customer-select');
    const bookingServiceSelect = document.getElementById('booking-service-select');
    const selectedBookingTimeEl = document.getElementById('selected-booking-time');
    const bookingCancelBtn = document.getElementById('booking-cancel-btn');
    const vehicleInfoContainer = document.getElementById('booking-vehicle-info-container');
    const vehicleInfoDisplay = document.getElementById('booking-vehicle-info');

    // --- Reschedule Elements ---
    const rescheduleListContainer = document.getElementById('reschedule-requests-list');

    // --- State ---
    let currentDate = new Date();
    let selectedDate = new Date();
    // Only use scheduled appointments, as walk-ins do not have a datetime for the calendar.
    let appointments = [...(window.appData.appointments || [])];
    let selectedTimeSlot = null;
    let reschedulingAppointment = null; // Holds the appointment being rescheduled
     const pendingApprovalsBadge = document.getElementById('pending-approvals-badge');
    const pendingApprovalsList = document.getElementById('pending-approvals-list');

    // --- Pending Approvals Logic ---
    const updatePendingApprovalsCount = () => {
        const pendingAppointments = (window.appData.appointments || []).filter(appt => appt.status === 'Pending');
        const rescheduleRequests = (window.appData.rescheduleRequests || []).filter(req => req.status === 'Pending');
        const totalPending = pendingAppointments.length + rescheduleRequests.length;

        if (pendingApprovalsBadge) {
            pendingApprovalsBadge.textContent = totalPending;
            pendingApprovalsBadge.style.display = totalPending > 0 ? 'inline-flex' : 'none';
        }
    };

    const renderPendingApprovalsModalContent = () => {
        if (!pendingApprovalsList) return;

        const pendingAppointments = (window.appData.appointments || []).filter(appt => appt.status === 'Pending');
        const rescheduleRequests = (window.appData.rescheduleRequests || []).filter(req => req.status === 'Pending');

        pendingApprovalsList.innerHTML = ''; // Clear previous content
        const fragment = document.createDocumentFragment();

        if (pendingAppointments.length === 0 && rescheduleRequests.length === 0) {
            pendingApprovalsList.innerHTML = '<p class="no-items text-muted" style="text-align: center; padding: 1rem;">No items requiring approval.</p>';
            updatePendingApprovalsCount(); // Update badge to 0
            return;
        }

        // Add Pending Appointments
        pendingAppointments.forEach(appt => {
            const itemEl = document.createElement('div');
            itemEl.classList.add('approval-item');
            itemEl.dataset.type = 'appointment';
            itemEl.dataset.id = appt.serviceId;

            // Create the technician dropdown. 'Unassigned' is the default.
            // The dropdown will be populated with active technicians.
            const technicianDropdownHTML = window.appData.createTechnicianDropdown('Unassigned');

            itemEl.innerHTML = `
                <div class="item-details">
                    <p><b>New Booking:</b> ${appt.customer} for ${appt.service}</p>
                    <small class="text-muted">${appt.datetime}</small>
                </div>
                <div class="item-assignment">
                    ${technicianDropdownHTML}
                </div>
                <div class="item-actions">
                    <button class="btn-primary-outline approve-appt-btn" data-id="${appt.serviceId}" disabled>Approve</button>
                    <button class="btn-danger-outline deny-appt-btn" data-id="${appt.serviceId}">Deny</button>
                </div>
            `;
            fragment.appendChild(itemEl);
        });

        // Add Reschedule Requests
        rescheduleRequests.forEach(req => {
            const itemEl = document.createElement('div');
            itemEl.classList.add('approval-item');
            itemEl.dataset.type = 'reschedule';
            itemEl.dataset.id = req.requestId;
            itemEl.innerHTML = `
                <div class="item-details">
                    <p><b>Reschedule Request:</b> ${req.customer} for ${req.service}</p>
                    <small class="text-muted">Original: ${new Date(req.originalDatetime.seconds * 1000).toLocaleString()} &bull; Reason: ${req.reason}</small>
                </div>
                <div class="item-actions">
                    <button class="btn-primary-outline review-reschedule-btn" data-request-id="${req.requestId}" data-service-id="${req.serviceId}">Review & Reschedule</button>
                    <button class="btn-danger-outline deny-reschedule-btn" data-request-id="${req.requestId}" data-service-id="${req.serviceId}">Deny</button>
                </div>
            `;
            fragment.appendChild(itemEl);
        });

        pendingApprovalsList.appendChild(fragment);
        updatePendingApprovalsCount(); // Update badge after rendering

        // Add event listeners for the new dropdowns
        pendingApprovalsList.querySelectorAll('.technician-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const approvalItem = e.target.closest('.approval-item');
                const approveBtn = approvalItem.querySelector('.approve-appt-btn');
                
                // Enable the 'Approve' button only if a technician other than "Unassigned" is selected.
                if (e.target.value && e.target.value !== 'Unassigned') {
                    approveBtn.disabled = false;
                } else {
                    approveBtn.disabled = true;
                }
            });
        });
    };
    window.renderPendingApprovalsModalContent = renderPendingApprovalsModalContent; // Expose globally

    // --- Handle Actions within the Pending Approvals Modal ---
    if (pendingApprovalsList) {
        pendingApprovalsList.addEventListener('click', async (e) => {
            const approveBtn = e.target.closest('.approve-appt-btn');
            const denyBtn = e.target.closest('.deny-appt-btn');
            const reviewBtn = e.target.closest('.review-reschedule-btn');

            if (approveBtn) {
                approveBtn.disabled = true; // Prevent double clicks
                const itemEl = approveBtn.closest('.approval-item');
                const serviceId = approveBtn.dataset.id;
                const technicianSelect = itemEl.querySelector('.technician-select');
                const selectedTechnician = technicianSelect.value;

                // Find the appointment in the global data
                const appointment = (window.appData.appointments || []).find(a => a.serviceId === serviceId);

                if (!appointment) {
                    alert('Error: Could not find the appointment to approve.');
                    approveBtn.disabled = false;
                    return;
                }

                try {
                    const db = window.firebase.firestore();
                    // Update the booking in Firestore with the new status and technician
                    await db.collection('bookings').doc(serviceId).update({
                        status: 'Approved', // Or 'Scheduled', depending on your workflow
                        technician: selectedTechnician
                    });

                    // Update the local data model
                    appointment.status = 'Approved';
                    appointment.technician = selectedTechnician;

                    // Remove the item from the modal and update counts
                    itemEl.remove();
                    updatePendingApprovalsCount();

                    // Send notification to customer about approval
                    try {
                        if (typeof NotificationService !== 'undefined') {
                            await NotificationService.notifyAppointmentConfirmed(
                                appointment.customerId || appointment.customer,
                                {
                                    id: serviceId,
                                    serviceName: appointment.service,
                                    dateTime: appointment.datetime,
                                    technician: selectedTechnician
                                }
                            );
                            NotificationService.showToast(
                                `Notification sent to ${appointment.customer}`,
                                'success'
                            );
                        }
                    } catch (notifError) {
                        console.warn('⚠️ Could not send notification, but appointment was approved:', notifError);
                    }

                    // Optionally, update the main appointments table if it's on the same page
                    // This is more complex and might be better handled by a page reload or a more robust state management system.

                    if (typeof showSuccessToast === 'function') {
                        showSuccessToast(`Appointment for ${appointment.customer} approved and assigned to ${selectedTechnician}.`);
                    }

                } catch (error) {
                    console.error("Error approving appointment:", error);
                    alert('Failed to approve appointment. Please try again.');
                    approveBtn.disabled = false; // Re-enable button on failure
                }
            }

            if (denyBtn) {
                denyBtn.disabled = true; // Prevent double clicks
                const itemEl = denyBtn.closest('.approval-item');
                const serviceId = denyBtn.dataset.id;

                // Find the appointment in the global data
                const appointment = (window.appData.appointments || []).find(a => a.serviceId === serviceId);

                if (!appointment) {
                    alert('Error: Could not find the appointment to deny.');
                    denyBtn.disabled = false;
                    return;
                }

                try {
                    const db = window.firebase.firestore();
                    // Update the booking status to Denied
                    await db.collection('bookings').doc(serviceId).update({
                        status: 'Denied'
                    });

                    // Update the local data model
                    appointment.status = 'Denied';

                    // Remove the item from the modal and update counts
                    itemEl.remove();
                    updatePendingApprovalsCount();

                    // Send notification to customer about denial
                    try {
                        if (typeof NotificationService !== 'undefined') {
                            await NotificationService.notifyAppointmentCancelled(
                                appointment.customerId || appointment.customer,
                                {
                                    id: serviceId,
                                    serviceName: appointment.service,
                                    reason: 'Your appointment request was not approved'
                                }
                            );
                            NotificationService.showToast(
                                `Cancellation notification sent to ${appointment.customer}`,
                                'info'
                            );
                        }
                    } catch (notifError) {
                        console.warn('⚠️ Could not send notification, but appointment was denied:', notifError);
                    }

                    if (typeof showSuccessToast === 'function') {
                        showSuccessToast(`Appointment for ${appointment.customer} denied.`);
                    }

                } catch (error) {
                    console.error("Error denying appointment:", error);
                    alert('Failed to deny appointment. Please try again.');
                    denyBtn.disabled = false; // Re-enable button on failure
                }
            }

            // Note: Handlers for reviewBtn can be added here as well
            // for better event delegation, but we'll leave them as is for now
            // to stick to the user's request.
        });
    }


    /**
     * Robustly parses the custom datetime string from your data file.
     * Format: "Oct 28, 2025 - 2:00 PM"
     * @param {string} dateTimeString - The date string to parse.
     * @returns {Date|null} A Date object or null if parsing fails.
     */
    const parseCustomDate = (dateTimeString) => {
        if (!dateTimeString) return null;
        // The string format is parsable by the Date constructor in modern browsers,
        // but this approach is safer if the format ever becomes more complex.
        const date = new Date(dateTimeString.replace(' - ', ' '));
        return isNaN(date) ? null : date;
        
    };

    // --- Calendar Logic ---
    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        calendarMonthYear.textContent = `${currentDate.toLocaleString('default', { month: 'long' })} ${year}`;

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        calendarDays.innerHTML = '';
        const fragment = document.createDocumentFragment();

        // Add empty cells for days before the 1st of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.classList.add('calendar-day', 'empty');
            fragment.appendChild(emptyCell);
        }

        // Add days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            const dayCell = document.createElement('div');
            dayCell.classList.add('calendar-day');
            dayCell.textContent = i;
            dayCell.dataset.day = i;

            const today = new Date();
            const cellDate = new Date(year, month, i);

            if (
                i === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear()
            ) {
                dayCell.classList.add('today');
            }

            if (
                i === selectedDate.getDate() &&
                month === selectedDate.getMonth() &&
                year === selectedDate.getFullYear()
            ) {
                dayCell.classList.add('selected');
            }

           // Check if there are appointments on this day
            const appointmentsOnDay = appointments.filter(appt => {
                const apptDate = window.appData.parseCustomDate(appt.datetime);
                return apptDate &&
                       apptDate.getFullYear() === year &&
                       apptDate.getMonth() === month &&
                       apptDate.getDate() === i &&
                       appt.status !== 'Cancelled'; // Don't show dots for cancelled appointments
            });

            if (appointmentsOnDay.length > 0) {
                dayCell.classList.add('has-appointments');
                const dot = document.createElement('span');
                dot.classList.add('appointment-dot');
                dayCell.appendChild(dot);
            }

            fragment.appendChild(dayCell);
        }

        calendarDays.appendChild(fragment);
        renderTimeSlots();
        renderQueue();
    };

    // --- Time Slot Logic ---
    const renderTimeSlots = () => {
        timeSlotsDate.textContent = selectedDate.toLocaleDateString(
            'en-US',
            {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
            }
        );

        const timeSlots = generateTimeSlots();
        timeSlotsContainer.innerHTML = ''; // Clear previous slots

        if (timeSlots.length === 0) {
            timeSlotsContainer.innerHTML = '<p class="text-muted">No available slots.</p>';
            return;
        }

        timeSlots.forEach(slot => {
            const slotEl = document.createElement('div');
            slotEl.classList.add('time-slot');

            if (!slot.available) {
                slotEl.classList.add('booked');
                slotEl.innerHTML = `${slot.time}<br><small>(${slot.bookingCount} booking${slot.bookingCount > 1 ? 's' : ''})</small>`;
                slotEl.title = `${slot.bookingCount} booking${slot.bookingCount > 1 ? 's' : ''} at this time`;
            } else {
                slotEl.textContent = slot.time;
                // Add data attribute for booking (use start time for selection)
                slotEl.dataset.time = slot.startTime;
            }
            timeSlotsContainer.appendChild(slotEl);
        });
    };

    const generateTimeSlots = () => {
        const slotDefinitions = [
            { start: '8:20 AM', end: '9:20 AM' },
            { start: '9:20 AM', end: '10:20 AM' },
            { start: '10:20 AM', end: '11:20 AM' },
            { start: '11:20 AM', end: '12:10 PM' },
            { start: '12:10 PM', end: '1:00 PM' },
            { start: '1:20 PM', end: '2:20 PM' },
            { start: '2:20 PM', end: '3:20 PM' },
            { start: '3:50 PM', end: '4:50 PM' },
            { start: '4:50 PM', end: '5:50 PM' },
            { start: '5:50 PM', end: '6:50 PM' },
            { start: '6:50 PM', end: '7:50 PM' },
            { start: '7:50 PM', end: '8:50 PM' }
        ];

        const slots = [];
        const now = new Date();
        const isToday = selectedDate.toDateString() === now.toDateString();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

        slotDefinitions.forEach(def => {
            const slotTime = new Date(selectedDate);
            const [time, period] = def.start.split(' ');
            const [hourStr, minuteStr] = time.split(':');
            let hour = parseInt(hourStr);
            const minute = parseInt(minuteStr);

            if (period === 'PM' && hour !== 12) hour += 12;
            if (period === 'AM' && hour === 12) hour = 0;

            slotTime.setHours(hour, minute, 0, 0);

            let isAvailable = true;

            // Rule 1: If it's today, the slot must be at least 1 hour in the future.
            if (isToday && slotTime < oneHourFromNow) {
                isAvailable = false;
            }

            // Rule 2: Count the number of non-cancelled appointments at this time slot.
            const appointmentsAtSlot = appointments.filter(appt => {
                const apptDate = window.appData.parseCustomDate(appt.datetime);
                return (
                    apptDate &&
                    apptDate.getTime() === slotTime.getTime() &&
                    appt.status !== 'Cancelled'
                );
            });

            const bookingCount = appointmentsAtSlot.length;

            if (bookingCount > 0) {
                isAvailable = false;
            }

            slots.push({
                time: `${def.start} - ${def.end}`,
                startTime: def.start,
                available: isAvailable,
                bookingCount: bookingCount,
            });
        });

        return slots;
    };

    // --- Queue Logic ---
    const renderQueue = () => {
        // For this example, the queue shows 'Pending' appointments for the selected day
        const pendingAppointments = (window.appData.appointments || []).filter(appt => {
           const apptDate = window.appData.parseCustomDate(appt.datetime);
            return apptDate && appt.status === 'Pending' &&
                   apptDate.toDateString() === selectedDate.toDateString();
        });

        queueList.innerHTML = '';
        if (pendingAppointments.length === 0) {
            queueList.innerHTML = '<p class="text-muted">No pending appointments in the queue for this day.</p>';
            return;
        }

        pendingAppointments.forEach(appt => {
            const itemEl = document.createElement('div');
            itemEl.classList.add('queue-item');
            itemEl.innerHTML = `
                <div class="queue-item-info">
                    <strong>${appt.customer}</strong>
                    <small>${appt.service}</small>
                </div>
                <div class="queue-item-time">
                    ${window.appData.parseCustomDate(appt.datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </div>
            `;
            queueList.appendChild(itemEl);
        });
    };

    // --- Reschedule Logic ---
    const renderRescheduleRequests = () => {
        if (!rescheduleListContainer) return; // Exit if the element isn't on the page

        const requests = (window.appData.rescheduleRequests || []).filter(req => req.status === 'Pending');
        rescheduleListContainer.innerHTML = ''; // Clear existing content

        if (requests.length === 0) {
            rescheduleListContainer.innerHTML = '<p class="text-muted">No pending reschedule requests.</p>';
            return;
        }

        requests.forEach(req => {
            const itemEl = document.createElement('div');
            itemEl.classList.add('reschedule-item');
            itemEl.innerHTML = `
                <div class="reschedule-item-info">
                    <strong>${req.customer}</strong>
                    <small>Wants to reschedule: <strong>${req.service}</strong> from ${new Date(req.originalDatetime.seconds * 1000).toLocaleString()}</small>
                    <p class="reason text-muted">Reason: "${req.reason}"</p>
                </div>
                <div class="reschedule-item-actions">
                     <button class="btn-danger-outline deny-request-btn" data-request-id="${req.requestId}" data-service-id="${req.serviceId}">
                        Deny
                    </button>
                    <button class="btn-primary-outline reschedule-btn" data-request-id="${req.requestId}">
                        Review & Reschedule
                    </button>
                </div>
            `;
            rescheduleListContainer.appendChild(itemEl);
        });
    };

    const handleRescheduleClick = (requestId) => {
        const request = (window.appData.rescheduleRequests || []).find(r => r.requestId === requestId);
        if (!request) return;

        // Find the original appointment to be updated later
        reschedulingAppointment = window.appData.appointments.find(a => a.serviceId === request.serviceId);
        if (!reschedulingAppointment) return;

        openBookingModal(true); // Open modal in reschedule mode
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
                console.log(`Task slot freed for ${technician.name}. New task count: ${technician.tasks}`);
            } else {
                console.warn(`Attempted to decrease task count for ${technician.name}, but it was already 0.`);
            }
        }
    };

    const handleDenyRequestClick = async (requestId, serviceId) => {
        const appointmentToCancel = window.appData.appointments.find(a => a.serviceId === serviceId);
        if (!appointmentToCancel) {
            alert('Error: Could not find the original appointment to cancel.');
            return;
        }

        const originalStatus = appointmentToCancel.status;
        const technicianName = appointmentToCancel.technician;

        // 1. Update the appointment status in the data model
        appointmentToCancel.status = 'Cancelled';



        // 2. Update the main table UI
        const tableRow = document.querySelector(`#main-appointments-table tr[data-service-id="${serviceId}"]`);
        if (tableRow) {
            tableRow.querySelector('td:nth-last-child(3)').innerHTML = `<span class="cancelled">Cancelled</span>`;
            tableRow.classList.add('card-flash');
            setTimeout(() => tableRow.classList.remove('card-flash'), 1000);
        }

        // 3. If the appointment was 'Pending' or 'In Progress', free up the technician's slot.
        if (originalStatus === 'Pending' || originalStatus === 'In Progress') {
            decreaseTechnicianTaskCount(technicianName);
        }

        // 4. Remove the request and re-render UI components
        removeRescheduleRequest(requestId);
        renderCalendar(); // This will update time slots and calendar dots
        if (typeof showSuccessToast === 'function') showSuccessToast(`Request denied. Appointment for ${appointmentToCancel.customer} has been cancelled.`);

        // 5. Log the admin activity
        const user = firebase.auth().currentUser;
        if (user && typeof logAdminActivity === 'function') {
            const logDetails = `Denied reschedule request for appointment ${serviceId} (${appointmentToCancel.customer}).`;
            logAdminActivity(user.uid, 'Denied Reschedule', logDetails);
        }

        // 6. Send a cancellation notification to the customer
        try {
            if (typeof NotificationService !== 'undefined') {
                await NotificationService.notifyAppointmentStatusChange({
                    customerIds: [appointmentToCancel.customerId || appointmentToCancel.customer],
                    status: 'cancelled',
                    appointmentId: serviceId,
                    reason: 'Your reschedule request was denied. The original appointment has been cancelled.',
                    serverUrl: window.serverUrl || 'http://localhost:5000'
                });
            }
        } catch (notifError) {
            console.warn('⚠️ Could not send cancellation notification:', notifError);
        }

        // 7. Admin notification
        if (typeof window.addNewNotification === 'function') {
            const newNotification = {
                id: `notif-cancel-${Date.now()}`,
                type: 'Cancellation', // A new type for a different icon
                message: `Cancellation notice sent to <b>${appointmentToCancel.customer}</b> for denied reschedule request.`,
                timestamp: 'Just now',
                isUnread: true,
                link: 'appointment.html'
            };
            window.addNewNotification(newNotification);
        }
    };

    // --- Helper function to find and assign the least busy technician ---
    // This logic is adapted from appointments.js to be self-contained.
    const findAndAssignLeastBusyTechnician = () => {
        const technicians = window.appData.technicians || [];
        const activeTechnicians = technicians.filter(tech => tech.status === 'Active' && tech.name !== 'Unassigned');

        if (activeTechnicians.length === 0) {
            return "Unassigned";
        }

        activeTechnicians.sort((a, b) => a.tasks - b.tasks);
        const leastBusyTechnician = activeTechnicians[0];

        // Increment the task count in the central data source
        const techInDataSource = technicians.find(t => t.id === leastBusyTechnician.id);
        if (techInDataSource) {
            techInDataSource.tasks++;
        }

        return leastBusyTechnician.name;
    };

    // --- Customer Search Dropdown Logic ---
    const populateCustomerOptions = (filter = '') => {
        const customers = window.appData.customers || [];
        const lowercasedFilter = filter.toLowerCase();
        
        const filteredCustomers = customers.filter(customer => 
            customer.name.toLowerCase().includes(lowercasedFilter) || 
            customer.phone.includes(filter)
        );

        customerOptionsContainer.innerHTML = '';
        if (filteredCustomers.length === 0) {
            customerOptionsContainer.innerHTML = '<div class="custom-select-option text-muted">No customers found.</div>';
            return;
        }

        filteredCustomers.forEach(customer => {
            const optionEl = document.createElement('div');
            optionEl.classList.add('custom-select-option');
            optionEl.dataset.value = customer.name;
            optionEl.innerHTML = `<strong>${customer.name}</strong><small>${customer.phone}</small>`;
            customerOptionsContainer.appendChild(optionEl);
        });
    };

    // --- Service Search Dropdown Logic ---
    const populateServiceOptions = (filter = '') => {
        const services = (window.appData.services || []).filter(s => s.availability === 'Available');
        const lowercasedFilter = filter.toLowerCase();

        const filteredServices = services.filter(service => 
            service.service.toLowerCase().includes(lowercasedFilter)
        );

        serviceOptionsContainer.innerHTML = '';
        if (filteredServices.length === 0) {
            serviceOptionsContainer.innerHTML = '<div class="custom-select-option text-muted">No services found.</div>';
            return;
        }

        filteredServices.forEach(service => {
            const optionEl = document.createElement('div');
            optionEl.classList.add('custom-select-option');
            optionEl.dataset.value = service.service;
            optionEl.innerHTML = `<strong>${service.service}</strong><small>${service.category}</small>`;
            serviceOptionsContainer.appendChild(optionEl);
        });
    };

    // --- New Appointment Modal Logic ---
    const openBookingModal = (isReschedule = false) => {
        const modalTitle = document.querySelector('#book-appointment-content').closest('.modal').querySelector('.modal-header h2');

        if (isReschedule && reschedulingAppointment) {
            modalTitle.textContent = `Reschedule for ${reschedulingAppointment.customer}`;
            // Pre-select the customer and service and disable them
            customerSearchInput.value = reschedulingAppointment.customer;
            serviceSearchInput.value = reschedulingAppointment.service;
            customerSearchInput.disabled = true;
            serviceSearchInput.disabled = true;
        } else {
            modalTitle.textContent = 'Book New Appointment';
            customerSearchInput.disabled = false;
            serviceSearchInput.disabled = false;
        }

        // Reset and populate customer search
        customerSearchInput.value = '';
        bookingCustomerSelect.innerHTML = '<option value="">Select a customer...</option>';
        populateCustomerOptions();

        // Populate the hidden select with all customers for validation purposes
        (window.appData.customers || []).forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.name;
            option.textContent = customer.name;
            bookingCustomerSelect.appendChild(option);
        });
        bookingCustomerSelect.value = ''; // Ensure it's reset

        // Reset and populate service search
        serviceSearchInput.value = '';
        bookingServiceSelect.innerHTML = '<option value="">Select a service...</option>';
        populateServiceOptions();

        // Populate the hidden service select for validation
        (window.appData.services || []).filter(s => s.availability === 'Available').forEach(service => {
            const option = document.createElement('option');
            option.value = service.service;
            option.textContent = service.service;
            bookingServiceSelect.appendChild(option);
        });
        bookingServiceSelect.value = ''; // Ensure it's reset

        // Update time display
        if (selectedTimeSlot) {
            const fullDateStr = `${selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${selectedTimeSlot}`;
            selectedBookingTimeEl.innerHTML = `<p>${fullDateStr}</p>`;
        } else {
            selectedBookingTimeEl.innerHTML = `<p class="text-muted">Please select an available time slot from the calendar.</p>`;
        }

        // Show the modal
        document.querySelectorAll('.modal-content').forEach(mc => mc.classList.remove('active'));
        bookingModalContent.classList.add('active');
        modalOverlay.classList.add('show');
        document.body.classList.add('modal-open');

        // Reset vehicle info display
        vehicleInfoContainer.style.display = 'none';
        vehicleInfoDisplay.innerHTML = '';
    };

    const closeBookingModal = () => {
        modalOverlay.classList.remove('show');
        document.body.classList.remove('modal-open');

        // Remove active class from any selected time slot
        const activeSlot = timeSlotsContainer.querySelector('.time-slot.active');
        if (activeSlot) {
            activeSlot.classList.remove('active');
        }
        // Clear reschedule state
        reschedulingAppointment = null;
        customerSearchInput.disabled = false;
        serviceSearchInput.disabled = false;
        selectedTimeSlot = null; // Reset selected time slot
    };

    // --- Helper to add the new appointment to the main table UI ---
    const addAppointmentToMainTable = (appt) => {
        const tableBody = document.querySelector('#main-appointments-table tbody');
        if (!tableBody) return;

        const row = document.createElement('tr');
        // This is a simplified row for demonstration. A full implementation
        // would replicate the structure from appointments.js.
        row.innerHTML = `
            <td>${appt.serviceId}</td>
            <td>${appt.customer}</td>
            <td>${appt.phone}</td>
            <td colspan="8" class="text-muted">... (details will fully appear on page reload)</td>
        `;
        tableBody.prepend(row); // Add the new row to the top of the table
    };

    const updateAppointmentInMainTable = (appt) => {
        const tableBody = document.querySelector('#main-appointments-table tbody');
        const row = tableBody.querySelector(`tr[data-service-id="${appt.serviceId}"]`);
        if (!row) return;

        // Update the row's data attributes and visible text
        row.dataset.datetime = appt.datetime;
        // A full implementation would update all cells, but for now we focus on the key change
        // For example, find the datetime cell if it exists and update it.
        // This is complex without a dedicated datetime column, so we'll rely on page reload for full visual consistency for now.

        // Flash the row to indicate it was updated
        row.classList.add('card-flash');
        setTimeout(() => row.classList.remove('card-flash'), 1000);
    };

    const removeRescheduleRequest = (requestId) => {
        const requests = (window.appData.rescheduleRequests || []);
        const index = requests.findIndex(r => r.requestId === requestId);
        if (index > -1) {
            requests.splice(index, 1);
        }
        renderRescheduleRequests();
    };

    const handleBookingSubmit = (e) => { 
        e.preventDefault();
        const selectedCustomerName = bookingCustomerSelect.value;
        const selectedServiceName = bookingServiceSelect.value;

        // --- RESCHEDULE LOGIC ---
        if (reschedulingAppointment) {
            const originalRequestId = (window.appData.rescheduleRequests || []).find(r => r.serviceId === reschedulingAppointment.serviceId)?.requestId;
            if (!originalRequestId) {
                alert('Error: Could not find the original reschedule request.');
                closeBookingModal();
                return;
            }
            if (!selectedTimeSlot) {
                alert('Please select a new time slot to reschedule.');
                return;
            }

            // 1. Update the datetime of the original appointment object
            reschedulingAppointment.datetime = `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${selectedTimeSlot}`;

            // 2. Update the UI
            updateAppointmentInMainTable(reschedulingAppointment);
            removeRescheduleRequest(originalRequestId);
            renderCalendar(); // Re-render calendar to update dots and slots

            // 3. Show success and close
            closeBookingModal();
            if (typeof showSuccessToast === 'function') showSuccessToast(`Appointment for ${reschedulingAppointment.customer} rescheduled successfully!`);

            // 4. Send a confirmation notification
            // if (typeof window.addNewNotification === 'function') {
            //     const newDateTime = new Date(reschedulingAppointment.datetime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            //     const newNotification = {
            //         id: `notif-resched-${Date.now()}`,
            //         type: 'Service Completed', // Using an existing icon type
            //         message: `Reschedule confirmed for <b>${reschedulingAppointment.customer}</b>. New time is ${newDateTime}.`,
            //         timestamp: 'Just now',
            //         isUnread: true,
            //     };
            //     window.addNewNotification(newNotification);
            // }
            return;
        }

        // --- NEW APPOINTMENT LOGIC ---
        // Validate that all fields are selected for a new booking
        if (!selectedTimeSlot || !selectedCustomerName || !selectedServiceName) {
            // If it's a reschedule, only the time slot is needed.
            if (reschedulingAppointment) {
                if (!selectedTimeSlot) {
                    alert('Please select a new time slot to reschedule.');
                    return;
                }
            } else {
                alert('Please select a customer, a service, and a time slot to book an appointment.');
                return;
            }
        }

        // This part of the logic was slightly misplaced. It should be inside the reschedule block.
        // Moving it up to ensure it runs correctly.
        if (reschedulingAppointment && !selectedTimeSlot) {
            alert('Please select a new time slot to reschedule.');
            return;
        }

        // Re-validating for new appointments after the reschedule check.
        if (!reschedulingAppointment && (!selectedTimeSlot || !selectedCustomerName || !selectedServiceName)) {
            alert('Please select a customer, a service, and a time slot to book an appointment.');
            return;
        }

        const customerData = window.appData.customers.find(c => c.name === selectedCustomerName);
        if (customerData) {
            // 2. Construct the new appointment object
            const newAppointment = {
                serviceId: `KC-${Date.now().toString().slice(-6)}`,
                customer: customerData.name,
                phone: customerData.phone,
                plate: customerData.plateNumber,
                carName: "N/A", // This info isn't in the customer object, default it
                carType: "N/A", // This info isn't in the customer object, default it
                service: selectedServiceName,
                technician: 'Unassigned', // Default to Unassigned
                status: 'Pending',
                // Format date to match "Oct 28, 2025 - 2:00 PM"
                datetime: `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${selectedTimeSlot}`,
                paymentStatus: 'Unpaid'
            };

            // 3. Add the new appointment to the global and local data arrays
            window.appData.appointments.unshift(newAppointment);
            appointments.unshift(newAppointment);

            // 4. Update the UI in real-time
            addAppointmentToMainTable(newAppointment); // Add to the main appointments table
            renderCalendar(); // This will re-render the calendar, time slots, and queue

            // 5. Close modal and show success message
            closeBookingModal();
            if (typeof showSuccessToast === 'function') {
                showSuccessToast(`Appointment for ${newAppointment.customer} booked successfully!`);
            }
            // 6. Send a notification to the admin about the new booking
            if (typeof window.addNewNotification === 'function') {
                const notification = {
                    id: `notif-new-booking-${Date.now()}`,
                    type: 'New Booking',
                    message: `<b>${newAppointment.customer}</b> has a new pending booking for <b>${newAppointment.service}</b>.`,
                    timestamp: 'Just now',
                    isUnread: true,
                    link: 'appointment.html'
                };
                window.addNewNotification(notification);
            }
        } else {
            alert('Could not find selected customer data. Please try again.');
        }
    };

    // --- Event Listeners ---
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    calendarDays.addEventListener('click', (e) => {
        const dayCell = e.target.closest('.calendar-day');
        if (dayCell && !dayCell.classList.contains('empty')) {
            const day = parseInt(dayCell.dataset.day);
            selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);

            // Remove 'selected' from all other days
            document.querySelectorAll('.calendar-day.selected').forEach(cell => {
                cell.classList.remove('selected');
            });
            // Add 'selected' to the clicked day
            dayCell.classList.add('selected');

            renderTimeSlots();
            renderQueue();
        }
    });

    timeSlotsContainer.addEventListener('click', (e) => {
        const slotEl = e.target.closest('.time-slot');
        if (slotEl && !slotEl.classList.contains('booked')) {
            // Remove 'active' from any previously selected slot
            const currentActive = timeSlotsContainer.querySelector('.time-slot.active');
            if (currentActive) {
                currentActive.classList.remove('active');
            }
            // Add 'active' to the newly clicked slot
            slotEl.classList.add('active');

            selectedTimeSlot = slotEl.dataset.time;
            // Do not open modal on slot click
        }
    });

    bookNewAppointmentBtn.addEventListener('click', () => {
        selectedTimeSlot = null; // No time is pre-selected
        openBookingModal();
    });

    bookingCancelBtn.addEventListener('click', closeBookingModal);
    document.getElementById('book-appointment-form').addEventListener('submit', handleBookingSubmit);

    if (rescheduleListContainer) {
        rescheduleListContainer.addEventListener('click', (e) => {
            const rescheduleBtn = e.target.closest('.reschedule-btn');
            if (rescheduleBtn) {
                handleRescheduleClick(rescheduleBtn.dataset.requestId);
            }

            const denyBtn = e.target.closest('.deny-request-btn');
            if (denyBtn) {
                handleDenyRequestClick(denyBtn.dataset.requestId, denyBtn.dataset.serviceId);
            }
        });
    }

    // --- Service Search Event Listeners ---
    serviceSearchInput.addEventListener('input', () => {
        populateServiceOptions(serviceSearchInput.value);
    });

    serviceSearchInput.addEventListener('focus', () => {
        serviceOptionsContainer.classList.add('show');
        populateServiceOptions(serviceSearchInput.value);
    });

    serviceOptionsContainer.addEventListener('click', (e) => {
        const option = e.target.closest('.custom-select-option');
        if (option && option.dataset.value) {
            const selectedName = option.dataset.value;
            serviceSearchInput.value = selectedName; // Update visible input
            bookingServiceSelect.value = selectedName; // Update hidden select

            // Manually trigger a 'change' event for any dependent logic
            const changeEvent = new Event('change', { bubbles: true });
            bookingServiceSelect.dispatchEvent(changeEvent);

            serviceOptionsContainer.classList.remove('show');
        }
    });

    // --- Customer Search Event Listeners ---
    customerSearchInput.addEventListener('input', () => {
        populateCustomerOptions(customerSearchInput.value);
    });

    customerSearchInput.addEventListener('focus', () => {
        customerOptionsContainer.classList.add('show');
        populateCustomerOptions(customerSearchInput.value);
    });

    customerOptionsContainer.addEventListener('click', (e) => {
        const option = e.target.closest('.custom-select-option');
        if (option && option.dataset.value) {
            const selectedName = option.dataset.value;
            customerSearchInput.value = selectedName; // Update visible input
            bookingCustomerSelect.value = selectedName; // Update hidden select

            // Manually trigger a 'change' event on the hidden select
            // This ensures the vehicle info logic still runs
            const changeEvent = new Event('change', { bubbles: true });
            bookingCustomerSelect.dispatchEvent(changeEvent);

            customerOptionsContainer.classList.remove('show');
        }
    });


    bookingCustomerSelect.addEventListener('change', (e) => {
        const selectedCustomerName = e.target.value;
        if (!selectedCustomerName) {
            vehicleInfoContainer.style.display = 'none';
            return;
        }

        const customerData = window.appData.customers.find(c => c.name === selectedCustomerName);
        if (customerData) {
            // The mobileCustomers data only has plateNumber. We'll display that.
            // If carName/carType were available, they could be added here.
            vehicleInfoDisplay.innerHTML = `
                <p><strong>Plate Number:</strong> ${customerData.plateNumber || 'N/A'}</p>
            `;
            vehicleInfoContainer.style.display = 'block';
        } else {
            vehicleInfoContainer.style.display = 'none';
        }
    });


    // Close modal if overlay is clicked
    modalOverlay.addEventListener('click', (e) => {
        // Also close the custom dropdown if clicking outside of it
        if (!e.target.closest('.custom-select-with-search')) {
            customerOptionsContainer.classList.remove('show');
            serviceOptionsContainer.classList.remove('show');
        }
        if (e.target === modalOverlay) {
            closeBookingModal();
        }
    });

    const fetchRescheduleRequests = async () => {
        try {
            const db = window.firebase.firestore();
            const allRequests = [];
            
            // Get all bookings
            const bookingsSnapshot = await db.collection('bookings').get();
            
            if (!bookingsSnapshot.empty) {
                // For each booking, get its rescheduleRequests subcollection
                for (const bookingDoc of bookingsSnapshot.docs) {
                    const rescheduleSnapshot = await db.collection('bookings').doc(bookingDoc.id).collection('rescheduleRequests').get();
                    
                    rescheduleSnapshot.docs.forEach((doc) => {
                        const data = doc.data();
                        // Only include pending requests
                        if (data.status === 'Pending') {
                            allRequests.push({
                                requestId: doc.id,
                                bookingId: bookingDoc.id,
                                ...data
                            });
                        }
                    });
                }
            }
            
            window.appData.rescheduleRequests = allRequests;
        } catch (error) {
            console.error("Error fetching reschedule requests:", error);
            window.appData.rescheduleRequests = []; // Ensure it's an empty array on error
        }
    };

    // --- Initial Render ---
    const initializeScheduler = async () => {
        await fetchRescheduleRequests(); // Fetch live data first
        renderCalendar(); // This will call renderTimeSlots and renderQueue
        renderRescheduleRequests();
        updatePendingApprovalsCount(); // Update the badge with the correct count
    };

    initializeScheduler();
}

);
