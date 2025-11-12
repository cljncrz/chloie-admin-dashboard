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

    imageInput.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;

        // Ensure we have a serviceId to reference in Storage and Firestore
        if (!serviceData.serviceId) {
            alert('Service identifier not found. Cannot upload image.');
            this.value = '';
            return;
        }

        showImageLoading();

        // Prefer server-side upload to avoid CORS errors. The project includes a Node endpoint at /api/upload
        try {
            // Read file as base64
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];

                // Build payload
                const payload = {
                    fileName: file.name,
                    fileData: base64,
                    fileType: file.type || 'application/octet-stream',
                };

                // Use XMLHttpRequest to get upload progress events
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/upload', true);
                xhr.setRequestHeader('Content-Type', 'application/json');

                xhr.upload.onprogress = (evt) => {
                    if (evt.lengthComputable) {
                        const percent = (evt.loaded / evt.total) * 100;
                        if (uploadProgressContainer) uploadProgressContainer.style.display = 'block';
                        if (uploadProgressBar) uploadProgressBar.style.width = `${Math.round(percent)}%`;
                    }
                };

                xhr.onreadystatechange = async () => {
                    if (xhr.readyState === 4) {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const resp = JSON.parse(xhr.responseText);
                                const downloadURL = resp.url || resp.downloadURL || resp.url || resp.message && resp.url;
                                // Fallback: try resp.url
                                const url = resp.url || resp.downloadURL || resp.url || null;
                                if (url) {
                                    serviceData.imageUrl = url;
                                    if (imageElement) imageElement.src = url;
                                    // Update services doc with new image URL
                                    try {
                                        const db = window.firebase.firestore();
                                        await db.collection('services').doc(serviceData.serviceId).update({
                                            imageUrl: url,
                                            updatedAt: window.firebase.firestore().FieldValue.serverTimestamp(),
                                        });
                                        showSuccessToast('Image uploaded and saved.');
                                    } catch (dbErr) {
                                        console.warn('Saved on server but failed to update service doc:', dbErr);
                                        showSuccessToast('Image uploaded (server).');
                                    }
                                } else {
                                    console.warn('Upload response did not include URL', resp);
                                    alert('Upload succeeded but no URL returned. Check server logs.');
                                }
                            } catch (parseErr) {
                                console.error('Failed to parse upload response:', parseErr, xhr.responseText);
                                alert('Upload succeeded but response invalid. See console.');
                            }
                        } else {
                            console.error('Server upload failed', xhr.status, xhr.responseText);
                            alert(`Server upload failed: ${xhr.status}`);
                        }

                        hideImageLoading();
                        imageInput.value = '';
                        if (uploadProgressContainer) {
                            setTimeout(() => {
                                uploadProgressContainer.style.display = 'none';
                                if (uploadProgressBar) uploadProgressBar.style.width = '0%';
                            }, 500);
                        }
                    }
                };

                xhr.onerror = () => {
                    console.error('XHR upload error');
                    alert('Upload failed (network).');
                    hideImageLoading();
                    imageInput.value = '';
                    if (uploadProgressContainer) uploadProgressContainer.style.display = 'none';
                };

                xhr.send(JSON.stringify(payload));
            };

            reader.onerror = (err) => {
                console.error('FileReader error', err);
                alert('Failed to read file.');
                hideImageLoading();
                imageInput.value = '';
            };

            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Unexpected error during server upload fallback:', error);
            alert('Unexpected error during upload. See console for details.');
            hideImageLoading();
            this.value = '';
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
    editServiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Gather form data and format for Firestore
        const formData = getFormData();
        const updatedService = {
            ...serviceData,
            ...formData,
            status: 'Published',
            name: formData.service, // Firestore field for service name
            pricing: {
                small: formData.small,
                medium: formData.medium,
                large: formData.large,
                xLarge: formData.xLarge,
            },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        // Store the updated service to be picked up by the services page
        sessionStorage.setItem('updatedServiceData', JSON.stringify(updatedService));
        sessionStorage.removeItem('selectedServiceData');
        window.removeEventListener('storage', handleMediaSelection);

        // Save to Firestore
        try {
            const db = window.firebase.firestore();
            const { serviceId, ...dataToSave } = updatedService;
            await db.collection('services').doc(serviceId).update(dataToSave);
            if (typeof showSuccessToast === 'function') {
                showSuccessToast('Service updated successfully!');
            } else {
                alert('Service updated successfully!');
            }
        } catch (error) {
            console.error('Error updating service in Firestore:', error);
            alert('Error saving service to Firestore. Changes saved locally but may not persist.');
        }

        // Redirect back to the services list after short delay
        setTimeout(() => {
            window.location.href = 'services.html';
        }, 1200);
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