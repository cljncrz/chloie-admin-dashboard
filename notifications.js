document.addEventListener('DOMContentLoaded', () => {
  // Encapsulate all notification logic in an IIFE to avoid global scope pollution
  (function() {
    // --- 1. State Management ---
    // The single source of truth for notification data
    const state = {
      notifications: window.appData.notifications || [],
      lastClearedNotifications: [], // For the "Undo" functionality
    };
    let undoTimeout = null; // To manage the undo toast timeout

    // --- 2. DOM Element References ---
    // Query all necessary elements once and store them for efficiency.
    const dom = {
      notificationBell: document.querySelector('.notification-bell'),
      notificationDropdown: document.querySelector('.notification-dropdown'),
      dropdownContainer: document.querySelector('.notification-list-dropdown'),
      pageContainer: document.getElementById('notification-list-page'),
      countBadge: document.querySelector('.notification-bell .message-count'),
      markAllReadBtn: document.getElementById('mark-all-read-btn'),
      clearAllBtn: document.getElementById('clear-all-btn'),
      // Confirmation Modal Elements
      clearAllConfirmOverlay: document.getElementById('clear-all-confirm-overlay'),
      clearAllConfirmBtn: document.getElementById('clear-all-confirm-btn'),
      clearAllCancelBtn: document.getElementById('clear-all-cancel-btn'),
      clearAllConfirmCloseBtn: document.getElementById('clear-all-confirm-close-btn'),
      // Undo Toast Elements
      undoToast: document.getElementById('undo-toast'),
      undoClearBtn: document.getElementById('undo-clear-btn'),
      viewAllLink: document.querySelector('.notification-footer'),
      mainHeaderTitle: document.querySelector('.main-header h1'),
      pages: document.querySelectorAll('.page'),
      sidebarLinks: document.querySelectorAll('.sidebar-menu a')
    };

    // Exit if essential elements are not found. Quietly skip initialization
    // on pages that don't include a notification UI to avoid noisy console warnings.
    if (!dom.notificationBell || !dom.dropdownContainer) {
      return;
    }

    // --- 3. Core Functions ---

    /**
     * Generates the HTML for a single notification item.
     * @param {object} item - The notification object.
     * @returns {string} - The HTML string for the notification item.
     */
    const generateItemHTML = (item) => {
      const iconMap = {
        'New Booking': 'book_online',
        'Service Completed': 'check_circle',
        'New Review': 'reviews',
        'Payment Received': 'payments',
        'Cancellation': 'cancel',
        'default': 'notifications'
      };
      const icon = iconMap[item.type] || iconMap['default'];

      return `
        <div class="notification-item ${item.isUnread ? 'unread' : ''}" data-id="${item.id}" data-link="${item.link || '#'}">
            <div class="notification-icon">
                <span class="material-symbols-outlined">${icon}</span>
            </div>
            <div class="notification-details">
                <p>${item.message}</p>
                <small class="text-muted">${item.timestamp}</small>
            </div>
            <div class="notification-item-actions">
                ${item.isUnread ? 
                `<button class="action-icon-btn mark-as-read-btn" title="Mark as read">
                    <span class="material-symbols-outlined">drafts</span>
                </button>` : ''}
            </div>
        </div>
      `;
    };

    /**
     * Renders all notification components based on the current state.
     */
    const render = () => {
      const notifications = state.notifications;
      const unreadCount = notifications.filter(n => n.isUnread).length;

      // Update unread count badge
      dom.countBadge.textContent = unreadCount;
      dom.countBadge.style.display = unreadCount > 0 ? 'flex' : 'none';

      // Populate Dropdown (latest 5)
      const recentNotifications = notifications.slice(0, 5);
      if (recentNotifications.length > 0) {
        dom.dropdownContainer.innerHTML = recentNotifications.map(generateItemHTML).join('');
      } else {
        dom.dropdownContainer.innerHTML = '<p style="padding: 1rem; text-align: center; color: var(--color-info-dark);">No new notifications.</p>';
      }

      // Populate Full Page
      if (dom.pageContainer) { // Only run if on the notifications page
        if (notifications.length > 0) {
          dom.pageContainer.innerHTML = notifications.map(generateItemHTML).join('');
        } else {
          dom.pageContainer.innerHTML = '<p class="text-muted" style="padding: 2rem; text-align: center;">No notifications found.</p>';
        }
      }
    };

    /**
     * Adds a new notification, triggers animation, and re-renders.
     * @param {object} newNotification - The new notification object to add.
     */
    const addNewNotification = (newNotification) => {
        // Add to the beginning of the array
        state.notifications.unshift(newNotification);
        
        // Re-render all components
        render();

        // Trigger animation on the bell
        if (dom.notificationBell) {
            dom.notificationBell.classList.add('new-notification-animation');
            // Remove the class after the animation completes to allow re-triggering
            dom.notificationBell.addEventListener('animationend', () => {
                dom.notificationBell.classList.remove('new-notification-animation');
            }, { once: true }); // The listener will be removed after it runs once
        }
    };

    // Expose the function globally so other scripts can add notifications
    window.addNewNotification = addNewNotification;
    // --- 4. Event Handlers ---

    const handleToggleDropdown = (e) => {
      e.stopPropagation();
      const profileDropdown = document.querySelector('.profile-dropdown');
      if (profileDropdown) profileDropdown.classList.remove('show');
      dom.notificationDropdown.classList.toggle('show');
    };

    const handleMarkAllRead = () => {
      state.notifications.forEach(n => n.isUnread = false);
      render(); // Re-render to reflect changes
    };

    const handleClearAll = () => {
      // Open the confirmation modal instead of clearing directly
      if (dom.clearAllConfirmOverlay) {
        dom.clearAllConfirmOverlay.classList.add('show');
        document.body.classList.add('modal-open');
      }
    };

    const closeClearAllModal = () => {
      if (dom.clearAllConfirmOverlay) {
        dom.clearAllConfirmOverlay.classList.remove('show');
        document.body.classList.remove('modal-open');
      }
    };

    const showUndoToast = () => {
      if (!dom.undoToast) return;

      // Clear any existing timeout to prevent premature clearing of data
      if (undoTimeout) clearTimeout(undoTimeout);

      dom.undoToast.classList.add('show');

      // After 5 seconds, hide the toast and permanently clear the backup
      undoTimeout = setTimeout(() => {
        hideUndoToast();
        state.lastClearedNotifications = []; // Final clear
      }, 5000);
    };

    const hideUndoToast = () => {
      if (dom.undoToast) dom.undoToast.classList.remove('show');
      if (undoTimeout) {
        clearTimeout(undoTimeout);
        undoTimeout = null;
      }
    };

    const handleMarkOneRead = (e) => {
        const markButton = e.target.closest('.mark-as-read-btn');
        if (markButton) {
            const notificationItem = e.target.closest('.notification-item');
            const notificationId = notificationItem.dataset.id;
            const notification = state.notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.isUnread = false;
                render(); // Re-render to reflect the change
            }
        }
    };

    const handleNotificationClick = (e) => {
        const item = e.target.closest('.notification-item');
        // Ensure the click is on the item itself, not on an action button inside it
        if (item && !e.target.closest('.notification-item-actions')) {
            const notificationId = item.dataset.id;
            const notification = state.notifications.find(n => n.id === notificationId);

            // Mark as read if it's currently unread
            if (notification && notification.isUnread) {
                notification.isUnread = false;
                render(); // Re-render to reflect the change immediately
            }

            const link = item.dataset.link;
            if (link && link !== '#') {
                // If the link is for a page on the current SPA (index.html)
                if (link.startsWith('#')) {
                    document.querySelector(`.sidebar-menu a[href="${link}"]`)?.click();
                } else {
                    window.location.href = link;
                }
            }
        }
    };

    const handleViewAllClick = (e) => {
      // This function is now simplified. The link will navigate directly.
      // We just need to close the dropdown.
      handleCloseDropdowns();
    };
    const handleCloseDropdowns = () => {
      if (dom.notificationDropdown.classList.contains('show')) {
        dom.notificationDropdown.classList.remove('show');
      }
    };

    // --- 5. Event Listeners Registration ---

    dom.notificationBell.addEventListener('click', handleToggleDropdown);
    dom.notificationDropdown.addEventListener('click', (e) => e.stopPropagation());
    if (dom.viewAllLink) dom.viewAllLink.addEventListener('click', handleViewAllClick);

    // Only add these listeners if the buttons exist (i.e., on notifications.html)
    if (dom.markAllReadBtn) dom.markAllReadBtn.addEventListener('click', handleMarkAllRead);
    if (dom.clearAllBtn) {
      dom.clearAllBtn.addEventListener('click', handleClearAll);

      // Add listeners for the new confirmation modal
      dom.clearAllConfirmBtn.addEventListener('click', () => {
        // 1. Back up the current notifications
        state.lastClearedNotifications = [...state.notifications];
        // 2. Clear the main notifications array
        state.notifications = [];
        // 3. Re-render the empty state
        render();
        // 4. Close the modal and show the undo toast
        closeClearAllModal();
        showUndoToast();
      });
      dom.clearAllCancelBtn.addEventListener('click', closeClearAllModal);
      dom.clearAllConfirmCloseBtn.addEventListener('click', closeClearAllModal);
      dom.clearAllConfirmOverlay.addEventListener('click', (e) => {
        if (e.target === dom.clearAllConfirmOverlay) closeClearAllModal();
      });
    }

    // Add listener for the "Undo" button
    if (dom.undoClearBtn) {
      dom.undoClearBtn.addEventListener('click', () => {
        // Restore notifications from the backup
        state.notifications = [...state.lastClearedNotifications];
        state.lastClearedNotifications = [];
        render(); // Re-render with the restored notifications
        hideUndoToast(); // Hide the toast immediately
      });
    }
    // Use event delegation for dynamically created "mark as read" buttons
    // and for the notification item clicks.
    dom.dropdownContainer.addEventListener('click', (e) => { handleMarkOneRead(e); handleNotificationClick(e); });
    // Only add listener if the page container exists
    if (dom.pageContainer) dom.pageContainer.addEventListener('click', (e) => { handleMarkOneRead(e); handleNotificationClick(e); });

    // Global listener to close dropdowns when clicking outside
    window.addEventListener('click', handleCloseDropdowns);

    // --- 6. Initialization ---
    render();

    // --- 7. Demo: Simulate a new notification after 5 seconds ---
    setTimeout(() => {
        const newDemoNotification = {
            id: `notif-${Date.now()}`,
            type: 'New Booking',
            message: '<b>Juan Dela Cruz</b> just booked a <b>Full Package Detailing</b>.',
            timestamp: 'Just now',
            isUnread: true,
            link: 'appointment.html'
        };
        // This function can be called from anywhere (e.g., a Firebase listener)
        // to add a new notification in real-time.
        addNewNotification(newDemoNotification);
    }, 5000); // 5-second delay


  })(); // End of IIFE
});