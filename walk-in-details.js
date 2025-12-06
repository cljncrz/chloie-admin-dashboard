document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const customerNameEl = document.getElementById('detail-customer-name');
    const walkinIdEl = document.getElementById('walk-in-id-subtitle');
    const serviceEl = document.getElementById('detail-service');
    const phoneEl = document.getElementById('detail-customer-phone');
    const plateEl = document.getElementById('detail-plate');
    const carNameEl = document.getElementById('detail-car-name');
    const carTypeEl = document.getElementById('detail-car-type');
    const avatarImg = document.getElementById('detail-customer-avatar');
    const backBtn = document.getElementById('back-btn');

    // --- State ---
    let walkinData = null;

    /**
     * Creates and populates the service progress tracker.
     * @param {string} currentStatus The current status of the walk-in.
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
    };

    /**
     * Parses different date/time string formats into a Date object.
     * @param {string | object} dateInput The date input to parse.
     * @returns {Date | null} A Date object or null if parsing fails.
     */
    const parseDate = (dateInput) => {
        if (!dateInput) return null;
        // Handle Firestore Timestamp objects
        if (typeof dateInput === 'object' && dateInput.seconds) {
            return new Date(dateInput.seconds * 1000);
        }
        // Handle ISO strings or other standard date strings
        const date = new Date(String(dateInput).replace(' - ', ' '));
        if (!isNaN(date)) {
            return date;
        }
        return null;
    };



    /**
     * Populates the payment information table for the walk-in.
     * @param {object} walkinData The walk-in data object.
     */
    const populatePaymentInfo = (walkinData) => {
        const paymentTableBody = document.querySelector('#payment-info-table tbody');
        const noPaymentMessage = document.querySelector('.profile-history .no-payment');
        if (!paymentTableBody || !noPaymentMessage) return;

        paymentTableBody.innerHTML = '';
        // Only show payment info for this walk-in
        const paymentStatus = walkinData.paymentStatus || 'Unpaid';
        const paymentStatusClass = paymentStatus.toLowerCase();
        const paymentMethod = walkinData.paymentMethod || 'N/A';
        const price = (walkinData.price !== undefined && walkinData.price !== null)
            ? `\u20b1${parseFloat(walkinData.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : 'N/A';
        const dateTime = walkinData.datetime ? new Date(walkinData.datetime).toLocaleString() : 'N/A';

        if (!walkinData.price && !walkinData.paymentStatus && !walkinData.paymentMethod) {
            noPaymentMessage.style.display = 'block';
            return;
        }
        noPaymentMessage.style.display = 'none';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="text-center">${dateTime}</td>
            <td>${price}</td>
            <td><span class="payment-status-badge ${paymentStatusClass}">${paymentStatus}</span></td>
            <td>${paymentMethod}</td>
        `;
        paymentTableBody.appendChild(row);
    };


    /**
     * Populates the page with walk-in details.
     * @param {object} data The walk-in data from sessionStorage.
     */
    const populateWalkinDetails = (data) => {
        if (!data) {
            document.querySelector('.profile-page-container').innerHTML = 
                '<p class="text-muted" style="text-align:center; padding: 2rem;">Walk-in data not found. Please go back and select a record.</p>';
            return;
        }

        // Populate with walk-in specific data
        walkinIdEl.textContent = `Plate: ${data.plate || 'N/A'}`;
        customerNameEl.textContent = data.customerName || 'Walk-in Customer';
        serviceEl.textContent = data.service || 'N/A';
        phoneEl.textContent = data.phone || 'N/A';
        plateEl.textContent = data.plate || 'N/A';
        carNameEl.textContent = data.carName || 'N/A';
        carTypeEl.textContent = data.carType || 'N/A';
        avatarImg.src = './images/redicon.png'; // Default avatar for walk-ins

        // Populate the service progress tracker
        createStatusTracker(data.status);

        // Populate the payment information for this walk-in
        populatePaymentInfo(data);
    };

    /**
     * Initializes the page by getting data from sessionStorage.
     */
    const initializePage = () => {
        const walkinDataString = sessionStorage.getItem('selectedWalkinData');
        if (walkinDataString) {
            walkinData = JSON.parse(walkinDataString);
            populateWalkinDetails(walkinData);
        } else {
            console.error('No walk-in data found in sessionStorage.');
            populateWalkinDetails(null); // Show an error message on the page
        }
    };

    const handleBackClick = (e) => {
        e.preventDefault();
        const previousPage = sessionStorage.getItem('previousPage') || 'appointment.html';
        window.location.href = previousPage;
    };

    /**
     * Deletes the walk-in record from Firestore.
     */
    const deleteWalkin = async () => {
        if (!walkinData || !walkinData.id) {
            if (typeof showSuccessToast === 'function') {
                showSuccessToast('Error: Walk-in data not found.', 'error');
            } else {
                alert('Error: Walk-in data not found.');
            }
            return;
        }

        // Only allow deletion of Pending walk-ins
        if (walkinData.status !== 'Pending') {
            if (typeof showSuccessToast === 'function') {
                showSuccessToast(`Cannot delete: This walk-in is ${walkinData.status}.`, 'error');
            } else {
                alert(`Cannot delete: This walk-in is ${walkinData.status}.`);
            }
            return;
        }

        // Confirm deletion
        const confirmDelete = confirm(`Are you sure you want to delete the walk-in for ${walkinData.plate}? This action cannot be undone.`);
        if (!confirmDelete) {
            return;
        }

        try {
            const db = window.firebase.firestore();
            await db.collection('walkins').doc(walkinData.id).delete();
            
            if (typeof showSuccessToast === 'function') {
                showSuccessToast(`Walk-in ${walkinData.plate} has been deleted.`);
            } else {
                alert(`Walk-in ${walkinData.plate} has been deleted.`);
            }

            // Redirect back to appointment page after a short delay
            setTimeout(() => {
                window.location.href = 'appointment.html';
            }, 1500);
        } catch (error) {
            console.error('Error deleting walk-in:', error);
            if (typeof showSuccessToast === 'function') {
                showSuccessToast('Failed to delete walk-in. Please try again.', 'error');
            } else {
                alert('Failed to delete walk-in. Please try again.');
            }
        }
    };

    // --- Event Listeners ---
    if (backBtn) {
        backBtn.addEventListener('click', handleBackClick);
    }

    const deleteBtn = document.getElementById('delete-walkin-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            deleteWalkin();
        });
    }

    // --- Initial Load ---
    initializePage();
});
