document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to be initialized
    await window.firebaseInitPromise;
    
    const db = window.firebase.firestore();
    let servicesData = window.appData.services || [];

    const appointmentsData = window.appData.appointments || [];
    const walkinsData = window.appData.walkins || [];
    const servicesTbody = document.getElementById('services-tbody');
    const searchInput = document.getElementById('service-search');
    const categoryFilter = document.getElementById('service-category-filter');
    const deleteSelectedBtn = document.getElementById('delete-selected-services-btn');

    if (!servicesTbody) return;

    // --- Fetch Services from Firestore ---
    const fetchServicesFromFirestore = async () => {
        try {
            const snapshot = await db.collection('services').get();
            
            if (snapshot.empty) {
                console.log('No services found in Firestore.');
                servicesData = [];
            } else {
                servicesData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const imageUrl = data.imageUrl || data.image || data.bannerUrl || null;
                    
                    // Extract pricing values from the dynamic pricing object
                    const pricingObj = data.pricing || {};
                    const pricingEntries = Object.entries(pricingObj);
                    const pricingValues = pricingEntries.filter(([key, v]) => v !== null && v !== undefined && !isNaN(v));
                    
                    // Map the pricing values to small, medium, large, xLarge
                    const small = pricingValues[0]?.[1] ?? null;
                    const medium = pricingValues[1]?.[1] ?? null;
                    const large = pricingValues[2]?.[1] ?? null;
                    const xLarge = pricingValues[3]?.[1] ?? null;
                    
                    // Extract pricing labels for display
                    const pricingLabel1 = pricingValues[0]?.[0] ?? null;
                    const pricingLabel2 = pricingValues[1]?.[0] ?? null;
                    
                    console.log('Service data from Firestore:', doc.id, {
                        service: data.service || data.serviceName,
                        pricingObject: pricingObj,
                        extractedPrices: { small, medium, large, xLarge },
                        pricingLabels: { pricingLabel1, pricingLabel2 },
                        imageUrl: imageUrl
                    });
                    return {
                        serviceId: doc.id,
                        service: data.service || data.serviceName || 'Unknown Service',
                        category: data.category || 'Uncategorized',
                        imageUrl: imageUrl,
                        featured: data.featured || false,
                        availability: data.availability || 'Available',
                        small: small,
                        medium: medium,
                        large: large,
                        xLarge: xLarge,
                        pricingLabel1: pricingLabel1,
                        pricingLabel2: pricingLabel2,
                        pricingScheme: data.pricingScheme || 'Car Sizes',
                        notes: data.notes || '',
                        ...data
                    };
                });
                console.log('Services loaded from Firestore:', servicesData);
            }
            
            // After fetching from Firestore, check for newly created or updated services from sessionStorage
            const newlyCreatedServiceJSON = sessionStorage.getItem('newlyCreatedService');
            if (newlyCreatedServiceJSON) {
                const newService = JSON.parse(newlyCreatedServiceJSON);
                // Add the new service to the top of the data array
                servicesData.unshift(newService);
                // Clean up sessionStorage
                sessionStorage.removeItem('newlyCreatedService');
            }

            // Check for an updated service from service-profile.html
            const updatedServiceJSON = sessionStorage.getItem('updatedServiceData');
            if (updatedServiceJSON) {
                const updatedService = JSON.parse(updatedServiceJSON);
                const index = servicesData.findIndex(s => s.serviceId === updatedService.serviceId);
                if (index !== -1) {
                    servicesData[index] = updatedService; // Replace the old data
                }
                // Clean up sessionStorage
                sessionStorage.removeItem('updatedServiceData');
            }

            // Render the table after data is loaded
            renderTable();
        } catch (error) {
            console.error('Error fetching services from Firestore:', error);
            // Fallback to window.appData.services if Firestore fetch fails
            servicesData = window.appData.services || [];
            renderTable();
        }
    };

    // --- Delete Confirmation Modal Elements ---
    const confirmOverlay = document.getElementById('delete-confirm-overlay');
    const confirmMessage = document.getElementById('delete-confirm-message');
    const confirmBtn = document.getElementById('delete-confirm-btn');
    const cancelBtn = document.getElementById('delete-cancel-btn');
    const closeModalBtn = document.getElementById('delete-confirm-close-btn');
    const successToast = document.getElementById('success-toast');

    // --- Generic Confirmation Modal Elements ---
    const genericConfirmOverlay = document.getElementById('generic-confirm-overlay');
    const genericConfirmTitle = document.getElementById('generic-confirm-title');
    const genericConfirmMessage = document.getElementById('generic-confirm-message');
    const genericConfirmBtn = document.getElementById('generic-confirm-btn');
    const genericCancelBtn = document.getElementById('generic-cancel-btn');
    const genericCloseModalBtn = document.getElementById('generic-confirm-close-btn');


    if (!servicesTbody) return;

    // --- Calculate how many times each service was availed ---
    const availedCounts = [...appointmentsData, ...walkinsData].reduce((acc, item) => {
        acc[item.service] = (acc[item.service] || 0) + 1;
        return acc;
    }, {});

    const createServiceRow = (service, index) => {
        const row = document.createElement('tr');
        row.dataset.serviceId = service.serviceId;

        // --- Calculate Price Range ---
        const getPriceRange = (service) => {
            // Convert all prices to numbers, filtering out null, undefined, and 0
            const prices = [service.small, service.medium, service.large, service.xLarge]
                .map(p => {
                    if (p === null || p === undefined || p === '') return null;
                    const numPrice = typeof p === 'string' ? parseFloat(p) : p;
                    return !isNaN(numPrice) && numPrice > 0 ? numPrice : null;
                })
                .filter(p => p !== null);
            
            if (prices.length === 0) {
                return '<span class="text-muted">—</span>';
            }
            
            if (prices.length === 1) {
                // Single price with label
                const label = service.pricingLabel1 ? `<br/><small style="font-size: 0.75em; color: #999;">(${service.pricingLabel1})</small>` : '';
                return `₱${prices[0].toLocaleString()}${label}`;
            }
            
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            
            if (minPrice === maxPrice) {
                const label = service.pricingLabel1 ? `<br/><small style="font-size: 0.75em; color: #999;">(${service.pricingLabel1})</small>` : '';
                return `₱${minPrice.toLocaleString()}${label}`;
            }
            
            // Price range with both labels
            let label = '';
            if (service.pricingLabel1 && service.pricingLabel2) {
                label = `<br/><small style="font-size: 0.75em; color: #999;">(${service.pricingLabel1} - ${service.pricingLabel2})</small>`;
            }
            
            return `₱${minPrice.toLocaleString()} - ₱${maxPrice.toLocaleString()}${label}`;
        };

        const priceContent = getPriceRange(service);
        const hasSpecificPrices = !priceContent.includes('text-muted');


        // --- Create Featured Toggle Switch ---
        const featuredToggle = `
            <label class="table-toggle-switch">
                <input type="checkbox" class="featured-toggle-checkbox" ${service.featured ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        `;
        
        const statusDropdown = `
            <select class="technician-select status-select ${service.availability.toLowerCase()}">
                <option value="Available" ${service.availability === 'Available' ? 'selected' : ''}>Available</option>
                <option value="Unavailable" ${service.availability === 'Unavailable' ? 'selected' : ''}>Unavailable</option>
            </select>`;

        row.innerHTML = `
            <td><input type="checkbox" class="service-checkbox"></td>
            <td>
                <div class="service-banner-cell">
                    <img
                        src="${service.imageUrl || './images/services.png'}"
                        alt="${service.service || 'Service'}"
                        class="service-table-image"
                        onerror="this.src='./images/services.png';"
                        style="max-width: 100%; height: auto; display: block;"
                    >
                </div>
            </td>
            <td>
                <div class="service-name-cell">
                    <strong>${service.service}</strong>                    
                    ${(service.pricingScheme === 'No Specific Prices' && service.notes) || (!hasSpecificPrices && service.notes && service.pricingScheme !== 'No Specific Prices') ? `<small class="text-muted">${service.notes}</small>` : ''}
                </div>
            </td>
            <td>
                <div class="price-cell">${priceContent}</div>
            </td>
            <td>${service.category}</td>
            <td class="text-center">${availedCounts[service.service] || 0}</td>
            <td class="text-center">${featuredToggle}</td>
            <td>${statusDropdown}</td>
            <td class="text-center">
                <button class="action-icon-btn view-service-btn" title="View Service Profile"><span class="material-symbols-outlined">visibility</span></button>
            </td>
        `;
        return row;
    };

    const renderTable = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedCategory = categoryFilter.value;
        
        servicesTbody.innerHTML = ''; // Clear table
        const fragment = document.createDocumentFragment();
        let hasResults = false;

        servicesData.forEach((service, index) => {
            const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;
            const matchesSearch = service.service.toLowerCase().includes(searchTerm);

            if (matchesCategory && matchesSearch) {
                fragment.appendChild(createServiceRow(service, index));
                hasResults = true;
            }
        });

        const noResultsRow = servicesTbody.nextElementSibling; // Assuming it's immediately after
        if (noResultsRow && noResultsRow.classList.contains('no-results-row')) {
             noResultsRow.style.display = hasResults ? 'none' : 'table-row';
        }

        servicesTbody.appendChild(fragment);
    };

    // --- Event Listeners ---
    if (searchInput) {
        searchInput.addEventListener('input', renderTable);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', renderTable);
    }

    const updateDeleteButtonState = () => {
        const checkedBoxes = servicesTbody.querySelectorAll('.service-checkbox:checked');
        deleteSelectedBtn.disabled = checkedBoxes.length === 0;
    };

    // Handle "Select All" checkbox
    const selectAllCheckbox = document.getElementById('select-all-services');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            servicesTbody.querySelectorAll('.service-checkbox').forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
            updateDeleteButtonState();
        });
    }

    servicesTbody.addEventListener('click', (e) => {
        // Ensure the click is within the table body and not on other page elements
        const row = e.target.closest('tr');
        if (!row) return;

        const viewBtn = e.target.closest('.view-service-btn');
        const featuredToggleInput = e.target.closest('.featured-toggle-checkbox');
        const statusSelect = e.target.closest('.status-select');

        // Handle checkbox clicks for enabling/disabling the delete button
        if (e.target.classList.contains('service-checkbox')) {
            updateDeleteButtonState();
        }

        if (viewBtn) {
            const serviceId = row.dataset.serviceId;
            const service = servicesData.find(s => s.serviceId === serviceId);

            if (service) {
                sessionStorage.setItem('selectedServiceData', JSON.stringify(service));
                window.location.href = 'service-profile.html';
            }
            return;
        }

        if (featuredToggleInput) {
            // Prevent the default toggle action until confirmed
            e.preventDefault();

            const serviceId = row.dataset.serviceId;
            const service = servicesData.find(s => s.serviceId === serviceId);
            const isCurrentlyFeatured = service.featured;
            const willBeFeatured = !isCurrentlyFeatured;

            if (service) {
                const action = willBeFeatured ? 'feature' : 'unfeature';
                const title = willBeFeatured ? 'Feature Service' : 'Unfeature Service';
                const message = `Are you sure you want to ${action} the service "${service.service}"?`;

                openGenericConfirmModal(title, message, async () => {
                    // --- This runs only on confirmation ---
                    // 1. Visually update the toggle
                    featuredToggleInput.checked = willBeFeatured;

                    // 2. Update the data model
                    service.featured = willBeFeatured;

                    // 3. Save to Firestore
                    try {
                        await db.collection('services').doc(serviceId).update({
                            featured: willBeFeatured
                        });
                        console.log(`Service ${serviceId} featured status updated in Firestore`);
                    } catch (error) {
                        console.error('Error updating featured status in Firestore:', error);
                        alert('Error updating service. Please try again.');
                    }

                    // 4. Show a success message
                    const successMessage = willBeFeatured
                        ? `"${service.service}" is now featured.`
                        : `"${service.service}" is no longer featured.`;
                    showSuccessToast(successMessage);
                });
            }
        }

        // Close generic modal if cancel/close is clicked
        if (e.target === genericCancelBtn || e.target === genericCloseModalBtn || e.target === genericConfirmOverlay) {
            closeGenericConfirmModal();
        }
    });

    servicesTbody.addEventListener('change', async (e) => {
        const statusSelect = e.target.closest('.status-select');
        if (statusSelect) {
            const row = statusSelect.closest('tr');
            const serviceId = row.dataset.serviceId;
            const service = servicesData.find(s => s.serviceId === serviceId);
            const newStatus = statusSelect.value;

            if (service) {
                // Update the data model
                service.availability = newStatus;

                // Update the dropdown's class to change its color
                statusSelect.className = `technician-select status-select ${newStatus.toLowerCase()}`;

                // Save to Firestore
                try {
                    await db.collection('services').doc(serviceId).update({
                        availability: newStatus
                    });
                    console.log(`Service ${serviceId} availability updated in Firestore`);
                } catch (error) {
                    console.error('Error updating availability in Firestore:', error);
                    alert('Error updating service status. Please try again.');
                }

                // Show a success message
                const message = `"${service.service}" status updated to ${newStatus}.`;
                showSuccessToast(message);
            }
        }
    });

    deleteSelectedBtn.addEventListener('click', () => {
        const checkedBoxes = servicesTbody.querySelectorAll('.service-checkbox:checked');
        const count = checkedBoxes.length;
        if (count > 0) {
            openDeleteConfirmModal(count, () => {
                const idsToDelete = Array.from(checkedBoxes).map(cb => cb.closest('tr').dataset.serviceId);
                deleteServices(idsToDelete);
            });
        }
    });

    // --- Delete Modal Logic ---
    const openDeleteConfirmModal = (count, confirmCallback) => {
        if (!confirmOverlay) return;
        confirmMessage.innerHTML = `Are you sure you want to delete <strong>${count} service(s)</strong>? This action cannot be undone.`;
        confirmOverlay.classList.add('show');

        // Use { once: true } to avoid attaching multiple listeners
        confirmBtn.addEventListener('click', function handler() {
            confirmCallback();
            closeDeleteConfirmModal();
            confirmBtn.removeEventListener('click', handler);
        }, { once: true });
    };

    // --- Generic Modal Logic ---
    const openGenericConfirmModal = (title, message, confirmCallback) => {
        if (!genericConfirmOverlay) return;
        genericConfirmTitle.textContent = title;
        genericConfirmMessage.innerHTML = message;
        genericConfirmOverlay.classList.add('show');

        // Use { once: true } to avoid attaching multiple listeners
        const confirmHandler = () => {
            confirmCallback();
            closeGenericConfirmModal();
        };

        genericConfirmBtn.addEventListener('click', confirmHandler, { once: true });
        genericCancelBtn.addEventListener('click', closeGenericConfirmModal, { once: true });
    };

    const closeGenericConfirmModal = () => {
        if (genericConfirmOverlay) genericConfirmOverlay.classList.remove('show');
    };

    const closeDeleteConfirmModal = () => {
        if (confirmOverlay) confirmOverlay.classList.remove('show');
    };

    const deleteServices = (serviceIds) => {
        let deletedCount = 0;
        serviceIds.forEach(id => {
            const serviceIndex = servicesData.findIndex(s => s.serviceId === id);
            if (serviceIndex > -1) {
                servicesData.splice(serviceIndex, 1);
                deletedCount++;
            }
        });
        if (deletedCount > 0) {
            renderTable();
            updateDeleteButtonState();
            showSuccessToast(`${deletedCount} service(s) deleted successfully!`);
        }
    };

    // --- Success Toast Notification ---
    const showSuccessToast = (message) => {
        if (!successToast) return;
        const toastText = successToast.querySelector('p');
        toastText.textContent = message;
        successToast.classList.add('show');

        setTimeout(() => {
            successToast.classList.remove('show');
        }, 3000); // Hide after 3 seconds
    };
    
    if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteConfirmModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeDeleteConfirmModal);
    if (confirmOverlay) confirmOverlay.addEventListener('click', (e) => { if (e.target === confirmOverlay) closeDeleteConfirmModal(); });

    // --- Fetch data from Firestore and render table ---
    fetchServicesFromFirestore();
});
