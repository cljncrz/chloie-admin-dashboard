document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to be initialized
    await window.firebaseInitPromise;
    
    const db = window.firebase.firestore();
    const promotionsCarousel = document.getElementById('promotions-carousel');
    const promotionsTbody = document.getElementById('promotions-tbody');
    const successToast = document.getElementById('success-toast');

    // --- Delete Modal Elements ---
    const confirmOverlay = document.getElementById('delete-confirm-overlay');
    const confirmMessage = document.getElementById('delete-confirm-message');
    const confirmBtn = document.getElementById('delete-confirm-btn');
    const cancelBtn = document.getElementById('delete-cancel-btn');
    const closeModalBtn = document.getElementById('delete-confirm-close-btn');

    if (!promotionsTbody) {
        return;
    }

    let promotionsData = window.appData.promotions || [];

    // --- Define helper functions FIRST (before they're called) ---
    const createPromotionCarouselCard = (promo) => {
        const card = document.createElement('div');
        card.classList.add('promotion-card');

        const now = new Date();
        const expiryDate = new Date(promo.expiryDate);
        const isExpired = now > expiryDate;
        const status = isExpired ? 'Expired' : 'Active';

        card.classList.toggle('expired', isExpired);

        // --- Price Range Logic ---
        const getPriceRange = (prices) => {
            if (!prices) return '';
            const validPrices = Object.values(prices).filter(p => p !== null);
            if (validPrices.length === 0) return '';
            if (validPrices.length === 1) return `₱${validPrices[0].toLocaleString()}`;
            
            const minPrice = Math.min(...validPrices);
            const maxPrice = Math.max(...validPrices);

            if (minPrice === maxPrice) return `₱${minPrice.toLocaleString()}`;
            return `₱${minPrice.toLocaleString()} - ₱${maxPrice.toLocaleString()}`;
        };

        const promoPriceDisplay = getPriceRange(promo.promoPrices) || `₱${promo.promoPrice?.toLocaleString() || 'N/A'}`; // Fallback for old data
        const originalPriceDisplay = getPriceRange(promo.originalPrices) || (promo.originalPrice ? `₱${promo.originalPrice.toLocaleString()}` : '');

        const originalPriceHTML = originalPriceDisplay ? `<del>${originalPriceDisplay}</del>` : '';


        card.innerHTML = `
            <div class="promo-card-image" style="height: 120px;">
                <img src="${promo.imageUrl || 'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'}" alt="${promo.title}">
                <span class="promo-status-badge ${status.toLowerCase()}">${status}</span>
            </div>
            <div class="promo-card-content">
                <h3>${promo.title}</h3>
                <p>${promo.description}</p>
                <div class="promo-pricing">
                    <span class="promo-price">${promoPriceDisplay}</span>
                    ${originalPriceHTML}
                </div>
            </div>
            <div class="promo-card-footer">
                <div class="promo-countdown" data-expiry="${promo.expiryDate}">
                    <div class="countdown-item">
                        <span class="countdown-value" data-unit="days">00</span>
                        <span class="countdown-label">Days</span>
                    </div>
                    <div class="countdown-item">
                        <span class="countdown-value" data-unit="hours">00</span>
                        <span class="countdown-label">Hours</span>
                    </div>
                    <div class="countdown-item">
                        <span class="countdown-value" data-unit="minutes">00</span>
                        <span class="countdown-label">Mins</span>
                    </div>
                    <div class="countdown-item">
                        <span class="countdown-value" data-unit="seconds">00</span>
                        <span class="countdown-label">Secs</span>
                    </div>
                </div>
            </div>
        `;
        return card;
    };

    const createPromotionTableRow = (promo) => {
        const row = document.createElement('tr');
        row.dataset.promoId = promo.promoId; // Add promoId to the row for easy lookup
        const publishDate = new Date(promo.publishDate);
        const expiryDate = new Date(promo.expiryDate);

        // --- Date Validation & Formatting ---
        const isValidDate = (d) => d instanceof Date && !isNaN(d);
        const options = { month: 'short', day: 'numeric', year: 'numeric' };

        const formattedPublishDate = isValidDate(publishDate)
            ? publishDate.toLocaleDateString('en-US', options)
            : '<span class="text-muted">—</span>';
        const formattedExpiryDate = isValidDate(expiryDate)
            ? expiryDate.toLocaleDateString('en-US', options)
            : '<span class="text-muted">—</span>';

        // --- Price Range Logic for Table ---
        const getPriceRange = (prices) => {
            if (!prices) return '';
            const validPrices = Object.values(prices).filter(p => p !== null);
            if (validPrices.length === 0) return '';
            if (validPrices.length === 1) return `₱${validPrices[0].toLocaleString()}`;
            
            const minPrice = Math.min(...validPrices);
            const maxPrice = Math.max(...validPrices);

            if (minPrice === maxPrice) return `₱${minPrice.toLocaleString()}`;
            return `₱${minPrice.toLocaleString()} - ₱${maxPrice.toLocaleString()}`;
        };

        const promoPriceDisplay = getPriceRange(promo.promoPrices) || `₱${promo.promoPrice?.toLocaleString() || 'N/A'}`;
        const originalPriceDisplay = getPriceRange(promo.originalPrices) || (promo.originalPrice ? `₱${promo.originalPrice.toLocaleString()}` : '');

        const includedServicesHTML = (promo.services && Array.isArray(promo.services)) 
            ? promo.services.map(s => `<li>${s}</li>`).join('') 
            : '';
        const originalPriceHTML = originalPriceDisplay ? `<del>${originalPriceDisplay}</del>` : '';

        // --- Status Logic ---
        let status;
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalize to start of day for comparison

        // The status can be manually set to 'Expired' to override the date check
        if (promo.status === 'Draft') {
            status = 'Draft';
        } else if (promo.status === 'Expired') {
            status = 'Expired';
        } else if (expiryDate < now) {
            status = 'Expired';
        } else {
            status = 'Active';
        }

        // Create the status dropdown
        const statusClass = status.toLowerCase(); // e.g., 'active', 'draft', 'expired'
        const statusDropdown = `
            <select class="technician-select status-select-promo ${statusClass}" data-promo-id="${promo.promoId}">
                <option value="Active" ${status === 'Active' ? 'selected' : ''}>Active</option>
                <option value="Draft" ${status === 'Draft' ? 'selected' : ''}>Draft</option>
                <option value="Expired" ${status === 'Expired' ? 'selected' : ''}>Expired</option>
            </select>
        `;

        row.innerHTML = `
            <td>
                <div class="promo-banner-cell">
                    <img src="${promo.imageUrl || 'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'}" alt="${promo.title}">
                </div>
            </td>
            <td>
                <div class="promo-details-cell">
                    <strong>${promo.title}</strong>
                    <ul>${includedServicesHTML}</ul>
                </div>
            </td>
            <td>
                <div class="promo-pricing-cell">
                    <span class="promo-price">${promoPriceDisplay}</span>
                    ${originalPriceHTML}
                </div>
            </td>
            <td>${formattedPublishDate}</td>
            <td>${formattedExpiryDate}</td>
            <td class="text-center">
                ${statusDropdown}
            </td>
            <td class="text-center">
                <button class="action-icon-btn edit-promo-btn" title="Edit Promotion"><span class="material-symbols-outlined">edit</span></button>
                <button class="action-icon-btn delete-promo-btn" title="Delete Promotion"><span class="material-symbols-outlined">delete</span></button>
            </td>
        `;
        return row;
    };

    const renderPromotions = () => {
        promotionsCarousel.innerHTML = '';
        promotionsTbody.innerHTML = '';

        console.log('Rendering', promotionsData.length, 'promotions to table');

        promotionsData.forEach(promo => {
            // Add active promos to carousel
            if (promotionsCarousel && new Date() < new Date(promo.expiryDate) && promo.status !== 'Draft' && promo.status !== 'Expired') {
                promotionsCarousel.appendChild(createPromotionCarouselCard(promo));
            }
            // Add all promos to table
            const row = createPromotionTableRow(promo);
            promotionsTbody.appendChild(row);
            console.log(`Added promotion to table: ${promo.title} (${promo.promoId})`);
        });
        
        console.log('✅ Finished rendering promotions. Table rows:', promotionsTbody.querySelectorAll('tr').length);
    };

    const showSuccessToast = (message) => {
        if (!successToast) return;
        const toastText = successToast.querySelector('p');
        toastText.textContent = message;
        successToast.classList.add('show');

        // Hide after 3 seconds
        setTimeout(() => {
            successToast.classList.remove('show');
        }, 3000);
    };

    const updateCountdowns = () => {
        if (!promotionsCarousel) return; // Don't run if carousel doesn't exist
        const countdownElements = promotionsCarousel.querySelectorAll('.promo-countdown');
        countdownElements.forEach(el => {
            const expiryDate = new Date(el.dataset.expiry);
            const now = new Date();
            const diff = expiryDate - now;
            const daysEl = el.querySelector('[data-unit="days"]');

            if (diff <= 0 || !daysEl) {
                if (daysEl) { // Only update if it's not already showing the expired message
                    el.innerHTML = '<div class="countdown-expired">This promotion has expired.</div>';
                }
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((diff / 1000 / 60) % 60);
            const seconds = Math.floor((diff / 1000) % 60);
            el.querySelector('[data-unit="days"]').textContent = String(days).padStart(2, '0');
            el.querySelector('[data-unit="hours"]').textContent = String(hours).padStart(2, '0');
            el.querySelector('[data-unit="minutes"]').textContent = String(minutes).padStart(2, '0');
            el.querySelector('[data-unit="seconds"]').textContent = String(seconds).padStart(2, '0');
        });
    };

    // --- Delete Modal & Logic ---
    const openConfirmModal = (onConfirm) => {
        confirmOverlay.classList.add('show');
        document.body.classList.add('modal-open');

        // Use { once: true } to ensure the handler only runs once and is self-cleaning
        confirmBtn.addEventListener('click', () => {
            onConfirm();
            closeConfirmModal();
        }, { once: true });
    };

    const closeConfirmModal = () => {
        confirmOverlay.classList.remove('show');
        document.body.classList.remove('modal-open');
    };

    if (cancelBtn) cancelBtn.addEventListener('click', closeConfirmModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeConfirmModal);
    if (confirmOverlay) {
        confirmOverlay.addEventListener('click', (e) => {
            if (e.target === confirmOverlay) closeConfirmModal();
        });
    }

    const deletePromotion = async (promoId) => {
        const index = promotionsData.findIndex(p => p.promoId === promoId);
        if (index > -1) {
            const deletedPromoTitle = promotionsData[index].title;
            promotionsData.splice(index, 1); // Remove from data array
            
            // Delete from Firebase
            try {
                await db.collection('promotions').doc(promoId).delete();
                console.log(`Promotion ${promoId} deleted from Firebase`);
            } catch (error) {
                console.error(`Error deleting promotion from Firebase:`, error);
            }
            
            renderPromotions(); // Re-render the UI
            showSuccessToast(`Promotion "${deletedPromoTitle}" deleted successfully.`);
        } else {
            console.error(`Could not find promotion with ID: ${promoId} to delete.`);
        }
    };

     // --- Status Dropdown Change Listener ---
    promotionsTbody.addEventListener('change', async (e) => {
        const statusSelect = e.target.closest('.status-select-promo');
        if (statusSelect) {
            const promoId = statusSelect.dataset.promoId;
            const newStatus = statusSelect.value;
            const promoToUpdate = promotionsData.find(p => p.promoId === promoId);

            if (promoToUpdate) {
                // Update the status in our main data array
                promoToUpdate.status = newStatus;

                // Update status in Firebase
                try {
                    await db.collection('promotions').doc(promoId).update({ status: newStatus });
                    console.log(`Promotion ${promoId} status updated to ${newStatus} in Firebase`);
                } catch (error) {
                    console.error(`Error updating promotion status in Firebase:`, error);
                }

                // Update the dropdown's class to change its color
                statusSelect.classList.remove('active', 'draft', 'expired');
                statusSelect.classList.add(newStatus.toLowerCase());

                // Show a confirmation toast
                showSuccessToast(`Promotion "${promoToUpdate.title}" status updated to ${newStatus}.`);

                // Re-render the promotions to reflect changes (e.g., in the carousel)
                renderPromotions();
            }
        }
    });

    // Initial Render
    renderPromotions();
    updateCountdowns();

    // Update countdowns every second
    setInterval(updateCountdowns, 1000);

    // --- Action Button Event Listeners ---
    promotionsTbody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-promo-btn');
        const deleteBtn = e.target.closest('.delete-promo-btn');
        if (editBtn) {
            const row = editBtn.closest('tr');
            const promoId = row.dataset.promoId;
            const promoToEdit = promotionsData.find(p => p.promoId === promoId);

            if (promoToEdit) {
                sessionStorage.setItem('selectedPromotionData', JSON.stringify(promoToEdit));
                window.location.href = 'promotion-profile.html';
            }
        }

        if (deleteBtn) {
            const row = deleteBtn.closest('tr');
            const promoId = row.dataset.promoId;
            openConfirmModal(() => {
                deletePromotion(promoId);
            });
        }
    });

    // --- Fetch Promotions from Firestore (MUST BE AFTER ALL FUNCTIONS ARE DEFINED) ---
    const fetchPromotionsFromFirestore = async () => {
        try {
            const snapshot = await db.collection('promotions').get();
            
            if (snapshot.empty) {
                console.log('No promotions found in Firestore.');
                promotionsData = [];
            } else {
                promotionsData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const promotion = {
                        promoId: doc.id,
                        ...data,
                        // Ensure dates are properly formatted
                        publishDate: data.publishDate || new Date().toISOString(),
                        expiryDate: data.expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        // Ensure services is always an array
                        services: Array.isArray(data.services) ? data.services : []
                    };
                    return promotion;
                });
                console.log(`✅ ${promotionsData.length} promotions loaded from Firestore:`, promotionsData);
            }
            
            // After fetching from Firestore, check for newly created promotion from sessionStorage
            const newPromoJSON = sessionStorage.getItem('newlyCreatedPromotion');
            if (newPromoJSON) {
                const newPromo = JSON.parse(newPromoJSON);
                console.log('New promotion detected from sessionStorage:', newPromo);
                promotionsData.unshift(newPromo);
                sessionStorage.removeItem('newlyCreatedPromotion');
            }

            // Check for an updated promotion
            const updatedPromoJSON = sessionStorage.getItem('updatedPromotionData');
            if (updatedPromoJSON) {
                const updatedPromo = JSON.parse(updatedPromoJSON);
                console.log('Updated promotion detected from sessionStorage:', updatedPromo);
                const index = promotionsData.findIndex(p => p.promoId === updatedPromo.promoId);
                if (index !== -1) {
                    promotionsData[index] = updatedPromo;
                }
                sessionStorage.removeItem('updatedPromotionData');
            }

            console.log('Total promotions to display:', promotionsData.length);
            renderPromotions();
        } catch (error) {
            console.error('❌ Error fetching promotions from Firestore:', error);
            // Fallback to window.appData.promotions if Firestore fetch fails
            promotionsData = window.appData.promotions || [];
            console.log('Fallback to appData promotions:', promotionsData);
            renderPromotions();
        }
    };

    // Fetch promotions on page load
    await fetchPromotionsFromFirestore();
});