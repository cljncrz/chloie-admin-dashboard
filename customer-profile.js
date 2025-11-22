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

    // Set customer profile image (support both photoURL and photoUrl)
    const avatarImg = document.getElementById('profile-avatar-img');
    if (avatarImg) {
        if (profileData.photoURL) {
            avatarImg.src = profileData.photoURL;
        } else if (profileData.photoUrl) {
            avatarImg.src = profileData.photoUrl;
        } else {
            avatarImg.src = './images/redicon.png';
        }
    }
    
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
    
    // --- Populate Service History from Firestore ---
    const populateServiceHistory = async (profile) => {
        const historyTableBody = document.querySelector('#service-history-table tbody');
        const noHistoryMessage = document.querySelector('.profile-history .no-history');
        if (!historyTableBody || !noHistoryMessage) return;

        try {
            // Get customer userId from profileData
            let userId = profile.customerId || null;

            // If no customerId, try to get userId from Firestore by matching fullName
            if (!userId && profile.fullName) {
                const db = window.firebase.firestore();
                try {
                    const userSnapshot = await db.collection('users')
                        .where('fullName', '==', profile.fullName)
                        .limit(1)
                        .get();
                    
                    if (!userSnapshot.empty) {
                        userId = userSnapshot.docs[0].id;
                    }
                } catch (err) {
                    console.warn('Could not fetch userId from Firestore:', err);
                }
            }

            // A customer userId is required to find history.
            if (!userId) {
                noHistoryMessage.style.display = 'block';
                historyTableBody.innerHTML = '';
                return;
            }

            // Fetch completed bookings from Firestore for this userId
            const db = window.firebase.firestore();
            const bookingsSnapshot = await db.collection('bookings')
                .where('userId', '==', userId)
                .where('status', '==', 'Completed')
                .get();

            let customerHistory = [];
            
            if (!bookingsSnapshot.empty) {
                customerHistory = bookingsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    
                    // Helper function to parse Firestore dates
                    const parseFirestoreDate = (val) => {
                        if (!val) return null;
                        try {
                            // Firestore Timestamp with toDate() method
                            if (val && typeof val.toDate === 'function') return val.toDate();
                            
                            // Firestore-like object: { seconds, nanoseconds }
                            if (val && typeof val.seconds === 'number') {
                                return new Date(val.seconds * 1000);
                            }
                            
                            // String date
                            if (typeof val === 'string' && val.trim() !== '') {
                                const parsed = new Date(val);
                                if (!isNaN(parsed.getTime())) return parsed;
                            }
                            
                            // Number timestamp
                            if (typeof val === 'number') {
                                return new Date(val);
                            }
                            
                            // Native Date
                            if (val instanceof Date) {
                                return val;
                            }
                        } catch (e) {
                            // Silently fail and return null
                        }
                        return null;
                    };
                    
                    // Parse Firestore date - try multiple field names
                    let dateObj = null;
                    const possibleDateFields = ['time', 'scheduleDate', 'dateTime', 'datetime', 'date', 'scheduledAt', 'appointmentDate', 'timestamp', 'bookingDate', 'createdAt', 'scheduledDate'];
                    
                    for (let field of possibleDateFields) {
                        const dateValue = data[field];
                        dateObj = parseFirestoreDate(dateValue);
                        if (dateObj) {
                            break;
                        }
                    }
                    
                    // If still no date, try scanning all object values
                    if (!dateObj) {
                        for (const [key, value] of Object.entries(data)) {
                            dateObj = parseFirestoreDate(value);
                            if (dateObj) {
                                break;
                            }
                        }
                    }
                    
                    // Parse bookingTime if available (format: "1:20 PM - 2:20 PM" or similar)
                    let timeStr = '';
                    if (dateObj && data.bookingTime) {
                        const timeRange = data.bookingTime.split(' - ')[0]; // e.g., "1:20 PM"
                        const timeMatch = timeRange.match(/(\d+):(\d+)\s*(AM|PM)/i);
                        if (timeMatch) {
                            let hours = parseInt(timeMatch[1]);
                            const minutes = parseInt(timeMatch[2]);
                            const ampm = timeMatch[3].toUpperCase();
                            if (ampm === 'PM' && hours !== 12) hours += 12;
                            if (ampm === 'AM' && hours === 12) hours = 0;
                            dateObj.setHours(hours, minutes, 0, 0);
                            timeStr = data.bookingTime;
                        }
                    }

                    console.log('Booking doc:', data, 'Parsed date:', dateObj, 'Time string:', timeStr);

                    return {
                        service: data.serviceNames || data.service || 'Unknown Service',
                        technician: data.technician || 'N/A',
                        status: data.status || 'N/A',
                        paymentStatus: data.paymentStatus || 'N/A',
                        datetime: dateObj,
                        bookingTime: data.bookingTime || '',
                        datetimeString: dateObj ? dateObj.toISOString() : 'N/A'
                    };
                });
            }

            // Also include local walk-in history for the current profile (if applicable)
            if (profile.plate) {
                const localWalkins = (window.appData.walkins || []).filter(
                    walkin => walkin.plate === profile.plate && walkin.status === 'Completed'
                );
                customerHistory = [...customerHistory, ...localWalkins];
            }

            // Sort by most recent first
            customerHistory.sort((a, b) => {
                const dateA = a.datetime ? new Date(a.datetime) : null;
                const dateB = b.datetime ? new Date(b.datetime) : null;
                if (!dateA || !dateB) return 0;
                return dateB - dateA;
            });

            historyTableBody.innerHTML = ''; // Clear previous history before populating
            if (customerHistory.length === 0) {
                noHistoryMessage.style.display = 'block';
                return;
            }

            noHistoryMessage.style.display = 'none';

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
                
                // Format date and time
                let datePart = 'N/A';
                let timePart = 'N/A';
                
                if (item.datetime) {
                    try {
                        const itemDate = item.datetime instanceof Date ? item.datetime : new Date(item.datetime);
                        if (!isNaN(itemDate.getTime())) {
                            datePart = itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            
                            // Use bookingTime if available (full time range), otherwise use the datetime from the booking
                            if (item.bookingTime) {
                                timePart = item.bookingTime; // Use full booking time range
                            } else {
                                timePart = itemDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                            }
                        }
                    } catch (e) {
                        console.warn('Error formatting date:', item.datetime, e);
                    }
                }

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
        } catch (error) {
            console.error('Error populating service history from Firestore:', error);
            noHistoryMessage.style.display = 'block';
            historyTableBody.innerHTML = '';
        }
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