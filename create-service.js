document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to be initialized
    if (window.firebaseInitPromise) {
        await window.firebaseInitPromise;
    }
    
    // Form Elements
    const createServiceForm = document.getElementById('create-service-form');
    const imageInput = document.getElementById('service-image');
    const priceInputGroups = document.querySelectorAll('.pricing-grid .price-input-group');
    const vehicleTypeSelect = document.getElementById('vehicle-type-select');
    const serviceNotesInput = document.getElementById('service-notes');
    const serviceNameInput = document.getElementById('service-name');
    const serviceCategorySelect = document.getElementById('service-category');
    const featuredToggle = document.getElementById('featured-toggle');

    // Only run if the form exists on the page
    if (!createServiceForm) return;

    // Image Preview Elements
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

    // --- Validation Helper ---
    const validateForm = () => {
        const errors = [];

        // Validate service name
        const serviceName = serviceNameInput.value.trim();
        if (!serviceName) {
            errors.push('Service name is required');
        } else if (serviceName.length < 3) {
            errors.push('Service name must be at least 3 characters');
        }

        // Validate category
        if (!serviceCategorySelect.value) {
            errors.push('Please select a service category');
        }

        // Validate pricing - at least one price should be provided
        const priceSmall = document.getElementById('price-small').value;
        const priceMedium = document.getElementById('price-medium').value;
        
        if (!priceSmall && !priceMedium) {
            errors.push('Please provide at least one price');
        }

        // Validate price values are positive numbers
        if (priceSmall && parseFloat(priceSmall) <= 0) {
            errors.push('Prices must be greater than zero');
        }
        if (priceMedium && parseFloat(priceMedium) <= 0) {
            errors.push('Prices must be greater than zero');
        }

        return errors;
    };

    // --- Helper to get price value ---
    const getPriceValue = (id) => {
        const input = document.getElementById(id);
        const value = input?.value?.trim();
        return value && !isNaN(parseFloat(value)) ? parseFloat(value) : null;
    };

    // --- Form Submission Logic ---
    createServiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate form
        const validationErrors = validateForm();
        if (validationErrors.length > 0) {
            alert('Please fix the following errors:\n\n' + validationErrors.join('\n'));
            return;
        }

        // Get form values
        const serviceName = serviceNameInput.value.trim();
        const serviceCategory = serviceCategorySelect.value;
        const vehicleType = vehicleTypeSelect.value;
        const serviceNotes = serviceNotesInput.value.trim();
        const priceSmall = getPriceValue('price-small');
        const priceMedium = getPriceValue('price-medium');
        const isFeatured = featuredToggle ? featuredToggle.checked : false;
        
        // Disable submit button to prevent double submission
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Service...';
        }
        
        // Build pricing object with proper labels
        const pricingScheme = vehicleType === 'Motorcycle' ? 'Motorcycle CCs' : 'Car Sizes';
        const pricingObj = {};
        
        if (pricingScheme === 'Motorcycle CCs') {
            if (priceSmall !== null) pricingObj['399cc below'] = priceSmall;
            if (priceMedium !== null) pricingObj['400cc above'] = priceMedium;
        } else {
            if (priceSmall !== null) pricingObj['5-Seater'] = priceSmall;
            if (priceMedium !== null) pricingObj['7-Seater'] = priceMedium;
        }
        
        // Generate unique service ID
        const timestamp = Date.now();
        const serviceId = `SER-${timestamp.toString().slice(-8)}`;

        // Save to Firestore
        try {
            // Check Firebase initialization
            if (!window.firebase || !window.firebase.firestore || !window.firebase.auth) {
                throw new Error('Firebase is not initialized. Please refresh the page and try again.');
            }

            // Check if user is authenticated before proceeding
            // Authentication check removed to allow admin and all users to create services

            const db = window.firebase.firestore();
            const storage = window.firebase.storage();
            let imageUrl = null;

            // Upload image to Firebase Storage if one was selected
            const imageFile = imageInput.files[0];
            if (imageFile) {
                // Validate image file
                const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                if (!validImageTypes.includes(imageFile.type)) {
                    throw new Error('Invalid image format. Please upload a JPEG, PNG, GIF, or WebP image.');
                }

                // Check file size (max 5MB)
                const maxSize = 5 * 1024 * 1024; // 5MB in bytes
                if (imageFile.size > maxSize) {
                    throw new Error('Image file is too large. Maximum size is 5MB.');
                }

                try {
                    const fileExtension = imageFile.name.split('.').pop();
                    const fileName = `${serviceId}.${fileExtension}`;
                    const storagePath = `services/${fileName}`;
                    
                    console.log('Starting image upload...');
                    console.log('- Storage path:', storagePath);
                    console.log('- File size:', (imageFile.size / 1024).toFixed(2), 'KB');
                    console.log('- File type:', imageFile.type);
                    
                    submitBtn.textContent = 'Uploading Image...';
                    
                    // Use the native storage API exposed by firebase-setup.js
                    if (!window._firebaseStorageAPI) {
                        console.error('Storage API not available');
                        throw new Error('Firebase Storage API not initialized. Please refresh the page.');
                    }
                    
                    console.log('Storage API available:', Object.keys(window._firebaseStorageAPI));
                    
                    const { ref, uploadBytes, getDownloadURL } = window._firebaseStorageAPI;
                    const fileRef = ref(storagePath);
                    
                    console.log('File reference created, starting upload...');
                    const snapshot = await uploadBytes(fileRef, imageFile);
                    console.log('Upload complete, getting download URL...');
                    
                    imageUrl = await getDownloadURL(snapshot.ref);
                    console.log('✓ Image uploaded successfully!');
                    console.log('  Download URL:', imageUrl);
                } catch (uploadError) {
                    console.error('✗ Image upload failed:', uploadError);
                    console.error('  Error code:', uploadError.code);
                    console.error('  Error message:', uploadError.message);
                    
                    // Show user-friendly error
                    const uploadErrorMsg = uploadError.code === 'storage/unauthorized' 
                        ? 'You do not have permission to upload images. Please check your Firebase Storage rules.'
                        : uploadError.message;
                    
                    throw new Error(`Image upload failed: ${uploadErrorMsg}`);
                }
            }
            
            // Create the service document in Firestore
            submitBtn.textContent = 'Saving Service...';
            
            const serviceData = {
                service: serviceName,
                category: serviceCategory,
                pricingScheme: pricingScheme,
                notes: serviceNotes || '',
                pricing: pricingObj,
                featured: isFeatured,
                availability: 'Available',
                imageUrl: imageUrl,
                createdAt: db.FieldValue.serverTimestamp(),
                status: 'Published'
            };

            await db.collection('services').doc(serviceId).set(serviceData);
            
            console.log('Service created successfully!', serviceData);
            alert('Service created successfully!');
            
            // Redirect back to the services list
            window.location.href = 'services.html';
            
        } catch (error) {
            console.error('Error creating service:', error);
            
            // User-friendly error messages
            let errorMessage = 'Failed to create service. ';
            if (error.code === 'permission-denied') {
                errorMessage += 'You do not have permission to create services.';
            } else if (error.code === 'unavailable') {
                errorMessage += 'Network error. Please check your connection and try again.';
            } else {
                errorMessage += error.message || 'An unknown error occurred.';
            }
            
            alert(errorMessage);
            
            // Re-enable submit button on error
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        }
    });
});