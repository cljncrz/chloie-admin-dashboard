document.addEventListener('DOMContentLoaded', () => {
    const editPromotionForm = document.getElementById('edit-promotion-form');
    const storedData = sessionStorage.getItem('promotionToEdit');

    if (!editPromotionForm || !storedData) {
        alert('Promotion data not found. Please return to the promotions list and select one to edit.');
        window.location.href = 'promotions.html';
        return;
    }

    const promoData = JSON.parse(storedData);

    // --- Get Form Elements ---
    const titleInput = document.getElementById('promo-title');
    const descriptionInput = document.getElementById('promo-description');
    const serviceChecklist = document.getElementById('service-checklist');
    const imageInput = document.getElementById('promo-image');
    const imagePreview = document.getElementById('image-preview');
    const imagePreviewImage = imagePreview.querySelector('.image-preview-image');
    const imageUploaderPlaceholder = imagePreview.querySelector('.image-uploader-placeholder');
    const publishInput = document.getElementById('promo-publish-date');
    const expiryInput = document.getElementById('promo-expiry');
    const backBtn = document.getElementById('back-btn');
    const saveDraftBtn = document.getElementById('save-draft-btn');

    // Pricing elements
    const vehicleTypeSelect = document.getElementById("pricing-vehicle-type");
    const originalPriceSmallLabel = document.getElementById(
      "original-price-small-label"
    );
    const originalPriceMediumLabel = document.getElementById(
      "original-price-medium-label"
    );
    const originalPriceSmall =
      document.getElementById("original-price-small");
    const originalPriceMedium = document.getElementById("original-price-medium");
    const promoPriceSmallLabel = document.getElementById(
      "promo-price-small-label"
    );
    const promoPriceMediumLabel = document.getElementById(
      "promo-price-medium-label"
    );
    const promoPriceSmall = document.getElementById("promo-price-small");
    const promoPriceMedium = document.getElementById("promo-price-medium");

    // --- Populate Form Fields ---
    titleInput.value = promoData.title || '';
    descriptionInput.value = promoData.description || '';

    // Set vehicle type
    if (promoData.vehicleType) {
        vehicleTypeSelect.value = promoData.vehicleType;
    }

    // Populate prices
    if (promoData.promoPrices) {
        promoPriceSmall.value = promoData.promoPrices.small || '';
        promoPriceMedium.value = promoData.promoPrices.medium || '';
    }
    if (promoData.originalPrices) {
        originalPriceSmall.value = promoData.originalPrices.small || '';
        originalPriceMedium.value = promoData.originalPrices.medium || '';
    }

    // Populate dates
    if (promoData.publishDate) {
        publishInput.value = new Date(promoData.publishDate).toISOString().split('T')[0];
    }
    if (promoData.expiryDate) {
        expiryInput.value = new Date(promoData.expiryDate).toISOString().split('T')[0];
    }

    // --- Dynamic Pricing Label Logic ---
    const updatePricingLabels = () => {
        const selectedType = vehicleTypeSelect.value;

        if (selectedType === "motorcycle") {
            originalPriceSmallLabel.textContent = "399cc below";
            originalPriceMediumLabel.textContent = "400cc above";
            promoPriceSmallLabel.textContent = "399cc below";
            promoPriceMediumLabel.textContent = "400cc above";
        } else {
            // Default to car labels
            originalPriceSmallLabel.textContent = "5-Seater";
            originalPriceMediumLabel.textContent = "7-Seater";
            promoPriceSmallLabel.textContent = "5-Seater";
            promoPriceMediumLabel.textContent = "7-Seater";
        }
    };

    if (vehicleTypeSelect) {
        vehicleTypeSelect.addEventListener("change", updatePricingLabels);
        updatePricingLabels(); // Initial call to set labels based on loaded data
    }

    // Populate Service Checklist
    const allServices = window.appData.services || [];
    allServices.forEach(service => {
        const isChecked = (promoData.services || []).includes(service.service);
        const itemHtml = `
            <div class="checklist-item">
                <input type="checkbox" id="service-${service.serviceId}" name="services" value="${service.service}" ${isChecked ? 'checked' : ''}>
                <label for="service-${service.serviceId}">${service.service}</label>
            </div>
        `;
        serviceChecklist.insertAdjacentHTML('beforeend', itemHtml);
    });

    // Populate Image
    if (promoData.imageUrl) {
        imagePreviewImage.src = promoData.imageUrl;
        imagePreviewImage.style.display = 'block';
        imageUploaderPlaceholder.style.display = 'none';
    }

    // --- Image Preview Logic ---
    imageInput.addEventListener('change', function () {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            imageUploaderPlaceholder.style.display = 'none';
            imagePreviewImage.style.display = 'block';
            reader.addEventListener('load', function () {
                imagePreviewImage.setAttribute('src', this.result);
            });
            reader.readAsDataURL(file);
        }
    });

    // --- Helper function to gather form data ---
    const getFormData = () => {
        const selectedServices = Array.from(serviceChecklist.querySelectorAll('input:checked')).map(input => input.value);
        return {
            ...promoData, // Keep original ID and other unchanged properties
            title: titleInput.value.trim(),
            description: descriptionInput.value.trim(),
            vehicleType: vehicleTypeSelect.value,
            services: selectedServices,
            promoPrices: {
                small: parseFloat(promoPriceSmall.value) || null,
                medium: parseFloat(promoPriceMedium.value) || null,
            },
            originalPrices: {
                small: parseFloat(originalPriceSmall.value) || null,
                medium: parseFloat(originalPriceMedium.value) || null,
            },
            publishDate: new Date(publishInput.value).toISOString(),
            expiryDate: new Date(expiryInput.value).toISOString(),
            imageUrl: imagePreviewImage.src.includes('data:image') || imagePreviewImage.src.includes('http') ? imagePreviewImage.src : ''
        };
    };

    // --- Save as Draft Logic ---
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', () => {
            const draftPromotion = {
                ...getFormData(),
                status: 'Draft' // Explicitly set status to Draft
            };

            sessionStorage.setItem('updatedPromotionData', JSON.stringify(draftPromotion));
            sessionStorage.removeItem('promotionToEdit');
            window.location.href = 'promotions.html';
        });
    }

    // --- Form Submission (Update) Logic ---
    editPromotionForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const updatedPromotion = getFormData();
        updatedPromotion.status = 'Active'; // When updating, assume it's meant to be active. The main page will re-evaluate.
        // Store the updated promotion to be picked up by the promotions page
        sessionStorage.setItem('updatedPromotionData', JSON.stringify(updatedPromotion));

        // Clean up the edit data
        sessionStorage.removeItem('promotionToEdit');

        // Redirect back to the promotions list
        window.location.href = 'promotions.html';
    });

    // --- Back Button Functionality ---
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.back();
        });
    }

    // Set min date for date inputs
    const today = new Date().toISOString().split('T')[0];
    if (publishInput) publishInput.setAttribute('min', today);
    if (expiryInput) expiryInput.setAttribute('min', today);
});