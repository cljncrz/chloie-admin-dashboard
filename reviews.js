document.addEventListener('DOMContentLoaded', async () => {
    const reviewsTable = document.getElementById('reviews-table');

    // Only run if the main table element exists
    if (!reviewsTable) return;

    const tableBody = reviewsTable.querySelector('tbody');
    const searchInput = document.getElementById('review-search');
    const selectAllCheckbox = document.getElementById('select-all-reviews');
    const deleteSelectedBtn = document.getElementById('delete-selected-reviews-btn');
    const noResultsRow = reviewsTable.querySelector('.no-results-row');
    const loader = document.querySelector('#reviews-table-container .table-loader');

    // Delete Modal Elements
    const confirmOverlay = document.getElementById('delete-confirm-overlay');
    const confirmMessage = document.getElementById('delete-confirm-message');
    const confirmBtn = document.getElementById('delete-confirm-btn');
    const cancelBtn = document.getElementById('delete-cancel-btn');
    const closeModalBtn = document.getElementById('delete-confirm-close-btn');

    // Stat Card Elements
    const totalReviewsStatEl = document.getElementById('total-reviews-stat');
    const averageRatingStatEl = document.getElementById('average-rating-stat');
    const topServiceStatEl = document.getElementById('top-service-stat');

    // Pagination Elements
    const paginationContainer = document.querySelector('.table-pagination');
    const prevBtn = paginationContainer.querySelector('[data-action="prev"]');
    const nextBtn = paginationContainer.querySelector('[data-action="next"]');
    const pageInfo = paginationContainer.querySelector('.page-info');
    const rowsPerPage = 10;
    let currentPage = 1;

    let currentSortBy = 'date';
    let currentSortDir = 'desc';

    let reviewsData = [];

    const createStarRating = (rating) => {
        let stars = '';
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars += `<span class="material-symbols-outlined filled">star</span>`;
            } else if (i === fullStars && halfStar) {
                stars += `<span class="material-symbols-outlined filled">star_half</span>`;
            } else {
                stars += `<span class="material-symbols-outlined">star</span>`;
            }
        }
        return `<div class="review-rating">${stars}</div>`;
    };

    const calculateAndDisplayStats = () => {
        if (!totalReviewsStatEl || !averageRatingStatEl || !topServiceStatEl) return;

        const totalReviews = reviewsData.length;
        if (totalReviews === 0) {
            totalReviewsStatEl.textContent = '0';
            averageRatingStatEl.textContent = 'N/A';
            topServiceStatEl.textContent = 'N/A';
            return;
        }

        // Calculate Total Reviews and Average Rating
        const totalRatingSum = reviewsData.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRatingSum / totalReviews;
        totalReviewsStatEl.textContent = totalReviews.toLocaleString();
        averageRatingStatEl.textContent = averageRating.toFixed(1);

        // Calculate Most Availed Service from reviews
        const serviceCounts = reviewsData.reduce((acc, review) => {
            acc[review.service] = (acc[review.service] || 0) + 1;
            return acc;
        }, {});

        let topService = 'N/A';
        let maxCount = 0;
        for (const service in serviceCounts) {
            if (serviceCounts[service] > maxCount) {
                maxCount = serviceCounts[service];
                topService = service;
            }
        }

        topServiceStatEl.textContent = topService;
    };

    // Fetch reviews from Firestore feedbacks collection
    const fetchReviews = async () => {
        try {
            if (loader) loader.classList.add('loading');
            
            const feedbacksRef = firebase.firestore().collection('feedbacks');
            const snapshot = await feedbacksRef.get();
            
            console.log('Total feedbacks found:', snapshot.docs.length);
            
            reviewsData = await Promise.all(snapshot.docs.map(async (doc) => {
                const data = doc.data();
                let customerName = 'Unknown';
                let serviceNames = 'N/A';
                let paymentMethod = 'N/A';
                let amount = 0;
                let transactionId = 'N/A';
                
                // Get userID - try multiple field names
                const userId = data.userId || data.userID || data.users || data.customerId || data.customerID;
                
                // Get bookingID - try multiple field names
                const bookingId = data.bookingId || data.bookingID || data.bookings || data.appointmentId || data.appointmentID;
                
                console.log('Processing feedback:', {
                    id: doc.id,
                    userId,
                    bookingId,
                    feedback: data.feedback
                });
                
                // Fetch customer name from users collection using userID
                if (userId) {
                    try {
                        const userDoc = await firebase.firestore().collection('users').doc(userId).get();
                        console.log('User doc exists:', userDoc.exists, 'for userID:', userId);
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            console.log('User data:', userData);
                            customerName = userData.name || userData.firstName || userData.fullName || userData.email || 'Unknown';
                        }
                    } catch (err) {
                        console.error('Error fetching user data for userID:', userId, err);
                    }
                }
                
                // Fetch service name, payment method, and price from bookings collection using bookingID
                if (bookingId) {
                    try {
                        const bookingDoc = await firebase.firestore().collection('bookings').doc(bookingId).get();
                        console.log('Booking doc exists:', bookingDoc.exists, 'for bookingID:', bookingId);
                        if (bookingDoc.exists) {
                            const bookingData = bookingDoc.data();
                            console.log('Booking data:', bookingData);
                            serviceNames = bookingData.service || bookingData.serviceNames || bookingData.serviceType || 'N/A';
                            paymentMethod = bookingData.paymentMethod || 'N/A';
                            amount = bookingData.price || 0;
                        }
                    } catch (err) {
                        console.error('Error fetching booking data for bookingID:', bookingId, err);
                    }
                }
                
                console.log('Final review object:', {
                    customer: customerName,
                    service: serviceNames,
                    paymentMethod: paymentMethod,
                    amount: amount
                });
                
                return {
                    reviewId: doc.id,
                    customer: customerName,
                    service: serviceNames,
                    comment: data.feedback || data.comment || '',
                    rating: parseFloat(data.rating) || 0,
                    date: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : new Date().toLocaleDateString(),
                    paymentMethod: paymentMethod,
                    amount: amount
                };
            }));

            console.log('Final reviews data:', reviewsData);
            window.appData.reviews = reviewsData;
            calculateAndDisplayStats();
            renderTablePage();
        } catch (error) {
            console.error('Error fetching reviews from Firestore:', error);
            if (typeof showErrorToast === 'function') {
                showErrorToast('Failed to load reviews from database');
            }
        } finally {
            if (loader) loader.classList.remove('loading');
        }
    };

    const renderTablePage = () => {
        if (loader) loader.classList.add('loading');

        setTimeout(() => {
            // 1. Sort data
            reviewsData.sort((a, b) => {
                let valA, valB;
                if (currentSortBy === 'date') {
                    valA = new Date(a.date);
                    valB = new Date(b.date);
                } else if (currentSortBy === 'rating') {
                    valA = a.rating;
                    valB = b.rating;
                } else { // String sort for customer, service
                    valA = a[currentSortBy]?.toLowerCase() || '';
                    valB = b[currentSortBy]?.toLowerCase() || '';
                }

                if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
                if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
                return 0;
            });

            // 2. Filter data based on search
            const searchTerm = searchInput.value.toLowerCase();
            const filteredReviews = reviewsData.filter(review => {
                const reviewText = `${review.customer} ${review.service} ${review.comment}`.toLowerCase();
                return reviewText.includes(searchTerm);
            });

            // 3. Paginate the filtered data
            const totalPages = Math.ceil(filteredReviews.length / rowsPerPage);
            currentPage = Math.max(1, Math.min(currentPage, totalPages)); // Ensure currentPage is valid

            const startIndex = (currentPage - 1) * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            const paginatedReviews = filteredReviews.slice(startIndex, endIndex);

            // 4. Build the table rows for the current page
            tableBody.innerHTML = ''; // Clear existing content
            const fragment = document.createDocumentFragment();

            if (paginatedReviews.length > 0) {
                paginatedReviews.forEach((review) => {
                    const row = document.createElement('tr');
                    row.dataset.reviewId = review.reviewId;

                    const starRatingHTML = createStarRating(review.rating);

                    row.innerHTML = /*html*/`
                        <td><input type="checkbox" class="review-checkbox"></td>
                        <td>${review.customer}</td>
                        <td>${review.service}</td>
                        <td class="review-comment" title="${review.comment}">${review.comment}</td>
                        <td class="text-center">${starRatingHTML}</td>
                        <td>${review.date}</td>
                        <td class="text-center actions-cell">
                            <button type="button" class="action-icon-btn view-btn" title="View Full Details">
                                <span class="material-symbols-outlined">visibility</span>
                            </button>
                        </td>
                    `;
                    fragment.appendChild(row);
                });
            }

            tableBody.appendChild(fragment);

            // 5. Update UI elements (no-results row, pagination)
            noResultsRow.style.display = filteredReviews.length === 0 ? 'table-row' : 'none';
            pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
            prevBtn.disabled = currentPage === 1;
            nextBtn.disabled = currentPage === totalPages || totalPages === 0;

            if (loader) loader.classList.remove('loading');
            updateDeleteButtonState(); // Ensure delete button state is correct after re-render
            selectAllCheckbox.checked = false; // Uncheck select-all on page change
        }, 300);
    };

    const updateDeleteButtonState = () => {
        const checkedBoxes = tableBody.querySelectorAll('.review-checkbox:checked');
        deleteSelectedBtn.disabled = checkedBoxes.length === 0;
    };

    // Fetch reviews on load
    await fetchReviews();

    const deleteSelectedReviews = async () => {
        const checkedBoxes = tableBody.querySelectorAll('.review-checkbox:checked');
        const count = checkedBoxes.length;

        if (count === 0) return;

        const idsToDelete = [];
        checkedBoxes.forEach(checkbox => {
            const row = checkbox.closest('tr');
            idsToDelete.push(row.dataset.reviewId);
        });

        try {
            // Delete from Firestore
            const batch = firebase.firestore().batch();
            idsToDelete.forEach(id => {
                const docRef = firebase.firestore().collection('feedbacks').doc(id);
                batch.delete(docRef);
            });
            await batch.commit();

            // Update client-side array
            const initialCount = reviewsData.length;
            reviewsData.splice(0, reviewsData.length, ...reviewsData.filter(r => !idsToDelete.includes(r.reviewId)));

            calculateAndDisplayStats(); // Update stats after deletion
            renderTablePage(); // Re-render the table with the updated data

            if (typeof showSuccessToast === 'function') {
                const deletedCount = initialCount - reviewsData.length;
                if (deletedCount > 0) {
                    showSuccessToast(`${deletedCount} review(s) successfully deleted.`);
                }
            }
        } catch (error) {
            console.error('Error deleting reviews:', error);
            if (typeof showErrorToast === 'function') {
                showErrorToast('Failed to delete reviews');
            }
        }
    };

    // --- Event Listeners ---
    searchInput.addEventListener('input', () => {
        currentPage = 1; // Reset to first page on search
        renderTablePage();
    });

    deleteSelectedBtn.addEventListener('click', deleteSelectedReviews);

    selectAllCheckbox.addEventListener('change', (e) => {
        tableBody.querySelectorAll('.review-checkbox').forEach(checkbox => checkbox.checked = e.target.checked);
        updateDeleteButtonState();
    });

    tableBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('review-checkbox')) {
            updateDeleteButtonState();
            if (!e.target.checked) selectAllCheckbox.checked = false;
        }
    });



    // --- Sorting Event Listener ---
    reviewsTable.querySelectorAll('th[data-sortable="true"]').forEach(header => {
        header.addEventListener('click', () => {
            const sortBy = header.dataset.sortBy;
            if (currentSortBy === sortBy) {
                currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortBy = sortBy;
                currentSortDir = 'desc'; // Default to descending for new column
            }

            // Update header classes for styling
            reviewsTable.querySelectorAll('th').forEach(th => th.classList.remove('sorted-asc', 'sorted-desc'));
            header.classList.add(currentSortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');

            currentPage = 1; // Reset to first page on sort
            renderTablePage();
        });
    });

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTablePage();
        }
    });

    nextBtn.addEventListener('click', () => {
        currentPage++;
        renderTablePage();
    });

    tableBody.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-btn');
        if (viewBtn) {
            e.preventDefault();
            const row = viewBtn.closest('tr');
            const reviewId = row.dataset.reviewId;
            const review = reviewsData.find(r => r.reviewId === reviewId);

            if (review) {
                // Store the data in sessionStorage and navigate
                sessionStorage.setItem('selectedReviewData', JSON.stringify(review));
                window.location.href = 'review-details.html';
            }
        }
    });

    // --- Initial Population & Sort ---
    // Set initial sort indicator on the 'Date' column
    const initialSortHeader = reviewsTable.querySelector('th[data-sort-by="date"]');
    if (initialSortHeader) initialSortHeader.classList.add('sorted-desc');

    // Calculate and display stats on initial load
    calculateAndDisplayStats();

    renderTablePage();
});