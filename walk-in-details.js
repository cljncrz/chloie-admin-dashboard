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
     * Finds and displays the service history for a given plate number.
     * @param {string} plateNumber The plate number to search for.
     */
    const populateServiceHistory = (plateNumber) => {
        const historyTableBody = document.querySelector('#service-history-table tbody');
        const noHistoryMessage = document.querySelector('.profile-history .no-history');

        if (!historyTableBody || !noHistoryMessage) return;

        // Combine all appointments and walk-ins to create a full history
        const allServices = [
            ...(window.appData.appointments || []),
            ...(window.appData.walkins || [])
        ];

        // Filter for services matching the plate number, excluding the current one being viewed
        const serviceHistory = allServices.filter(service => 
            service.plate === plateNumber && service.datetime !== walkinData.datetime
        ).sort((a, b) => new Date(b.datetime) - new Date(a.datetime)); // Sort by most recent first

        historyTableBody.innerHTML = ''; // Clear existing rows

        if (serviceHistory.length === 0) {
            noHistoryMessage.style.display = 'block';
            return;
        }

        noHistoryMessage.style.display = 'none';
        const fragment = document.createDocumentFragment();

        serviceHistory.forEach(item => {
            const row = document.createElement('tr');
            const itemDate = window.appData.parseCustomDate(item.datetime);
            const formattedDate = itemDate ? itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
            
            const statusClass = (item.status || '').toLowerCase().replace(' ', '-');
            const paymentStatus = item.paymentStatus || 'Unpaid';
            const paymentStatusClass = paymentStatus.toLowerCase();

            row.innerHTML = `
                <td class="text-center">${formattedDate}</td>
                <td>${item.service || item.serviceNames || 'N/A'}</td>
                <td>${item.technician || 'N/A'}</td>
                <td class="text-center"><span class="${statusClass}">${item.status}</span></td>
                <td class="text-center">
                    <span class="payment-status-badge ${paymentStatusClass}">${paymentStatus}</span>
                </td>
            `;
            fragment.appendChild(row);
        });

        historyTableBody.appendChild(fragment);
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

        // Populate the service history based on the plate number
        if (data.plate) populateServiceHistory(data.plate);
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

    // --- Event Listeners ---
    if (backBtn) {
        backBtn.addEventListener('click', handleBackClick);
    }

    // --- Initial Load ---
    initializePage();
});