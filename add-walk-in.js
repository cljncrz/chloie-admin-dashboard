document.addEventListener('DOMContentLoaded', () => {
    // This script is specifically for the add-walk-in.html page
    const addWalkinPage = document.getElementById('add-walk-in-page');

    if (addWalkinPage) {
        const form = document.getElementById('new-walk-in-form');
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
                window.appData.services = snapshot.docs.map(doc => ({ serviceId: doc.id, ...doc.data() }));
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
                option.value = service.service;
                option.textContent = service.service;
                
                // Check the pricing labels to determine correct mapping
                // In the database, the labels are: pricingLabel1 = "7-seater", pricingLabel2 = "5-seater"
                // But the values are: small = 12500 (5-seater), medium = 10500 (7-seater)
                const pricing = service.pricing || {};
                const label1 = service.pricingLabel1 || '';
                const label2 = service.pricingLabel2 || '';
                
                let price5Seater = 0;
                let price7Seater = 0;
                
                // Map based on labels to get correct prices
                if (label1.toLowerCase().includes('5')) {
                    price5Seater = parseFloat(pricing.small || service.small) || 0;
                    price7Seater = parseFloat(pricing.medium || service.medium) || 0;
                } else if (label2.toLowerCase().includes('5')) {
                    price5Seater = parseFloat(pricing.medium || service.medium) || 0;
                    price7Seater = parseFloat(pricing.small || service.small) || 0;
                } else {
                    // Fallback: assume small=5seater, medium=7seater
                    price5Seater = parseFloat(pricing.small || service.small) || 0;
                    price7Seater = parseFloat(pricing.medium || service.medium) || 0;
                }
                
                option.dataset.price5Seater = price5Seater;
                option.dataset.price7Seater = price7Seater;
                
                console.log(`Service: ${service.service}, Labels: [${label1}, ${label2}], 5-Seater: ₱${price5Seater}, 7-Seater: ₱${price7Seater}`);
                select.appendChild(option);
            });

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn-danger-outline remove-service-btn';
            removeBtn.innerHTML = '<span class="material-symbols-outlined">remove</span>';
            removeBtn.style.display = 'none'; // Hide on the first row

            serviceRow.appendChild(select);
            serviceRow.appendChild(removeBtn);

            select.addEventListener('change', updateTotalPrice);
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
            let total = 0;
            const selectedCheckbox = vehicleSizeGroup.querySelector('input[name="vehicle-size"]:checked');
            
            // If no checkbox is selected, default to 'small' for price calculation to avoid errors.
            const selectedSizeValue = selectedCheckbox ? selectedCheckbox.value : 'small';

            servicesContainer.querySelectorAll('.walkin-service-select').forEach(select => {
                const selectedOption = select.options[select.selectedIndex];
                if (selectedOption && selectedOption.value) {
                    const price5Seater = parseFloat(selectedOption.dataset.price5Seater) || 0;
                    const price7Seater = parseFloat(selectedOption.dataset.price7Seater) || 0;
                    // Choose price based on the selected vehicle size value ('small' or 'medium')
                    total += (selectedSizeValue === 'medium') ? price7Seater : price5Seater;
                }
            });
            priceInput.value = total.toFixed(2);
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
            const serviceSelects = servicesContainer.querySelectorAll('.walkin-service-select');
            const services = Array.from(serviceSelects)
                .map(select => select.value)
                .filter(value => value !== ""); // Filter out empty selections

            const price = parseFloat(priceInput.value);
            const date = dateInput.value;
            const time = timeInput.value;
            const paymentStatus = document.getElementById('walkin-payment-status').value;
            const paymentMethod = document.getElementById('walkin-payment-method').value;

            if (!customerName || !carPlate || !customerPhone || !vehicleType || !carName || !carType || services.length === 0 || !date || !time || !paymentStatus) {
                alert('Please fill out all required fields and select at least one service.');
                return;
            }

            // Validate payment method if status is Paid
            if (paymentStatus === 'Paid' && !paymentMethod) {
                alert('Please select a payment method for paid transactions.');
                return;
            }

            // Combine date and time into a single Date object for Firestore
            const dateTime = new Date(`${date}T${time}`);

            const newWalkinData = {
                customerName,
                plate: carPlate,
                plateNumber: carPlate, // Also store as plateNumber for consistency
                phone: customerPhone,
                phoneNumber: customerPhone, // Also store as phoneNumber for consistency
                customerPhone: customerPhone, // Also store as customerPhone for consistency
                carName,
                carType,
                vehicleType, // Save the selected vehicle type
                service: services.join(', '), // Store as a comma-separated string
                serviceNames: services.join(', '), // Also store as serviceNames for consistency
                price,
                dateTime, // Store as a Firestore timestamp
                status: 'Pending',
                paymentStatus: paymentStatus,
                paymentMethod: paymentStatus === 'Paid' ? paymentMethod : null,
                technician: 'Unassigned', // Default technician
                isWalkin: true,
                createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
            };

            // Add paidAt timestamp if payment status is Paid
            if (paymentStatus === 'Paid') {
                newWalkinData.paidAt = window.firebase.firestore.FieldValue.serverTimestamp();
            }

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

        // --- Toggle payment method field based on payment status ---
        const paymentStatusSelect = document.getElementById('walkin-payment-status');
        const paymentMethodGroup = document.getElementById('payment-method-group');
        const paymentMethodSelect = document.getElementById('walkin-payment-method');

        paymentStatusSelect.addEventListener('change', () => {
            if (paymentStatusSelect.value === 'Paid') {
                paymentMethodGroup.style.display = 'block';
                paymentMethodSelect.required = true;
            } else {
                paymentMethodGroup.style.display = 'none';
                paymentMethodSelect.required = false;
                paymentMethodSelect.value = ''; // Reset selection
            }
        });

        // --- Initialization ---
        setDefaultDateTime();
        form.addEventListener('submit', handleWalkinSubmit);
        document.getElementById('add-service-btn').addEventListener('click', () => {
            addServiceRow();
            updateTotalPrice(); // Recalculate price every time a new service is added
        });
        vehicleTypeSelect.addEventListener('change', updateVehicleSizeLabels);
        
        // Add event listener to the group container for the radio buttons
        vehicleSizeGroup.addEventListener('change', (e) => {
            if (e.target.name === 'vehicle-size' && e.target.type === 'checkbox') {
                // Uncheck other checkboxes in the group
                const checkboxes = vehicleSizeGroup.querySelectorAll('input[name="vehicle-size"]');
                checkboxes.forEach(checkbox => {
                    if (checkbox !== e.target) {
                        checkbox.checked = false;
                    }
                });
                updateTotalPrice();
            }
        });

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