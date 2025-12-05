document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to be initialized
    await window.firebaseInitPromise;
    
    const db = window.firebase.firestore();
    const customersTable = document.getElementById('customers-table'); // This should be customers-table

    // Only run the script if the customers table and data exist on the page
    if (customersTable) {
        const tableBody = customersTable.querySelector('tbody');
        let mobileCustomers = []; // This will hold the data from Firestore
        const searchInput = document.getElementById('customer-search');
        const printBtn = document.getElementById('print-customers-btn');
        const selectAllCheckbox = document.getElementById('select-all-customers');
        const deleteSelectedBtn = document.getElementById('delete-selected-customers-btn');
        const noResultsRow = customersTable.querySelector('.no-results-row');
        const loader = document.querySelector('.customer-list-container .table-loader');



        // --- Fetch Booking Counts from Firestore ---
        const fetchBookingCounts = async (userIds) => {
            const counts = {};
            
            try {
                // Fetch all completed bookings for the given user IDs
                const bookingsSnapshot = await db.collection('bookings')
                    .where('userId', 'in', userIds.slice(0, 10)) // Firestore 'in' query limit is 10
                    .where('status', '==', 'Completed')
                    .get();

                // Count bookings per user
                bookingsSnapshot.docs.forEach(doc => {
                    const userId = doc.data().userId;
                    counts[userId] = (counts[userId] || 0) + 1;
                });

                // If there are more than 10 users, fetch in batches
                if (userIds.length > 10) {
                    for (let i = 10; i < userIds.length; i += 10) {
                        const batch = userIds.slice(i, i + 10);
                        const batchSnapshot = await db.collection('bookings')
                            .where('userId', 'in', batch)
                            .where('status', '==', 'Completed')
                            .get();

                        batchSnapshot.docs.forEach(doc => {
                            const userId = doc.data().userId;
                            counts[userId] = (counts[userId] || 0) + 1;
                        });
                    }
                }
            } catch (error) {
                console.error("Error fetching booking counts:", error);
            }

            return counts;
        };

        // --- Fetch and Populate Table from Firestore ---
        const fetchAndPopulateCustomers = async () => {
            if (loader) loader.classList.add('loading');
            tableBody.innerHTML = ''; // Clear existing static content

            try {
                // Fetch users that are not admins. Assuming customers have a different role or no role.
                const snapshot = await db.collection('users').where('role', '!=', 'admin').get();

                if (snapshot.empty) {
                    if (noResultsRow) noResultsRow.style.display = 'table-row';
                    console.log('No customer documents found in Firestore.');
                    return;
                }

                mobileCustomers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Fetch booking counts for each customer
                const bookingCounts = await fetchBookingCounts(mobileCustomers.map(c => c.id));
                
                // Add booking count to each customer
                mobileCustomers = mobileCustomers.map(customer => ({
                    ...customer,
                    bookings: bookingCounts[customer.id] || 0
                }));

                // Sort by registration date, newest first
                mobileCustomers.sort((a, b) => {
                    const dateA = a.registrationDate ? new Date(a.registrationDate) : 0;
                    const dateB = b.registrationDate ? new Date(b.registrationDate) : 0;
                    return dateB - dateA;
                });

                renderTable(mobileCustomers);

            } catch (error) {
                console.error("Error fetching customers from Firestore:", error);
                if (noResultsRow) {
                    noResultsRow.style.display = 'table-row';
                    noResultsRow.querySelector('td').textContent = 'Error loading customers.';
                }
            } finally {
                if (loader) loader.classList.remove('loading');
            }
        };

        const renderTable = (customers) => {
            tableBody.innerHTML = ''; // Clear the table
            const fragment = document.createDocumentFragment();
            customers.forEach(customer => {
                const row = document.createElement('tr');
                row.dataset.id = customer.id; // Use Firestore document ID

                const verificationBadge = customer.phoneVerified ?
                    `<span class="status-badge verified">Verified</span>` :
                    `<span class="status-badge not-verified">Not Verified</span>`;

                // Use Firestore data, providing fallbacks for potentially missing fields
                row.innerHTML = /*html*/ `
                    <td><input type="checkbox" class="customer-checkbox"></td>
                    <td>${customer.fullName || 'N/A'}</td>
                    <td>${customer.phoneNumber || 'N/A'}</td>
                    <td>${customer.email || 'N-A'}</td>
                    <td class="text-center">${verificationBadge}</td>
                    <td class="text-center">${customer.bookings || 0}</td>
                    <td>${customer.createdAt ? new Date(customer.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</td>
                    <td class="text-center actions-cell">
                        <button type="button" class="action-icon-btn view-btn" title="View Details">
                            <span class="material-symbols-outlined">info</span>
                        </button>
                        <button type="button" class="action-icon-btn delete-btn" title="Delete Customer">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </td>
                `;
                fragment.appendChild(row);
            });
            tableBody.appendChild(fragment);
            filterCustomers(); // Apply any existing search term
        };

        // Search Functionality
        const filterCustomers = () => {
            const searchTerm = searchInput.value.toLowerCase();
            const rows = tableBody.querySelectorAll('tr:not(.no-results-row)');
            let visibleRows = 0;

            rows.forEach(row => {
                const name = row.children[1].textContent.toLowerCase();
                const phone = row.children[2].textContent.toLowerCase();
                const email = row.children[3].textContent.toLowerCase();

                if (name.includes(searchTerm) || phone.includes(searchTerm) || email.includes(searchTerm)) {
                    row.style.display = '';
                    visibleRows++;
                } else {
                    row.style.display = 'none';
                }
            });

            noResultsRow.style.display = visibleRows === 0 ? '' : 'none';
        };

        // Checkbox Logic
        const updateDeleteButtonState = () => {
            const checkedBoxes = tableBody.querySelectorAll('.customer-checkbox:checked');
            deleteSelectedBtn.disabled = checkedBoxes.length === 0;
        };

        // --- Delete Modal Logic ---
        const openConfirmModal = (count) => {
            confirmMessage.textContent = `Are you sure you want to delete ${count} selected customer(s)? This action cannot be undone.`;
            confirmOverlay.classList.add('show');
        };

        const closeConfirmModal = () => {
            confirmOverlay.classList.remove('show');
        };

        // --- Success Toast Notification ---
        const showSuccessToast = (message) => {
            if (!successToast) return;
            const toastText = successToast.querySelector('p');
            toastText.textContent = message;
            successToast.classList.add('show');

            // Hide after 3 seconds
            setTimeout(() => {
                successToast.classList.remove('show');
            }, 3000);
        };


        // Delete Selected Functionality
        const deleteSelectedCustomers = async () => {
            const checkedBoxes = tableBody.querySelectorAll('.customer-checkbox:checked');
            const count = checkedBoxes.length;

            if (count === 0) {
                // This case should ideally not be hit since the button is disabled, but it's good practice.
                alert('Please select at least one customer to delete.');
                return;
            }

            const batch = db.batch();
            const idsToDelete = [];
            checkedBoxes.forEach(checkbox => {
                const row = checkbox.closest('tr');
                const docId = row.dataset.id;
                if (docId) {
                    idsToDelete.push(docId);
                    const docRef = db.collection('users').doc(docId);
                    batch.delete(docRef);
                }
            });

            try {
                await batch.commit();
                // Remove from local state and re-render
                mobileCustomers = mobileCustomers.filter(cust => !idsToDelete.includes(cust.id));
                renderTable(mobileCustomers);
                showSuccessToast(`${count} customer(s) successfully deleted.`);
            } catch (error) {
                console.error("Error deleting customers: ", error);
                alert('An error occurred while deleting customers. Please try again.');
            } finally {
                updateDeleteButtonState();
                selectAllCheckbox.checked = false;
            }
        };

        // Event Listeners
        searchInput.addEventListener('input', filterCustomers);
        printBtn.addEventListener('click', () => window.print());
        deleteSelectedBtn.addEventListener('click', deleteSelectedCustomers);
        selectAllCheckbox.addEventListener('change', (e) => {
            tableBody.querySelectorAll('.customer-checkbox').forEach(checkbox => checkbox.checked = e.target.checked);
            updateDeleteButtonState();
        });
        tableBody.addEventListener('change', (e) => {
            if (e.target.classList.contains('customer-checkbox')) {
                updateDeleteButtonState();
                if (!e.target.checked) selectAllCheckbox.checked = false;
            }
        });
        tableBody.addEventListener('click', (e) => {
            const viewButton = e.target.closest('.view-btn');
            const deleteButton = e.target.closest('.delete-btn');
            const checkbox = e.target.closest('.customer-checkbox');
            const row = e.target.closest('tr');

            if (!row || row.classList.contains('no-results-row')) return;

            // Prevent default for action buttons to avoid accidental form submits
            if (viewButton || deleteButton) e.preventDefault();

            // If the click was on the row itself or the view button (but not on another action button/checkbox), navigate to the profile page
            const isActionClick = deleteButton || checkbox;
            if (!isActionClick) {
                const customerId = row.dataset.id;
                const customer = mobileCustomers.find(c => c.id === customerId);

                if (customer) {
                    // The customer object from mobileCustomers already has all the needed details.
                    // We just need to pass it in the expected format for customer-profile.js
                    const profileData = {
                        ...customer,
                        customer: customer.fullName,
                        phone: customer.phoneNumber, // Add the phone number to the data being passed
                        plate: customer.plateNumber,
                        service: customer.lastService,
                        // Use the actual Firestore document ID as the customerId
                        customerId: customer.id
                    };
                    sessionStorage.setItem('selectedProfileData', JSON.stringify(profileData));
                    window.location.href = 'customer-profile.html';
                }
            }
        });



        // Initial Population
        fetchAndPopulateCustomers();
    }
});