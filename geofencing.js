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
            const settingsDoc = await db.collection('admin_settings').doc('geofencing').get();
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
        try {
            const newOperatingHours = {};
            daysOfWeek.forEach(day => {
                newOperatingHours[day] = {
                    isOpen: document.getElementById(`is-open-${day}`).checked,
                    start: document.getElementById(`start-time-${day}`).value,
                    end: document.getElementById(`end-time-${day}`).value,
                };
            });

            const updatedSettings = {
                isEnabled: enabledToggle.checked,
                operatingHours: newOperatingHours,
                notificationMessage: notificationMessageInput.value,
                updatedAt: new Date().toISOString()
            };

            await db.collection('admin_settings').doc('geofencing').set(updatedSettings);
            geofencingSettings = updatedSettings;
            console.log('✅ Geofencing settings saved to Firestore');
            updateStats();
            showSuccessToast('Geofencing settings saved successfully!');
        } catch (error) {
            console.error('❌ Error saving geofencing settings:', error);
            alert('Failed to save settings: ' + error.message);
        }
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

            const newLocation = {
                id: locationRef.id,
                name: name,
                address: address,
                latitude: latitude,
                longitude: longitude,
                radius: radius
            };

            geofencingLocations.push(newLocation);
            console.log('✅ Location added to Firestore:', newLocation);

            // Clear form
            locationNameInput.value = '';
            locationAddressInput.value = '';
            locationLatInput.value = '';
            locationLngInput.value = '';
            locationRadiusInput.value = '500';

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

    // --- Event Listeners ---
    geofencingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings();
    });

    if (addLocationBtn) {
        addLocationBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addLocation();
        });
    }

    // Add real-time toggle listener to update status immediately
    if (enabledToggle) {
        enabledToggle.addEventListener('change', () => {
            geofencingSettings.isEnabled = enabledToggle.checked;
            updateStats();
            console.log(`🔄 Geofencing ${enabledToggle.checked ? 'enabled' : 'disabled'} (not saved yet)`);
        });
    }

    // --- Initialization ---
    await loadSettings();
});