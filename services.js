document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to be initialized
    await window.firebaseInitPromise;
    
    // Add a small delay to ensure Firestore connection is established
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const db = window.firebase.firestore();
    let servicesData = window.appData.services || [];
    
    console.log('Services page loaded. Firebase initialized:', !!window.firebase);
    console.log('Firestore available:', !!db);

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
            console.log('Fetching services from Firestore...');
            const snapshot = await db.collection('services').get();
            
            console.log('Firestore query completed. Snapshot:', {
                empty: snapshot.empty,
                size: snapshot.docs ? snapshot.docs.length : 0
            });
            
            if (snapshot.empty) {
                console.log('No services found in Firestore.');
                servicesData = [];
            } else {
                servicesData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const imageUrl = data.imageUrl || data.image || data.bannerUrl || null;
                    
                    // Extract pricing values from the dynamic pricing object
                    const pricingObj = data.pricing || {};
                    
                    // Get all pricing entries (filter out non-numeric values)
                    const pricingEntries = Object.entries(pricingObj).filter(([key, v]) => {
                        return v !== null && v !== undefined && !isNaN(v) && typeof v === 'number';
                    });
                    
                    // Extract prices from the pricing object (they're stored with labels as keys)
                    const priceValues = pricingEntries.map(([key, value]) => value);
                    
                    // Map to small, medium, large, xLarge for compatibility
                    let small = data.small ?? priceValues[0] ?? null;
                    let medium = data.medium ?? priceValues[1] ?? null;
                    let large = data.large ?? priceValues[2] ?? null;
                    let xLarge = data.xLarge ?? priceValues[3] ?? null;
                    
                    // Extract pricing labels for display
                    const pricingLabel1 = pricingEntries[0]?.[0] ?? null;
                    const pricingLabel2 = pricingEntries[1]?.[0] ?? null;
                    
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
            
            // Render the table after data is loaded
            renderTable();
        } catch (error) {
            console.error('Error fetching services from Firestore:', error);
            console.error('Error details:', {
                code: error.code,
                message: error.message,
                name: error.name
            });
            
            // Show user-friendly error message
            if (error.code === 'unavailable') {
                console.warn('Firestore is offline. Check your internet connection.');
                alert('Unable to connect to the database. Please check your internet connection and try refreshing the page.');
            } else if (error.code === 'permission-denied') {
                console.error('Permission denied. Check Firestore security rules.');
                alert('Permission denied. Please contact the administrator.');
            }
            
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
        
        const availability = service.availability || 'Available';
        const statusDropdown = `
            <select class="technician-select status-select ${availability.toLowerCase()}">
                <option value="Available" ${availability === 'Available' ? 'selected' : ''}>Available</option>
                <option value="Unavailable" ${availability === 'Unavailable' ? 'selected' : ''}>Unavailable</option>
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
                    ${service.notes ? `<br/><small class="text-muted">${service.notes}</small>` : ''}
                </div>
            </td>
            <td>
                <div class="price-cell">${priceContent}</div>
            </td>
            <td>${service.category}</td>
            <td class="text-center">${availedCounts[service.service] || 0}</td>
            <td>${statusDropdown}</td>
            <td class="text-center">
                <button type="button" class="action-icon-btn view-service-btn" title="View Service Profile"><span class="material-symbols-outlined">visibility</span></button>
            </td>
        `;
        return row;
    };

    const renderTable = () => {
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
        
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

        // Add no results row if needed
        if (!hasResults) {
            const noResultsRow = document.createElement('tr');
            noResultsRow.className = 'no-results-row';
            noResultsRow.innerHTML = `
                <td colspan="8" class="text-center text-muted" style="padding: 2rem;">
                    No services found.
                </td>
            `;
            fragment.appendChild(noResultsRow);
        }

        servicesTbody.appendChild(fragment);
        
        // Update delete button state after render
        updateDeleteButtonState();
    };

    // --- Event Listeners ---
    if (searchInput) {
        searchInput.addEventListener('input', renderTable);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', renderTable);
    }

    const updateDeleteButtonState = () => {
        if (!deleteSelectedBtn) return;
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
        const statusSelect = e.target.closest('.status-select');

        // Handle checkbox clicks for enabling/disabling the delete button
        if (e.target.classList.contains('service-checkbox')) {
            updateDeleteButtonState();
        }

        if (viewBtn) {
            e.preventDefault();
            const serviceId = row.dataset.serviceId;
            const service = servicesData.find(s => s.serviceId === serviceId);

            if (service) {
                sessionStorage.setItem('selectedServiceData', JSON.stringify(service));
                window.location.href = 'service-profile.html';
            }
            return;
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

    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', async () => {
            const checkedBoxes = servicesTbody.querySelectorAll('.service-checkbox:checked');
            const count = checkedBoxes.length;
            if (count > 0) {
                const idsToDelete = Array.from(checkedBoxes).map(cb => cb.closest('tr').dataset.serviceId);
                
                // Delete directly without confirmation
                try {
                    // Delete from Firestore
                    const deletePromises = idsToDelete.map(id => 
                        db.collection('services').doc(id).delete()
                    );
                    await Promise.all(deletePromises);
                    
                    // Remove from local data
                    servicesData = servicesData.filter(s => !idsToDelete.includes(s.serviceId));
                    
                    // Re-render the table
                    renderTable();
                    
                    // Uncheck "Select All" checkbox
                    const selectAllCheckbox = document.getElementById('select-all-services');
                    if (selectAllCheckbox) {
                        selectAllCheckbox.checked = false;
                    }
                    
                    // Update delete button state
                    updateDeleteButtonState();
                    
                    // Show success message
                    const message = count === 1 
                        ? 'Service deleted successfully.' 
                        : `${count} services deleted successfully.`;
                    showSuccessToast(message);
                    
                    console.log(`Deleted ${count} service(s) from Firestore`);
                } catch (error) {
                    console.error('Error deleting services:', error);
                    alert('Error deleting services. Please try again.');
                }
            }
        });
    }

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

    // --- Fetch data from Firestore and render table ---
    fetchServicesFromFirestore();
});
