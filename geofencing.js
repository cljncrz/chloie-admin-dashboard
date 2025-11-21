document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to be initialized
    await window.firebaseInitPromise;
    
    const db = window.firebase.firestore();
    const geofencingForm = document.getElementById('geofencing-settings-form');
    if (!geofencingForm) return;

    // --- DOM Elements ---
    const enabledToggle = document.getElementById('geofencing-enabled-toggle');
    const hoursGrid = document.getElementById('operating-hours-grid');
    const locationNameInput = document.getElementById('location-name');
    const locationAddressInput = document.getElementById('location-address');
    const locationLatInput = document.getElementById('location-latitude');
    const locationLngInput = document.getElementById('location-longitude');
    const locationRadiusInput = document.getElementById('location-radius');
    const addLocationBtn = document.getElementById('add-location-btn');
    const locationsList = document.getElementById('locations-list');
    const notificationMessageInput = document.getElementById('notification-message');
    const activeLocationsCount = document.getElementById('active-locations-count');
    const geofencingStatus = document.getElementById('geofencing-status');
    const notificationsSentCount = document.getElementById('notifications-sent-count');

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // --- Default Settings ---
    const defaultSettings = {
        isEnabled: false,
        operatingHours: {
            Sunday: { isOpen: false, start: '09:00', end: '17:00' },
            Monday: { isOpen: true, start: '08:00', end: '20:00' },
            Tuesday: { isOpen: true, start: '08:00', end: '20:00' },
            Wednesday: { isOpen: true, start: '08:00', end: '20:00' },
            Thursday: { isOpen: true, start: '08:00', end: '20:00' },
            Friday: { isOpen: true, start: '08:00', end: '20:00' },
            Saturday: { isOpen: true, start: '08:00', end: '22:00' },
        },
        notificationMessage: 'Kingsley Carwash is nearby! Visit us now!',
        notificationsSent: 0
    };

    let geofencingSettings = { ...defaultSettings };
    let geofencingLocations = [];

    // --- Load Settings from Firestore ---
    const loadSettings = async () => {
        try {
            const settingsDoc = await db.collection('adminSettings').doc('geofencing').get();
            if (settingsDoc.exists) {
                geofencingSettings = { ...defaultSettings, ...settingsDoc.data() };
                console.log('✅ Geofencing settings loaded from Firestore:', geofencingSettings);
            }
            
            const locationsSnapshot = await db.collection('geofencing_locations').get();
            geofencingLocations = locationsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log('✅ Geofencing locations loaded from Firestore:', geofencingLocations);
            
            // Populate UI
            enabledToggle.checked = geofencingSettings.isEnabled;
            notificationMessageInput.value = geofencingSettings.notificationMessage || '';
            populateHoursGrid(geofencingSettings.operatingHours);
            renderLocationsList();
            updateStats();
        } catch (error) {
            console.error('❌ Error loading geofencing settings:', error);
        }
    };

    // --- Save Settings to Firestore ---
    const saveSettings = async () => {
        // Disable save button and show loading state
        const saveBtn = document.querySelector('button[type="submit"]');
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Saving...';

        try {
            // Validate notification message
            const notificationMessage = notificationMessageInput.value.trim();
            if (!notificationMessage) {
                throw new Error('Notification message cannot be empty');
            }

            // Collect operating hours
            const newOperatingHours = {};
            let hasValidHours = false;

            daysOfWeek.forEach(day => {
                const isOpen = document.getElementById(`is-open-${day}`).checked;
                const startTime = document.getElementById(`start-time-${day}`).value;
                const endTime = document.getElementById(`end-time-${day}`).value;

                // Validate time range if day is open
                if (isOpen) {
                    if (!startTime || !endTime) {
                        throw new Error(`Please set operating hours for ${day}`);
                    }
                    if (startTime >= endTime) {
                        throw new Error(`${day}: End time must be after start time`);
                    }
                    hasValidHours = true;
                }

                newOperatingHours[day] = {
                    isOpen: isOpen,
                    start: startTime || '08:00',
                    end: endTime || '20:00',
                };
            });

            // Warn if no days are open
            if (!hasValidHours) {
                const proceed = confirm('Warning: No operating hours are set. Geofencing will not trigger on any day. Continue anyway?');
                if (!proceed) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalText;
                    return;
                }
            }

            // Prepare settings object
            const updatedSettings = {
                isEnabled: enabledToggle.checked,
                operatingHours: newOperatingHours,
                notificationMessage: notificationMessage,
                updatedAt: new Date().toISOString(),
                updatedBy: firebase.auth().currentUser?.email || 'admin'
            };

            console.log('🔄 Saving geofencing settings...', updatedSettings);

            // Create batch for atomic updates
            const batch = db.batch();

            // Update geofencing settings
            const geofencingRef = db.collection('adminSettings').doc('geofencing');
            batch.set(geofencingRef, updatedSettings, { merge: true });

            // Update app settings for mobile app
            const appSettingsRef = db.collection('app_settings').doc('features');
            batch.set(appSettingsRef, {
                geofencingEnabled: updatedSettings.isEnabled,
                geofencingMessage: notificationMessage,
                lastUpdated: new Date().toISOString()
            }, { merge: true });

            // Commit batch
            await batch.commit();

            // Update local state
            geofencingSettings = { ...geofencingSettings, ...updatedSettings };
            
            console.log('✅ Geofencing settings saved to Firestore');
            updateStats();
            
            // Show detailed success message
            showSaveSuccessMessage(updatedSettings);
            
        } catch (error) {
            console.error('❌ Error saving geofencing settings:', error);
            
            // Show user-friendly error message
            const errorMessage = document.createElement('div');
            errorMessage.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: #ef4444;
                color: white;
                padding: 1rem 1.5rem;
                border-radius: 0.5rem;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 1000;
                max-width: 400px;
            `;
            errorMessage.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                    <span class="material-symbols-outlined">error</span>
                    <div>
                        <strong>Failed to Save Settings</strong>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem;">${error.message}</p>
                    </div>
                </div>
            `;
            document.body.appendChild(errorMessage);
            setTimeout(() => errorMessage.remove(), 5000);
        } finally {
            // Re-enable save button
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    };

    // --- Show Save Success Message ---
    const showSaveSuccessMessage = (settings) => {
        const openDays = Object.entries(settings.operatingHours)
            .filter(([_, hours]) => hours.isOpen)
            .map(([day, _]) => day);

        const successMessage = document.createElement('div');
        successMessage.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;
        successMessage.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                <span class="material-symbols-outlined" style="font-size: 2rem;">check_circle</span>
                <div style="flex: 1;">
                    <strong style="font-size: 1.1rem;">Settings Saved Successfully!</strong>
                    <div style="margin-top: 0.75rem; font-size: 0.875rem; opacity: 0.95;">
                        <p style="margin: 0.25rem 0;">✅ Geofencing: <strong>${settings.isEnabled ? 'Enabled' : 'Disabled'}</strong></p>
                        <p style="margin: 0.25rem 0;">📅 Active Days: <strong>${openDays.length}</strong> (${openDays.slice(0, 3).join(', ')}${openDays.length > 3 ? '...' : ''})</p>
                        <p style="margin: 0.25rem 0;">📍 Locations: <strong>${geofencingLocations.length}</strong></p>
                        <p style="margin: 0.25rem 0;">📱 Mobile app will sync on next refresh</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(successMessage);

        setTimeout(() => {
            successMessage.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => successMessage.remove(), 300);
        }, 6000);
    };

    // --- Add Location ---
    const addLocation = async () => {
        const name = locationNameInput.value.trim();
        const address = locationAddressInput.value.trim();
        const latitude = parseFloat(locationLatInput.value);
        const longitude = parseFloat(locationLngInput.value);
        const radius = parseFloat(locationRadiusInput.value);

        if (!name || !address || !latitude || !longitude || !radius) {
            alert('Please fill in all location fields');
            return;
        }

        try {
            console.log('🔄 Adding location to Firestore...');
            const locationRef = await db.collection('geofencing_locations').add({
                name: name,
                address: address,
                latitude: latitude,
                longitude: longitude,
                radius: radius,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            // After adding, reload locations from Firestore to avoid duplicates
            console.log('✅ Location added to Firestore. Reloading locations...');

            // Clear form
            locationNameInput.value = '';
            locationAddressInput.value = '';
            locationLatInput.value = '';
            locationLngInput.value = '';
            locationRadiusInput.value = '500';

            // Reload locations from Firestore
            const locationsSnapshot = await db.collection('geofencing_locations').get();
            geofencingLocations = locationsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderLocationsList();
            updateStats();
            showSuccessToast(`Location "${name}" added successfully!`);
        } catch (error) {
            console.error('❌ Error adding location:', error);
            alert('Failed to add location: ' + error.message);
        }
    };

    // --- Delete Location ---
    const deleteLocation = async (locationId) => {
        if (!confirm('Are you sure you want to delete this location?')) return;

        try {
            console.log('🔄 Deleting location from Firestore...');
            await db.collection('geofencing_locations').doc(locationId).delete();
            
            geofencingLocations = geofencingLocations.filter(loc => loc.id !== locationId);
            console.log('✅ Location deleted from Firestore');
            
            renderLocationsList();
            updateStats();
            showSuccessToast('Location deleted successfully!');
        } catch (error) {
            console.error('❌ Error deleting location:', error);
            alert('Failed to delete location: ' + error.message);
        }
    };

    // --- Render Locations List ---
    const renderLocationsList = () => {
        locationsList.innerHTML = '';

        if (geofencingLocations.length === 0) {
            locationsList.innerHTML = '<p class="text-muted text-center" style="padding: 2rem;">No locations added yet. Add one above!</p>';
            return;
        }

        geofencingLocations.forEach(location => {
            const locationCard = document.createElement('div');
            locationCard.className = 'location-card';
            locationCard.innerHTML = `
                <div class="location-info">
                    <h4>${location.name}</h4>
                    <p><strong>Address:</strong> ${location.address}</p>
                    <p><strong>Coordinates:</strong> ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}</p>
                    <p><strong>Geofence Radius:</strong> ${location.radius}m</p>
                </div>
                <div class="location-actions">
                    <button type="button" class="action-icon-btn delete-location-btn" data-location-id="${location.id}" title="Delete Location">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            `;
            locationsList.appendChild(locationCard);
        });

        // Add delete listeners
        document.querySelectorAll('.delete-location-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const locationId = e.target.closest('button').dataset.locationId;
                deleteLocation(locationId);
            });
        });
    };

    // --- Populate Hours Grid ---
    const populateHoursGrid = (hoursData) => {
        hoursGrid.innerHTML = '';
        daysOfWeek.forEach(day => {
            const dayData = hoursData[day];
            const row = document.createElement('div');
            row.className = 'operating-hours-row';
            row.innerHTML = `
                <strong class="day-label">${day}</strong>
                <div class="form-group">
                    <input type="time" id="start-time-${day}" value="${dayData.start}" ${!dayData.isOpen ? 'disabled' : ''}>
                </div>
                <div class="form-group">
                    <input type="time" id="end-time-${day}" value="${dayData.end}" ${!dayData.isOpen ? 'disabled' : ''}>
                </div>
                <div class="form-group-toggle">
                    <label class="theme-toggle-switch small-toggle">
                        <input type="checkbox" id="is-open-${day}" ${dayData.isOpen ? 'checked' : ''}>
                        <span class="theme-slider"></span>
                    </label>
                </div>
            `;
            hoursGrid.appendChild(row);

            // Add event listener to enable/disable time inputs
            const isOpenToggle = row.querySelector(`#is-open-${day}`);
            const startTimeInput = row.querySelector(`#start-time-${day}`);
            const endTimeInput = row.querySelector(`#end-time-${day}`);
            isOpenToggle.addEventListener('change', () => {
                startTimeInput.disabled = !isOpenToggle.checked;
                endTimeInput.disabled = !isOpenToggle.checked;
            });
        });
    };

    // --- Update Statistics ---
    const updateStats = () => {
        activeLocationsCount.textContent = geofencingLocations.length;
        geofencingStatus.textContent = geofencingSettings.isEnabled ? 'Enabled' : 'Disabled';
        geofencingStatus.className = geofencingSettings.isEnabled ? 'stat-value active' : 'stat-value';
        notificationsSentCount.textContent = geofencingSettings.notificationsSent || 0;
    };

    // --- Show Success Toast ---
    const showSuccessToast = (message) => {
        const successToast = document.getElementById('success-toast');
        if (!successToast) return;
        const toastText = successToast.querySelector('p');
        toastText.textContent = message;
        successToast.classList.add('show');
        setTimeout(() => {
            successToast.classList.remove('show');
        }, 3000);
    };

    // --- Master Control Toggle ---
    const toggleGeofencing = async (isEnabled) => {
        try {
            console.log(`🔄 ${isEnabled ? 'Enabling' : 'Disabling'} geofencing system...`);
            // Create batch write for atomic updates
            const batch = db.batch();
            // Update geofencing settings
            const geofencingRef = db.collection('adminSettings').doc('geofencing');
            batch.set(geofencingRef, {
                ...geofencingSettings,
                isEnabled: isEnabled,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            // Update app settings for mobile app to read
            const appSettingsRef = db.collection('app_settings').doc('features');
            batch.set(appSettingsRef, {
                geofencingEnabled: isEnabled,
                lastUpdated: new Date().toISOString(),
                updatedBy: firebase.auth().currentUser?.email || 'admin'
            }, { merge: true });
            // Commit batch
            await batch.commit();
            // Reload settings from Firestore to ensure UI matches saved state
            const settingsDoc = await db.collection('adminSettings').doc('geofencing').get();
            if (settingsDoc.exists) {
                geofencingSettings = { ...geofencingSettings, ...settingsDoc.data() };
                enabledToggle.checked = geofencingSettings.isEnabled;
            }
            updateStats();
            const message = isEnabled 
                ? '✅ Geofencing system enabled! Customers will receive notifications when near your locations.'
                : '⚠️ Geofencing system disabled. No notifications will be sent to customers.';
            showSuccessToast(message);
            console.log(`✅ Geofencing ${isEnabled ? 'enabled' : 'disabled'} successfully`);
            console.log(`📱 Mobile app will sync this setting on next refresh`);
            // Show visual feedback on the page
            showSystemStatusMessage(isEnabled);
        } catch (error) {
            console.error('❌ Error toggling geofencing:', error);
            // Revert toggle on error
            enabledToggle.checked = !isEnabled;
            alert('Failed to update geofencing status: ' + error.message);
        }
    };

    // --- Show System Status Message ---
    const showSystemStatusMessage = (isEnabled) => {
        // Remove any existing status message
        const existingMessage = document.querySelector('.system-status-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create new status message
        const statusMessage = document.createElement('div');
        statusMessage.className = 'system-status-message';
        statusMessage.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${isEnabled ? '#10b981' : '#f59e0b'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        statusMessage.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span class="material-symbols-outlined">${isEnabled ? 'check_circle' : 'warning'}</span>
                <div>
                    <strong>${isEnabled ? 'Geofencing Enabled' : 'Geofencing Disabled'}</strong>
                    <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem; opacity: 0.9;">
                        ${isEnabled ? 'System is now active and monitoring customer locations' : 'No notifications will be sent to customers'}
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(statusMessage);

        // Remove after 5 seconds
        setTimeout(() => {
            statusMessage.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => statusMessage.remove(), 300);
        }, 5000);
    };

    // --- Event Listeners ---

    // Save notification message instantly when changed
    if (notificationMessageInput) {
        notificationMessageInput.addEventListener('change', async (e) => {
            const newMessage = e.target.value.trim();
            if (!newMessage) return;
            try {
                await db.collection('adminSettings').doc('geofencing').set({
                    notificationMessage: newMessage,
                    updatedAt: new Date().toISOString(),
                    updatedBy: firebase.auth().currentUser?.email || 'admin'
                }, { merge: true });
                geofencingSettings.notificationMessage = newMessage;
                showSuccessToast('Notification message saved!');
            } catch (error) {
                console.error('❌ Error saving notification message:', error);
                alert('Failed to save notification message: ' + error.message);
            }
        });
    }

    if (addLocationBtn) {
        addLocationBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addLocation();
        });
    }

    // Master Control Toggle Event Listener
    if (enabledToggle) {
        enabledToggle.addEventListener('change', (e) => {
            toggleGeofencing(e.target.checked);
        });
    }

    // Save Operating Hours Button Event Listener
    const saveOperatingHoursBtn = document.getElementById('save-operating-hours-btn');
    if (saveOperatingHoursBtn) {
        saveOperatingHoursBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Update button state
            const originalHTML = saveOperatingHoursBtn.innerHTML;
            saveOperatingHoursBtn.disabled = true;
            saveOperatingHoursBtn.innerHTML = '<span class="material-symbols-outlined">sync</span> Saving...';
            
            try {
                // Collect operating hours data
                const operatingHours = {};
                const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                
                // Validate and collect operating hours
                let isValid = true;
                for (const day of days) {
                    const openInput = document.getElementById(`${day}-open`);
                    const closeInput = document.getElementById(`${day}-close`);
                    
                    if (!openInput || !closeInput) {
                        isValid = false;
                        break;
                    }
                    
                    const openTime = openInput.value;
                    const closeTime = closeInput.value;
                    
                    if (!openTime || !closeTime) {
                        showStatusMessage('Please fill in all operating hours', 'error');
                        isValid = false;
                        break;
                    }
                    
                    operatingHours[day] = {
                        open: openTime,
                        close: closeTime
                    };
                }
                
                if (!isValid) {
                    saveOperatingHoursBtn.disabled = false;
                    saveOperatingHoursBtn.innerHTML = originalHTML;
                    return;
                }
                
                // Save to Firestore using batch
                const batch = db.batch();
                
                // Update admin_settings
                const adminSettingsRef = db.collection('adminSettings').doc('geofencing');
                batch.update(adminSettingsRef, {
                    operatingHours: operatingHours,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Update app_settings
                const appSettingsRef = db.collection('app_settings').doc('geofencing');
                batch.update(appSettingsRef, {
                    operatingHours: operatingHours,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                await batch.commit();
                
                // Show success message
                showStatusMessage('Operating hours saved successfully!', 'success');
                
                // Reset button
                saveOperatingHoursBtn.disabled = false;
                saveOperatingHoursBtn.innerHTML = originalHTML;
                
            } catch (error) {
                console.error('Error saving operating hours:', error);
                showStatusMessage('Failed to save operating hours. Please try again.', 'error');
                
                // Reset button
                saveOperatingHoursBtn.disabled = false;
                saveOperatingHoursBtn.innerHTML = originalHTML;
            }
        });
    }

    // --- Real-time Listener for Settings Changes ---
    const setupRealtimeListener = () => {
        // Listen for changes to geofencing settings
        db.collection('adminSettings').doc('geofencing').onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                
                // Update local state
                geofencingSettings = { ...defaultSettings, ...data };
                
                // Update UI if toggle state is different
                if (enabledToggle.checked !== geofencingSettings.isEnabled) {
                    console.log('📡 Geofencing setting changed remotely, updating UI...');
                    enabledToggle.checked = geofencingSettings.isEnabled;
                    updateStats();
                }
                
                // Update notification message if changed
                if (notificationMessageInput.value !== geofencingSettings.notificationMessage) {
                    notificationMessageInput.value = geofencingSettings.notificationMessage || '';
                }
            }
        }, (error) => {
            console.error('❌ Error listening to geofencing settings:', error);
        });

        // Listen for changes to geofencing locations
        db.collection('geofencing_locations').onSnapshot((snapshot) => {
            geofencingLocations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            renderLocationsList();
            updateStats();
        }, (error) => {
            console.error('❌ Error listening to geofencing locations:', error);
        });
    };

    // --- Initialization ---
    await loadSettings();
    setupRealtimeListener();
    console.log('✅ Geofencing page initialized with real-time sync');
});