document.addEventListener('DOMContentLoaded', () => {
  // Encapsulate all notification logic in an IIFE to avoid global scope pollution
  (function() {
    // --- 1. State Management ---
    // The single source of truth for notification data
    const state = {
      notifications: window.appData.notifications || [],
    };

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
        const iconKey = item.type || item.title || 'default';
        const icon = iconMap[iconKey] || iconMap['default'];

        // Prefer title + message when available
        const titleHTML = item.title ? `<strong>${item.title}</strong>` : '';
        const messageHTML = item.message || item.body || '';

        return `
        <div class="notification-item ${item.isUnread ? 'unread' : ''}" data-id="${item.id}" data-link="${item.link || '#'}">
          <div class="notification-icon">
            <span class="material-symbols-outlined">${icon}</span>
          </div>
          <div class="notification-details">
            <p>${titleHTML} ${messageHTML}</p>
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
     * Adds a new notification, optionally persists to Firestore, triggers animation, and re-renders.
     * @param {object} newNotification - The new notification object to add.
     * @param {boolean} persist - Whether to persist in Firestore (if available). Defaults to true.
     */
    const addNewNotification = async (newNotification, persist = true) => {
      try {
        if (persist && window.firebase && window.firebase.firestore) {
          const db = window.firebase.firestore();
          const docRef = await db.collection('notifications').add({
            title: newNotification.title || newNotification.type || 'Notification',
            body: newNotification.message || newNotification.body || '',
            data: newNotification.data || {},
            link: newNotification.link || null,
            read: false,
            sentAt: db.FieldValue.serverTimestamp()
          });

          // Optimistically add it locally so the UI updates immediately
          state.notifications.unshift({
            id: docRef.id,
            title: newNotification.title || newNotification.type || 'Notification',
            message: newNotification.message || newNotification.body || '',
            timestamp: 'Just now',
            isUnread: true,
            link: newNotification.link || '#'
          });
        } else {
          state.notifications.unshift(newNotification);
        }
      } catch (err) {
        console.warn('Could not persist notification to Firestore:', err);
        state.notifications.unshift(newNotification);
      }

      render();

      // Trigger animation on the bell
      if (dom.notificationBell) {
        dom.notificationBell.classList.add('new-notification-animation');
        dom.notificationBell.addEventListener('animationend', () => {
          dom.notificationBell.classList.remove('new-notification-animation');
        }, { once: true });
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
      // Mark locally
      state.notifications.forEach(n => n.isUnread = false);
      render(); // Re-render to reflect changes

      // Persist to Firestore if available: mark all unread notifications as read
      try {
        if (window.firebase && window.firebase.firestore) {
          const db = window.firebase.firestore();
          state.notifications.forEach(n => {
            if (n.id) {
              db.collection('notifications').doc(n.id).update({ read: true }).catch(() => {});
            }
          });
        }
      } catch (err) {
        console.warn('Could not persist mark-all-read to Firestore', err);
      }
    };

    const handleClearAll = async () => {
      // Clear all notifications from Firestore and local state
      try {
        if (window.firebase && window.firebase.firestore) {
          const db = window.firebase.firestore();
          const batch = db.batch();

          // Get all notification documents
          const snapshot = await db.collection('notifications').get();

          // Add delete operations to batch
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });

          // Commit the batch delete
          await batch.commit();
          console.log(`Deleted ${snapshot.docs.length} notifications from Firestore`);
        }
      } catch (err) {
        console.warn('Could not delete notifications from Firestore:', err);
      }

      // Clear local state
      state.notifications = [];
      render();
    };

    const handleMarkOneRead = (e) => {
        const markButton = e.target.closest('.mark-as-read-btn');
        if (markButton) {
            const notificationItem = e.target.closest('.notification-item');
            const notificationId = notificationItem.dataset.id;
            const notification = state.notifications.find(n => n.id === notificationId);
            if (notification) {
          notification.isUnread = false;
          // Persist change to Firestore if available
          if (window.firebase && window.firebase.firestore) {
            try {
              const db = window.firebase.firestore();
              db.collection('notifications').doc(notificationId).update({ read: true }).catch(() => {});
            } catch (err) {
              console.warn('Could not mark notification read in Firestore', err);
            }
          }

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
          // Persist change to Firestore if available
          if (window.firebase && window.firebase.firestore) {
            try {
              const db = window.firebase.firestore();
              db.collection('notifications').doc(notificationId).update({ read: true }).catch(() => {});
            } catch (err) {
              console.warn('Could not mark notification read in Firestore', err);
            }
          }

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
    }
    // Use event delegation for dynamically created "mark as read" buttons
    // and for the notification item clicks.
    dom.dropdownContainer.addEventListener('click', (e) => { handleMarkOneRead(e); handleNotificationClick(e); });
    // Only add listener if the page container exists
    if (dom.pageContainer) dom.pageContainer.addEventListener('click', (e) => { handleMarkOneRead(e); handleNotificationClick(e); });

    // Global listener to close dropdowns when clicking outside
    window.addEventListener('click', handleCloseDropdowns);

    // --- 6. Firestore-backed Initialization ---
    const tryInitFirestoreListener = () => {
      try {
        if (window.firebase && window.firebase.firestore) {
          const db = window.firebase.firestore();

          db.collection('notifications')
            .orderBy('sentAt', 'desc')
            .limit(50)
            .onSnapshot(snapshot => {
              const docs = snapshot.docs.map(doc => {
                const d = doc.data() || {};
                return {
                  id: doc.id,
                  title: d.title || d.type || 'Notification',
                  message: d.body || d.message || '',
                  timestamp: d.sentAt && d.sentAt.toDate ? d.sentAt.toDate().toLocaleString() : (d.sentAt || 'Just now'),
                  isUnread: d.read === false || d.read === undefined,
                  link: d.data && d.data.action === 'view_appointment' ? 'appointment.html' : (d.link || '#')
                };
              });

              state.notifications = docs;
              render();
            }, err => {
              console.warn('Could not establish notifications listener:', err);
              render();
            });

          return true;
        }
      } catch (e) {
        console.warn('Firestore listener initialization failed', e);
      }
      return false;
    };

    const firestoreAvailable = tryInitFirestoreListener();
    if (!firestoreAvailable) render();


  })(); // End of IIFE
});