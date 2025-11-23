document.addEventListener('DOMContentLoaded', () => {
    // Wait for the Firebase initialization promise (created in firebase-config.js)
    const ensureFirebaseReady = async () => {
        if (window.firebaseInitPromise) {
            try {
                await window.firebaseInitPromise;
            } catch (e) {
                console.warn('window.firebaseInitPromise rejected or failed:', e);
            }
        }

        if (!window.firebase || typeof window.firebase.firestore !== 'function') {
            // If the compat-style wrapper wasn't created, throw a helpful error
            console.error("Firebase not initialized or compat wrapper missing. Check firebase-config.js");
            return null;
        }

        return window.firebase;
    };

    ensureFirebaseReady().then((firebaseWrapper) => {
        if (!firebaseWrapper) return; // abort if firebase unavailable
        const db = firebaseWrapper.firestore();

    // --- DOM Elements ---
    const customerNameEl = document.getElementById('detail-customer-name');
    const appointmentIdEl = document.getElementById('appointment-id-subtitle');
    const serviceEl = document.getElementById('detail-service');
    const phoneEl = document.getElementById('detail-customer-phone');
    const emailEl = document.getElementById('detail-customer-email');
        const paymentMethodEl = document.getElementById('detail-payment-method');
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
     * Creates and populates the service progress tracker.
     * @param {string} currentStatus The current status of the appointment.
     */
    const createStatusTracker = (currentStatus) => {
        const profileHistorySection = document.querySelector('.profile-history');
        if (!profileHistorySection || !currentStatus) return;

        // Remove existing tracker to prevent duplicates on re-render
        const existingTracker = profileHistorySection.querySelector('.status-tracker-container');
        if (existingTracker) {
            existingTracker.remove();
        }

        // Remove existing payment history to prevent duplicates
        const existingPaymentHistory = profileHistorySection.querySelector('.payment-history-container');
        if (existingPaymentHistory) {
            existingPaymentHistory.remove();
        }

        const trackerContainer = document.createElement('div');
        trackerContainer.className = 'status-tracker-container widget-card';

        const statuses = ['Pending', 'Approved', 'In Progress', 'Completed'];
        // Normalize currentStatus for matching (case-insensitive, allow 'Approve' as 'Approved')
        let normalizedStatus = (currentStatus || '').toLowerCase();
        if (normalizedStatus === 'approve') normalizedStatus = 'approved';
        const currentStatusIndex = statuses.findIndex(s => s.toLowerCase() === normalizedStatus);

        let stepsHTML = '';
        statuses.forEach((status, index) => {
            const isCompleted = index < currentStatusIndex;
            const isActive = index === currentStatusIndex;
            let icon = 'pending_actions';
            if (status === 'Approved') icon = 'check_circle';
            else if (status === 'In Progress') icon = 'autorenew';
            else if (status === 'Completed') icon = 'check_circle';
            stepsHTML += `
               <div class="status-step clickable ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}" data-status="${status}">
                    <div class="icon">
                        <span class="material-symbols-outlined">${icon}</span>
                    </div>
                    <p>${status}</p>
                </div>
            `;
        });

        trackerContainer.innerHTML = `
            <div class="widget-header">
                <h3>Service Progress</h3>
            </div>
            <div class="status-tracker">
                ${stepsHTML}
            </div>
        `;

        profileHistorySection.prepend(trackerContainer);

        // --- Payment Method History Section ---
        const paymentHistoryContainer = document.createElement('div');
        paymentHistoryContainer.className = 'payment-history-container widget-card';
        let paymentStatus = appointmentData && appointmentData.paymentStatus ? appointmentData.paymentStatus : 'N/A';
        let paidAt = appointmentData && appointmentData.paidAt ? appointmentData.paidAt : null;
        let paidAtStr = '';
        if (paymentStatus && paymentStatus.toLowerCase() === 'paid') {
            if (paidAt && paidAt.seconds) {
                // Firestore Timestamp
                const date = new Date(paidAt.seconds * 1000);
                paidAtStr = date.toLocaleString();
            } else if (typeof paidAt === 'string' || typeof paidAt === 'number') {
                paidAtStr = new Date(paidAt).toLocaleString();
            } else {
                paidAtStr = 'N/A';
            }
        } else {
            paidAtStr = 'Pending';
        }

        // Always fetch payment method from Firestore user profile for history
        let paymentMethod = 'N/A';
        (async () => {
            // Prefer payment method from appointment data
            paymentMethod = appointmentData.paymentMethod || appointmentData.payment_method || appointmentData.paymentType || null;
            let methodSource = 'appointment';
            if (!paymentMethod) {
                let customerId = appointmentData.userId || appointmentData.customerId || appointmentData.customerUid;
                try {
                    const db = window.firebase.firestore();
                    if (!customerId) {
                        // Try to find by fullName if no ID
                        const usersSnapshot = await db.collection('users').where('fullName', '==', appointmentData.customer).limit(1).get();
                        if (!usersSnapshot.empty) {
                            customerId = usersSnapshot.docs[0].id;
                        }
                    }
                    if (customerId) {
                        const userDoc = await db.collection('users').doc(customerId).get();
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            paymentMethod = userData.paymentMethod || 'Not set';
                            methodSource = 'user';
                        }
                    }
                } catch (err) {
                    paymentMethod = 'Not set';
                }
            }
            if (!paymentMethod) paymentMethod = 'N/A';
            // Status badge logic
            let statusBadge = '';
            if (!paymentStatus || paymentStatus === 'N/A') {
                statusBadge = '<span class="payment-status-badge na">N/A</span>';
            } else if (paymentStatus.toLowerCase() === 'pending') {
                statusBadge = '<span class="payment-status-badge pending">Pending</span>';
            } else if (paymentStatus.toLowerCase() === 'paid') {
                statusBadge = '<span class="payment-status-badge paid">Paid</span>';
            } else {
                statusBadge = `<span class="payment-status-badge">${paymentStatus}</span>`;
            }
            let paidAtDisplay = paidAtStr ? `<span class="date-paid-badge ${paidAtStr==='Pending'?'pending':''}">${paidAtStr}</span>` : '';
            paymentHistoryContainer.innerHTML = `
                <div class="widget-header">
                    <h3>Payment Method History</h3>
                </div>
                <div class="payment-history-details">
                    <div><strong>Status:</strong> ${statusBadge}</div>
                    <div><strong>Method:</strong> <span class="payment-method-badge ${methodSource}">${paymentMethod}</span></div>
                    <div><strong>Date Paid:</strong> ${paidAtDisplay}</div>
                </div>
            `;
        })();
        profileHistorySection.insertBefore(paymentHistoryContainer, trackerContainer.nextSibling);

        // Add event listener for status updates
        trackerContainer.querySelector('.status-tracker').addEventListener('click', (e) => {
            const step = e.target.closest('.status-step');
            if (!step || !step.dataset.status) return;

            const newStatus = step.dataset.status;
            appointmentData.status = newStatus;
            createStatusTracker(newStatus);
            if (typeof showSuccessToast === 'function') showSuccessToast(`Status updated to "${newStatus}"`);
        });
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
        // Use plateNumber from Firestore if available, fallback to apptData
        plateEl.textContent = apptData.plateNumber || apptData.plate || 'N/A';
        carNameEl.textContent = apptData.carName || 'N/A';
        carTypeEl.textContent = apptData.carType || 'N/A';

        // 2. Fetch and populate customer-specific data (name, phone, email, photo) from the 'users' collection
        const customerData = await fetchCustomerData(apptData.userId);
        if (customerData) {
            // Use data from the 'users' collection as the source of truth
            customerNameEl.textContent = customerData.fullName || apptData.customer || 'N/A';
            // Use phoneNumber from Firestore if available, fallback to apptData
            phoneEl.textContent = customerData.phoneNumber || apptData.phoneNumber || apptData.phone || 'N/A';
            emailEl.textContent = customerData.email || 'N/A';

            // Payment Method: prefer from appointment, fallback to user
            if (paymentMethodEl) {
                paymentMethodEl.textContent = apptData.paymentMethod || apptData.payment_method || apptData.paymentType || customerData.paymentMethod || 'N/A';
            }
            // Payment Status: show badge for N/A and Pending
            const paymentStatusEl = document.getElementById('detail-payment-status');
            if (paymentStatusEl) {
                let status = apptData.paymentStatus || 'N/A';
                if (!status || status === 'N/A') {
                    paymentStatusEl.innerHTML = '<span class="payment-status-badge na">N/A</span>';
                } else if (status.toLowerCase() === 'pending') {
                    paymentStatusEl.innerHTML = '<span class="payment-status-badge pending">Pending</span>';
                } else if (status.toLowerCase() === 'paid') {
                    paymentStatusEl.innerHTML = '<span class="payment-status-badge paid">Paid</span>';
                } else {
                    paymentStatusEl.innerHTML = `<span class="payment-status-badge">${status}</span>`;
                }
            }

            // Set avatar image
            if (customerData.photoURL) {
                avatarImg.src = customerData.photoURL;
            } else if (customerData.photoUrl) {
                avatarImg.src = customerData.photoUrl;
            } else {
                // Fallback if user has no photoURL or photoUrl
                avatarImg.src = './images/redicon.png';
            }
        } else {
            // Fallback if customer is not found in 'users' collection
            customerNameEl.textContent = apptData.customer || 'N/A';
            phoneEl.textContent = apptData.phone || 'N/A';
            emailEl.textContent = 'N/A';
            if (paymentMethodEl) paymentMethodEl.textContent = 'N/A';
            avatarImg.src = './images/redicon.png';
        }

        // 3. Populate the service progress tracker
        createStatusTracker(apptData.status);
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
     * It tries to return to the previous page in history.
     * If history is not available, it defaults to appointment.html.
     */
    const handleBackClick = (e) => {
        e.preventDefault();
        // Check if there's a previous page in the history to go back to
        if (document.referrer && document.referrer.includes(window.location.host)) {
            window.history.back();
        } else {
            // Fallback for direct access or if the referrer is external
            window.location.href = 'appointment.html';
        }
    };

    // --- Event Listeners ---
    if (backBtn) {
        backBtn.addEventListener('click', handleBackClick);
    }

        // --- Initial Load ---
        // Ensure Firebase is ready before we try to use it.
        firebaseWrapper.auth().onAuthStateChanged((user) => {
            if (user) {
                initializePage();
            }
        });
    });
});