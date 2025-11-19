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

        const trackerContainer = document.createElement('div');
        trackerContainer.className = 'status-tracker-container widget-card'; // Added widget-card for styling

        const statuses = ['Pending', 'In Progress', 'Completed'];
        const currentStatusIndex = statuses.indexOf(currentStatus);

        let stepsHTML = '';
        statuses.forEach((status, index) => {
            const isCompleted = index < currentStatusIndex;
            const isActive = index === currentStatusIndex;
            const icon = status === 'Pending' ? 'pending_actions' : status === 'In Progress' ? 'autorenew' : 'check_circle';
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

        // Add event listener for status updates
        trackerContainer.querySelector('.status-tracker').addEventListener('click', (e) => {
            const step = e.target.closest('.status-step');
            if (!step || !step.dataset.status) return;

            const newStatus = step.dataset.status;
            // In a real app, you would have a function here to update the status in Firestore.
            // For now, we'll just update the local data and re-render the tracker.
            appointmentData.status = newStatus;
            createStatusTracker(newStatus); // Re-render the tracker
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