document.addEventListener('DOMContentLoaded', () => {
    // This script runs on the customer-profile.html page
    // Retrieve the stored data from sessionStorage
    const storedData = sessionStorage.getItem('selectedProfileData');
    
    if (!storedData) {
        // If no data is found, display an error message
        document.getElementById('profile-name').textContent = 'Customer Not Found';
        document.getElementById('profile-customer-id').textContent = 'Please go back and select a customer.';
        return;
    }
    
    const profileData = JSON.parse(storedData);
    
    // Populate the profile page with the data passed from the previous page.
    // This data can be from a mobile app customer, an appointment, or a walk-in.
    document.getElementById('profile-customer-id').textContent = profileData.customerId || profileData.serviceId || profileData.plate || 'N/A';
    document.getElementById('profile-name').textContent = profileData.fullName || profileData.customer || profileData.name || 'Walk-in Customer';
    document.getElementById('profile-phone').textContent = profileData.phoneNumber || profileData.phone || 'N/A'; // Keep `phone` as a fallback
    document.getElementById('profile-email').textContent = profileData.email || 'N/A';
    
    // Handle different date formats (Firestore timestamp vs. string)
    let registrationDateText = 'N/A';
    if (profileData.createdAt) {
        // Firestore timestamp object: { seconds: ..., nanoseconds: ... }
        registrationDateText = new Date(profileData.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } else if (profileData.registrationDate) {
        // Plain string date (fallback for older data structures or walk-ins)
        registrationDateText = new Date(profileData.registrationDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    document.getElementById('profile-member-since').textContent = registrationDateText;

    const verificationEl = document.getElementById('profile-verification');
    const verificationText = verificationEl.querySelector('span:last-child');
    
    // The `isVerified` property will only exist for mobile app customers.
    // We can use its presence to determine the verification status.
    if (profileData.isVerified === true) {
        verificationEl.classList.add('verified');
        verificationText.textContent = 'Verified App User';
    } else {
        // This now covers both `isVerified: false` and cases where it's not defined (walk-ins)
        verificationEl.classList.add('not-verified');
        verificationText.textContent = 'Not Verified';
    }
    
    // --- Create and Populate Service Progress Tracker ---
    const createStatusTracker = (currentStatus) => {
        const profileHistorySection = document.querySelector('.profile-history');
        // Only show the tracker if there's a status (i.e., it's from an appointment/walk-in)
        if (!profileHistorySection || !currentStatus) return;
 
        const trackerContainer = document.createElement('div');
        trackerContainer.className = 'status-tracker-container';
 
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
            <h3>Service Progress</h3>
            <div class="status-tracker">
                ${stepsHTML}
            </div>
        `;
 
        // Insert the tracker before the service history table
        profileHistorySection.prepend(trackerContainer);

        // --- Add Event Listener for Clickable Status Steps ---
        const statusTrackerEl = trackerContainer.querySelector('.status-tracker');
        if (statusTrackerEl) {
            statusTrackerEl.addEventListener('click', (e) => {
                const step = e.target.closest('.status-step');
                if (!step || !step.dataset.status) return;

                const newStatus = step.dataset.status;

                // Prevent changing to the same status or going backwards
                if (newStatus === profileData.status || statuses.indexOf(newStatus) < statuses.indexOf(profileData.status)) {
                    return;
                }

                // Find the original appointment/walk-in in the global data to update it
                let dataItem = null;
                if (profileData.serviceId) { // It's a scheduled appointment
                    dataItem = (window.appData.appointments || []).find(a => a.serviceId === profileData.serviceId);
                } else { // It's a walk-in, match by plate and service
                    dataItem = (window.appData.walkins || []).find(w => w.plate === profileData.plate && w.service === profileData.service);
                }

                if (dataItem) {
                    // Update the status in both the global data and the local profileData
                    dataItem.status = newStatus;
                    profileData.status = newStatus;

                    // Re-render the tracker with the new status
                    trackerContainer.remove(); // Remove the old tracker
                    createStatusTracker(newStatus); // Create a new one with the updated status

                    // Re-render the history table to show the updated status there too
                    populateServiceHistory(profileData.customer || profileData.name);

                    // Show a success message
                    if (typeof showSuccessToast === 'function') {
                        showSuccessToast(`Status updated to "${newStatus}"`);
                    }
                } else {
                    alert('Could not find the original record to update.');
                }
            });
        }
    };
 
    createStatusTracker(profileData.status);
    
    // --- Populate Service History ---
    const populateServiceHistory = (profile) => {
        const historyTableBody = document.querySelector('#service-history-table tbody');
        const noHistoryMessage = document.querySelector('.profile-history .no-history');
        if (!historyTableBody || !noHistoryMessage) return;

        // A customer identifier (ID or plate) is required to find history.
        if (!profile.customerId && !profile.plate) {
            noHistoryMessage.style.display = 'block';
            historyTableBody.innerHTML = '';
            return;
        }

        // Find history based on the type of profile we are viewing.
        const customerHistory = [
            ...(window.appData.appointments || []).filter(appt => appt.customer === customerName),
            // Only include walk-in history if the current profile is a walk-in (has no serviceId)
            // and has a plate number to match against. This logic is being updated.
            ...(window.appData.walkins || []).filter(walkin => walkin.plate === profile.plate)
        ];

        customerHistory.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
        historyTableBody.innerHTML = ''; // Clear previous history before populating
        if (customerHistory.length === 0) {
            noHistoryMessage.style.display = 'block';
            return;
        }

        // After sorting, the first item is the most recent.
        // Let's update the "Last Service Availed" field in the profile card.
        const lastServiceEl = document.getElementById('profile-service');
        if (lastServiceEl && customerHistory.length > 0) {
            lastServiceEl.textContent = customerHistory[0].service;
        } else if (lastServiceEl) {
            lastServiceEl.textContent = 'N/A';
        }

        const fragment = document.createDocumentFragment();
        customerHistory.forEach(item => {
            const row = document.createElement('tr');
            const statusClass = (item.status || '').toLowerCase().replace(/\s+/g, '-');
            const itemDate = item.datetime ? new Date(item.datetime.replace(' - ', ' ')) : null;
            const datePart = itemDate ? itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
            const timePart = itemDate ? itemDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'N/A';

            // Create a styled badge for the payment status
            const paymentStatus = item.paymentStatus || 'N/A';
            const paymentStatusClass = paymentStatus.toLowerCase();
            const paymentBadge = `<span class="payment-status-badge ${paymentStatusClass}">${paymentStatus}</span>`;

            row.innerHTML = `
                <td>${datePart}</td>
                <td class="text-center">${timePart}</td>
                <td>${item.service}</td>
                <td>${item.technician}</td>
                <td class="text-center"><span class="${statusClass}">${item.status}</span></td>
                <td class="text-center">${paymentBadge}</td>
            `;
            fragment.appendChild(row);
        });
        historyTableBody.appendChild(fragment);
    };

    populateServiceHistory(profileData);

    // --- Back Button Functionality ---
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Navigate to the stored previous page, or fall back to customers.html
            const previousPage = sessionStorage.getItem('previousPage');
            // Clean up the session storage item after using it
            sessionStorage.removeItem('previousPage');
            window.location.href = previousPage || 'customers.html';
        });
    }
});