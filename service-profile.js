document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to be initialized
    if (window.firebaseInitPromise) {
        await window.firebaseInitPromise;
    }
    
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
    const imageUploadSpinner = document.getElementById('image-upload-spinner');
    const imageUploaderContainer = document.getElementById('service-image-preview');

    // Create a simple inline progress bar element (hidden by default)
    const uploadProgressContainer = document.createElement('div');
    uploadProgressContainer.style.display = 'none';
    uploadProgressContainer.style.width = '100%';
    uploadProgressContainer.style.height = '8px';
    uploadProgressContainer.style.background = '#e6e6e6';
    uploadProgressContainer.style.borderRadius = '4px';
    uploadProgressContainer.style.overflow = 'hidden';
    uploadProgressContainer.style.marginTop = '0.75rem';

    const uploadProgressBar = document.createElement('div');
    uploadProgressBar.style.width = '0%';
    uploadProgressBar.style.height = '100%';
    uploadProgressBar.style.background = '#4caf50';
    uploadProgressBar.style.transition = 'width 150ms linear';

    uploadProgressContainer.appendChild(uploadProgressBar);
    if (imageUploaderContainer) imageUploaderContainer.appendChild(uploadProgressContainer);
    const chooseFromManagerBtn = document.querySelector('.choose-from-manager-btn');
    const saveDraftBtn = document.getElementById('save-draft-btn');
    const serviceIdSubtitle = document.getElementById('service-id-subtitle');

    // --- UI helpers ---
    const successToast = document.getElementById('success-toast');
    const showSuccessToast = (msg) => {
        if (successToast) {
            const p = successToast.querySelector('p');
            if (p) p.textContent = msg;
            successToast.style.display = 'flex';
            setTimeout(() => successToast.style.display = 'none', 2000);
        } else {
            console.log(msg);
        }
    };

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
        const placeholderUrl = './images/services.png';
        imageElement.src = serviceData.imageUrl || placeholderUrl;
        imageElement.onerror = () => { imageElement.src = placeholderUrl; };
    };

    const showImageLoading = () => {
        if (imageUploadSpinner) imageUploadSpinner.style.display = 'block';
        if (imageElement) imageElement.style.opacity = '0.5'; // Dim the image
    };

    const hideImageLoading = () => {
        if (imageUploadSpinner) imageUploadSpinner.style.display = 'none';
        if (imageElement) imageElement.style.opacity = '1';
    };

    imageInput.addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) return;

        // Ensure we have a serviceId to reference in Storage and Firestore
        if (!serviceData.serviceId) {
            alert('Service identifier not found. Cannot upload image.');
            this.value = '';
            return;
        }

        // Validate image file
        const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validImageTypes.includes(file.type)) {
            alert('Invalid image format. Please upload a JPEG, PNG, GIF, or WebP image.');
            this.value = '';
            return;
        }

        // Check file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB in bytes
        if (file.size > maxSize) {
            alert('Image file is too large. Maximum size is 5MB.');
            this.value = '';
            return;
        }

        showImageLoading();

        try {
            // Check Firebase initialization
            if (!window._firebaseStorageAPI) {
                throw new Error('Firebase Storage API not initialized');
            }

            const fileExtension = file.name.split('.').pop();
            const fileName = `${serviceData.serviceId}.${fileExtension}`;
            const storagePath = `services/${fileName}`;
            
            console.log('Uploading image to Firebase Storage:', storagePath);
            
            if (uploadProgressContainer) uploadProgressContainer.style.display = 'block';
            
            // Use the native storage API exposed by firebase-setup.js
            const { ref, uploadBytesResumable, getDownloadURL } = window._firebaseStorageAPI;
            const fileRef = ref(storagePath);
            
            console.log('Using native SDK upload with progress tracking...');
            
            // Upload the file with progress tracking
            const uploadTask = uploadBytesResumable(fileRef, file);
            
            uploadTask.on('state_changed',
                (snapshot) => {
                    // Track upload progress
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('Upload progress:', progress + '%');
                    if (uploadProgressBar) {
                        uploadProgressBar.style.width = progress + '%';
                    }
                },
                (error) => {
                    // Handle upload errors
                    throw error;
                },
                async () => {
                    // Upload complete, get the download URL
                    try {
                        const url = await getDownloadURL(uploadTask.snapshot.ref);
                        console.log('Image uploaded successfully:', url);
                        
                        // Update the image in the UI
                        serviceData.imageUrl = url;
                        if (imageElement) imageElement.src = url;
                        
                        // Update Firestore
                        const db = window.firebase.firestore();
                        await db.collection('services').doc(serviceData.serviceId).update({
                            imageUrl: url,
                            updatedAt: db.FieldValue.serverTimestamp()
                        });
                        
                        showSuccessToast('Image updated successfully!');
                        hideImageLoading();
                        imageInput.value = '';
                        
                        if (uploadProgressContainer) {
                            setTimeout(() => {
                                uploadProgressContainer.style.display = 'none';
                                if (uploadProgressBar) uploadProgressBar.style.width = '0%';
                            }, 500);
                        }
                    } catch (error) {
                        throw error;
                    }
                }
            );
        } catch (error) {
            console.error('Error during image upload:', error);
            
            let errorMessage = 'Failed to upload image. ';
            if (error.code === 'storage/unauthorized') {
                errorMessage += 'You do not have permission to upload images.';
            } else if (error.code === 'storage/canceled') {
                errorMessage += 'Upload was canceled.';
            } else {
                errorMessage += error.message || 'An unknown error occurred.';
            }
            
            alert(errorMessage);
            hideImageLoading();
            imageInput.value = '';
            if (uploadProgressContainer) uploadProgressContainer.style.display = 'none';
            if (uploadProgressBar) uploadProgressBar.style.width = '0%';
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

    // Also listen for postMessage from picker windows (more direct)
    const handleMessage = (event) => {
        // event.data should contain { selectedMedia: { url, openerId } }
        if (!event || !event.data) return;
        const data = event.data;
        const selectedMedia = data.selectedMedia || data;
        if (!selectedMedia) return;
        // If openerId matches this uploader, update image
        if (selectedMedia.openerId === 'service-profile-uploader') {
            if (imageElement) {
                serviceData.imageUrl = selectedMedia.url;
                renderImage();
            }
        }
    };
    window.addEventListener('message', handleMessage, false);

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
        const priceSmall = document.getElementById('price-small')?.value;
        const priceMedium = document.getElementById('price-medium')?.value;
        
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

    // --- Helper function to gather form data ---
    const getFormData = () => {
        return {
            ...serviceData, // Keep original ID and other unchanged properties
            service: serviceNameInput.value.trim(),
            notes: serviceNotesInput.value.trim(),
            category: serviceCategorySelect.value,
            pricingScheme: vehicleTypeSelect.value === 'Motorcycle' ? 'Motorcycle CCs' : 'Car Sizes',
            featured: featuredToggle.checked,
            small: getPriceValue('price-small'),
            medium: getPriceValue('price-medium'),
            large: null, // Not used in this form
            xLarge: null, // Not used in this form
            imageUrl: serviceData.imageUrl,
        };
    };

    // --- Save as Draft Logic ---
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', async () => {
            // Validate form before saving draft
            const validationErrors = validateForm();
            if (validationErrors.length > 0) {
                alert('Please fix the following errors before saving as draft:\n\n' + validationErrors.join('\n'));
                return;
            }

            // Disable button to prevent double clicks
            const originalText = saveDraftBtn.textContent;
            saveDraftBtn.disabled = true;
            saveDraftBtn.textContent = 'Saving Draft...';

            try {
                const formData = getFormData();
                
                // Build pricing object
                const pricingObj = {};
                if (formData.pricingScheme === 'Motorcycle CCs') {
                    if (formData.small !== null) pricingObj['399cc below'] = formData.small;
                    if (formData.medium !== null) pricingObj['400cc above'] = formData.medium;
                } else {
                    if (formData.small !== null) pricingObj['5-Seater'] = formData.small;
                    if (formData.medium !== null) pricingObj['7-Seater'] = formData.medium;
                }

                // Save as draft in Firestore
                const db = window.firebase.firestore();
                
                const draftData = {
                    service: formData.service,
                    category: formData.category,
                    pricingScheme: formData.pricingScheme,
                    notes: formData.notes,
                    pricing: pricingObj,
                    featured: formData.featured,
                    imageUrl: formData.imageUrl,
                    availability: serviceData.availability || 'Available',
                    status: 'Draft',
                    updatedAt: db.FieldValue.serverTimestamp()
                };

                await db.collection('services').doc(serviceData.serviceId).update(draftData);
                
                console.log('Draft saved successfully!');
                alert('Draft saved successfully!');
                
                // Clean up and redirect
                sessionStorage.removeItem('selectedServiceData');
                window.location.href = 'services.html';
                
            } catch (error) {
                console.error('Error saving draft:', error);
                alert('Failed to save draft: ' + (error.message || 'Unknown error'));
                
                // Re-enable button
                saveDraftBtn.disabled = false;
                saveDraftBtn.textContent = originalText;
            }
        });
    }

    // --- Form Submission (Update) Logic ---
    editServiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Validate form
        const validationErrors = validateForm();
        if (validationErrors.length > 0) {
            alert('Please fix the following errors:\n\n' + validationErrors.join('\n'));
            return;
        }
        
        // Disable submit button to prevent double submission
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving Changes...';
        }

        try {
            // Check Firebase initialization
            if (!window.firebase || !window.firebase.firestore) {
                throw new Error('Firebase is not initialized. Please refresh the page and try again.');
            }

            // Gather form data and format for Firestore
            const formData = getFormData();
            
            // Build pricing object with proper labels
            const pricingObj = {};
            if (formData.pricingScheme === 'Motorcycle CCs') {
                if (formData.small !== null) pricingObj['399cc below'] = formData.small;
                if (formData.medium !== null) pricingObj['400cc above'] = formData.medium;
            } else {
                if (formData.small !== null) pricingObj['5-Seater'] = formData.small;
                if (formData.medium !== null) pricingObj['7-Seater'] = formData.medium;
            }
            
            // Validate pricing object
            if (Object.keys(pricingObj).length === 0) {
                throw new Error('At least one price must be provided');
            }
            
            // Save to Firestore
            const db = window.firebase.firestore();
            
            const dataToSave = {
                service: formData.service,
                category: formData.category,
                pricingScheme: formData.pricingScheme,
                notes: formData.notes,
                pricing: pricingObj,
                featured: formData.featured,
                imageUrl: formData.imageUrl,
                availability: serviceData.availability || 'Available',
                status: 'Published',
                updatedAt: db.FieldValue.serverTimestamp()
            };
            
            await db.collection('services').doc(serviceData.serviceId).update(dataToSave);
            
            console.log('Service updated successfully!', dataToSave);
            
            // Clean up
            sessionStorage.removeItem('selectedServiceData');
            window.removeEventListener('storage', handleMediaSelection);
            
            // Show success message
            if (typeof showSuccessToast === 'function') {
                showSuccessToast('Service updated successfully!');
            } else {
                alert('Service updated successfully!');
            }
            
            // Redirect back to the services list after short delay
            setTimeout(() => {
                window.location.href = 'services.html';
            }, 1200);
            
        } catch (error) {
            console.error('Error updating service:', error);
            
            // User-friendly error messages
            let errorMessage = 'Failed to update service. ';
            if (error.code === 'permission-denied') {
                errorMessage += 'You do not have permission to update services.';
            } else if (error.code === 'not-found') {
                errorMessage += 'Service not found. It may have been deleted.';
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