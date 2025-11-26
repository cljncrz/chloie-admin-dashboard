document.addEventListener('DOMContentLoaded', () => {
    // This script runs on the technician-profile.html page

    // Retrieve the stored data from sessionStorage
    const storedData = sessionStorage.getItem('selectedTechnicianData');

    if (!storedData) {
        // If no data is found, display an error message
        document.getElementById('profile-name').textContent = 'Technician Not Found';
        document.getElementById('profile-header-role').textContent = 'Please go back and select a technician.';
        return;
    }

    const techData = JSON.parse(storedData);
    let currentRole = techData.role || 'Detailing Technician'; // Default if no role is set

    // Populate the profile page with the technician's data
    const profileName = document.getElementById('profile-name');
    const profileHeaderRole = document.getElementById('profile-header-role');
    const profileDetailsRoleContainer = document.getElementById('profile-details-role');
    const profileId = document.getElementById('profile-id');

    if (profileName) profileName.textContent = techData.name || 'N/A';
    if (profileId) profileId.textContent = `ID: ${techData.id || 'N/A'}`;
    if (profileHeaderRole) profileHeaderRole.textContent = currentRole;
    
    // --- Role Dropdown Functionality ---
    if (profileDetailsRoleContainer) {
        // Expanded role options requested by user
        const roles = [
            'Vehicle Prepper / Wash Technician',
            'Tunnel Operator',
            'Finisher / Wipe-Down Attendant',
            'Car Detailer / Auto Detail Technician',
            'Lot Attendant / Vehicle Mover'
        ];
        let selectedRole = currentRole;
        let isEditMode = false;

        // Create initial role display with edit button
        const roleDisplay = document.createElement('div');
        roleDisplay.id = 'role-display';
        roleDisplay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span id="role-value">${currentRole}</span>
                <button id="role-edit-btn" class="btn-icon" title="Edit Role" style="background: none; border: none; padding: 0; cursor: pointer; color: var(--color-primary);">
                    <span class="material-symbols-outlined" style="font-size: 1.2rem;">edit</span>
                </button>
            </div>
        `;

        profileDetailsRoleContainer.innerHTML = ''; // Clear the element
        profileDetailsRoleContainer.appendChild(roleDisplay);

        const editBtn = document.getElementById('role-edit-btn');
        const cancelBtn = document.getElementById('role-cancel-btn');
        const saveBtn = document.getElementById('role-save-btn');
        const roleEditActions = document.getElementById('role-edit-actions');

        // Toggle edit mode
        editBtn.addEventListener('click', () => {
            isEditMode = true;
            selectedRole = currentRole;

            // Hide display and edit button
            roleDisplay.style.display = 'none';
            roleEditActions.style.display = 'flex';

            // Create and show select dropdown
            const select = document.createElement('select');
            select.id = 'role-select';
            select.classList.add('technician-select');
            select.style.marginBottom = '0';

            roles.forEach(role => {
                const option = document.createElement('option');
                option.value = role;
                option.textContent = role;
                if (role === currentRole) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            // Insert select before the action buttons
            roleEditActions.parentElement.insertBefore(select, roleEditActions);

            // Update selectedRole on change
            select.addEventListener('change', (e) => {
                selectedRole = e.target.value;
            });
        });

        // Cancel button
        cancelBtn.addEventListener('click', () => {
            isEditMode = false;
            roleDisplay.style.display = 'block';
            roleEditActions.style.display = 'none';
            const select = document.getElementById('role-select');
            if (select) select.remove();
        });

        // Save button
        saveBtn.addEventListener('click', async () => {
            // Prevent double-click
            saveBtn.disabled = true;
            try {
                const db = window.firebase.firestore();

                // Update in Firestore
                await db.collection('technicians').doc(techData.id).update({
                    role: selectedRole,
                    description: selectedRole  // Also update description to match role
                });

                // Update local data
                currentRole = selectedRole;
                techData.role = selectedRole;
                updateTechnicianRole(techData, selectedRole);

                // Update UI
                const roleValueEl = document.getElementById('role-value');
                if (roleValueEl) roleValueEl.textContent = selectedRole;
                if (profileHeaderRole) profileHeaderRole.textContent = selectedRole;

                // Hide edit mode
                isEditMode = false;
                roleDisplay.style.display = 'block';
                roleEditActions.style.display = 'none';
                const select = document.getElementById('role-select');
                if (select) select.remove();

                // Show success feedback then reload the page so other pages reflect the change
                if (typeof showSuccessToast === 'function') {
                    showSuccessToast(`Role updated to ${selectedRole}`);
                } else {
                    // Fallback alert for environments without the toast helper
                    alert(`Role updated to ${selectedRole}`);
                }

                // Wait a short moment to let the toast appear, then reload the page
                setTimeout(() => {
                    // reload current page so UI/data refreshes across the app
                    window.location.reload();
                }, 900);
            } catch (error) {
                console.error('Error updating role:', error);
                // Re-enable save button so user can retry
                saveBtn.disabled = false;
                if (typeof showSuccessToast === 'function') {
                    showSuccessToast('Failed to update role. Please try again.');
                } else {
                    alert('Failed to update role. Please try again.');
                }
            }
        });
    }

    // --- Populate Assigned Tasks ---
    const populateAssignedTasks = async (technicianName) => {
        const tasksTableBody = document.querySelector('#assigned-tasks-body');
        const tasksCountEl = document.getElementById('assigned-tasks-count');
        if (!tasksTableBody) return;

        const noHistoryRow = tasksTableBody.querySelector('.no-history');
        if (!noHistoryRow) return;

        try {
            const db = window.firebase.firestore();
            const assignedTasks = [];

            // Fetch from 'bookings' collection
            const bookingsSnapshot = await db.collection('bookings').where('technician', '==', technicianName).get();

            // Map docs to task objects, resolving customer name when it's stored as a userId (string or object)
            const bookingTasksPromises = bookingsSnapshot.docs.map(async (doc) => {
                const data = doc.data();

                // Try common direct name fields first
                let customerName = data.customerName || data.customer || data.fullName || null;

                // If not found, try resolving from userId which may be a string (doc id) or an object containing name/email
                if (!customerName && data.userId) {
                    try {
                        if (typeof data.userId === 'string') {
                            const userDoc = await db.collection('users').doc(data.userId).get();
                            if (userDoc.exists) {
                                const u = userDoc.data();
                                customerName = u.fullName || u.name || u.displayName || u.email || null;
                            }
                        } else if (typeof data.userId === 'object') {
                            customerName = data.userId.fullName || data.userId.name || data.userId.displayName || data.userId.email || null;
                        }
                    } catch (err) {
                        console.warn('Could not resolve userId for booking', doc.id, err);
                    }
                }

                return {
                    id: doc.id,
                    plate: data.plateNumber || data.plate || 'N/A',
                    customer: customerName || 'N/A',
                    service: data.serviceNames || data.service || 'N/A',
                    status: data.status || 'N/A',
                };
            });

            const bookingTasks = await Promise.all(bookingTasksPromises);
            assignedTasks.push(...bookingTasks);
            

            // Fetch from 'walkins' collection (resolve userId if present)
            const walkinsSnapshot = await db.collection('walkins').where('technician', '==', technicianName).get();
            const walkinTasksPromises = walkinsSnapshot.docs.map(async (doc) => {
                const data = doc.data();

                let customerName = data.customerName || data.fullName || null;
                if (!customerName && data.userId) {
                    try {
                        if (typeof data.userId === 'string') {
                            const userDoc = await db.collection('users').doc(data.userId).get();
                            if (userDoc.exists) {
                                const u = userDoc.data();
                                customerName = u.fullName || u.name || u.displayName || u.email || null;
                            }
                        } else if (typeof data.userId === 'object') {
                            customerName = data.userId.fullName || data.userId.name || data.userId.displayName || data.userId.email || null;
                        }
                    } catch (err) {
                        console.warn('Could not resolve userId for walkin', doc.id, err);
                    }
                }

                return {
                    id: doc.id,
                    plate: data.plate || data.plateNumber || 'N/A',
                    customer: customerName || data.customer || 'N/A',
                    service: data.service || data.serviceName || 'N/A',
                    status: data.status || 'N/A',
                };
            });

            const walkinTasks = await Promise.all(walkinTasksPromises);
            assignedTasks.push(...walkinTasks);

            // Update the total tasks count in the card header
            const completedTasks = assignedTasks.filter(task => task.status === 'Completed').length;
            if (tasksCountEl) {
                tasksCountEl.textContent = `${completedTasks} Completed`;
            }

            if (assignedTasks.length === 0) {
                noHistoryRow.style.display = 'table-row';
                return;
            }

            const fragment = document.createDocumentFragment();
            assignedTasks.forEach(task => {
                const row = document.createElement('tr');
                const statusClass = (task.status || '').toLowerCase().replace(/\s+/g, '-');
                row.innerHTML = `
                    <td>${task.id}</td>
                    <td>${task.plate}</td>
                    <td>${task.customer}</td>
                    <td>${task.service}</td>
                    <td class="text-center"><span class="${statusClass}">${task.status}</span></td>
                `;
                fragment.appendChild(row);
            });
            noHistoryRow.style.display = 'none'; // Hide the no history row
            tasksTableBody.innerHTML = ''; // Clear previous content
            tasksTableBody.appendChild(fragment);

        } catch (error) {
            console.error("Error fetching assigned tasks:", error);
            noHistoryRow.style.display = 'table-row';
            noHistoryRow.querySelector('td').textContent = 'Error loading tasks.';
        }
    };

    populateAssignedTasks(techData.name);

    // --- Populate Technician Reviews ---
    const populateTechnicianReviews = async (technicianName) => {
        const feedbackContainer = document.getElementById('technician-feedback-container');
        if (!feedbackContainer) return;

        try {
            const db = window.firebase.firestore();
            
            // Fetch reviews from technician_feedbacks collection for this technician
            const feedbacksSnapshot = await db.collection('technician_feedbacks')
                .where('technicianName', '==', technicianName)
                .get();

            if (feedbacksSnapshot.empty) {
                feedbackContainer.innerHTML = '<p class="text-muted" style="text-align: center; padding: 2rem;">No customer feedback yet.</p>';
                return;
            }

            feedbackContainer.innerHTML = ''; // Clear any existing content
            const fragment = document.createDocumentFragment();

            // Convert to array and sort by timestamp (most recent first)
            const feedbackDocs = feedbacksSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => {
                    const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
                    const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
                    return bTime - aTime;
                });

            // Process each feedback and fetch related data
            const feedbackPromises = feedbackDocs.map(async (feedback) => {
                let customerName = 'Anonymous';
                let serviceName = 'Service';
                let carType = 'sedan';

                // Fetch customer name from userId
                if (feedback.userId) {
                    try {
                        const userDoc = await db.collection('users').doc(feedback.userId).get();
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            customerName = userData.fullName || userData.name || userData.displayName || userData.email || 'Anonymous';
                        }
                    } catch (err) {
                        console.warn('Could not fetch user data for feedback', feedback.id, err);
                    }
                }

                // Fetch service details from bookingId
                if (feedback.bookingId) {
                    try {
                        // Try bookings collection first
                        let bookingDoc = await db.collection('bookings').doc(feedback.bookingId).get();
                        
                        // If not found in bookings, try walkins collection
                        if (!bookingDoc.exists) {
                            bookingDoc = await db.collection('walkins').doc(feedback.bookingId).get();
                        }

                        if (bookingDoc.exists) {
                            const bookingData = bookingDoc.data();
                            serviceName = bookingData.serviceNames || bookingData.service || bookingData.serviceName || 'Service';
                            carType = bookingData.carType || 'sedan';
                        }
                    } catch (err) {
                        console.warn('Could not fetch booking data for feedback', feedback.id, err);
                    }
                }

                return { feedback, customerName, serviceName, carType };
            });

            const enrichedFeedbacks = await Promise.all(feedbackPromises);

            enrichedFeedbacks.forEach(({ feedback, customerName, serviceName, carType }) => {
                const reviewCard = document.createElement('div');
                reviewCard.classList.add('feedback-card');

                // Generate star rating HTML
                let stars = '';
                const rating = feedback.rating || 0;
                for (let i = 0; i < 5; i++) {
                    stars += `<span class="material-symbols-outlined ${i < rating ? 'filled' : ''}">star</span>`;
                }

                // Get car image
                const carImageSrc = getCarImage(carType);

                // Format date
                let dateStr = 'N/A';
                if (feedback.timestamp) {
                    try {
                        const date = feedback.timestamp.toDate ? feedback.timestamp.toDate() : new Date(feedback.timestamp);
                        dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    } catch (e) {
                        console.warn('Could not parse timestamp:', e);
                    }
                }

                reviewCard.innerHTML = `
                    <div class="feedback-media">
                        <img src="${carImageSrc}" alt="Customer car">
                    </div>
                    <div class="feedback-content">
                        <div class="review-header">
                            <h3>${customerName}</h3>
                            <small class="text-muted">${serviceName} &bull; ${dateStr}</small>
                        </div>
                        <div class="review-rating">${stars}</div>
                        <p class="review-comment">"${feedback.comment || feedback.feedback || 'No comment provided'}"</p>
                    </div>
                `;
                fragment.appendChild(reviewCard);
            });
            
            feedbackContainer.appendChild(fragment);

        } catch (error) {
            console.error("Error fetching technician feedbacks:", error);
            feedbackContainer.innerHTML = '<p class="text-muted" style="text-align: center; padding: 2rem;">Error loading customer feedback.</p>';
        }
    };

    populateTechnicianReviews(techData.name);

    // --- Back Button Functionality ---
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.back();
        });
    }
});

function getCarImage(carType) {
    // Return a default car image based on car type
    // You can customize this to return different images for different car types
    const carImages = {
        // Map common car types to a bundled image that exists in the repo
        'sedan': './images/redicon.png',
        'suv': './images/redicon.png',
        'truck': './images/redicon.png',
        'van': './images/redicon.png',
        'coupe': './images/redicon.png',
        'hatchback': './images/redicon.png'
    };
    const type = (carType || 'sedan').toLowerCase();
    return carImages[type] || './images/redicon.png'; // Default fallback image
}

function updateTechnicianRole(techData, newRole) {
    // Find the technician in the technicians array in technicians.js and update the role
    const technicians = window.appData.technicians;
    if (technicians) {
        const techIndex = technicians.findIndex(tech => tech.id === techData.id);
        if (techIndex > -1) {
            technicians[techIndex].role = newRole; // Update the role in the technicians array
        }
    }

    // Update the techData object as well
    techData.role = newRole;

    // Update the header role text
    const profileHeaderRole = document.getElementById('profile-header-role');
    if (profileHeaderRole) profileHeaderRole.textContent = newRole;

    return techData;
}