document.addEventListener('DOMContentLoaded', () => {
    const mediaManagerContainer = document.querySelector('.media-manager-container');
    // Firebase services are globally available from firebase-config.js
    const db = firebase.firestore();
    const storage = firebase.storage();

    // If the main container isn't on the page, don't run any of this script.
    if (!mediaManagerContainer) return;

    const gallery = document.getElementById('media-gallery');
    const searchInput = document.getElementById('media-search');
    const uploadInput = document.getElementById('media-upload-input');
    const noResultsEl = document.getElementById('media-no-results');
    const selectAllCheckbox = document.getElementById('select-all-media');
    const deleteSelectedBtn = document.getElementById('delete-selected-media-btn');
    const filterButtons = document.querySelectorAll('.media-filter-btn');
    // Add a button to fetch images directly from Storage for demonstration
    const fetchFromStorageBtn = document.getElementById('fetch-from-storage-btn');

    // --- Media Detail Modal Elements ---
    const detailModalOverlay = document.getElementById('media-detail-modal-overlay');
    const detailModalBody = document.getElementById('media-detail-modal-body');
    const detailModalCloseBtn = document.getElementById('media-detail-modal-close-btn');
    const galleryLoader = document.querySelector('.media-gallery-loader');

    // Check if the media manager is opened in 'picker' mode
    const urlParams = new URLSearchParams(window.location.search);
    const isPickerMode = urlParams.get('picker') === 'true';
    const openerId = urlParams.get('openerId'); // To identify which editor opened the manager

    // This will be populated from Firestore or Storage
    let mediaData = [];
    let currentFilter = 'all'; // 'all', 'image', or 'video'

    /**
     * Fetches all images directly from Firebase Storage under the 'media' folder.
     * This bypasses Firestore and lists all image files in the folder.
     */
    const fetchImagesFromStorage = async () => {
        if (galleryLoader) mediaManagerContainer.classList.add('is-loading');
        try {
            // List all files under 'media/'
            const listRef = storage.ref('media');
            const res = await listRef.listAll();
            // Only keep image files
            const imageItems = res.items.filter(item => item.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i));
            // Get download URLs and build mediaData
            const imageData = await Promise.all(imageItems.map(async (item) => {
                const url = await item.getDownloadURL();
                return {
                    id: item.fullPath, // Use storage path as id
                    name: item.name,
                    url: url,
                    storagePath: item.fullPath,
                    type: 'image',
                    size: '', // Size not available from Storage listAll
                    createdAt: null,
                };
            }));
            mediaData = imageData;
            renderGallery(false);
        } catch (error) {
            console.error('Error fetching images from Storage:', error);
            noResultsEl.innerHTML = '<p>Error loading images from Storage. Please try again.</p>';
            noResultsEl.style.display = 'block';
        } finally {
            if (galleryLoader) mediaManagerContainer.classList.remove('is-loading');
        }
    };

    const createMediaCard = (mediaItem) => {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.dataset.url = mediaItem.url;
        card.dataset.id = mediaItem.id;

        let previewHtml = '';
        if (mediaItem.type === 'image') {
            previewHtml = `<img src="${mediaItem.url}" alt="${mediaItem.name}">`;
        } else if (mediaItem.type === 'video') {
            previewHtml = `
                <video muted loop playsinline>
                    <source src="${mediaItem.url}" type="video/mp4">
                </video>
                <div class="video-overlay">
                    <span class="material-symbols-outlined">play_circle</span>
                </div>
            `;
        }

        card.innerHTML = `
            <input type="checkbox" class="media-checkbox" title="Select this item">
            <div class="media-preview">
                ${previewHtml}
            </div>
            <div class="media-info">
                <p class="media-name" title="${mediaItem.name}">${mediaItem.name}</p>
                <div class="media-card-actions">
                    <button class="action-icon-btn copy-url-btn" title="Copy URL">
                        <span class="material-symbols-outlined">content_copy</span>
                    </button>
                    <button class="action-icon-btn delete-media-btn" title="Delete Media">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </div>
        `;

        // Add event listener for card clicks to open modal or select for picker
        card.addEventListener('click', (e) => {
            // Only proceed if not clicking a button or checkbox
            if (!e.target.closest('button, input[type="checkbox"]')) {
                if (isPickerMode) {
                    // Use sessionStorage to pass the data back to the editor
                    const selectedMedia = {
                        url: mediaItem.url,
                        openerId: openerId
                    };
                    // First try to postMessage to the opener window directly (more reliable)
                    try {
                        if (window.opener && !window.opener.closed) {
                            window.opener.postMessage({ selectedMedia }, '*');
                        }
                    } catch (err) {
                        console.warn('postMessage to opener failed', err);
                    }

                    // Fallback: use localStorage so the opener window receives a storage event
                    try {
                        localStorage.setItem('selectedMedia', JSON.stringify(selectedMedia));
                        // Remove the key shortly after to avoid lingering state
                        setTimeout(() => localStorage.removeItem('selectedMedia'), 500);
                    } catch (err) {
                        console.warn('localStorage set failed in picker', err);
                    }

                    window.close(); // Close the picker window
                } else {
                    // Open the details modal in normal mode
                    openMediaDetailsModal(mediaItem);
                }
            }
        });

        // Add picker-mode class for styling if applicable
        if (isPickerMode) {
            card.classList.add('picker-mode');
        }

        // Add event listener for selection via checkbox
        const checkbox = card.querySelector('.media-checkbox');
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click event from firing
            toggleSelection(card, checkbox.checked);
        });

        // Add event listener for the new copy URL button
        card.querySelector('.copy-url-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click event
            navigator.clipboard.writeText(mediaItem.url).then(() => {
                // Use the global success toast function if it exists
                if (typeof showSuccessToast === 'function') {
                    showSuccessToast('URL copied to clipboard!');
                } else {
                    // Fallback alert if the function isn't available
                    alert('URL copied to clipboard!');
                }
            }).catch(err => {
                console.error('Failed to copy URL: ', err);
                alert('Failed to copy URL.');
            });
        });


        // Add event listener for deletion
        card.querySelector('.delete-media-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click event
            if (confirm(`Are you sure you want to permanently delete "${mediaItem.name}"? This cannot be undone.`)) {
                deleteMediaItems([mediaItem.id]);
            }
        });

        return card;
    };

    const toggleSelection = (card, isSelected) => {
        card.classList.toggle('selected', isSelected);        
        updateDeleteButtonState();
        updateSelectAllCheckboxState();
    };

    const updateSelectAllCheckboxState = () => {
        // If the selectAllCheckbox doesn't exist on the page, do nothing.
        if (!selectAllCheckbox) {
            return;
        }
        const allCards = gallery.querySelectorAll('.media-card');
        if (allCards.length === 0) {
            selectAllCheckbox.checked = false;
        }
        const selectedCards = gallery.querySelectorAll('.media-card.selected');
        selectAllCheckbox.checked = allCards.length === selectedCards.length;
    };

    const openMediaDetailsModal = (mediaItem) => {
        let previewHtml = '';
        if (mediaItem.type === 'image') {
            previewHtml = `<img src="${mediaItem.url}" alt="${mediaItem.name}">`;
        } else if (mediaItem.type === 'video') {
            previewHtml = `<video controls autoplay loop><source src="${mediaItem.url}" type="video/mp4"></video>`;
        }

        detailModalBody.innerHTML = `
            <div class="media-detail-preview">
                ${previewHtml}
            </div>
            <div class="media-detail-info">
                <h3>${mediaItem.name}</h3>
                <div class="detail-info-group">
                    <label>File Type</label>
                    <p>${mediaItem.type.charAt(0).toUpperCase() + mediaItem.type.slice(1)}</p>
                </div>
                <div class="detail-info-group">
                    <label>File Size</label>
                    <p>${mediaItem.size || 'N/A'}</p>
                </div>
                <div class="detail-info-group">
                    <label>Dimensions</label>
                    <p>${mediaItem.dimensions || 'N/A'}</p>
                </div>
                <div class="detail-info-group">
                    <label>File URL</label>
                    <p style="word-break: break-all;">${mediaItem.url}</p>
                </div>
                <div class="modal-actions">
                    <button class="btn-primary" id="copy-media-url-btn">
                        <span class="material-symbols-outlined">content_copy</span>
                        Copy URL
                    </button>
                </div>
            </div>
        `;

        detailModalOverlay.classList.add('show');

        // Add event listener for the copy button
        document.getElementById('copy-media-url-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(mediaItem.url).then(() => {
                // This assumes you have a global showSuccessToast function
                if (typeof showSuccessToast === 'function') {
                    showSuccessToast('URL copied to clipboard!');
                } else {
                    alert('URL copied to clipboard!');
                }
            }).catch(err => {
                console.error('Failed to copy URL: ', err);
                alert('Failed to copy URL.');
            });
        });
    };

    const closeMediaDetailsModal = () => {
        detailModalOverlay.classList.remove('show');
        // Clear the content to stop video playback
        detailModalBody.innerHTML = '';
    };

    const renderGallery = (showLoader = true) => {
        // Show loader and hide gallery
        if (galleryLoader && showLoader) mediaManagerContainer.classList.add('is-loading');

        // Use a small timeout to allow the UI to update and show the loader
        // before the potentially blocking rendering logic runs, or just render if no loader.
        setTimeout(() => {
            const searchTerm = searchInput.value.toLowerCase();
            gallery.innerHTML = '';
            const fragment = document.createDocumentFragment();
            let hasResults = false;

            mediaData
                .filter(item => {
                    const matchesFilter = currentFilter === 'all' || item.type === currentFilter;
                    const matchesSearch = item.name.toLowerCase().includes(searchTerm);
                    return matchesFilter && matchesSearch;
                })
                .forEach(item => {
                    fragment.appendChild(createMediaCard(item));
                    hasResults = true;
                });

            gallery.appendChild(fragment);
            noResultsEl.style.display = hasResults ? 'none' : 'block';
            updateDeleteButtonState(); // Update button state after render
            updateSelectAllCheckboxState(); // Also update the select-all checkbox

            // Hide loader and show gallery
            if (galleryLoader && showLoader) mediaManagerContainer.classList.remove('is-loading');
        }, showLoader ? 200 : 0); // A 200ms delay is usually enough for the loader to appear smoothly.
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleFiles = async (files) => {
        if (files.length === 0) return;

        if (galleryLoader) mediaManagerContainer.classList.add('is-loading');

        let successCount = 0;

        // Check if user is authenticated
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            if (typeof showErrorToast === 'function') {
                showErrorToast('You must be logged in to upload files.');
            } else {
                alert('You must be logged in to upload files.');
            }
            if (galleryLoader) mediaManagerContainer.classList.remove('is-loading');
            return;
        }

        const API_URL = 'http://localhost:5000/api/upload';

        for (const file of files) {
            try {
                console.log(`Attempting to upload: ${file.name}`);

                // Convert file to base64
                const fileData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        // Extract base64 data without the "data:...;base64," prefix
                        const base64 = reader.result.split(',')[1];
                        resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                // Send to backend server
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        fileName: file.name,
                        fileData: fileData,
                        fileType: file.type,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.details || errorData.error || 'Upload failed');
                }

                const result = await response.json();
                console.log(`Upload successful: ${result.url}`);

                // Add to local mediaData array
                mediaData.unshift({
                    id: result.id,
                    name: result.name,
                    url: result.url,
                    storagePath: result.storagePath,
                    type: result.type,
                    size: result.size,
                    createdAt: result.createdAt,
                });

                successCount++;
                renderGallery(false);

                if (typeof showSuccessToast === 'function') {
                    showSuccessToast(`${file.name} uploaded successfully!`);
                }
            } catch (error) {
                console.error('Error uploading file:', error);

                // Check if server is running
                if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    if (typeof showErrorToast === 'function') {
                        showErrorToast('Backend server is not running. Start it with: npm start');
                    } else {
                        alert('Error: Backend server is not running.\n\nTo start the server:\n1. Open terminal\n2. Run: npm install\n3. Run: npm start');
                    }
                    break; // Stop trying other files
                } else {
                    if (typeof showErrorToast === 'function') {
                        showErrorToast(`Failed to upload ${file.name}: ${error.message}`);
                    } else {
                        alert(`Failed to upload ${file.name}: ${error.message}`);
                    }
                }
            }
        }

        // Hide loader
        if (galleryLoader) mediaManagerContainer.classList.remove('is-loading');

        if (successCount > 0) {
            renderGallery(false);
        }
    };

    const updateDeleteButtonState = () => {
        const selectedCount = gallery ? gallery.querySelectorAll('.media-card.selected').length : 0;
        deleteSelectedBtn.disabled = selectedCount === 0;
        if (selectedCount > 0) {
            deleteSelectedBtn.textContent = `Delete Selected (${selectedCount})`;
        } else {
            deleteSelectedBtn.textContent = 'Delete Selected';
        }
    };

    /**
     * Fetches all media items from the 'media' collection in Firestore.
     */
    const fetchMedia = async () => {
        if (galleryLoader) mediaManagerContainer.classList.add('is-loading');
        try {
            const snapshot = await db.collection('media').orderBy('createdAt', 'desc').get();
            mediaData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderGallery(false); // Render immediately without the delay
        } catch (error) {
            console.error("Error fetching media from Firestore:", error);
            noResultsEl.innerHTML = '<p>Error loading media. Please try again.</p>';
            noResultsEl.style.display = 'block';
        } finally {
            if (galleryLoader) mediaManagerContainer.classList.remove('is-loading');
        }
    };

    /**
     * Deletes media items from Firestore and Firebase Storage via backend API.
     * @param {string[]} idsToDelete - An array of Firestore document IDs to delete.
     */
    const deleteMediaItems = async (idsToDelete) => {
        const API_URL = 'http://localhost:5000/api/media';

        for (const id of idsToDelete) {
            try {
                const response = await fetch(`${API_URL}/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.details || errorData.error || 'Delete failed');
                }

                console.log(`Deleted media item: ${id}`);
                
                if (typeof showSuccessToast === 'function') {
                    showSuccessToast(`Media deleted successfully!`);
                }
            } catch (error) {
                console.error('Error deleting media item:', error);

                // Check if server is running
                if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    if (typeof showErrorToast === 'function') {
                        showErrorToast('Backend server is not running. Start it with: npm start');
                    } else {
                        alert('Error: Backend server is not running.\n\nTo start the server:\n1. Open terminal\n2. Run: npm start');
                    }
                    break; // Stop trying other files
                } else {
                    if (typeof showErrorToast === 'function') {
                        showErrorToast(`Failed to delete media: ${error.message}`);
                    } else {
                        alert(`Failed to delete media: ${error.message}`);
                    }
                }
            }
        }

        // Refetch the data to ensure consistency
        await fetchMedia();
    };
    // --- Event Listeners ---
    if (searchInput) {
        searchInput.addEventListener('input', renderGallery);
    }

    if (filterButtons) {
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                currentFilter = button.dataset.filter;
                renderGallery();
            });
        });
    }
    if (uploadInput) {
        uploadInput.addEventListener('change', (e) => handleFiles(e.target.files));
    }

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', () => {
            const isChecked = selectAllCheckbox.checked;
            // Select only visible cards
            gallery.querySelectorAll('.media-card').forEach(card => {
                const checkbox = card.querySelector('.media-checkbox');
                checkbox.checked = isChecked;
                toggleSelection(card, isChecked);
            });
            updateDeleteButtonState(); // Ensure delete button state is updated
        });
    }

    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', () => {
            const selectedCards = gallery.querySelectorAll('.media-card.selected');
            if (selectedCards.length === 0) return;

            if (confirm(`Are you sure you want to permanently delete ${selectedCards.length} selected item(s)?`)) {
                const idsToDelete = Array.from(selectedCards).map(card => card.dataset.id);
                deleteMediaItems(idsToDelete);
            }
        });
    }

    // --- Drag and Drop Event Listeners ---
    if (mediaManagerContainer) {
        // Prevent default behaviors for all drag events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            mediaManagerContainer.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Add class to show overlay on drag enter/over
        ['dragenter', 'dragover'].forEach(eventName => {
            mediaManagerContainer.addEventListener(eventName, () => mediaManagerContainer.classList.add('drag-over'));
        });

        // Remove class on drag leave/drop
        ['dragleave', 'drop'].forEach(eventName => {
            mediaManagerContainer.addEventListener(eventName, () => mediaManagerContainer.classList.remove('drag-over'));
        });

        // Handle the file drop
        mediaManagerContainer.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
    }

    // --- Media Detail Modal Listeners ---
    if (detailModalOverlay) {
        detailModalCloseBtn.addEventListener('click', closeMediaDetailsModal);
        detailModalOverlay.addEventListener('click', (e) => { if (e.target === detailModalOverlay) closeMediaDetailsModal(); });
    }

    // Add hover effect for video previews
    gallery.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.media-card');
        if (card) {
            const video = card.querySelector('video');
            if (video) video.play();
        }
    });

    gallery.addEventListener('mouseout', (e) => {
        const card = e.target.closest('.media-card');
        if (card) {
            const video = card.querySelector('video');
            if (video) {
                video.pause();
                video.currentTime = 0;
            }
        }
    });

    // Initial Render
    fetchMedia();

    // Add event listener for the fetch-from-storage button if present
    if (fetchFromStorageBtn) {
        fetchFromStorageBtn.addEventListener('click', fetchImagesFromStorage);
    }
});