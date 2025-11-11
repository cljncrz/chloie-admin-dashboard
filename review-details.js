document.addEventListener('DOMContentLoaded', () => {
    const storedData = sessionStorage.getItem('selectedReviewData');

    if (!storedData) {
        // If no data is found, display an error message
        document.querySelector('h1').textContent = 'Review Not Found';
        const pageContent = document.getElementById('review-details-page');
        if (pageContent) {
            pageContent.innerHTML = '<p class="text-center text-muted" style="padding: 2rem;">Please go back to the reviews page and select a review to view.</p>';
        }
        return;
    }

    const reviewData = JSON.parse(storedData);

    // --- Helper function to create star ratings ---
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
        return stars;
    };

    // --- Populate the page with review data ---
    const customerNameEl = document.getElementById('review-customer-name');
    const serviceNameEl = document.getElementById('review-service-name');
    const starRatingEl = document.getElementById('review-star-rating');
    const fullCommentEl = document.getElementById('review-full-comment');
    const dateEl = document.getElementById('review-date');
    const mediaContentEl = document.getElementById('review-media-content');
    
    // --- Reply Section Elements ---
    const existingReplyContainer = document.getElementById('existing-reply-container');
    const adminReplyTextEl = document.getElementById('admin-reply-text');
    const adminReplyForm = document.getElementById('admin-reply-form');
    const replyTextarea = document.getElementById('reply-textarea');
    const replyFormTitle = document.getElementById('reply-form-title');
    const showReplyFormBtn = document.getElementById('show-reply-form-btn');
    const editReplyBtn = document.getElementById('edit-reply-btn');
    const cancelReplyBtn = document.getElementById('cancel-reply-btn');

    // --- Receipt Elements ---
    const transIdEl = document.getElementById('receipt-trans-id');
    const mopEl = document.getElementById('receipt-mop');
    const totalEl = document.getElementById('receipt-total');
    const serviceAvailedEl = document.getElementById('receipt-service');

    if (customerNameEl) customerNameEl.textContent = reviewData.customer;
    if (serviceNameEl) serviceNameEl.textContent = reviewData.service;
    if (starRatingEl) starRatingEl.innerHTML = createStarRating(reviewData.rating);
    if (fullCommentEl) fullCommentEl.textContent = `"${reviewData.comment}"`;
    if (dateEl) dateEl.textContent = `Reviewed on: ${reviewData.date}`;

    // --- Populate Media Section ---
    if (mediaContentEl) {
        if (reviewData.mediaUrl) {
            if (reviewData.mediaType === 'image') {
                mediaContentEl.innerHTML = `<img src="${reviewData.mediaUrl}" alt="Customer review media for ${reviewData.service}">`;
            } else if (reviewData.mediaType === 'video') {
                mediaContentEl.innerHTML = `
                    <video controls>
                        <source src="${reviewData.mediaUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                `;
            }
        } else {
            // The placeholder is already in the HTML, so we don't need to do anything here.
        }
    }

    // --- Populate Receipt Section ---
    if (transIdEl) transIdEl.textContent = reviewData.transactionId || 'N/A';
    if (serviceAvailedEl) serviceAvailedEl.textContent = reviewData.service || 'N/A';
    if (mopEl) mopEl.textContent = reviewData.paymentMethod || 'N/A';
    if (totalEl) {
        const amount = reviewData.amount ? `₱${reviewData.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A';
        totalEl.textContent = amount;
    }

    // --- Populate or Show Reply Section ---
    const handleReplySection = () => {
        if (reviewData.reply) {
            if (adminReplyTextEl) adminReplyTextEl.textContent = reviewData.reply;
            if (existingReplyContainer) existingReplyContainer.style.display = 'block';
            if (adminReplyForm) adminReplyForm.style.display = 'none';
            if (showReplyFormBtn) showReplyFormBtn.style.display = 'none';
        } else {
            if (existingReplyContainer) existingReplyContainer.style.display = 'none';
            if (adminReplyForm) adminReplyForm.style.display = 'none';
            if (showReplyFormBtn) showReplyFormBtn.style.display = 'inline-flex';
        }
        replyTextarea.value = ''; // Clear textarea
    };

    // --- Handle Reply Form Submission ---
    if (adminReplyForm) {
        adminReplyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const replyText = replyTextarea.value.trim();
            if (replyText) {
                // In a real app, you'd save this to the database.
                // Here, we'll just update the UI to simulate it.
                reviewData.reply = replyText;
                // Since we are not persisting data, we need to update the sessionStorage object
                // so if the user reloads, the new reply is still there.
                sessionStorage.setItem('selectedReviewData', JSON.stringify(reviewData));
                handleReplySection(); // Re-render the section to show the new reply
                showSuccessToast('Reply submitted successfully!');
            }
        });
    }

    // --- Handle "Reply to Customer" button click ---
    if (showReplyFormBtn) {
        showReplyFormBtn.addEventListener('click', () => {
            showReplyFormBtn.style.display = 'none';
            adminReplyForm.style.display = 'block';
            if (replyFormTitle) replyFormTitle.textContent = 'Reply to this Review';
            replyTextarea.focus();
        });
    }

    // --- Handle "Edit Reply" button click ---
    if (editReplyBtn) {
        editReplyBtn.addEventListener('click', () => {
            existingReplyContainer.style.display = 'none';
            adminReplyForm.style.display = 'block';
            if (replyFormTitle) replyFormTitle.textContent = 'Edit Your Reply';
            replyTextarea.value = reviewData.reply || '';
            replyTextarea.focus();
        });
    }

    // --- Handle "Cancel Reply" button click ---
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', handleReplySection);
    }

    // --- Handle Print Receipt Button ---
    const printReceiptBtn = document.getElementById('print-receipt-btn');
    if (printReceiptBtn) {
        printReceiptBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // --- Back Button Functionality ---
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Go back to the previous page in history
            window.history.back();
        });
    }

    // Initial population of reply section
    handleReplySection();
});