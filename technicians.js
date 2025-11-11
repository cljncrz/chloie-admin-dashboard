document.addEventListener('DOMContentLoaded', () => {
    // --- Populate Technician Table / Card Grid on technicians.html ---
    const technicianTableBody = document.getElementById('technicians-table-body');
    const cardsContainer = document.getElementById('technician-cards-grid');
    if ((technicianTableBody || cardsContainer) && window.appData && window.appData.technicians) {
        const technicians = window.appData.technicians; // Get data from the central source

        // Filter out "Unassigned" for the main list view
        const displayableTechnicians = technicians.filter(tech => tech && tech.name !== 'Unassigned'); 
        
        const addTechnicianToTable = (tech) => {
            if (!technicianTableBody) return; // table removed — skip
            const row = document.createElement('tr');
            row.dataset.technicianId = tech.id;
            row.classList.add('clickable-row');

            const statusBadgeClass = tech.status === 'Active' ? 'tech-active' : 'tech-on-leave';
            const starRatingHTML = createStarRating(tech.rating);

            row.innerHTML = `
                <td class="technician-table-info">
                    <div class="profile-photo"><img src="./images/redicon.png" alt="${tech.name}"></div>
                    <span>${tech.name}</span>
                </td>
                <td class="text-center">${tech.tasks}</td>
                <td class="text-center">${starRatingHTML}</td>
                <td>
                    <select class="status-select status-badge ${statusBadgeClass}" data-tech-id="${tech.id}">
                        <option value="Active" ${tech.status === 'Active' ? 'selected' : ''}>Active</option>
                        <option value="On Leave" ${tech.status === 'On Leave' ? 'selected' : ''}>On Leave</option>
                    </select>
                </td>
                <td class="text-center">
                    <button class="action-icon-btn view-profile-btn" title="View Profile"><span class="material-symbols-outlined">visibility</span></button>
                    <button class="action-icon-btn delete-tech-btn" title="Delete Technician">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </td>
            `;
            technicianTableBody.prepend(row); // Add new technician to the top
        };

        const fragment = document.createDocumentFragment();

        const createStarRating = (rating) => {
            let stars = '';
            const fullStars = Math.floor(rating);
            const halfStar = rating % 1 >= 0.5;
            for (let i = 0; i < 5; i++) {
                if (i < fullStars) {
                    stars += `<span class="material-symbols-outlined filled">star</span>`;
                } else if (i === fullStars && halfStar) {
                    stars += `<span class="material-symbols-outlined filled">star_half</span>`;
                } else {
                    stars += `<span class="material-symbols-outlined">star</span>`;
                }
            }
            return `<div class="review-rating">${stars}</div>`;
        };

                // Card view renderer: creates a card DOM element for a technician
                const createTechnicianCard = (tech) => {
                        const card = document.createElement('div');
                        card.className = 'tech-card';
                        card.dataset.technicianId = tech.id;

                        const stars = createStarRating(tech.rating || 0);
                        const avatarSrc = tech.avatar ? tech.avatar : './images/redicon.png';
                        card.innerHTML = `
                                <div class="status-badge">${tech.status || 'Active'}</div>
                                <div class="profile-photo"><img src="${avatarSrc}" alt="${tech.name}"></div>
                                <div class="tech-name">${tech.name}</div>
                                <div class="tech-desc">${tech.description || 'No description available.'}</div>
                                <hr />
                                <div class="summary">
                                    <div>
                                        <div class="label">Avg. Rating</div>
                                        ${stars}
                                    </div>
                                    <div>
                                        <div class="label">Tasks Today</div>
                                        <div class="value">${tech.tasks ?? 0}</div>
                                    </div>
                                </div>
                                <div class="card-actions">
                                    <button class="btn action-view btn-primary" data-tech-id="${tech.id}" title="View Profile"><span class="material-symbols-outlined">visibility</span> View Profile</button>
                                    <button class="btn action-delete" data-tech-id="${tech.id}" title="Delete Technician"><span class="material-symbols-outlined">delete</span></button>
                                </div>
                        `;

                        return card;
                };
  
        displayableTechnicians.forEach(tech => {
            // Defensive check for valid data
            if (tech && tech.name) {
                // table row (if table exists)
                addTechnicianToTable(tech);
                // card (if card container exists)
                if (cardsContainer) {
                    const card = createTechnicianCard(tech);
                    cardsContainer.appendChild(card);
                }
            }
        });
  
        // Add event listener for row clicks using event delegation (only if table exists)
        if (technicianTableBody) {
            technicianTableBody.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                if (!row || row.classList.contains('no-results-row')) return;

                const techId = row.dataset.technicianId;
                const tech = technicians.find(t => t.id === techId);
                if (!tech) return;

                // Check if the click was on an action button or the status dropdown
                const isStatusSelect = e.target.classList.contains('status-select');
                const isDeleteButton = e.target.closest('.delete-tech-btn');
                const isViewButton = e.target.closest('.view-profile-btn');

                if (isStatusSelect) {
                    // Handled by the 'change' event listener
                    return;
                }

                if (isDeleteButton) {
                    openDeleteConfirmModal(tech);
                    return;
                }

                // If the click was on the view button or anywhere else on the row, navigate
                if (isViewButton || !isDeleteButton) {
                    sessionStorage.setItem('selectedTechnicianData', JSON.stringify(tech));
                    window.location.href = `technician-profile.html?id=${tech.id}`;
                }
            });
        }

        // Add a 'change' event listener for the status dropdowns (if table exists)
        if (technicianTableBody) {
            technicianTableBody.addEventListener('change', (e) => {
                if (e.target.classList.contains('status-select')) {
                    const select = e.target;
                    const techId = select.dataset.techId;
                    const newStatus = select.value;
                    const tech = technicians.find(t => t.id === techId);
                    if (tech) tech.status = newStatus;

                    select.className = `status-select status-badge ${newStatus === 'Active' ? 'tech-active' : 'tech-on-leave'}`;
                }
            });
        }

        // Card container: handle clicks for view/delete and card body click
        const cardsContainerEl = document.getElementById('technician-cards-grid');
        if (cardsContainerEl) {
            cardsContainerEl.addEventListener('click', (e) => {
                const viewBtn = e.target.closest('.action-view');
                const deleteBtn = e.target.closest('.action-delete');
                const cardEl = e.target.closest('.tech-card');

                if (viewBtn) {
                    const id = viewBtn.dataset.techId;
                    const tech = technicians.find(t => t.id === id);
                    if (tech) {
                        sessionStorage.setItem('selectedTechnicianData', JSON.stringify(tech));
                        window.location.href = `technician-profile.html?id=${id}`;
                    }
                    return;
                }

                if (deleteBtn) {
                    const id = deleteBtn.dataset.techId;
                    const tech = technicians.find(t => t.id === id);
                    if (tech) openDeleteConfirmModal(tech);
                    return;
                }

                // clicking on card area opens profile
                if (cardEl && !e.target.closest('.action-delete') && !e.target.closest('.action-view')) {
                    const id = cardEl.dataset.technicianId;
                    const tech = technicians.find(t => t.id === id);
                    if (tech) {
                        sessionStorage.setItem('selectedTechnicianData', JSON.stringify(tech));
                        window.location.href = `technician-profile.html?id=${id}`;
                    }
                }
            });
        }

        // --- Delete Confirmation Modal Logic ---
        const confirmOverlay = document.getElementById('delete-confirm-overlay');
        const confirmMessage = document.getElementById('delete-confirm-message');
        const confirmBtn = document.getElementById('delete-confirm-btn');
        const cancelBtn = document.getElementById('delete-cancel-btn');
        const closeModalBtn = document.getElementById('delete-confirm-close-btn');

        const openDeleteConfirmModal = (tech) => {
            if (!confirmOverlay) return;
            confirmMessage.innerHTML = `Are you sure you want to delete <strong>${tech.name}</strong>? This action cannot be undone.`;
            confirmOverlay.classList.add('show');

            confirmBtn.onclick = () => {
                deleteTechnician(tech.id);
                closeDeleteConfirmModal();
            };
        };

        const closeDeleteConfirmModal = () => {
            if (confirmOverlay) confirmOverlay.classList.remove('show');
        };

        const deleteTechnician = (techId) => {
            const techIndex = technicians.findIndex(t => t.id === techId);
            if (techIndex > -1) {
                technicians.splice(techIndex, 1); // Remove from data array
                // remove from table if present
                if (technicianTableBody) {
                    const row = technicianTableBody.querySelector(`tr[data-technician-id="${techId}"]`);
                    if (row) row.remove();
                }
                // remove card if present
                if (cardsContainer) {
                    const card = cardsContainer.querySelector(`.tech-card[data-technician-id="${techId}"]`);
                    if (card) card.remove();
                }
                if (typeof showSuccessToast === 'function') showSuccessToast('Technician deleted successfully!');
            }
        };

        // Event listeners for the delete modal
        if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteConfirmModal);
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeDeleteConfirmModal);
        if (confirmOverlay) confirmOverlay.addEventListener('click', (e) => { if (e.target === confirmOverlay) closeDeleteConfirmModal(); });

        // --- Handle New Technician Form Submission ---
        const addTechnicianForm = document.getElementById('add-technician-form');
        const avatarInput = document.getElementById('technician-avatar-input');
        const avatarPreviewImg = document.getElementById('avatar-preview-img');
        let selectedAvatarDataURL = null;

        // Preview avatar when user selects a file
        if (avatarInput) {
            avatarInput.addEventListener('change', (evt) => {
                const file = evt.target.files && evt.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(e) {
                    selectedAvatarDataURL = e.target.result;
                    if (avatarPreviewImg) avatarPreviewImg.src = selectedAvatarDataURL;
                };
                reader.readAsDataURL(file);
            });
        }

        // Clicking the avatar preview label should open file picker
        const avatarLabel = document.querySelector('.avatar-upload-label');
        if (avatarLabel && avatarInput) {
            avatarLabel.addEventListener('click', () => avatarInput.click());
        }

        // Cancel button closes modal properly
        const addTechCancelBtn = document.getElementById('add-tech-cancel-btn');
        if (addTechCancelBtn) {
            addTechCancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Reset form and avatar preview
                selectedAvatarDataURL = null;
                if (avatarPreviewImg) avatarPreviewImg.src = './images/redicon.png';
                if (addTechnicianForm) addTechnicianForm.reset();
                // Close modal by removing 'show' class from overlay
                const modalOverlay = document.getElementById('modal-overlay');
                if (modalOverlay) {
                    modalOverlay.classList.remove('show');
                    document.body.classList.remove('modal-open');
                    const modalContents = modalOverlay.querySelectorAll('.modal-content');
                    modalContents.forEach(content => content.classList.remove('active'));
                }
            });
        }

        if (addTechnicianForm) {
            addTechnicianForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const nameInput = document.getElementById('technician-name');
                const descriptionInput = document.getElementById('technician-description');
                const newName = nameInput.value.trim();
                const newDesc = descriptionInput ? descriptionInput.value.trim() : '';

                if (newName) {
                    const newId = `TCH-${String(Date.now()).slice(-4)}`;
                    const newTechnician = {
                        id: newId,
                        name: newName,
                        status: 'Active',
                        tasks: 0,
                        rating: 0,
                        description: newDesc,
                        avatar: selectedAvatarDataURL || './images/redicon.png'
                    };
                    technicians.push(newTechnician); // Add to the main data array
                    addTechnicianToTable(newTechnician);
                    if (cardsContainer) {
                        const newCard = createTechnicianCard(newTechnician);
                        cardsContainer.prepend(newCard);
                    }
                    
                    // Reset and close
                    selectedAvatarDataURL = null;
                    if (avatarPreviewImg) avatarPreviewImg.src = './images/redicon.png';
                    addTechnicianForm.reset();
                    // Close modal
                    const modalOverlay = document.getElementById('modal-overlay');
                    if (modalOverlay) {
                        modalOverlay.classList.remove('show');
                        document.body.classList.remove('modal-open');
                        const modalContents = modalOverlay.querySelectorAll('.modal-content');
                        modalContents.forEach(content => content.classList.remove('active'));
                    }
                    if (typeof showSuccessToast === 'function') showSuccessToast('New technician added successfully!');
                }
            });
        }
  
        // Initialize table functionality for search and pagination
        if (typeof window.initializeTableFunctionality === 'function') {
            window.initializeTableFunctionality('#technicians-table-container');
        }
    }
  });
  