document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to initialize
    await window.firebaseInitPromise;

    const firebase = window.firebase;
    const db = firebase.firestore();
    const auth = firebase.auth();

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

    // Load notification settings from Firestore
    const loadNotificationSettings = async () => {
        try {
            const user = auth.currentUser;
            if (!user) {
                console.log('User not logged in, cannot load settings');
                return;
            }

            const settingsDoc = await db.collection('adminSettings').doc(user.uid).get();
            
            if (settingsDoc.exists) {
                const settings = settingsDoc.data().notificationPreferences || {};
                
                // Apply settings to toggles
                Object.keys(notificationToggles).forEach(toggleId => {
                    const toggle = document.getElementById(toggleId);
                    const settingKey = notificationToggles[toggleId];
                    
                    if (toggle && settings.hasOwnProperty(settingKey)) {
                        toggle.checked = settings[settingKey];
                    }
                });
            }
        } catch (error) {
            console.error('Error loading notification settings:', error);
            alert('Failed to load notification settings. Please refresh the page.');
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
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Show success message
            const successToast = document.getElementById('success-toast');
            if (successToast) {
                const toastText = successToast.querySelector('p');
                if (toastText) toastText.textContent = 'Notification settings saved successfully!';
                successToast.classList.add('show');
                setTimeout(() => successToast.classList.remove('show'), 3000);
            } else {
                alert('Notification settings saved successfully!');
            }
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
            loadNotificationSettings();
        }
    });

    // General Settings Form Handler
    const generalSettingsForm = document.getElementById('general-settings-form');
    if (generalSettingsForm) {
        generalSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const user = auth.currentUser;
                if (!user) {
                    alert('You must be logged in to save settings.');
                    return;
                }

                const shopName = document.getElementById('shop-name').value;
                const shopAddress = document.getElementById('shop-address').value;
                const shopPhone = document.getElementById('shop-phone').value;
                const shopEmail = document.getElementById('shop-email').value;

                const generalSettings = {
                    shopName,
                    shopAddress,
                    shopPhone,
                    shopEmail
                };

                // Save to Firestore
                await db.collection('adminSettings').doc(user.uid).set({
                    generalSettings: generalSettings,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                // Show success message
                const successToast = document.getElementById('success-toast');
                if (successToast) {
                    const toastText = successToast.querySelector('p');
                    if (toastText) toastText.textContent = 'General settings saved successfully!';
                    successToast.classList.add('show');
                    setTimeout(() => successToast.classList.remove('show'), 3000);
                } else {
                    alert('General settings saved successfully!');
                }
            } catch (error) {
                console.error('Error saving general settings:', error);
                alert('Failed to save general settings. Please try again.');
            }
        });
    }

    // Theme Toggle Handler (already exists in script.js, but we'll ensure it works)
    const themeToggle = document.getElementById('theme-preference-toggle');
    if (themeToggle) {
        // Set initial state based on current theme
        const currentTheme = localStorage.getItem('theme');
        themeToggle.checked = currentTheme === 'dark';

        themeToggle.addEventListener('change', () => {
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
        });
    }
});
