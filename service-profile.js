document.addEventListener('DOMContentLoaded', () => {
    const editServiceForm = document.getElementById('edit-service-form');
    const storedData = sessionStorage.getItem('selectedServiceData');

    if (!editServiceForm || !storedData) {
        alert('Service data not found. Please return to the services list and select a service to edit.');
        window.location.href = 'services.html';
        return;
    }

    const serviceData = JSON.parse(storedData);

    // --- Get Form Elements ---
    const serviceNameInput = document.getElementById('service-name');
    const serviceNotesInput = document.getElementById('service-notes');
    const serviceCategorySelect = document.getElementById('service-category');
    const featuredToggle = document.getElementById('featured-toggle');
    const vehicleTypeSelect = document.getElementById('vehicle-type-select');
    const pricingContainer = document.getElementById('profile-pricing-details');
    const imageInput = document.getElementById('service-image-input');
    const imageElement = document.getElementById('profile-service-image');
    const chooseFromManagerBtn = document.querySelector('.choose-from-manager-btn');
    const saveDraftBtn = document.getElementById('save-draft-btn');
    const serviceIdSubtitle = document.getElementById('service-id-subtitle');

    // --- Populate Form Fields ---
    if (serviceIdSubtitle) serviceIdSubtitle.textContent = `ID: ${serviceData.serviceId}`;
    serviceNameInput.value = serviceData.service;
    serviceNotesInput.value = serviceData.notes || '';

    // Populate Category Dropdown
    const categories = ['Wash Services', 'Detailing Services'];
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        if (cat === serviceData.category) {
            option.selected = true;
        }
        serviceCategorySelect.appendChild(option);
    });

    // Set Featured Toggle
    featuredToggle.checked = serviceData.featured;

    // --- Dynamic Pricing Logic ---
    const populatePricingInputs = () => {
        // Determine the vehicle type from the service data
        const vehicleType = (serviceData.pricingScheme === 'Motorcycle CCs') ? 'Motorcycle' : 'Cars';
        vehicleTypeSelect.value = vehicleType;

        // Generate the base HTML for price inputs
        pricingContainer.innerHTML = `
            <div class="price-input-group" data-size="small">
                <div class="form-group">
                    <label for="price-small" class="price-label">5-Seater</label>
                    <input type="number" id="price-small" placeholder="e.g., 150" value="${serviceData.small || ''}">
                </div>
            </div>
            <div class="price-input-group" data-size="medium">
                <div class="form-group">
                    <label for="price-medium" class="price-label">7-Seater</label>
                    <input type="number" id="price-medium" placeholder="e.g., 200" value="${serviceData.medium || ''}">
                </div>
            </div>
        `;
        updatePricingLabels(); // Call the function to set the correct initial labels
    };

    const updatePricingLabels = () => {
        const selectedType = vehicleTypeSelect.value;
        const priceInputGroups = pricingContainer.querySelectorAll('.price-input-group');

        priceInputGroups.forEach(group => {
            const size = group.dataset.size;
            const labelEl = group.querySelector('.price-label');
            group.style.display = 'block'; // Reset display

            if (selectedType === 'Cars') {
                if (size === 'small') labelEl.textContent = '5-Seater';
                else if (size === 'medium') labelEl.textContent = '7-Seater';
                else group.style.display = 'none';
            } else if (selectedType === 'Motorcycle') {
                if (size === 'small') labelEl.textContent = '399cc below';
                else if (size === 'medium') labelEl.textContent = '400cc above';
                else group.style.display = 'none';
            }
        });
    };

    if (vehicleTypeSelect) {
        vehicleTypeSelect.addEventListener('change', () => {
            updatePricingLabels();
            // Clear input values when switching types to avoid saving incorrect data
            document.getElementById('price-small').value = '';
            document.getElementById('price-medium').value = '';
        });
    }

    // Initial population of the form
    populatePricingInputs();

    // --- Image Update Logic ---
    const renderImage = () => {
        const placeholderUrl = './images/placeholder-image.png';
        imageElement.src = serviceData.imageUrl || placeholderUrl;
        imageElement.onerror = () => { imageElement.src = placeholderUrl; };
    };

    imageInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                serviceData.imageUrl = e.target.result; // Store as base64 for saving
                renderImage();
            };
            reader.readAsDataURL(file);
        }
    });

    // --- Media Manager Integration ---
    if (chooseFromManagerBtn) {
        chooseFromManagerBtn.addEventListener('click', () => {
            // The 'openerId' helps the manager know which uploader to send data back to.
            const openerId = 'service-profile-uploader'; // A unique ID for this uploader instance
            const pickerUrl = `media-manager.html?picker=true&openerId=${openerId}`;
            // Open the media manager in a new, smaller window
            window.open(pickerUrl, 'MediaManager', 'width=1200,height=800,scrollbars=yes');
        });
    }

    // Listen for the message from the media manager window
    const handleMediaSelection = (event) => {
        // Only act if the 'selectedMedia' key is changed and has a value.
        if (event.key !== 'selectedMedia' || !event.newValue) {
            return;
        }
        const selectedMedia = JSON.parse(event.newValue);
        
        // Check if this message is for this specific uploader
        if (selectedMedia.openerId === 'service-profile-uploader') {
            if (imageElement) {
                serviceData.imageUrl = selectedMedia.url;
                renderImage();
            }
        }
    };
    window.addEventListener('storage', handleMediaSelection);

    // --- Helper function to gather form data ---
    const getFormData = () => {
        return {
            ...serviceData, // Keep original ID and other unchanged properties
            service: serviceNameInput.value,
            notes: serviceNotesInput.value,
            category: serviceCategorySelect.value,
            pricingScheme: vehicleTypeSelect.value === 'Motorcycle' ? 'Motorcycle CCs' : 'Car Sizes',
            featured: featuredToggle.checked,
            small: parseFloat(document.getElementById('price-small').value) || null,
            medium: parseFloat(document.getElementById('price-medium').value) || null,
            large: null, // Not used in this form
            xLarge: null, // Not used in this form
            imageUrl: serviceData.imageUrl,
        };
    };

    // --- Save as Draft Logic ---
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', () => {
            const draftService = {
                ...getFormData(),
                status: 'Draft' // Mark this as a draft
            };

            // Save to localStorage
            let drafts = JSON.parse(localStorage.getItem('serviceDrafts')) || [];
            // If a draft with the same ID exists, update it. Otherwise, add it.
            const existingIndex = drafts.findIndex(d => d.serviceId === draftService.serviceId);
            if (existingIndex > -1) {
                drafts[existingIndex] = draftService;
            } else {
                drafts.push(draftService);
            }
            localStorage.setItem('serviceDrafts', JSON.stringify(drafts));
            window.location.href = 'services.html'; // Redirect back
        });
    }

    // --- Form Submission (Update) Logic ---
    editServiceForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Create the updated service object
        const updatedService = {
            ...serviceData, // Keep original ID and other unchanged properties
            ...getFormData(),
            status: 'Published' // Mark as published
        };

        // Store the updated service to be picked up by the services page
        sessionStorage.setItem('updatedServiceData', JSON.stringify(updatedService));

        // Clean up the edit data
        sessionStorage.removeItem('selectedServiceData');

        // IMPORTANT: Remove the event listener when we are done with this page.
        window.removeEventListener('storage', handleMediaSelection);

        // Redirect back to the services list
        window.location.href = 'services.html';
    });

    // --- Populate Analytics ---
    const availedCounts = [...(window.appData.appointments || []), ...(window.appData.walkins || [])].reduce((acc, item) => {
        acc[item.service] = (acc[item.service] || 0) + 1;
        return acc;
    }, {});

    document.getElementById('profile-availed-count').textContent = availedCounts[serviceData.service] || 0;

    // Initial image render
    renderImage();

    // --- Cleanup on Page Exit ---
    // This is the crucial fix. It ensures that if the user navigates away
    // using the back button or sidebar links, the 'storage' listener is removed.
    window.addEventListener('pagehide', () => {
        window.removeEventListener('storage', handleMediaSelection);
    });
});