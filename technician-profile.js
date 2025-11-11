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
    const currentRole = techData.role || 'Detailing Technician'; // Default if no role is set

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
        const roles = ['Detailing Technician', 'Senior Technician', 'Trainee', 'Team Lead'];

        // Create and populate the select element
        const select = document.createElement('select');
        select.classList.add('technician-select'); // Re-use existing styles
        select.id = 'role-select';

        roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role;
            option.textContent = role;
            if (role === currentRole) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        // Replace the <p> with the <select>
        profileDetailsRoleContainer.innerHTML = ''; // Clear the element
        profileDetailsRoleContainer.appendChild(select);

        // Add event listener to handle changes
        select.addEventListener('change', (e) => {
            const newRole = e.target.value;
            updateTechnicianRole(techData, newRole);
            if (typeof showSuccessToast === 'function') showSuccessToast(`${techData.name}'s role updated to ${newRole}.`);
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