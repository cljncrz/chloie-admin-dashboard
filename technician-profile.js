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
                const db = firebase.firestore();

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
    const populateAssignedTasks = (technicianName) => {
        const tasksTableBody = document.getElementById('assigned-tasks-body');
        const noHistoryRow = tasksTableBody.querySelector('.no-history');

        if (!tasksTableBody || !noHistoryRow) return;

        // Check if global appointment data is available
        if (typeof window.appData?.appointments === 'undefined' || typeof window.appData?.walkins === 'undefined') {
            noHistoryRow.style.display = 'table-row';
            noHistoryRow.querySelector('td').textContent = 'Could not load appointment data.';
            return;
        }

        const assignedTasks = [
            ...window.appData.appointments.filter(appt => appt.technician === technicianName),
            ...window.appData.walkins.filter(walkin => walkin.technician === technicianName)
        ];

        if (assignedTasks.length === 0) {
            noHistoryRow.style.display = 'table-row';
            return;
        }

        const fragment = document.createDocumentFragment();
        assignedTasks.forEach(task => {
            const row = document.createElement('tr');
            const statusClass = task.status.toLowerCase().replace(' ', '-');
            row.innerHTML = `
                <td>${task.serviceId || task.plate}</td>
                <td>${task.customer || 'Walk-in'}</td>
                <td>${task.service}</td>
                <td class="${statusClass} text-center">${task.status}</td>
            `;
            fragment.appendChild(row);
        });
        tasksTableBody.appendChild(fragment);
    };

    populateAssignedTasks(techData.name);

    // --- Populate Technician Reviews ---
    const populateTechnicianReviews = (technicianName) => {
        const feedbackContainer = document.getElementById('technician-feedback-container');
        if (!feedbackContainer) return;

        // Check if global review and appointment data is available
        if (typeof window.appData?.reviews === 'undefined' || typeof window.appData?.appointments === 'undefined') {
            feedbackContainer.innerHTML = '<p class="text-muted" style="text-align: center; padding: 2rem;">Could not load review data.</p>';
            return;
        }

        // --- Image mapping for different car types ---
        const carImageMap = {
            'sedan': 'https://images.pexels.com/photos/112460/pexels-photo-112460.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            'suv': 'https://images.pexels.com/photos/3764984/pexels-photo-3764984.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            'pickup': 'https://images.pexels.com/photos/1637859/pexels-photo-1637859.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            'crossover': 'https://images.pexels.com/photos/1638459/pexels-photo-1638459.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            'mpv': 'https://images.pexels.com/photos/3807378/pexels-photo-3807378.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            'hatchback': 'https://images.pexels.com/photos/10394782/pexels-photo-10394782.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            'default': 'https://images.pexels.com/photos/3156482/pexels-photo-3156482.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
        };

        const getCarImage = (carType) => {
            return carImageMap[carType?.toLowerCase()] || carImageMap['default'];
        };

        // Find reviews linked to this technician's completed services
        const technicianReviews = window.appData.reviews.filter(review => {
            const matchingAppointment = window.appData.appointments.find(appt => 
                appt.customer === review.customer && 
                appt.service === review.service &&
                appt.technician === technicianName
            );
            return matchingAppointment;
        });

        if (technicianReviews.length > 0) {
            feedbackContainer.innerHTML = ''; // Clear the "no reviews" message
            const fragment = document.createDocumentFragment();
            technicianReviews.forEach(review => {
                const reviewCard = document.createElement('div');
                reviewCard.classList.add('feedback-card');

                let stars = '';
                for (let i = 0; i < 5; i++) {
                    stars += `<span class="material-symbols-outlined ${i < review.rating ? 'filled' : ''}">star</span>`;
                }

                const matchingAppointment = window.appData.appointments.find(appt => appt.customer === review.customer && appt.service === review.service);
                const carImageSrc = getCarImage(matchingAppointment?.carType);

                reviewCard.innerHTML = `
                    <div class="feedback-media">
                        <img src="${carImageSrc}" alt="${matchingAppointment?.carName || 'Customer car'}">
                    </div>
                    <div class="feedback-content">
                        <div class="review-header">
                            <h3>${review.customer}</h3>
                            <small class="text-muted">${review.service} &bull; ${review.date}</small>
                        </div>
                        <div class="review-rating">${stars}</div>
                        <p class="review-comment">"${review.comment}"</p>
                    </div>
                `;
                fragment.appendChild(reviewCard);
            });
            feedbackContainer.appendChild(fragment);
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