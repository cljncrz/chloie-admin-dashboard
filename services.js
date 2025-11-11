document.addEventListener('DOMContentLoaded', () => {
    const servicesData = window.appData.services || [];

    // --- Check for a newly created service from create-service.html ---
    const newlyCreatedServiceJSON = sessionStorage.getItem('newlyCreatedService');
    if (newlyCreatedServiceJSON) {
        const newService = JSON.parse(newlyCreatedServiceJSON);
        // Add the new service to the top of the data array
        servicesData.unshift(newService);
        // Clean up sessionStorage
        sessionStorage.removeItem('newlyCreatedService');
    }

    // --- Check for an updated service from service-profile.html ---
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

    const appointmentsData = window.appData.appointments || [];
    const walkinsData = window.appData.walkins || [];
    const servicesTbody = document.getElementById('services-tbody');
    const searchInput = document.getElementById('service-search');
    const categoryFilter = document.getElementById('service-category-filter');
    const deleteSelectedBtn = document.getElementById('delete-selected-services-btn');

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

        // --- Create Specific Price Breakdown ---
        const formatPrice = (price) => price ? `₱${price.toLocaleString()}` : '<span class="text-muted">—</span>';
        let priceBreakdownHTML = '';
        let hasSpecificPrices = false;

        if (service.pricingScheme === 'Car Sizes' || !service.pricingScheme) { // Default to Car Sizes if not set
            if (service.small) { priceBreakdownHTML += `<div><small>5-Seater:</small> <strong>${formatPrice(service.small)}</strong></div>`; hasSpecificPrices = true; }
            if (service.medium) { priceBreakdownHTML += `<div><small>7-Seater:</small> <strong>${formatPrice(service.medium)}</strong></div>`; hasSpecificPrices = true; }
            if (service.large) { priceBreakdownHTML += `<div><small>9-Seater:</small> <strong>${formatPrice(service.large)}</strong></div>`; hasSpecificPrices = true; }
            if (service.xLarge) { priceBreakdownHTML += `<div><small>12-Seater:</small> <strong>${formatPrice(service.xLarge)}</strong></div>`; hasSpecificPrices = true; }
        } else if (service.pricingScheme === 'Motorcycle CCs') {
            if (service.small) { priceBreakdownHTML += `<div><small>399cc below:</small> <strong>${formatPrice(service.small)}</strong></div>`; hasSpecificPrices = true; }
            if (service.xLarge) { priceBreakdownHTML += `<div><small>400cc above:</small> <strong>${formatPrice(service.xLarge)}</strong></div>`; hasSpecificPrices = true; }
        } else if (service.pricingScheme === 'Custom') {
            // For custom, just display all available prices with generic labels
            if (service.small) { priceBreakdownHTML += `<div><small>Small:</small> <strong>${formatPrice(service.small)}</strong></div>`; hasSpecificPrices = true; }
            if (service.medium) { priceBreakdownHTML += `<div><small>Medium:</small> <strong>${formatPrice(service.medium)}</strong></div>`; hasSpecificPrices = true; }
            if (service.large) { priceBreakdownHTML += `<div><small>Large:</small> <strong>${formatPrice(service.large)}</strong></div>`; hasSpecificPrices = true; }
            if (service.xLarge) { priceBreakdownHTML += `<div><small>X-Large:</small> <strong>${formatPrice(service.xLarge)}</strong></div>`; hasSpecificPrices = true; }
        }

        let priceContent;
        if (service.pricingScheme === 'No Specific Prices' && service.notes) {
            priceContent = `<div class="price-notes">${service.notes}</div>`;
        } else if (hasSpecificPrices) {
            priceContent = `<div class="price-breakdown">${priceBreakdownHTML}</div>`;
        } else if (service.notes && service.notes.includes(':')) { // Fallback for old data or if notes are structured
            priceContent = `<div class="price-notes">${service.notes}</div>`;
        } else {
            priceContent = '<span class="text-muted">—</span>';
        }

        // Use notes as fallback if no specific prices exist
        // The logic above already handles this, so we can simplify.
        // const hasSpecificPrices = service.small || service.medium; // This is now handled by the hasSpecificPrices flag

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
                        src="${service.imageUrl || './images/placeholder-image.png'}"
                        alt="${service.service}"
                        onerror="this.onerror=null;this.src='./images/placeholder-image.png';"
                    >
                </div>
            </td>
            <td>${service.serviceId}</td>
            <td>
                <div class="service-name-cell">
                    <strong>${service.service}</strong>                    
                    ${(service.pricingScheme === 'No Specific Prices' && service.notes) || (!hasSpecificPrices && service.notes && service.pricingScheme !== 'No Specific Prices') ? `<small class="text-muted">${service.notes}</small>` : ''}
                </div>
            </td>
            <td>${priceContent}</td>
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

                openGenericConfirmModal(title, message, () => {
                    // --- This runs only on confirmation ---
                    // 1. Visually update the toggle
                    featuredToggleInput.checked = willBeFeatured;

                    // 2. Update the data model
                    service.featured = willBeFeatured;

                    // 3. Show a success message
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

    servicesTbody.addEventListener('change', (e) => {
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

    // Initial render
    renderTable();
});
