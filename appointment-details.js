document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to initialize
    await window.firebaseInitPromise;

    const firebase = window.firebase;
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- DOM Elements ---
    const customerNameEl = document.getElementById('detail-customer-name');
    const appointmentIdEl = document.getElementById('appointment-id-subtitle');
    const serviceEl = document.getElementById('detail-service');
    const phoneEl = document.getElementById('detail-customer-phone');
    const emailEl = document.getElementById('detail-customer-email');
    const plateEl = document.getElementById('detail-plate');
    const carNameEl = document.getElementById('detail-car-name');
    const carTypeEl = document.getElementById('detail-car-type');
    const avatarImg = document.getElementById('detail-customer-avatar');
    const backBtn = document.getElementById('back-btn');

    // --- State ---
    let appointmentData = null;

    /**
     * Fetches customer data from Firestore based on customer name.
     * @param {string} userId The ID of the customer to fetch.
     * @returns {Promise<object|null>} Customer data or null if not found.
     */
    const fetchCustomerData = async (userId) => {
        if (!userId) return null;
        try {
            const customerDoc = await db.collection('users').doc(userId).get();
            if (!customerDoc.exists) {
                console.warn(`Customer with ID "${userId}" not found in 'users' collection.`);
                return null;
            }
            return { id: customerDoc.id, ...customerDoc.data() };
        } catch (error) {
            console.error("Error fetching customer data:", error);
            return null;
        }
    };

    /**
     * Creates and populates the service progress tracker with appointment info card.
     * @param {string} currentStatus The current status of the appointment.
     * @param {object} apptData Full appointment data for displaying additional info.
     */
    const createStatusTracker = (currentStatus, apptData) => {
        const profileHistorySection = document.querySelector('.profile-history');
        if (!profileHistorySection || !currentStatus) return;

        // Remove existing tracker to prevent duplicates on re-render
        const existingTracker = profileHistorySection.querySelector('.status-tracker-container');
        if (existingTracker) {
            existingTracker.remove();
        }

        const trackerContainer = document.createElement('div');
        trackerContainer.className = 'status-tracker-container widget-card';

        const statuses = ['Pending', 'In Progress', 'Completed'];
        const currentStatusIndex = statuses.indexOf(currentStatus);

        let stepsHTML = '';
        statuses.forEach((status, index) => {
            const isCompleted = index < currentStatusIndex;
            const isActive = index === currentStatusIndex;
            const isCancelled = currentStatus === 'Cancelled';
            const icon = status === 'Pending' ? 'pending_actions' : status === 'In Progress' ? 'autorenew' : 'check_circle';
            stepsHTML += `
               <div class="status-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isCancelled ? 'cancelled' : ''}" data-status="${status}">
                    <div class="icon">
                        <span class="material-symbols-outlined">${icon}</span>
                    </div>
                    <p>${status}</p>
                </div>
            `;
        });

        // Get payment status badge
        const paymentStatus = apptData.paymentStatus || 'Unpaid';
        const paymentStatusClass = paymentStatus.toLowerCase();

        trackerContainer.innerHTML = `
            <div class="widget-header">
                <h3>Service Progress</h3>
            </div>
            <div class="status-tracker">
                ${stepsHTML}
            </div>
            <div class="appointment-info-card" style="margin-top: 1.5rem; padding: 1rem; background: var(--color-light); border-radius: 8px;">
                <h4 style="margin-bottom: 1rem; color: var(--color-dark);">Appointment Information</h4>
                <div class="detail-item" style="margin-bottom: 0.75rem;">
                    <span class="material-symbols-outlined">calendar_month</span>
                    <div>
                        <small class="text-muted">Date & Time</small>
                        <p>${apptData.datetime || 'N/A'}</p>
                    </div>
                </div>
                <div class="detail-item" style="margin-bottom: 0.75rem;">
                    <span class="material-symbols-outlined">payments</span>
                    <div>
                        <small class="text-muted">Price</small>
                        <p>₱${apptData.price || '0'}</p>
                    </div>
                </div>
                <div class="detail-item" style="margin-bottom: 0.75rem;">
                    <span class="material-symbols-outlined">engineering</span>
                    <div>
                        <small class="text-muted">Technician</small>
                        <p>${apptData.technician || 'Unassigned'}</p>
                    </div>
                </div>
                <div class="detail-item" style="margin-bottom: 0.75rem;">
                    <span class="material-symbols-outlined">credit_card</span>
                    <div>
                        <small class="text-muted">Payment Status</small>
                        <p><span class="payment-status-badge ${paymentStatusClass}">${paymentStatus}</span></p>
                    </div>
                </div>
                ${apptData.status === 'Cancelled' ? `
                <div class="detail-item" style="margin-bottom: 0.75rem;">
                    <span class="material-symbols-outlined">info</span>
                    <div>
                        <small class="text-muted">Cancellation Reason</small>
                        <p>${apptData.cancellationReason || 'N/A'}</p>
                    </div>
                </div>
                ${apptData.cancellationNotes ? `
                <div class="detail-item" style="margin-bottom: 0.75rem;">
                    <span class="material-symbols-outlined">description</span>
                    <div>
                        <small class="text-muted">Notes</small>
                        <p>${apptData.cancellationNotes}</p>
                    </div>
                </div>
                ` : ''}
                ` : ''}
            </div>
        `;

        profileHistorySection.prepend(trackerContainer);
    };

    /**
     * Populates the page with appointment and customer details.
     * @param {object} apptData The appointment data from sessionStorage.
     */
    const populateAppointmentDetails = async (apptData) => {
        if (!apptData) {
            document.querySelector('.profile-page-container').innerHTML = 
                '<p class="text-muted" style="text-align:center; padding: 2rem;">Appointment data not found. Please go back and select an appointment.</p>';
            return;
        }

        // 1. Populate with appointment-specific data that doesn't change
        appointmentIdEl.textContent = `ID: ${apptData.serviceId || 'N/A'}`;
        serviceEl.textContent = apptData.service || 'N/A';
        plateEl.textContent = apptData.plate || 'N/A';
        carNameEl.textContent = apptData.carName || 'N/A';
        carTypeEl.textContent = apptData.carType || 'N/A';

        // 2. Fetch and populate customer-specific data (name, phone, email, photo) from the 'users' collection
        const customerData = await fetchCustomerData(apptData.userId);
        if (customerData) {
            // Use data from the 'users' collection as the source of truth
            customerNameEl.textContent = customerData.fullName || apptData.customer || 'N/A';
            phoneEl.textContent = customerData.phoneNumber || apptData.phone || 'N/A';
            emailEl.textContent = customerData.email || 'N/A';

            // Set avatar image
            if (customerData.photoURL) {
                avatarImg.src = customerData.photoURL;
            } else {
                // Fallback if user has no photoURL
                avatarImg.src = './images/redicon.png';
            }
        } else {
            // Fallback if customer is not found in 'users' collection
            customerNameEl.textContent = apptData.customer || 'N/A';
            phoneEl.textContent = apptData.phone || 'N/A';
            emailEl.textContent = 'N/A';
            avatarImg.src = './images/redicon.png';
        }

        // 3. Populate the service progress tracker with full appointment data
        createStatusTracker(apptData.status, apptData);
    };

    /**
     * Initializes the page by getting data from sessionStorage.
     */
    const initializePage = () => {
        const appointmentDataString = sessionStorage.getItem('selectedAppointmentData');
        if (appointmentDataString) {
            appointmentData = JSON.parse(appointmentDataString);
            populateAppointmentDetails(appointmentData);
        } else {
            console.error('No appointment data found in sessionStorage.');
            populateAppointmentDetails(null); // Show an error message on the page
        }
    };

    /**
     * Handles the back button click.
     */
    const handleBackClick = (e) => {
        e.preventDefault();
        const previousPage = sessionStorage.getItem('previousPage');
        if (previousPage) {
            window.location.href = previousPage;
        } else if (document.referrer && document.referrer.includes(window.location.host)) {
            window.history.back();
        } else {
            window.location.href = 'appointment.html';
        }
    };

    // --- Event Listeners ---
    if (backBtn) {
        backBtn.addEventListener('click', handleBackClick);
    }

    // --- Initial Load ---
    auth.onAuthStateChanged((user) => {
        if (user) {
            initializePage();
        }
    });
});