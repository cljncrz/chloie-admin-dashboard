document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to be initialized
    await window.firebaseInitPromise;
    
    const db = window.firebase.firestore();
    const editPromotionForm = document.getElementById('edit-promotion-form');
    const storedData = sessionStorage.getItem('selectedPromotionData');

    if (!editPromotionForm || !storedData) {
        alert('Promotion data not found. Please return to the promotions list and select one to edit.');
        window.location.href = 'promotions.html';
        return;
    }

    const promoData = JSON.parse(storedData);

    // --- Get Form Elements ---
    const titleInput = document.getElementById('promo-title');
    const descriptionInput = document.getElementById('promo-description');
    const expiryInput = document.getElementById('promo-expiry');
    const publishInput = document.getElementById('promo-publish-date');
    const serviceChecklist = document.getElementById('promo-service-checklist');
    const imageInput = document.getElementById('promo-image-input');
    const imageElement = document.getElementById('profile-promo-image');
    const promoPricingContainer = document.getElementById('promo-pricing-details');
    const originalPricingContainer = document.getElementById('original-pricing-details');
    const chooseFromManagerBtn = document.querySelector('.choose-from-manager-btn');
    const saveDraftBtn = document.getElementById('save-draft-btn');
    const promoIdSubtitle = document.getElementById('promo-id-subtitle');

    // --- Populate Form Fields ---
    if (promoIdSubtitle) promoIdSubtitle.textContent = `ID: ${promoData.promoId}`;
    titleInput.value = promoData.title || '';
    descriptionInput.value = promoData.description || '';
    if (promoData.publishDate) {
        publishInput.value = new Date(promoData.publishDate).toISOString().split('T')[0];
    }
    if (promoData.expiryDate) {
        expiryInput.value = new Date(promoData.expiryDate).toISOString().split('T')[0];
    }

    // Populate Pricing Inputs
    const promoPrices = promoData.promoPrices || {};
    promoPricingContainer.innerHTML = `
        <label>Promo Price (₱)</label>
        <div class="pricing-grid">
            <input type="number" id="promo-price-small" placeholder="5-Seater / 399cc below" value="${promoPrices.small || ''}">
            <input type="number" id="promo-price-medium" placeholder="7-Seater / 400cc above" value="${promoPrices.medium || ''}">
            <
    `;

    const originalPrices = promoData.originalPrices || {};
    originalPricingContainer.innerHTML = `
        <input type="number" id="original-price-small" placeholder="5-Seater / 399cc below" value="${originalPrices.small || ''}">
        <input type="number" id="original-price-medium" placeholder="7-Seater / 400cc above" value="${originalPrices.medium || ''}">

    `;

    // --- Media Manager Integration ---
    if (chooseFromManagerBtn) {
        chooseFromManagerBtn.addEventListener('click', () => {
            const openerId = 'promo-profile-uploader';
            const pickerUrl = `media-manager.html?picker=true&openerId=${openerId}`;
            window.open(pickerUrl, 'MediaManager', 'width=1200,height=800,scrollbars=yes');
        });
    }

    // --- Fetch and Populate Service Checklist ---
    const populateServiceChecklist = async () => {
        try {
            // Fetch services from Firebase
            const servicesSnapshot = await db.collection('services').get();
            
            let allServices = [];
            if (!servicesSnapshot.empty) {
                allServices = servicesSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        serviceId: doc.id,
                        service: data.service || data.serviceName || 'Unknown Service',
                        ...data
                    };
                });
                console.log('Services fetched from Firebase:', allServices);
            } else {
                // Fallback to appData if Firebase is empty
                allServices = window.appData.services || [];
            }
            
            // Clear existing checkboxes
            serviceChecklist.innerHTML = '';
            
            // Populate Service Checklist
            allServices.forEach(service => {
                const isChecked = (promoData.services || []).includes(service.service);
                const itemHtml = `
                    <div class="checklist-item">
                        <input type="checkbox" id="service-${service.serviceId}" value="${service.service}" ${isChecked ? 'checked' : ''}>
                        <label for="service-${service.serviceId}">${service.service}</label>
                    </div>
                `;
                serviceChecklist.insertAdjacentHTML('beforeend', itemHtml);
            });
        } catch (error) {
            console.error('Error fetching services from Firebase:', error);
            // Fallback to appData if there's an error
            const allServices = window.appData.services || [];
            serviceChecklist.innerHTML = '';
            allServices.forEach(service => {
                const isChecked = (promoData.services || []).includes(service.service);
                const itemHtml = `
                    <div class="checklist-item">
                        <input type="checkbox" id="service-${service.serviceId}" value="${service.service}" ${isChecked ? 'checked' : ''}>
                        <label for="service-${service.serviceId}">${service.service}</label>
                    </div>
                `;
                serviceChecklist.insertAdjacentHTML('beforeend', itemHtml);
            });
        }
    };

    // Call the function to populate services
    await populateServiceChecklist();

    // Populate Image
    const renderImage = () => {
        const placeholderUrl = './images/services.png';
        imageElement.src = promoData.imageUrl || placeholderUrl;
        imageElement.onerror = () => { imageElement.src = placeholderUrl; };
    };

    // --- Helper function to gather form data ---
    const getFormData = () => {
        const selectedServices = Array.from(serviceChecklist.querySelectorAll('input:checked')).map(input => input.value);
        
        return {
            ...promoData, // Keep original ID and other unchanged properties
            title: titleInput.value.trim(),
            description: descriptionInput.value.trim(),
            promoPrices: {
                small: parseFloat(document.getElementById('promo-price-small').value) || null,
                medium: parseFloat(document.getElementById('promo-price-medium').value) || null,
  
            },
            originalPrices: {
                small: parseFloat(document.getElementById('original-price-small').value) || null,
                medium: parseFloat(document.getElementById('original-price-medium').value) || null,
       
            },
            expiryDate: new Date(expiryInput.value).toISOString(),
            publishDate: new Date(publishInput.value).toISOString(),
            services: selectedServices,
            imageUrl: promoData.imageUrl,
        };
    };

    // --- Save as Draft Logic ---
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', async () => {
            const draftPromotion = {
                ...getFormData(),
                status: 'Draft' // Mark this as a draft
            };

            // Save to Firebase
            try {
                await db.collection('promotions').doc(draftPromotion.promoId).update({
                    title: draftPromotion.title,
                    description: draftPromotion.description,
                    promoPrices: draftPromotion.promoPrices,
                    originalPrices: draftPromotion.originalPrices,
                    expiryDate: draftPromotion.expiryDate,
                    publishDate: draftPromotion.publishDate,
                    services: draftPromotion.services,
                    imageUrl: draftPromotion.imageUrl,
                    status: 'Draft',
                    updatedAt: new Date().toISOString()
                });
                console.log('Promotion saved as draft in Firebase:', draftPromotion.promoId);
            } catch (error) {
                console.error('Error saving promotion as draft in Firebase:', error);
                alert('Failed to save draft. Please try again.');
                return;
            }
            
            // Redirect back, optionally with a success message
            sessionStorage.setItem('toastMessage', 'Promotion saved as a draft.');
            // Clean up sessionStorage to prevent accidental updates to live data
            sessionStorage.removeItem('selectedPromotionData');
            window.location.href = 'promotions.html';
        });
    }

    // --- Form Submission (Update) Logic ---
    editPromotionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = getFormData();

        const updatedPromotion = {
            ...formData,
        };

        // Determine status based on dates
        const now = new Date();
        const publishDate = new Date(updatedPromotion.publishDate);
        const expiryDate = new Date(updatedPromotion.expiryDate);
        now.setHours(0, 0, 0, 0);

        if (publishDate > now) updatedPromotion.status = 'Scheduled';
        else if (expiryDate < now) updatedPromotion.status = 'Expired';
        else updatedPromotion.status = 'Active';

        // Save to Firebase
        try {
            await db.collection('promotions').doc(updatedPromotion.promoId).update({
                title: updatedPromotion.title,
                description: updatedPromotion.description,
                promoPrices: updatedPromotion.promoPrices,
                originalPrices: updatedPromotion.originalPrices,
                expiryDate: updatedPromotion.expiryDate,
                publishDate: updatedPromotion.publishDate,
                services: updatedPromotion.services,
                imageUrl: updatedPromotion.imageUrl,
                status: updatedPromotion.status,
                updatedAt: new Date().toISOString()
            });
            console.log('Promotion updated in Firebase:', updatedPromotion.promoId);
            
            // Store the updated promotion to be picked up by the promotions page
            sessionStorage.setItem('updatedPromotionData', JSON.stringify(updatedPromotion));
            
            // Clean up the edit data
            sessionStorage.removeItem('selectedPromotionData');
            
            // Redirect back to the promotions list
            window.location.href = 'promotions.html';
        } catch (error) {
            console.error('Error updating promotion in Firebase:', error);
            alert('Failed to save promotion. Please try again.');
        }
    });

    // Set min date for date inputs
    try {
        const today = new Date().toISOString().split('T')[0];
        if (publishInput) {
            publishInput.setAttribute('min', today);
        }
        if (expiryInput) {
            expiryInput.setAttribute('min', today);
        }
    } catch (error) {
        console.error("Could not set min date for date inputs:", error);
    }

    // Listen for the message from the media manager window
    window.addEventListener('storage', (event) => {
        if (event.key === 'selectedMedia' && event.newValue) {
            const selectedMedia = JSON.parse(event.newValue);
            
            if (selectedMedia.openerId === 'promo-profile-uploader') {
                if (imageElement) {
                    promoData.imageUrl = selectedMedia.url;
                    renderImage();
                }
                // Clean up the sessionStorage item
                sessionStorage.removeItem('selectedMedia');
            }
        }
    });

    // --- Image Update Logic ---
    imageInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                promoData.imageUrl = e.target.result; // Store as base64 for saving
                renderImage();
            };
            reader.readAsDataURL(file);
        }
    });

    renderImage();
});