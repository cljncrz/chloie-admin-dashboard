document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to be initialized
    await window.firebaseInitPromise;
    
    const db = window.firebase.firestore();
    const auth = window.firebase.auth();
    const storage = window.firebase.storage();
    
    // --- DOM Elements ---
    const cardsContainer = document.getElementById('technician-cards-grid');
    const searchInput = document.getElementById('technician-search'); // Assuming there's a search input for technicians
    const loader = document.querySelector('#technicians-table-container .table-loader');
    const noResultsEl = document.querySelector('#technician-cards-grid + .no-results-row'); // Assuming a no-results row for cards

    // --- Data State ---
    window.appData.technicians = window.appData.technicians || []; // Ensure it's initialized
    let technicians = window.appData.technicians; // Reference to the global array

    // --- Helper Functions ---

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
                    // Defensive check for valid data
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
  
    // --- Main Fetch and Render Function ---
    const fetchAndPopulateTechnicians = async () => {
        if (loader) loader.classList.add('loading');
        if (cardsContainer) cardsContainer.innerHTML = ''; // Clear existing cards
    
        try {
            // Fetch all documents from the 'technicians' collection
            const snapshot = await db.collection('technicians').get();

            if (snapshot.empty) {
                if (noResultsEl) noResultsEl.style.display = 'block';
                console.log('No technician documents found in Firestore.');
                technicians = []; // Clear local data if no technicians found
                window.appData.technicians = technicians; // Update the global data source
                return;
            }

            // Map Firestore documents to local technician objects
            technicians = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            window.appData.technicians = technicians; // Update the global data source

            // Filter out "Unassigned" for the main list view (if it exists in Firestore)
            // The "Unassigned" technician is a system entry and should not be displayed in the main list.
            const displayableTechnicians = technicians.filter(tech => tech && tech.name !== 'Unassigned');

            const fragment = document.createDocumentFragment();
                displayableTechnicians.forEach(tech => {
                if (tech && tech.name) {
                    const card = createTechnicianCard(tech);
                    fragment.appendChild(card);
                }
            });
            if (cardsContainer) cardsContainer.appendChild(fragment);

            if (noResultsEl) noResultsEl.style.display = displayableTechnicians.length === 0 ? 'block' : 'none';

        } catch (error) {
            console.error("Error fetching technicians from Firestore:", error);
            if (noResultsEl) {
                noResultsEl.style.display = 'block';
                noResultsEl.querySelector('td').textContent = 'Error loading technicians.';
            }
        } finally {
            if (loader) loader.classList.remove('loading');
        }
    };

        // Card container: handle clicks for view/delete and card body click
        if (cardsContainer) {
            cardsContainer.addEventListener('click', (e) => {
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
                if (cardEl && !viewBtn && !deleteBtn) { // Ensure click wasn't on a button
                    const id = cardEl.dataset.technicianId;
                    const tech = technicians.find(t => t.id === id);
                    if (tech) {
                        sessionStorage.setItem('selectedTechnicianData', JSON.stringify(tech));
                        window.location.href = `technician-profile.html?id=${id}`;
                    }
                }
            });
        }
        const confirmOverlay = document.getElementById('delete-confirm-overlay');
        const confirmMessage = document.getElementById('delete-confirm-message');
        const confirmBtn = document.getElementById('delete-confirm-btn');
        const cancelBtn = document.getElementById('delete-cancel-btn');
        const closeModalBtn = document.getElementById('delete-confirm-close-btn');

        const openDeleteConfirmModal = (tech) => {
            if (!confirmOverlay) return;
            confirmMessage.innerHTML = `Are you sure you want to delete <strong>${tech.name}</strong>? This action cannot be undone.`;
            confirmOverlay.classList.add('show');
            document.body.classList.add('delete-modal-open');
            confirmBtn.onclick = async () => { // Make onclick async
                await deleteTechnician(tech.id); // Await deletion
                closeDeleteConfirmModal();
            };
        };

        const closeDeleteConfirmModal = () => {
            if (confirmOverlay) confirmOverlay.classList.remove('show');
            document.body.classList.remove('delete-modal-open');
        };

        const deleteTechnician = async (techId) => {
            try {
                // 1. Delete from Firestore
                await db.collection('technicians').doc(techId).delete();
                
                // 2. Remove from local data array
                const techIndex = technicians.findIndex(t => t.id === techId);
                if (techIndex > -1) {
                    technicians.splice(techIndex, 1);
                }
                
                // 3. Remove card from UI if present
                if (cardsContainer) {
                    const card = cardsContainer.querySelector(`.tech-card[data-technician-id="${techId}"]`);
                    if (card) card.remove();
                }
                
                // 4. Log the activity
                if (window.firebase.auth().currentUser) {
                    await logAdminActivity(window.firebase.auth().currentUser.uid, 'Deleted Technician', `Deleted technician with ID: ${techId}`);
                }
                
                // 5. Show success message
                if (typeof showSuccessToast === 'function') showSuccessToast('Technician deleted successfully!');
            } catch (error) {
                console.error("Error deleting technician from Firestore:", error);
                if (typeof showSuccessToast === 'function') showSuccessToast('Failed to delete technician. Please try again.');
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
            addTechnicianForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nameInput = document.getElementById('technician-name');
                const descriptionInput = document.getElementById('technician-description');
                const newName = nameInput.value.trim();
                const newDesc = descriptionInput ? descriptionInput.value.trim() : '';

                if (!newName) {
                    // Consider implementing a dedicated showErrorToast for better UX
                    if (typeof showSuccessToast === 'function') showSuccessToast('Please enter a technician name.');
                    return;
                }

                // Disable submit button and show loading indicator (optional but good UX)
                const submitButton = addTechnicianForm.querySelector('button[type="submit"]');
                const originalButtonText = submitButton.textContent;
                submitButton.textContent = 'Adding...';
                submitButton.disabled = true;

                try {
                    // 1. Generate a new document ID beforehand
                    const newTechDocRef = db.collection('technicians').doc(); // Get a new document reference with an auto-generated ID
                    const newTechId = newTechDocRef.id;

                    let avatarDownloadURL = './images/redicon.png'; // Default avatar

                    // Helper function to convert data URL to Blob
                    const dataURLtoBlob = (dataurl) => {
                        const arr = dataurl.split(',');
                        const mime = arr[0].match(/:(.*?);/)[1];
                        const bstr = atob(arr[1]);
                        let n = bstr.length;
                        const u8arr = new Uint8Array(n);
                        while (n--) {
                            u8arr[n] = bstr.charCodeAt(n);
                        }
                        return new Blob([u8arr], { type: mime });
                    };

                    // 2. Handle avatar upload to Firebase Storage if a custom avatar is selected
                    if (selectedAvatarDataURL && selectedAvatarDataURL !== './images/redicon.png') {
                        try {
                            const avatarBlob = dataURLtoBlob(selectedAvatarDataURL);
                            const avatarFileName = `technician_avatars/${newTechId}_${Date.now()}`;
                            const avatarRef = storage.ref().child(avatarFileName);
                            const uploadTask = await avatarRef.put(avatarBlob);
                            avatarDownloadURL = await uploadTask.ref.getDownloadURL();
                        } catch (uploadError) {
                            console.error("Error uploading avatar to Firebase Storage:", uploadError);
                            // Fallback to default avatar if upload fails
                            // Consider implementing a dedicated showErrorToast for better UX
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to upload avatar. Technician will be added with a default avatar.');
                        }
                    }

                    // 3. Create the technician object for Firestore
                    const technicianData = {
                        name: newName,
                        fullName: newName,
                        description: newDesc,
                        role: 'technician',
                        status: 'Active',
                        tasks: 0,
                        rating: 0,
                        avatar: avatarDownloadURL, // Use the uploaded URL or default
                        createdAt: window.firebase.firestore().FieldValue.serverTimestamp()
                    };

                    // 4. Save to Firestore using the pre-generated ID
                    await db.collection('technicians').doc(newTechId).set(technicianData);

                    // 5. Create the local object with the new Firestore ID
                    const newTechnicianForUI = { ...technicianData, id: newTechId };

                    // 6. Update the local state and UI
                    technicians.push(newTechnicianForUI);
                    if (cardsContainer) {
                        const newCard = createTechnicianCard(newTechnicianForUI);
                        cardsContainer.prepend(newCard);
                    }
                    
                    // 7. Log the activity
                    if (window.firebase.auth().currentUser) {
                        await logAdminActivity(window.firebase.auth().currentUser.uid, 'Created Technician', `Added new technician: ${newName} to technicians collection`);
                    }

                    // 8. Reset form and close modal
                    selectedAvatarDataURL = null;
                    if (avatarPreviewImg) avatarPreviewImg.src = './images/redicon.png';
                    addTechnicianForm.reset();
                    const modalOverlay = document.getElementById('modal-overlay');
                    if (modalOverlay) {
                        modalOverlay.classList.remove('show');
                        document.body.classList.remove('modal-open');
                        modalOverlay.querySelectorAll('.modal-content').forEach(content => content.classList.remove('active'));
                    }
                    if (typeof showSuccessToast === 'function') showSuccessToast('New technician added successfully!');
                } catch (error) {
                    console.error("Error adding technician to Firestore: ", error);
                    // Consider implementing a dedicated showErrorToast for better UX
                    if (typeof showSuccessToast === 'function') showSuccessToast('Failed to add technician. Please check the console for details.');
                } finally {
                    // Re-enable submit button
                    submitButton.textContent = originalButtonText;
                    submitButton.disabled = false;
                }
            });
    }

    // --- Initial Load ---
        fetchAndPopulateTechnicians();
});