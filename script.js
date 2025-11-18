document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to initialize before continuing.
    // Some pages previously logged "Firebase is not available to attach auth state listener." when
    // `window.firebaseInitPromise` was missing. Use a resilient helper that prefers the global
    // promise but falls back to polling for the `window.firebase` shim.
    const getFirebaseReadyPromise = (opts = {}) => {
        const { timeout = 5000, interval = 100 } = opts;

        // If a thenable init promise exists, use it.
        if (window.firebaseInitPromise && typeof window.firebaseInitPromise.then === 'function') {
            return window.firebaseInitPromise;
        }

        // Otherwise poll for the presence of window.firebase and its auth() function.
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const check = () => {
                if (window.firebase && typeof window.firebase.auth === 'function') {
                    resolve();
                    return;
                }
                if (Date.now() - start > timeout) {
                    // Resolve anyway to avoid blocking the UI; callers should still check availability.
                    resolve();
                    return;
                }
                setTimeout(check, interval);
            };
            check();
        });
    };

    await getFirebaseReadyPromise();

    const sideMenu = document.querySelector('aside');
    const menuBtn = document.querySelector('#menu-btn');
    const closeBtn = document.querySelector('#close-btn');
    const themeToggler = document.querySelector('.theme-toggler');
    const navLinks = document.querySelectorAll('.sidebar-menu a, .profile-dropdown a');
    const pages = document.querySelectorAll('.page');
    const mainHeaderTitle = document.querySelector('.main-header h1');
    const profile = document.querySelector('.main-header .profile');
    let sidebarOverlay;

    // Create and append the sidebar overlay
    const createSidebarOverlay = () => {
        // Check if overlay already exists to prevent duplicates
        if (document.querySelector('.sidebar-overlay')) {
            sidebarOverlay = document.querySelector('.sidebar-overlay');
            return;
        }
        
        sidebarOverlay = document.createElement('div');
        sidebarOverlay.classList.add('sidebar-overlay');
        document.body.appendChild(sidebarOverlay);
        sidebarOverlay.addEventListener('click', closeSidebar);
    };

    const openSidebar = () => {
        sideMenu.classList.add('show');
        if (sidebarOverlay) {
            sidebarOverlay.style.display = 'block';
            setTimeout(() => sidebarOverlay.classList.add('active'), 10);
        }
    };

    const closeSidebar = () => {
        sideMenu.classList.remove('show');
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
            setTimeout(() => sidebarOverlay.style.display = 'none', 300);
        }
    };

    // --- Sidebar Toggle ---
    if (menuBtn && closeBtn) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSidebar();
        });
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeSidebar();
        });
    }

    // Close sidebar when clicking on sidebar navigation links (mobile)
    if (navLinks) {
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 1200 && sideMenu.classList.contains('show')) {
                    closeSidebar();
                }
            });
        });
    }

    // --- Theme Management ---
    const applyTheme = (theme) => {
        const isDark = theme === 'dark';

        // 1. Apply theme to the body
        document.body.classList.toggle('dark-theme-variables', isDark);

        // 2. Update the header theme toggler's active state
        if (themeToggler) {
            themeToggler.querySelector('span:nth-child(1)').classList.toggle('active', !isDark);
            themeToggler.querySelector('span:nth-child(2)').classList.toggle('active', isDark);
        }

        // 3. Update the settings page toggle's checked state (if it exists)
        const themePreferenceToggle = document.getElementById('theme-preference-toggle');
        if (themePreferenceToggle) {
            themePreferenceToggle.checked = isDark;
        }
    };

    // On page load, apply the saved theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Add event listener for the settings page toggle
    const themePreferenceToggle = document.getElementById('theme-preference-toggle');
    if (themePreferenceToggle) {
        themePreferenceToggle.addEventListener('change', (e) => {
            const newTheme = e.target.checked ? 'dark' : 'light';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        });
    }

    // Add event listener for the header theme toggler
    if (themeToggler) {
        themeToggler.addEventListener('click', () => {
            const currentTheme = document.body.classList.contains('dark-theme-variables') ? 'dark' : 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
            // The applyTheme function will now also update the settings toggle if it's on the page.
        });
    }

    // --- Profile Dropdown Toggle ---
    if (profile) {
        const profileDropdown = profile.querySelector('.profile-dropdown');

        profile.addEventListener('click', (e) => {
            // Stop propagation to prevent the window click event from firing immediately
            e.stopPropagation();
            profileDropdown.classList.toggle('show');
        });

        // Prevent dropdown from closing when clicking inside it
        profileDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Close profile dropdown when clicking anywhere else on the page
    window.addEventListener('click', () => {
        const profileDropdown = document.querySelector('.profile-dropdown');
        if (profileDropdown && profileDropdown.classList.contains('show')) {
            profileDropdown.classList.remove('show');
        }
    });

    // --- Global Logout Logic ---
    // This can be placed here since the logout button is consistent across pages.
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Firebase auth state change will be caught by auth-guard.js to redirect.
            window.firebase.auth().signOut();
        });
    }


    // --- Modal Logic ---
    const modalOverlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('app-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalTitle = document.getElementById('modal-title');
    const modalContents = document.querySelectorAll('.modal-content');
    const addToDoLink = document.querySelector('.add-item-link');

    // Add event listener for the "Add To-Do" link specifically
    if (addToDoLink) {
        addToDoLink.addEventListener('click', (e) => e.preventDefault());
    }

    // --- Populate Modal Dropdowns ---
    const serviceSelect = document.getElementById('walkin-service');
    if (serviceSelect) {
        const services = window.appData.services || [];
        serviceSelect.innerHTML = '<option value="">Select a service</option>';
        services.forEach(service => {
            const option = document.createElement('option');
            option.value = service.service; // Use the actual service name as the value
            option.textContent = service.service;
            serviceSelect.appendChild(option);
        });
    }

    const openModal = (title, contentId) => {
        modalTitle.textContent = title;

        // Hide all modal content, then show the correct one
        modalContents.forEach(content => content.classList.remove('active'));
        const targetContent = document.getElementById(contentId || 'default-modal-content');
        if (targetContent) {
            targetContent.classList.add('active');
        }

        modalOverlay.classList.add('show');
        document.body.classList.add('modal-open');
    };

    const closeModal = () => {
        modalOverlay.classList.remove('show');
        document.body.classList.remove('modal-open');
        // Deactivate all content for next time
        modalContents.forEach(content => content.classList.remove('active'));
    };    



    // This selector now includes all buttons intended to open a modal
    document.querySelectorAll('.action-btn, .add-item-link, .open-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            let title = btn.dataset.modalTitle || 'Quick Action';
            let contentId = btn.dataset.contentId;
            openModal(title, contentId);
        });
    });

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }

    // --- Success Toast Notification ---
    const successToast = document.getElementById('success-toast');
    const showSuccessToast = (message) => {
        const toastText = successToast.querySelector('p');
        toastText.textContent = message;
        successToast.classList.add('show');

        setTimeout(() => {
            successToast.classList.remove('show');
        }, 3000); // Hide after 3 seconds
    };

    // --- Reusable Form Validation ---
    const validateForm = (fields, errorMessage) => {
        let isValid = true;

        // Reset all fields first
        fields.forEach(field => field.classList.remove('invalid'));

        // Validation Check
        fields.forEach(field => {
            if (field.value.trim() === '') {
                field.classList.add('invalid');
                isValid = false;
            }
        });

        if (!isValid) {
            alert(errorMessage);
        }

        return isValid;
    };


    // --- Handle Form Submissions ---
    const addPromotionForm = document.getElementById('add-promotion-form');
    if (addPromotionForm) {
        addPromotionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const promoName = document.getElementById('promo-name');
            const discount = document.getElementById('promo-discount');

            const fieldsToValidate = [promoName, discount];
            if (!validateForm(fieldsToValidate, 'Please fill out all promotion details.')) return;

            const formData = {
                promoName: promoName.value,
                discount: discount.value,
            };

            console.log('New Promotion:', formData);
            showSuccessToast('New promotion created!');
            closeModal();
            addPromotionForm.reset();
        });
    }

    const generateReportForm = document.getElementById('generate-report-form');
    if (generateReportForm) {
        generateReportForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const reportType = document.getElementById('report-type');
            const reportPeriod = document.getElementById('report-period');

            const fieldsToValidate = [reportType, reportPeriod];
            if (!validateForm(fieldsToValidate, 'Please select a report type and a time period.')) return;

            const reportTypeText = reportType.options[reportType.selectedIndex].text;
            const periodText = reportPeriod.options[reportPeriod.selectedIndex].text;
            showSuccessToast(`Generating ${periodText} ${reportTypeText}...`);
            closeModal();
            generateReportForm.reset();
        });
    }

    // --- Reusable Table Functionality ---
    // Make this function globally available so other scripts can use it
    window.initializeTableFunctionality = (tableContainerSelector) => {
        const tableContainer = document.querySelector(tableContainerSelector);
        if (!tableContainer) return;

        // Populate status filter
        // Always ensure the filter is correctly populated, clearing it first.
        if (statusFilter) {
            statusFilter.innerHTML = ''; // Clear existing options to prevent duplicates
            const statuses = ['All Statuses', 'Pending', 'Completed', 'In Progress', 'Cancelled'];
            statuses.forEach(status => {
                const option = document.createElement('option');
                option.value = status === 'All Statuses' ? 'all' : status.toLowerCase();
                option.textContent = status;
                statusFilter.appendChild(option);
            });
            // Set default value
            statusFilter.value = 'all';
        }

        // Filtering and Pagination logic
        const renderTable = () => {
            if (loader) loader.classList.add('loading');

            // Use a timeout to allow the loader to render before the blocking JS runs
            setTimeout(() => {
                const searchTerm = searchInput.value.trim().toLowerCase();
                const selectedStatus = statusFilter ? statusFilter.value : 'all';
                const allRows = Array.from(tableBody.querySelectorAll('tr:not(.no-results-row)'));

                // 1. Filter rows
                const filteredRows = allRows.filter(row => {
                    const rowText = row.textContent.trim().toLowerCase();
                    // Find the status cell by its class, which is more reliable than column index
                    const statusCell = row.querySelector('.pending, .completed, .in-progress, .cancelled');
                    const statusCellText = statusCell ? statusCell.textContent.trim().toLowerCase() : '';

                    const matchesSearch = rowText.includes(searchTerm);
                    const matchesStatus = selectedStatus === 'all' || statusCellText === selectedStatus;
                    return matchesSearch && matchesStatus;
                });

                // 2. Paginate filtered rows
                const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
                currentPage = Math.min(currentPage, totalPages) || 1;

                const startIndex = (currentPage - 1) * rowsPerPage;
                const endIndex = startIndex + rowsPerPage;
                const paginatedRows = filteredRows.slice(startIndex, endIndex);

                // 3. Render the DOM
                allRows.forEach(row => row.style.display = 'none'); // Hide all rows first
                paginatedRows.forEach(row => row.style.display = ''); // Show paginated rows

                // 4. Update UI elements
                if (noResultsRow) {
                    noResultsRow.style.display = filteredRows.length === 0 ? 'table-row' : 'none';
                }

                pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
                prevBtn.disabled = currentPage === 1;
                nextBtn.disabled = currentPage === totalPages || totalPages === 0;

                if (loader) loader.classList.remove('loading');
            }, 200); // 200ms delay
        };

        // Event Listeners
        searchInput.addEventListener('input', () => {
            currentPage = 1; // Reset to first page on search
            renderTable();
        });
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                currentPage = 1; // Reset to first page on filter change
                renderTable();
            });
        }
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });
        nextBtn.addEventListener('click', () => {
            currentPage++;
            renderTable();
        });

        // Sorting logic
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const columnIndex = Array.from(header.parentElement.children).indexOf(header);
                const currentIsAsc = header.classList.contains('sorted-asc');
                const sortDirection = currentIsAsc ? 'desc' : 'asc';

                tableContainer.querySelectorAll('th').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
                header.classList.add(sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');

                const rows = Array.from(tableBody.querySelectorAll('tr:not(.no-results-row)'));
                rows.sort((a, b) => {
                    const aText = a.querySelectorAll('td')[columnIndex].textContent.trim().toLowerCase();
                    const bText = b.querySelectorAll('td')[columnIndex].textContent.trim().toLowerCase();
                    return aText.localeCompare(bText) * (sortDirection === 'asc' ? 1 : -1);
                });
                // Re-append sorted rows to maintain their order in the DOM for filtering
                rows.forEach(row => tableBody.appendChild(row));
                renderTable(); // Re-render the table to apply pagination to the sorted list
            });
        });

        renderTable(); // Initial render
    };

    // --- To-Do List Functionality ---
    // This logic is now moved to todo-lists.js for the dedicated page.

    // --- Tab Navigation for Reviews Page ---
    /**
     * Initializes tab navigation for a given container.
     * It finds a '.tab-nav' and a '.tab-content-container' within the provided parent element.
     * @param {HTMLElement} parentContainer The element containing the tab structure.
     */
    const initializeTabs = (parentContainer) => {
        const tabNav = parentContainer.querySelector('.tab-nav');
        const tabContentContainer = parentContainer.querySelector('.tab-content-container');

        if (!tabNav || !tabContentContainer) return;

        tabNav.addEventListener('click', (e) => {
            const tabButton = e.target.closest('.tab-btn');
            if (!tabButton) return;

            const targetTabContentId = tabButton.dataset.tab;
            if (!targetTabContentId) return;

            // Update button active states within this specific tab navigation
            tabNav.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            tabButton.classList.add('active');

            // Update content active states within this specific content container
            tabContentContainer.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTabContentId) {
                    content.classList.add('active');
                }
            });
        });
    };

    // Initialize tabs for the settings page
    const settingsPage = document.getElementById('settings-page');
    if (settingsPage) initializeTabs(settingsPage);

    // --- Sticky Header Shadow on Scroll ---
    const mainHeader = document.querySelector('.main-header');
    if (mainHeader) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 10) {
                mainHeader.classList.add('scrolled');
            } else {
                mainHeader.classList.remove('scrolled');
            }
        });
    }

    createSidebarOverlay();
});

// --- Firebase Auth State Listener ---
// Attach the auth state listener in a resilient way. If Firebase isn't ready yet we retry
// silently rather than logging a noisy error.
const attachAuthListener = () => {
    if (window.firebase && typeof window.firebase.auth === 'function') {
        try {
            window.firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    // User is signed in.
                    console.log('Authenticated user found:', user.uid);
                    populateUserProfile(user);
                    initializeProfilePage(user);
                    populateAdminActivity(user);
                } else {
                    // User is signed out. Handled by auth-guard.js
                    console.log('No authenticated user. Auth guard will redirect.');
                }
            });
        } catch (error) {
            // Firebase app not initialized yet, retry after a delay
            console.debug('Firebase app not fully initialized yet; retrying shortly.', error);
            setTimeout(attachAuthListener, 500);
        }
    } else {
        // Not ready yet — retry shortly. This avoids noisy console.error when startup order
        // varies between pages.
        console.debug('Firebase not ready for auth listener; retrying shortly.');
        setTimeout(() => {
            if (window.firebase && typeof window.firebase.auth === 'function') {
                attachAuthListener();
            }
        }, 500);
    }
};

// Helper used outside DOMContentLoaded to wait for firebase readiness if available.
const getFirebaseReadyPromiseTop = (opts = {}) => {
    const { timeout = 5000, interval = 100 } = opts;
    if (window.firebaseInitPromise && typeof window.firebaseInitPromise.then === 'function') {
        return window.firebaseInitPromise;
    }
    return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
            if (window.firebase && typeof window.firebase.auth === 'function') {
                resolve();
                return;
            }
            if (Date.now() - start > timeout) {
                // Resolve to avoid blocking; attachAuthListener will perform its own checks.
                resolve();
                return;
            }
            setTimeout(check, interval);
        };
        check();
    });
};

getFirebaseReadyPromiseTop().then(attachAuthListener).catch((err) => {
    console.error('Error waiting for Firebase initialization before attaching auth listener:', err);
    // Fallback: attempt to attach after a short delay
    setTimeout(attachAuthListener, 1000);
});


// --- Populate User Profile in Header and Profile Page ---
const populateUserProfile = (user) => {
    const profileHeaderName = document.getElementById('profile-header-name');
    const profileHeaderPhoto = document.querySelector('.profile-photo img');
    const profilePageNameInput = document.getElementById('profile-name-input');
    const profilePageEmailInput = document.getElementById('profile-email-input');
    const profilePagePicture = document.getElementById('profile-page-picture');

    // Default admin profile picture
    const defaultAdminPic = 'images/redicon.png';

    // Use data from Firebase Auth object first
    if (profileHeaderName) profileHeaderName.textContent = user.displayName || 'Admin';
    if (profileHeaderPhoto) profileHeaderPhoto.src = user.photoURL || defaultAdminPic;
    if (profilePageNameInput) profilePageNameInput.value = user.displayName || '';
    if (profilePageEmailInput) profilePageEmailInput.value = user.email || '';
    if (profilePagePicture) profilePagePicture.src = user.photoURL || defaultAdminPic;

    // You can also fetch from Firestore if you store more data there
    // Use window.firebase.firestore() to ensure it's initialized
    if (window.firebase && typeof window.firebase.firestore === 'function') {
        const db = window.firebase.firestore();
        db.collection('users').doc(user.uid).get().then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                // Override with Firestore data if it's more up-to-date
                if (profileHeaderName) profileHeaderName.textContent = userData.name || 'Admin';
                if (profilePageNameInput) profilePageNameInput.value = userData.name || '';
                // Use photoURL from Firestore or default to redicon
                const photoURL = userData.photoURL || defaultAdminPic;
                if (profileHeaderPhoto) profileHeaderPhoto.src = photoURL;
                if (profilePagePicture) profilePagePicture.src = photoURL;
            } else {
                // If no Firestore doc exists, ensure default picture is set
                if (profileHeaderPhoto && !profileHeaderPhoto.src.includes('http')) {
                    profileHeaderPhoto.src = defaultAdminPic;
                }
                if (profilePagePicture && !profilePagePicture.src.includes('http')) {
                    profilePagePicture.src = defaultAdminPic;
                }
            }
        }).catch(error => console.error("Error fetching user data from Firestore:", error));
    }
};

// --- Initialize Profile Page Functionality ---
const initializeProfilePage = (user) => {
    const profileForm = document.getElementById('profile-update-form');
    const nameInput = document.getElementById('profile-name-input');
    const pictureInput = document.getElementById('profile-picture-upload');
    const picturePreview = document.getElementById('profile-page-picture');
    const passwordForm = document.getElementById('password-update-form');
    const successToast = document.getElementById('success-toast');

    if (!profileForm) return;

    // --- Preview selected image ---
    pictureInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                picturePreview.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // --- Handle Name/Picture Update Form Submission ---
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = nameInput.value.trim();
        const newPictureFile = pictureInput.files[0];
        const submitButton = profileForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;

        submitButton.textContent = 'Saving...';
        submitButton.disabled = true;

        try {
            let photoURL = user.photoURL;

            // 1. If a new picture is uploaded, handle it first
            if (newPictureFile) {
                const filePath = `profile-pictures/${user.uid}/${newPictureFile.name}`;
                if (window.firebase && typeof window.firebase.storage === 'function') {
                    const storage = window.firebase.storage();
                    const fileRef = storage.ref(filePath);
                    const uploadTask = await fileRef.put(newPictureFile);
                    photoURL = await uploadTask.ref.getDownloadURL();
                }
            }

            // 2. Update Firebase Auth profile
            await user.updateProfile({
                displayName: newName,
                photoURL: photoURL
            });

            // 3. Update Firestore 'users' collection
            if (window.firebase && typeof window.firebase.firestore === 'function') {
                const db = window.firebase.firestore();
                await db.collection('users').doc(user.uid).update({
                    name: newName,
                    photoURL: photoURL
                });
            }

            // 4. Log this activity
            await logAdminActivity(user.uid, 'Updated Profile', `Changed name to "${newName}".`);

            // 4. Update UI and show success
            populateUserProfile(user); // Re-populate with fresh data
            populateAdminActivity(user); // Refresh activity log
            successToast.querySelector('p').textContent = 'Profile updated successfully!';
            successToast.classList.add('show');
            setTimeout(() => successToast.classList.remove('show'), 3000);

        } catch (error) {
            console.error("Error updating profile:", error);
            alert(`Failed to update profile: ${error.message}`);
        } finally {
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
        }
    });

    // --- Handle Password Update Form Submission ---
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('new-password-input').value;
            const submitButton = passwordForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;

            if (newPassword.length < 6) {
                alert('Password should be at least 6 characters long.');
                return;
            }

            submitButton.textContent = 'Updating...';
            submitButton.disabled = true;

            try {
                await user.updatePassword(newPassword);
                await logAdminActivity(user.uid, 'Updated Security', 'Changed account password.');

                passwordForm.reset();
                populateAdminActivity(user); // Refresh activity log
                successToast.querySelector('p').textContent = 'Password updated successfully!';
                successToast.classList.add('show');
                setTimeout(() => successToast.classList.remove('show'), 3000);

            } catch (error) {
                console.error("Error updating password:", error);
                alert(`Failed to update password: ${error.message}. You may need to log out and log back in to perform this action.`);
            } finally {
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            }
        });
    }
};

// --- Settings Page Specific Logic ---
const initializeSettingsPage = () => {
    // --- Theme Toggle ---
    const themeToggle = document.getElementById('theme-preference-toggle');
    if (themeToggle) {
        // Set initial state based on localStorage
        themeToggle.checked = localStorage.getItem('theme') === 'dark';

        themeToggle.addEventListener('change', (e) => {
            const newTheme = e.target.checked ? 'dark' : 'light';
            localStorage.setItem('theme', newTheme);
            // The applyTheme function is now global in scope and will handle the change
            applyTheme(newTheme);
        });
    }

    // --- General Settings Form ---
    const generalSettingsForm = document.getElementById('general-settings-form');
    if (generalSettingsForm) {
        const shopNameInput = document.getElementById('shop-name');
        const shopAddressInput = document.getElementById('shop-address');
        const shopPhoneInput = document.getElementById('shop-phone');
        const shopEmailInput = document.getElementById('shop-email');

        // Function to load settings from localStorage
        const loadGeneralSettings = () => {
            const savedSettings = localStorage.getItem('shopSettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                if (shopNameInput) shopNameInput.value = settings.name || '';
                if (shopAddressInput) shopAddressInput.value = settings.address || '';
                if (shopPhoneInput) shopPhoneInput.value = settings.phone || '';
                if (shopEmailInput) shopEmailInput.value = settings.email || '';
            }
        };

        // Handle form submission
        generalSettingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const settings = {
                name: shopNameInput.value,
                address: shopAddressInput.value,
                phone: shopPhoneInput.value,
                email: shopEmailInput.value,
            };
            localStorage.setItem('shopSettings', JSON.stringify(settings));
            showSuccessToast('General settings saved successfully!');
        });

        // Load settings when the page initializes
        loadGeneralSettings();
    }
};

// --- Reusable function to log admin actions ---
const logAdminActivity = async (adminId, action, details) => {
    if (!adminId) return;
    try {
        if (!window.firebase || typeof window.firebase.firestore !== 'function') {
            console.warn('Firebase Firestore is not available for logging activity');
            return;
        }
        const db = window.firebase.firestore();
        await db.collection('activity_logs').add({
            adminId: adminId,
            action: action,
            details: details,
            timestamp: window.firebase.firestore().FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Error logging admin activity:", error);
    }
};

/**
 * Formats a Firestore timestamp into a user-friendly relative or absolute string.
 * e.g., "2 hours ago", "Yesterday at 5:30 PM", "Oct 29, 2023"
 * @param {Timestamp} firestoreTimestamp - The timestamp from Firestore.
 * @returns {string} A formatted date string.
 */
const formatActivityTimestamp = (firestoreTimestamp) => {
    if (!firestoreTimestamp) return 'Just now';

    const date = firestoreTimestamp.toDate();
    const now = new Date();
    const diffSeconds = Math.round((now - date) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;

    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };

    if (diffDays === 1) {
        return `Yesterday at ${date.toLocaleTimeString('en-US', timeOptions)}`;
    }
    if (diffDays < 7) {
        return `${date.toLocaleDateString('en-US', { weekday: 'long' })} at ${date.toLocaleTimeString('en-US', timeOptions)}`;
    }

    return date.toLocaleDateString('en-US', dateOptions);
};

const getActivityIcon = (action) => {
    const iconMap = {
        'Updated Profile': 'manage_accounts',
        'Updated Security': 'lock_reset',
        'Created Technician': 'person_add',
        'Deleted Service': 'delete_forever',
        'default': 'history'
    };
    return iconMap[action] || iconMap['default'];
};

// --- Populate the Recent Activity log on the profile page ---
const populateAdminActivity = async (user) => {
    const logList = document.getElementById('activity-log-list');
    if (!logList) return;

    logList.innerHTML = '<div class="spinner-small"></div>'; // Show a small loader

    try {
        if (!window.firebase || typeof window.firebase.firestore !== 'function') {
            logList.innerHTML = '<div class="activity-item-placeholder"><p class="text-muted">Firebase is not initialized yet.</p></div>';
            return;
        }

        const db = window.firebase.firestore();
        const snapshot = await db.collection('activity_logs')
            .where('adminId', '==', user.uid)
            .orderBy('timestamp', 'desc')
            .limit(7)
            .get();

        logList.innerHTML = ''; // Clear loader

        if (snapshot.empty) {
            logList.innerHTML = '<div class="activity-item-placeholder"><p class="text-muted">No recent activity found.</p></div>';
            return;
        }

        snapshot.forEach(doc => {
            const log = doc.data();
            const logDate = formatActivityTimestamp(log.timestamp);
            const logIcon = getActivityIcon(log.action);
            const logItem = document.createElement('div');
            logItem.className = 'activity-item';
            logItem.innerHTML = `
                <div class="activity-icon"><span class="material-symbols-outlined">${logIcon}</span></div>
                <div class="activity-details">
                    <p><b>${log.action}:</b> ${log.details}</p>
                    <small class="text-muted">${logDate}</small>
                </div>
            `;
            logList.appendChild(logItem);
        });

    } catch (error) {
        console.error("Error fetching activity log:", error);
        logList.innerHTML = '<div class="activity-item-placeholder"><p class="text-muted">Could not load activity.</p></div>';
    }
};
