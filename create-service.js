document.addEventListener('DOMContentLoaded', () => {
    const createServiceForm = document.getElementById('create-service-form');
    const imageInput = document.getElementById('service-image');
    const priceInputGroups = document.querySelectorAll('.pricing-grid .price-input-group');
    const vehicleTypeSelect = document.getElementById('vehicle-type-select');
    const serviceNotesInput = document.getElementById('service-notes'); // Get the notes input

    // Only run if the form exists on the page
    if (!createServiceForm) return;

    const imagePreview = document.getElementById('image-preview');
    const imagePreviewImage = imagePreview ? imagePreview.querySelector('.image-preview-image') : null;
    const imageUploaderPlaceholder = imagePreview ? imagePreview.querySelector('.image-uploader-placeholder') : null;
    const uploadOverlay = imagePreview ? imagePreview.querySelector('.upload-overlay') : null;

    // --- Image Preview Logic ---
    imageInput.addEventListener('change', function () {
        console.log("Image input changed");
        const file = this.files[0];

        if (file) {
            const reader = new FileReader();

            if (imageUploaderPlaceholder) {
                imageUploaderPlaceholder.style.display = 'none';
            }
            imagePreviewImage.style.opacity = '1';
            imagePreviewImage.style.visibility = 'visible';

            reader.addEventListener('load', function () {
                imagePreviewImage.setAttribute('src', this.result);
                // Hide the upload overlay text when an image is present
                if (uploadOverlay) uploadOverlay.querySelector('span:last-child').style.display = 'none';
            });

            reader.readAsDataURL(file);
        } else { // No file selected, revert to placeholder
            if (imageUploaderPlaceholder) {
                imageUploaderPlaceholder.style.display = 'block';
            }
            imagePreviewImage.style.opacity = '0';
            imagePreviewImage.style.visibility = 'hidden';
            imagePreviewImage.setAttribute('src', '');
            if (uploadOverlay) uploadOverlay.querySelector('span:last-child').style.display = 'block';
        }
    });

    // --- Dynamic Pricing Input Logic ---
    const updatePricingInputs = () => {
        const selectedType = vehicleTypeSelect.value;

        priceInputGroups.forEach(group => {
            const size = group.dataset.size;
            const labelEl = group.querySelector('.price-label');
            const inputEl = group.querySelector('input[type="number"]');

            // Reset visibility and values
            group.style.display = 'flex';
            inputEl.value = '';

            if (selectedType === 'Cars') {
                if (size === 'small') labelEl.textContent = '5-Seater';
                else if (size === 'medium') {
                    labelEl.textContent = '7-Seater';
                } else {
                    group.style.display = 'none'; // Hide large and xlarge for cars
                }
            } else if (selectedType === 'Motorcycle') {
                if (size === 'small') {
                    labelEl.textContent = '399cc below';
                } else if (size === 'medium') { // Using medium for 499cc above
                    labelEl.textContent = '400cc above';
                } else {
                    // Hide medium and large inputs for motorcycles
                    group.style.display = 'none';
                }
            }
        });
    };

    if (vehicleTypeSelect) {
        vehicleTypeSelect.addEventListener('change', updatePricingInputs);
        updatePricingInputs(); // Initial call to set the correct labels on page load
    }

    // --- Form Submission Logic ---
    createServiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get price values, converting empty strings to null
        const getPriceValue = (id) => {
            const input = document.getElementById(id);
            return input && input.value !== '' ? parseFloat(input.value) : null;
        };

        const serviceName = document.getElementById('service-name').value;
        const serviceCategory = document.getElementById('service-category').value;
        const vehicleType = vehicleTypeSelect.value;
        const serviceNotes = serviceNotesInput.value;
        const priceSmall = getPriceValue('price-small'); // This will be 5-seater or 399cc below
        const priceMedium = getPriceValue('price-medium'); // This will be 7-seater or 400cc above
        const isFeatured = document.getElementById('featured-toggle') ? document.getElementById('featured-toggle').checked : false;
        const imageSrc = imagePreviewImage.getAttribute('src');

        // Basic validation
        if (!serviceName || !serviceCategory) {
            alert('Please fill out the Service Name and Category.');
            return;
        }
        const newService = {
            serviceId: `SER-${Date.now().toString().slice(-5)}`, // Generate a semi-unique ID
            service: serviceName,
            category: serviceCategory,
            pricingScheme: vehicleType === 'Motorcycle' ? 'Motorcycle CCs' : 'Car Sizes',
            notes: serviceNotes,
            small: priceSmall,
            medium: priceMedium,
            featured: isFeatured,
            availability: 'Available',
            imageUrl: imageSrc || null, // Store the Base64 image string
        };

        // Store the new service in sessionStorage to be picked up by the services.js script
        sessionStorage.setItem('newlyCreatedService', JSON.stringify(newService));

        // Save to Firestore
        try {
            const db = window.firebase.firestore();
            const { serviceId, ...dataToSave } = newService; // Remove serviceId to avoid storing it as a field
            
            await db.collection('services').doc(newService.serviceId).set({
                ...dataToSave,
                createdAt: new Date(),
                status: 'Published'
            });
            console.log('Service created in Firestore successfully!');
        } catch (error) {
            console.error('Error creating service in Firestore:', error);
            alert('Error saving service to Firestore. Changes saved locally but may not persist.');
        }

        // Redirect back to the services list
        window.location.href = 'services.html';
    });
});