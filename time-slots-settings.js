// time-slots-settings.js
// Manages configurable time slots stored in Firebase
document.addEventListener('DOMContentLoaded', async () => {
  console.log('time-slots-settings.js loaded');

  // Wait for Firebase to initialize
  await window.firebaseInitPromise;
  const db = window.firebase.firestore();
  const auth = window.firebase.auth();

  // DOM Elements
  const timeSlotsListEl = document.getElementById('time-slots-list');
  const addSlotBtn = document.getElementById('add-slot-btn');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const timeSlotForm = document.getElementById('time-slot-form');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const totalSlotsCount = document.getElementById('total-slots-count');
  const activeSlotsCount = document.getElementById('active-slots-count');
  const lastUpdatedEl = document.getElementById('last-updated');
  
  // Form inputs
  const slotStartTime = document.getElementById('slot-start-time');
  const slotEndTime = document.getElementById('slot-end-time');
  const slotIsActive = document.getElementById('slot-is-active');

  // State
  let timeSlots = [];
  let editingSlotId = null;

  // --- Helper Functions ---
  
  /**
   * Convert 24-hour time to 12-hour format with AM/PM
   */
  const formatTime12Hour = (time24) => {
    const [hours, minutes] = time24.split(':');
    let hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minutes} ${ampm}`;
  };

  /**
   * Convert 12-hour time with AM/PM to 24-hour format
   */
  const formatTime24Hour = (time12) => {
    const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return '00:00';
    
    let hour = parseInt(match[1]);
    const minute = match[2];
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  };

  /**
   * Show success toast notification
   */
  const showToast = (message, type = 'success') => {
    if (typeof showSuccessToast === 'function') {
      showSuccessToast(message, type);
    } else {
      alert(message);
    }
  };

  // --- Modal Functions ---

  const openModal = (title = 'Add Time Slot') => {
    modalTitle.textContent = title;
    modalOverlay.classList.add('show');
    document.body.classList.add('modal-open');
  };

  const closeModal = () => {
    modalOverlay.classList.remove('show');
    document.body.classList.remove('modal-open');
    timeSlotForm.reset();
    slotIsActive.checked = true;
    editingSlotId = null;
  };

  // --- Firestore Operations ---

  /**
   * Load time slots from Firestore
   */
  const loadTimeSlots = async () => {
    try {
      const loader = timeSlotsListEl.querySelector('.table-loader');
      if (loader) loader.classList.add('loading');

      const doc = await db.collection('time_slots_config').doc('slots').get();
      
      if (doc.exists) {
        const data = doc.data();
        timeSlots = data.slots || [];
        
        // Update last updated timestamp
        if (data.updatedAt) {
          const date = new Date(data.updatedAt);
          lastUpdatedEl.textContent = date.toLocaleString();
        }
      } else {
        // Initialize with default slots if none exist
        timeSlots = getDefaultSlots();
        await saveTimeSlots();
      }

      renderTimeSlots();
      updateStats();

      if (loader) loader.classList.remove('loading');
    } catch (error) {
      console.error('Error loading time slots:', error);
      showToast('Failed to load time slots', 'error');
      if (loader) loader.classList.remove('loading');
    }
  };

  /**
   * Save time slots to Firestore
   */
  const saveTimeSlots = async () => {
    try {
      await db.collection('time_slots_config').doc('slots').set({
        slots: timeSlots,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.email || 'admin'
      });
      
      // Also update lastUpdatedEl
      lastUpdatedEl.textContent = new Date().toLocaleString();
      
      console.log('✅ Time slots saved successfully');
    } catch (error) {
      console.error('❌ Error saving time slots:', error);
      throw error;
    }
  };

  /**
   * Get default time slots
   */
  const getDefaultSlots = () => {
    return [
      { id: generateId(), start: "8:20 AM", end: "9:20 AM", isActive: true },
      { id: generateId(), start: "9:20 AM", end: "10:20 AM", isActive: true },
      { id: generateId(), start: "10:20 AM", end: "11:20 AM", isActive: true },
      { id: generateId(), start: "11:20 AM", end: "12:10 PM", isActive: true },
      { id: generateId(), start: "12:10 PM", end: "1:00 PM", isActive: true },
      { id: generateId(), start: "1:20 PM", end: "2:20 PM", isActive: true },
      { id: generateId(), start: "2:20 PM", end: "3:20 PM", isActive: true },
      { id: generateId(), start: "3:50 PM", end: "4:50 PM", isActive: true },
      { id: generateId(), start: "4:50 PM", end: "5:50 PM", isActive: true },
      { id: generateId(), start: "5:50 PM", end: "6:50 PM", isActive: true },
      { id: generateId(), start: "6:50 PM", end: "7:50 PM", isActive: true },
      { id: generateId(), start: "7:50 PM", end: "8:50 PM", isActive: true }
    ];
  };

  /**
   * Generate unique ID
   */
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  // --- Render Functions ---

  /**
   * Render time slots list
   */
  const renderTimeSlots = () => {
    if (timeSlots.length === 0) {
      timeSlotsListEl.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--color-info);">
          <p>No time slots configured. Click "Add Time Slot" to create your first slot.</p>
        </div>
      `;
      return;
    }

    // Sort slots by start time
    const sortedSlots = [...timeSlots].sort((a, b) => {
      const timeA = formatTime24Hour(a.start);
      const timeB = formatTime24Hour(b.start);
      return timeA.localeCompare(timeB);
    });

    const html = sortedSlots.map(slot => `
      <div class="time-slot-item ${slot.isActive ? '' : 'inactive'}" data-id="${slot.id}">
        <div class="slot-time-display">
          <span class="material-symbols-outlined">${slot.isActive ? 'schedule' : 'schedule_disabled'}</span>
          <div class="slot-times">
            <strong>${slot.start} - ${slot.end}</strong>
            <small>${slot.isActive ? 'Available' : 'Unavailable'}</small>
          </div>
        </div>
        <div class="slot-actions">
          <div class="toggle-switch-wrapper">
            <div class="toggle-switch ${slot.isActive ? 'active' : ''}" 
                 data-slot-id="${slot.id}"
                 data-action="toggle"
                 title="Toggle availability">
            </div>
            <span class="toggle-label">${slot.isActive ? 'ON' : 'OFF'}</span>
          </div>
          <div class="action-buttons-group">
            <button class="action-icon-btn edit-slot-btn" title="Edit Slot">
              <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="action-icon-btn delete-slot-btn delete-btn" title="Delete Slot">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    timeSlotsListEl.innerHTML = html;

    // Attach event listeners
    attachSlotEventListeners();
  };

  /**
   * Update statistics
   */
  const updateStats = () => {
    totalSlotsCount.textContent = timeSlots.length;
    activeSlotsCount.textContent = timeSlots.filter(s => s.isActive).length;
  };

  /**
   * Attach event listeners to slot items
   */
  const attachSlotEventListeners = () => {
    // ON/OFF toggle buttons
    document.querySelectorAll('[data-action="toggle"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const slotId = btn.dataset.slotId;
        await toggleSlot(slotId);
      });
    });

    // Edit buttons
    document.querySelectorAll('.edit-slot-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const slotItem = e.target.closest('.time-slot-item');
        const slotId = slotItem.dataset.id;
        editSlot(slotId);
      });
    });

    // Delete buttons
    document.querySelectorAll('.delete-slot-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const slotItem = e.target.closest('.time-slot-item');
        const slotId = slotItem.dataset.id;
        await deleteSlot(slotId);
      });
    });
  };

  // --- CRUD Operations ---

  /**
   * Edit a time slot
   */
  const editSlot = (slotId) => {
    const slot = timeSlots.find(s => s.id === slotId);
    if (!slot) return;

    editingSlotId = slotId;
    slotStartTime.value = formatTime24Hour(slot.start);
    slotEndTime.value = formatTime24Hour(slot.end);
    slotIsActive.checked = slot.isActive;

    openModal('Edit Time Slot');
  };

  /**
   * Toggle slot active status
   */
  const toggleSlot = async (slotId) => {
    const slot = timeSlots.find(s => s.id === slotId);
    if (!slot) return;

    slot.isActive = !slot.isActive;

    try {
      await saveTimeSlots();
      renderTimeSlots();
      updateStats();
      showToast(`Time slot ${slot.isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      showToast('Failed to update slot', 'error');
      // Revert change
      slot.isActive = !slot.isActive;
    }
  };

  /**
   * Delete a time slot
   */
  const deleteSlot = async (slotId) => {
    const slot = timeSlots.find(s => s.id === slotId);
    if (!slot) return;

    const confirmed = confirm(`Delete time slot ${slot.start} - ${slot.end}?`);
    if (!confirmed) return;

    const index = timeSlots.findIndex(s => s.id === slotId);
    if (index === -1) return;

    timeSlots.splice(index, 1);

    try {
      await saveTimeSlots();
      renderTimeSlots();
      updateStats();
      showToast('Time slot deleted');
    } catch (error) {
      showToast('Failed to delete slot', 'error');
      // Could revert here if needed
    }
  };

  // --- Event Handlers ---

  addSlotBtn.addEventListener('click', () => {
    openModal('Add Time Slot');
  });

  closeModalBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  timeSlotForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const startTime = slotStartTime.value;
    const endTime = slotEndTime.value;
    const isActive = slotIsActive.checked;

    // Validate times
    if (!startTime || !endTime) {
      showToast('Please enter both start and end times', 'error');
      return;
    }

    if (startTime >= endTime) {
      showToast('End time must be after start time', 'error');
      return;
    }

    const start12 = formatTime12Hour(startTime);
    const end12 = formatTime12Hour(endTime);

    if (editingSlotId) {
      // Update existing slot
      const slot = timeSlots.find(s => s.id === editingSlotId);
      if (slot) {
        slot.start = start12;
        slot.end = end12;
        slot.isActive = isActive;
      }
    } else {
      // Add new slot
      timeSlots.push({
        id: generateId(),
        start: start12,
        end: end12,
        isActive: isActive
      });
    }

    try {
      await saveTimeSlots();
      renderTimeSlots();
      updateStats();
      closeModal();
      showToast(editingSlotId ? 'Time slot updated' : 'Time slot added');
    } catch (error) {
      showToast('Failed to save time slot', 'error');
    }
  });

  // --- Initialize ---
  loadTimeSlots();
});
