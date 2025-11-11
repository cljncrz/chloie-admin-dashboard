document.addEventListener('DOMContentLoaded', () => {
    const geofencingForm = document.getElementById('geofencing-settings-form');
    if (!geofencingForm) return;

    // --- DOM Elements ---
    const enabledToggle = document.getElementById('geofencing-enabled-toggle');
    const hoursGrid = document.getElementById('operating-hours-grid');

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
        }
    };

    // --- Functions ---

    /**
     * Populates the operating hours grid with controls for each day.
     * @param {object} hoursData - The operating hours data to populate the form with.
     */
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

    /**
     * Loads settings from localStorage or uses defaults.
     */
    const loadSettings = () => {
        const savedSettings = localStorage.getItem('geofencingSettings');
        const settings = savedSettings ? JSON.parse(savedSettings) : defaultSettings;

        enabledToggle.checked = settings.isEnabled;
        populateHoursGrid(settings.operatingHours);
    };

    /**
     * Saves the current form settings to localStorage.
     */
    const saveSettings = () => {
        const newOperatingHours = {};
        daysOfWeek.forEach(day => {
            newOperatingHours[day] = {
                isOpen: document.getElementById(`is-open-${day}`).checked,
                start: document.getElementById(`start-time-${day}`).value,
                end: document.getElementById(`end-time-${day}`).value,
            };
        });

        const newSettings = {
            isEnabled: enabledToggle.checked,
            operatingHours: newOperatingHours,
        };

        localStorage.setItem('geofencingSettings', JSON.stringify(newSettings));

        // Show success toast (assuming global function exists from script.js)
        if (typeof showSuccessToast === 'function') {
            showSuccessToast('Geofencing settings saved successfully!');
        } else {
            alert('Settings saved!');
        }
    };

    // --- Event Listeners ---
    geofencingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings();
    });

    // --- Initialization ---
    loadSettings();
});