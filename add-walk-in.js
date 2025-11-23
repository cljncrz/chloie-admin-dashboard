document.addEventListener('DOMContentLoaded', () => {
    // This script is specifically for the add-walk-in.html page
    const addWalkinPage = document.getElementById('add-walk-in-page');

    if (addWalkinPage) {
        const form = document.getElementById('new-walk-in-form');
        const technicianSelect = document.getElementById('walkin-technician-select');
        const servicesContainer = document.getElementById('walkin-services-container');
        const priceInput = document.getElementById('walkin-price');
        const dateInput = document.getElementById('walkin-date');
        const vehicleTypeSelect = document.getElementById('walkin-vehicle-type');
        const vehicleSizeGroup = document.getElementById('walkin-vehicle-size-group');
        const timeInput = document.getElementById('walkin-time');

        // --- Make price input unchangeable ---
        priceInput.readOnly = true;
        priceInput.style.cursor = 'not-allowed';
        priceInput.style.backgroundColor = 'var(--color-light)';

        // --- Fetch services from Firestore ---
        const fetchServices = async () => {
            try {
                const db = window.firebase.firestore();
                const snapshot = await db.collection('services').get();
                window.appData.services = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const pricingObj = data.pricing || {};

                    // Helper to normalize keys and find prices for 5/7 seater labels
                    const normalizeKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
                    const parseNumeric = (raw) => {
                        if (raw === null || raw === undefined) return null;
                        if (typeof raw === 'number') return isNaN(raw) ? null : raw;
                        const cleaned = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
                        return isNaN(cleaned) ? null : cleaned;
                    };

                    const findByCandidates = (obj, candidates) => {
                        for (const [k, v] of Object.entries(obj)) {
                            const nk = normalizeKey(k);
                            for (const c of candidates) {
                                if (nk.includes(c)) return parseNumeric(v);
                            }
                        }
                        return null;
                    };

                    // Try to find explicit 5-seater / 7-seater keys in the pricing object
                    const match5 = findByCandidates(pricingObj, ['5seater', '5seat', 'five', '5']);
                    const match7 = findByCandidates(pricingObj, ['7seater', '7seat', 'seven', '7']);

                    // Fallback: gather numeric values in order
                    const pricingEntries = Object.entries(pricingObj).map(([k, v]) => parseNumeric(v)).filter(v => v !== null);

                    const small = data.small ?? match5 ?? pricingEntries[0] ?? null;
                    const medium = data.medium ?? match7 ?? pricingEntries[1] ?? null;
                    const large = data.large ?? pricingEntries[2] ?? null;
                    const xLarge = data.xLarge ?? pricingEntries[3] ?? null;

                    return {
                        serviceId: doc.id,
                        service: data.service || data.serviceName || 'Unknown Service',
                        category: data.category || null,
                        small,
                        medium,
                        large,
                        xLarge,
                        pricing: pricingObj,
                        ...data
                    };
                });
            } catch (error) {
                console.error("Error fetching services:", error);
                window.appData.services = []; // Ensure it's an empty array on error
            }
        };

        // --- Service Selection Logic ---
        const createServiceSelector = () => {
            const serviceRow = document.createElement('div');
            serviceRow.className = 'service-row';
            serviceRow.style.display = 'flex';
            serviceRow.style.gap = '1rem';
            serviceRow.style.alignItems = 'center';

            const select = document.createElement('select');
            select.className = 'walkin-service-select';
            select.innerHTML = '<option value="">Select a service...</option>';
            select.style.flexGrow = '1';

            const services = window.appData.services || [];
            services.forEach(service => {
                const option = document.createElement('option');
                // Use serviceId as the option value for reliable lookup,
                // but display the human-readable service name.
                option.value = service.serviceId || service.service;
                option.textContent = service.service;
                // Store numeric dataset values as strings (fall back to 0)
                option.dataset.price5Seater = (service.small ?? 0).toString();
                option.dataset.price7Seater = (service.medium ?? 0).toString();
                select.appendChild(option);
            });

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn-danger-outline remove-service-btn';
            removeBtn.innerHTML = '<span class="material-symbols-outlined">remove</span>';
            removeBtn.style.display = 'none'; // Hide on the first row

            serviceRow.appendChild(select);
            serviceRow.appendChild(removeBtn);

            // Update total price on change
            select.addEventListener('change', updateTotalPrice);
            // Also update on blur in case of autofill
            select.addEventListener('blur', updateTotalPrice);
            removeBtn.addEventListener('click', () => {
                serviceRow.remove();
                updateTotalPrice();
                document.getElementById('add-service-btn').style.display = 'inline-flex';
            });

            return serviceRow;
        };

        const addServiceRow = () => {
            const serviceRows = servicesContainer.querySelectorAll('.service-row');
            if (serviceRows.length < 3) {
                const newRow = createServiceSelector();
                servicesContainer.appendChild(newRow);
                if (servicesContainer.querySelectorAll('.service-row').length > 1) {
                    newRow.querySelector('.remove-service-btn').style.display = 'inline-flex';
                }
                if (servicesContainer.querySelectorAll('.service-row').length >= 3) {
                    document.getElementById('add-service-btn').style.display = 'none';
                }
            }
        };

        const updateTotalPrice = () => {
            // Helper: parse price strings like "₱1,000.00" or numbers safely
            const parsePrice = (v) => {
                if (v === undefined || v === null) return 0;
                if (typeof v === 'number') return isNaN(v) ? 0 : v;
                // Remove currency symbols, commas and whitespace
                const s = String(v).replace(/[^0-9.\-]/g, '');
                const n = parseFloat(s);
                return isNaN(n) ? 0 : n;
            };

            let total = 0;
            const selectedCheckbox = vehicleSizeGroup.querySelector('input[name="vehicle-size"]:checked');
            const selectedSizeValue = selectedCheckbox ? selectedCheckbox.value : 'small';
            const servicesList = window.appData && window.appData.services ? window.appData.services : [];

            servicesContainer.querySelectorAll('.walkin-service-select').forEach((select, idx) => {
                const selectedOption = select.options[select.selectedIndex];
                if (!selectedOption || !selectedOption.value) return;

                // Read raw dataset values
                const rawDatasetPrice5 = selectedOption.dataset.price5Seater;
                const rawDatasetPrice7 = selectedOption.dataset.price7Seater;

                // Prefer dataset values, but always sanitize them
                let priceSmall = parsePrice(rawDatasetPrice5);
                let priceMedium = parsePrice(rawDatasetPrice7);

                // If dataset yielded 0 for both (or missing), try looking up the service object
                if ((priceSmall === 0 && priceMedium === 0)) {
                    const svcKey = selectedOption.value;
                    const svcObj = servicesList.find(s => s.service === svcKey || s.serviceId === svcKey);
                    if (svcObj) {
                        priceSmall = parsePrice(svcObj.small ?? svcObj.price ?? svcObj.pricing ?? 0);
                        priceMedium = parsePrice(svcObj.medium ?? svcObj.price ?? svcObj.pricing ?? 0);
                    }
                }

                // Debugging: show what we read for each select
                try {
                    console.debug('[updateTotalPrice] selectIndex:', idx, 'optionValue:', selectedOption.value, 'optionText:', selectedOption.textContent, 'rawDatasetPrice5:', rawDatasetPrice5, 'rawDatasetPrice7:', rawDatasetPrice7, 'priceSmall:', priceSmall, 'priceMedium:', priceMedium);
                } catch (e) {}

                total += (selectedSizeValue === 'medium') ? priceMedium : priceSmall;
            });

            // Format and set the total price
            if (total === 0) {
                priceInput.value = '0.00';
            } else {
                priceInput.value = Number(total).toFixed(2);
            }

            try { console.debug('[updateTotalPrice] size:', selectedSizeValue, 'total:', priceInput.value); } catch (e) {}
        };

        // --- Set Default Date and Time ---
        const setDefaultDateTime = () => {
            const now = new Date();
            // Format date as YYYY-MM-DD
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            dateInput.value = `${year}-${month}-${day}`;

            // Format time as HH:MM
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            timeInput.value = `${hours}:${minutes}`;
        };

        // --- Handle Form Submission ---
        const handleWalkinSubmit = async (e) => {
            e.preventDefault();
            const customerName = document.getElementById('walkin-customer-name').value.trim();
            const carPlate = document.getElementById('walkin-car-plate').value.trim().toUpperCase();
            const customerPhone = document.getElementById('walkin-customer-phone').value.trim();
            const vehicleType = vehicleTypeSelect.value;
            const carName = document.getElementById('walkin-car-name').value.trim();
            const carType = document.getElementById('walkin-car-type').value.trim();
            const paymentMethod = document.getElementById('walkin-payment-method').value;
            const serviceSelects = servicesContainer.querySelectorAll('.walkin-service-select');
            const services = Array.from(serviceSelects)
                .map(select => {
                    const val = select.value;
                    if (!val) return null;
                    // Map stored option value (serviceId) back to service name for storage
                    const svc = (window.appData.services || []).find(s => s.serviceId === val || s.service === val);
                    return svc ? svc.service : val;
                })
                .filter(value => value !== null && value !== ""); // Filter out empty selections

            const price = parseFloat(priceInput.value);
            const date = dateInput.value;
            const time = timeInput.value;

            if (!customerName || !carPlate || !customerPhone || !vehicleType || !carName || !carType || !paymentMethod || services.length === 0 || !date || !time) {
                alert('Please fill out all required fields and select at least one service.');
                return;
            }

            // Combine date and time into a single Date object for Firestore
            const dateTime = new Date(`${date}T${time}`);

            const newWalkinData = {
                customerName,
                plate: carPlate,
                phone: customerPhone,
                carName,
                carType,
                vehicleType, // Save the selected vehicle type
                service: services.join(', '), // Store as a comma-separated string
                price,
                dateTime, // Store as a Firestore timestamp
                status: 'Pending',
                paymentStatus: 'Unpaid',
                paymentMethod: paymentMethod, // Save the selected payment method
                technician: technicianSelect && technicianSelect.value ? technicianSelect.value : 'Unassigned',
                isWalkin: true
            };

            try {
                const db = window.firebase.firestore();
                await db.collection('walkins').add(newWalkinData);

                if (typeof showSuccessToast === 'function') {
                    showSuccessToast('New walk-in added to the queue!');
                }

                // Redirect back to the appointments page after a short delay
                setTimeout(() => {
                    window.location.href = 'appointment.html';
                }, 1000);
            } catch (error) {
                console.error("Error adding walk-in to Firestore:", error);
                alert('Failed to add walk-in. Please try again.');
            }
        };

        // --- Function to update vehicle size labels ---
        const updateVehicleSizeLabels = () => {
            const selectedType = vehicleTypeSelect.value;
            const smallLabel = document.getElementById('vehicle-size-small-label');
            const mediumLabel = document.getElementById('vehicle-size-medium-label');

            if (selectedType === 'Motorcycle') {
                smallLabel.textContent = '399cc below';
                mediumLabel.textContent = '400cc above';
            } else { // Default to Car
                smallLabel.textContent = '5-Seater';
                mediumLabel.textContent = '7-Seater';
            }
            // Recalculate price when the type changes
            updateTotalPrice();
        };

        // --- Initialization ---
        setDefaultDateTime();
        form.addEventListener('submit', handleWalkinSubmit);
                // --- Technician Dropdown Logic ---
                // Populate technician dropdown with active technicians
                const populateTechnicianDropdown = () => {
                    if (!technicianSelect) return;
                    technicianSelect.innerHTML = '<option value="Unassigned">Choose technician...</option>';
                    const technicians = (window.appData.technicians || []).filter(tech => tech.status === 'Active');
                    technicians.forEach(tech => {
                        const opt = document.createElement('option');
                        opt.value = tech.name;
                        opt.textContent = tech.name;
                        technicianSelect.appendChild(opt);
                    });
                };
                // Populate on load (after Firebase ready)
                if (window.appData && window.appData.technicians) {
                    populateTechnicianDropdown();
                } else {
                    setTimeout(populateTechnicianDropdown, 1000); // fallback if not loaded yet
                }

                // Disable approve/start button if technician is not selected
                if (technicianSelect) {
                    const approveBtn = document.getElementById('walkin-approve-btn');
                    const updateApproveBtnState = () => {
                        if (approveBtn) {
                            approveBtn.disabled = !technicianSelect.value || technicianSelect.value === 'Unassigned';
                            approveBtn.title = approveBtn.disabled ? 'Choose technician first' : 'Approve Walk-in';
                        }
                    };
                    technicianSelect.addEventListener('change', updateApproveBtnState);
                    updateApproveBtnState();
                }
        document.getElementById('add-service-btn').addEventListener('click', () => {
            addServiceRow();
            updateTotalPrice(); // Recalculate price every time a new service is added
        });
        vehicleTypeSelect.addEventListener('change', updateVehicleSizeLabels);
        
        // Add event listener to the group container for the radio buttons
        vehicleSizeGroup.addEventListener('change', (e) => {
            if (e.target.name === 'vehicle-size') {
                // Uncheck other checkboxes in the group (if using checkboxes)
                if (e.target.type === 'checkbox') {
                    const checkboxes = vehicleSizeGroup.querySelectorAll('input[name="vehicle-size"]');
                    checkboxes.forEach(checkbox => {
                        if (checkbox !== e.target) {
                            checkbox.checked = false;
                        }
                    });
                }
                updateTotalPrice();
            }
        });

        // Fallback: update total price on any change in the services container (for robustness)
        servicesContainer.addEventListener('change', updateTotalPrice);
        servicesContainer.addEventListener('input', updateTotalPrice);

        // Fetch services from Firestore and then populate the dropdown
        fetchServices().then(() => {
            // Add the initial service selector row
            updateVehicleSizeLabels(); // Set initial labels
            if (servicesContainer.children.length === 0) {
                addServiceRow();
                updateTotalPrice(); // Calculate price on initial load
            }
        });
    }
});