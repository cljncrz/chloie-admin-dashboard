document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to initialize
    await window.firebaseInitPromise;

    const firebase = window.firebase;
    const db = firebase.firestore();
    const auth = firebase.auth();

    // Helper function to show success toast
    const showSuccessToast = (message) => {
        const successToast = document.getElementById('success-toast');
        if (successToast) {
            const toastText = successToast.querySelector('p');
            if (toastText) toastText.textContent = message;
            successToast.classList.add('show');
            setTimeout(() => successToast.classList.remove('show'), 3000);
        } else {
            alert(message);
        }
    };

    // Tab Navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            // Remove active class from all tabs and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // Notification Settings
    const notificationToggles = {
        'notify-new-appointments': 'newAppointments',
        'notify-cancellations': 'cancellations',
        'notify-reschedule': 'rescheduleRequests',
        'notify-payments': 'paymentsReceived',
        'notify-pending-payments': 'pendingPayments',
        'notify-new-customers': 'newCustomers',
        'notify-customer-messages': 'customerMessages',
        'notify-new-reviews': 'newReviews',
        'notify-low-ratings': 'lowRatings',
        'notify-daily-summary': 'dailySummary',
        'notify-system-updates': 'systemUpdates'
    };

    // Load all settings from Firestore
    const loadAllSettings = async () => {
        try {
            const user = auth.currentUser;
            if (!user) {
                console.log('User not logged in, cannot load settings');
                return;
            }

            const settingsDoc = await db.collection('adminSettings').doc(user.uid).get();
            
            if (settingsDoc.exists) {
                const data = settingsDoc.data();
                
                // Load notification preferences
                const notificationSettings = data.notificationPreferences || {};
                Object.keys(notificationToggles).forEach(toggleId => {
                    const toggle = document.getElementById(toggleId);
                    const settingKey = notificationToggles[toggleId];
                    
                    if (toggle && notificationSettings.hasOwnProperty(settingKey)) {
                        toggle.checked = notificationSettings[settingKey];
                    }
                });

                // Load general settings
                if (data.generalSettings) {
                    const general = data.generalSettings;
                    if (general.shopName) document.getElementById('shop-name').value = general.shopName;
                    if (general.shopAddress) document.getElementById('shop-address').value = general.shopAddress;
                    if (general.shopPhone) document.getElementById('shop-phone').value = general.shopPhone;
                    if (general.shopEmail) document.getElementById('shop-email').value = general.shopEmail;
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            showSuccessToast('Failed to load settings. Please refresh the page.');
        }
    };

    // Save notification settings
    const saveNotificationSettings = async () => {
        try {
            const user = auth.currentUser;
            if (!user) {
                alert('You must be logged in to save settings.');
                return;
            }

            // Collect all toggle states
            const preferences = {};
            Object.keys(notificationToggles).forEach(toggleId => {
                const toggle = document.getElementById(toggleId);
                const settingKey = notificationToggles[toggleId];
                
                if (toggle) {
                    preferences[settingKey] = toggle.checked;
                }
            });

            // Save to Firestore
            await db.collection('adminSettings').doc(user.uid).set({
                notificationPreferences: preferences,
                updatedAt: db.FieldValue.serverTimestamp()
            }, { merge: true });

            // Log admin activity
            if (typeof logAdminActivity === 'function') {
                await logAdminActivity(user.uid, 'Updated Notification Settings', 'Changed notification preferences in settings');
            }

            // Show success message
            showSuccessToast('Notification settings saved successfully!');
        } catch (error) {
            console.error('Error saving notification settings:', error);
            alert('Failed to save notification settings. Please try again.');
        }
    };

    // Save button handler
    const saveButton = document.getElementById('save-notification-settings');
    if (saveButton) {
        saveButton.addEventListener('click', saveNotificationSettings);
    }

    // Load settings on page load
    auth.onAuthStateChanged(user => {
        if (user) {
            loadAllSettings();
        }
    });

    // General Settings Form Handler
    const generalSettingsForm = document.getElementById('general-settings-form');
    if (generalSettingsForm) {
        generalSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitButton = e.target.querySelector('button[type="submit"]');
            const originalButtonText = submitButton ? submitButton.textContent : '';
            
            try {
                // Disable button and show loading state
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = 'Saving...';
                }

                const user = auth.currentUser;
                if (!user) {
                    showSuccessToast('You must be logged in to save settings.');
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = originalButtonText;
                    }
                    return;
                }

                const shopNameInput = document.getElementById('shop-name');
                const shopAddressInput = document.getElementById('shop-address');
                const shopPhoneInput = document.getElementById('shop-phone');
                const shopEmailInput = document.getElementById('shop-email');

                if (!shopNameInput || !shopAddressInput || !shopPhoneInput || !shopEmailInput) {
                    console.error('One or more input fields not found');
                    showSuccessToast('Error: Form fields not found.');
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = originalButtonText;
                    }
                    return;
                }

                const shopName = shopNameInput.value;
                const shopAddress = shopAddressInput.value;
                const shopPhone = shopPhoneInput.value;
                const shopEmail = shopEmailInput.value;

                // Validate inputs
                if (!shopName.trim()) {
                    showSuccessToast('Shop name is required.');
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = originalButtonText;
                    }
                    return;
                }

                const generalSettings = {
                    shopName: shopName.trim(),
                    shopAddress: shopAddress.trim(),
                    shopPhone: shopPhone.trim(),
                    shopEmail: shopEmail.trim()
                };

                console.log('Saving general settings:', generalSettings);

                // Save to Firestore
                await db.collection('adminSettings').doc(user.uid).set({
                    generalSettings: generalSettings,
                    updatedAt: db.FieldValue.serverTimestamp()
                }, { merge: true });

                console.log('General settings saved to Firestore successfully');

                // Log admin activity
                if (typeof logAdminActivity === 'function') {
                    try {
                        await logAdminActivity(user.uid, 'Updated General Settings', 'Modified shop information in settings');
                    } catch (logError) {
                        console.warn('Failed to log activity:', logError);
                    }
                }

                // Show success message
                showSuccessToast('General settings saved successfully!');
            } catch (error) {
                console.error('Error saving general settings:', error);
                console.error('Error details:', error.message, error.code);
                showSuccessToast('Failed to save general settings. Please try again.');
            } finally {
                // Re-enable button
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                }
            }
        });
    }

    // Theme Toggle Handler
    const themeToggle = document.getElementById('theme-preference-toggle');
    if (themeToggle) {
        // Set initial state based on current theme
        const currentTheme = localStorage.getItem('theme');
        themeToggle.checked = currentTheme === 'dark';

        themeToggle.addEventListener('change', async () => {
            const newTheme = themeToggle.checked ? 'dark' : 'light';
            localStorage.setItem('theme', newTheme);
            
            if (newTheme === 'dark') {
                document.documentElement.classList.add('dark-theme-variables');
                document.body.classList.add('dark-theme-variables');
            } else {
                document.documentElement.classList.remove('dark-theme-variables');
                document.body.classList.remove('dark-theme-variables');
            }

            // Update theme toggler in header
            const themeTogglerBtns = document.querySelectorAll('.theme-toggler span');
            themeTogglerBtns.forEach(btn => btn.classList.remove('active'));
            if (newTheme === 'dark') {
                themeTogglerBtns[1].classList.add('active');
            } else {
                themeTogglerBtns[0].classList.add('active');
            }

            // Save theme preference to Firestore
            try {
                const user = auth.currentUser;
                if (user) {
                    await db.collection('adminSettings').doc(user.uid).set({
                        themePreference: newTheme,
                        updatedAt: db.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
            } catch (error) {
                console.error('Error saving theme preference:', error);
            }

            // Show success message
            showSuccessToast(`Theme changed to ${newTheme} mode`);
        });
    }

    // Add individual toggle change listeners for instant feedback
    Object.keys(notificationToggles).forEach(toggleId => {
        const toggle = document.getElementById(toggleId);
        if (toggle) {
            toggle.addEventListener('change', () => {
                // Visual feedback that changes are pending save
                const saveButton = document.getElementById('save-notification-settings');
                if (saveButton) {
                    saveButton.style.animation = 'pulse 0.5s ease-in-out';
                    setTimeout(() => {
                        saveButton.style.animation = '';
                    }, 500);
                }
            });
        }
    });
});
