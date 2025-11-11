document.addEventListener('DOMContentLoaded', () => {
    // This script is specifically for the add-walk-in.html page
    const addWalkinPage = document.getElementById('add-walk-in-page');

    if (addWalkinPage) {
        const form = document.getElementById('new-walk-in-form');
        const serviceSelect = document.getElementById('walkin-service');
        const priceInput = document.getElementById('walkin-price');
        const dateInput = document.getElementById('walkin-date');
        const timeInput = document.getElementById('walkin-time');

        // --- Populate Service Dropdown ---
        const populateServices = () => {
            const services = window.appData.services || [];
            if (serviceSelect) {
                serviceSelect.innerHTML = '<option value="">Select a service...</option>';
                services.forEach(service => {
                    // We'll store the price data directly on the option element
                    const option = document.createElement('option');
                    option.value = service.service;
                    option.textContent = service.service;
                    // Storing prices as a JSON string in a data attribute
                    option.dataset.prices = JSON.stringify({
                        small: service.small,
                        medium: service.medium,
                        large: service.large,
                        xlarge: service.xlarge
                    });
                    serviceSelect.appendChild(option);
                });
            }
        };

        // --- Auto-fill price based on service selection ---
        const handleServiceChange = () => {
            const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
            if (selectedOption && selectedOption.dataset.prices) {
                const prices = JSON.parse(selectedOption.dataset.prices);
                // Default to the 'medium' price if available, otherwise take the first available price
                priceInput.value = prices.medium || prices.small || prices.large || prices.xlarge || '';
            } else {
                priceInput.value = '';
            }
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
        const handleWalkinSubmit = (e) => {
            e.preventDefault();
            const customerName = document.getElementById('walkin-customer-name').value.trim();
            const carPlate = document.getElementById('walkin-car-plate').value.trim().toUpperCase();
            const customerPhone = document.getElementById('walkin-customer-phone').value.trim();
            const carName = document.getElementById('walkin-car-name').value.trim();
            const carType = document.getElementById('walkin-car-type').value.trim();
            const service = serviceSelect.value;
            const price = parseFloat(priceInput.value);
            const date = dateInput.value;
            const time = timeInput.value;

            if (!customerName || !carPlate || !customerPhone || !carName || !carType || !service || !price || !date || !time) {
                alert('Please fill out all required fields.');
                return;
            }

            // In a real app, you would send this data to your backend (e.g., Firestore)
            // For now, we can simulate success and redirect.
            console.log('New Walk-in Data:', { customerName, carPlate, customerPhone, carName, carType, service, price, date, time });

            if (typeof showSuccessToast === 'function') {
                showSuccessToast('New walk-in added to the queue!');
            }

            // Redirect back to the appointments page after a short delay
            setTimeout(() => {
                window.location.href = 'appointment.html';
            }, 1000);
        };

        // --- Initialization ---
        populateServices();
        setDefaultDateTime();
        form.addEventListener('submit', handleWalkinSubmit);
        serviceSelect.addEventListener('change', handleServiceChange);
    }
});