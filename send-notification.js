/**
 * Send Notification Admin Interface
 * Allows admins to send push notifications to mobile app users
 * Notifications are stored in Firestore and delivered to users' devices
 */

document.addEventListener('DOMContentLoaded', async () => {
  // State management
  const state = {
    notificationTarget: 'single',
    selectedUserId: null,
    selectedUserName: null,
    users: [],
    filteredUsers: [],
    recentNotifications: [],
    previewData: null
  };

  // DOM Elements
  const elements = {
    targetRadios: document.querySelectorAll('input[name="notification-target"]'),
    userSection: document.getElementById('single-user-section'),
    userSearch: document.getElementById('user-search'),
    userSelect: document.getElementById('user-select'),
    selectedUserInfo: document.getElementById('selected-user-info'),
    categorySelect: document.getElementById('notification-category'),
    titleInput: document.getElementById('notification-title'),
    messageInput: document.getElementById('notification-message'),
    imageInput: document.getElementById('notification-image'),
    imagePreview: document.getElementById('image-preview'),
    imagePreviewImg: document.getElementById('image-preview-img'),
    dataInput: document.getElementById('notification-data'),
    charCount: document.getElementById('char-count'),
    form: document.getElementById('send-notification-form'),
    sendBtn: document.getElementById('send-btn'),
    previewBtn: document.getElementById('preview-btn'),
    statusMessage: document.getElementById('status-message'),
    recentList: document.getElementById('recent-notifications-list'),
    modal: document.getElementById('preview-modal'),
    previewCloseBtn: document.getElementById('preview-close-btn'),
    previewCancelBtn: document.getElementById('preview-cancel-btn'),
    previewConfirmBtn: document.getElementById('preview-confirm-btn'),
    previewTitle: document.getElementById('preview-title'),
    previewMessage: document.getElementById('preview-message'),
    previewImage: document.getElementById('preview-image'),
    previewImageSection: document.getElementById('preview-image-section'),
    previewTimestamp: document.getElementById('preview-timestamp')
  };

  // ========== Initialize ==========
  await initializeApp();

  async function initializeApp() {
    try {
      // Wait for Firebase to be ready
      await window.firebaseInitPromise;
      
      // Load admin profile
      await loadAdminProfile();
      
      // Load users from Firestore
      await loadUsers();
      
      // Load recent notifications
      await loadRecentNotifications();
      
      // Setup event listeners
      setupEventListeners();
      
      // Validate form on input
      validateForm();
    } catch (error) {
      console.error('Error initializing app:', error);
      showStatus('Error initializing app. Please refresh the page.', 'error');
    }
  }

  async function loadAdminProfile() {
    try {
      const auth = window.firebase.auth();
      const user = await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
          unsubscribe();
          resolve(user);
        });
      });

      if (user) {
        const db = window.firebase.firestore();
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          const displayName = userData.fullName || userData.name || userData.displayName || user.email.split('@')[0];
          const headerName = document.getElementById('profile-header-name');
          if (headerName) {
            headerName.textContent = displayName;
          }
        }
      }
    } catch (error) {
      console.error('Error loading admin profile:', error);
    }
  }

  // ========== User Management ==========
  async function loadUsers() {
    try {
      // Wait for Firebase to initialize
      await window.firebaseInitPromise;
      
      const db = window.firebase.firestore();
      const auth = window.firebase.auth();

      // Ensure user is authenticated
      const user = await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
          unsubscribe();
          resolve(user);
        });
      });

      if (!user) {
        showStatus('Please log in to send notifications', 'error');
        return;
      }

      // Show loading state
      elements.userSelect.innerHTML = '<option value="">Loading users...</option>';
      
      const usersSnapshot = await db.collection('users').get();
      state.users = [];

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const userRole = userData.role || '';
        
        // Exclude admin accounts (only include customers/regular users)
        if (userRole !== 'admin') {
          state.users.push({
            id: doc.id,
            name: userData.fullName || userData.name || userData.displayName || 'Unknown',
            email: userData.email || '',
            phoneNumber: userData.phoneNumber || '',
            fcmTokens: userData.fcmTokens || [],
            role: userRole
          });
        }
      });

      // Sort by name
      state.users.sort((a, b) => a.name.localeCompare(b.name));
      populateUserSelect(state.users);

      console.log(`Loaded ${state.users.length} users (admins excluded)`);
    } catch (error) {
      console.error('Error loading users:', error);
      showStatus('Error loading users: ' + error.message, 'error');
      elements.userSelect.innerHTML = '<option value="">Error loading users</option>';
      throw error;
    }
  }

  function populateUserSelect(users) {
    elements.userSelect.innerHTML = '<option value="">-- Select a user --</option>';
    users.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = `${user.name} (${user.email})`;
      option.dataset.name = user.name;
      option.dataset.email = user.email;
      elements.userSelect.appendChild(option);
    });
  }

  // ========== Event Listeners ==========
  function setupEventListeners() {
    // Target radio buttons
    elements.targetRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        state.notificationTarget = e.target.value;
        updateUIForTarget();
        validateForm();
      });
    });

    // Optional settings toggle
    const optionalToggle = document.getElementById('optional-settings-toggle');
    const optionalContent = document.getElementById('optional-settings-content');
    const optionalIcon = document.getElementById('optional-settings-icon');
    
    if (optionalToggle && optionalContent && optionalIcon) {
      optionalToggle.addEventListener('click', () => {
        const isHidden = optionalContent.style.display === 'none';
        optionalContent.style.display = isHidden ? 'block' : 'none';
        optionalIcon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
      });
    }

    // User search
    elements.userSearch.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      state.filteredUsers = state.users.filter(user =>
        user.name.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm)
      );
      populateUserSelect(state.filteredUsers.length > 0 ? state.filteredUsers : state.users);
    });

    // User selection
    elements.userSelect.addEventListener('change', (e) => {
      state.selectedUserId = e.target.value;
      const selectedOption = e.target.selectedOptions[0];
      if (selectedOption.value) {
        state.selectedUserName = selectedOption.dataset.name;
        const email = selectedOption.dataset.email;
        elements.selectedUserInfo.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="material-symbols-outlined" style="font-size: 1.25rem; color: var(--color-primary);">check_circle</span>
            <div>
              <strong style="color: var(--color-dark);">${state.selectedUserName}</strong>
              <div style="font-size: 0.8rem; color: var(--color-info-dark); margin-top: 0.1rem;">${email}</div>
            </div>
          </div>
        `;
        elements.selectedUserInfo.style.display = 'block';
      } else {
        state.selectedUserName = null;
        elements.selectedUserInfo.textContent = '';
        elements.selectedUserInfo.style.display = 'none';
      }
      validateForm();
    });

    // Character count
    elements.messageInput.addEventListener('input', (e) => {
      elements.charCount.textContent = e.target.value.length;
      validateForm();
    });

    // Image preview
    elements.imageInput.addEventListener('input', (e) => {
      const url = e.target.value;
      if (url) {
        elements.imagePreviewImg.src = url;
        elements.imagePreview.style.display = 'block';
        elements.imagePreviewImg.onerror = () => {
          elements.imagePreview.style.display = 'none';
        };
      } else {
        elements.imagePreview.style.display = 'none';
      }
    });

    // Form validation
    elements.titleInput.addEventListener('input', validateForm);
    elements.messageInput.addEventListener('input', validateForm);
    elements.categorySelect.addEventListener('change', validateForm);

    // Form submission
    elements.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSendNotification();
    });

    // Preview button
    elements.previewBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showPreviewModal();
    });

    // Modal controls
    elements.previewCloseBtn.addEventListener('click', closePreviewModal);
    elements.previewCancelBtn.addEventListener('click', closePreviewModal);
    elements.previewConfirmBtn.addEventListener('click', async () => {
      closePreviewModal();
      await sendNotificationToFirestore();
    });
  }

  function updateUIForTarget() {
    if (state.notificationTarget === 'single') {
      elements.userSection.style.display = 'block';
    } else {
      elements.userSection.style.display = 'none';
      state.selectedUserId = null;
    }
  }

  // ========== Form Validation ==========
  function validateForm() {
    const title = elements.titleInput.value.trim();
    const message = elements.messageInput.value.trim();
    const category = elements.categorySelect.value;

    let isValid = title && message && category;

    if (state.notificationTarget === 'single') {
      isValid = isValid && state.selectedUserId;
    }

    elements.sendBtn.disabled = !isValid;
  }

  // ========== Preview Modal ==========
  function showPreviewModal() {
    const title = elements.titleInput.value.trim();
    const message = elements.messageInput.value.trim();
    const imageUrl = elements.imageInput.value.trim();
    const timestamp = new Date().toLocaleString();

    // Validate before showing preview
    if (!title || !message) {
      showStatus('Please enter a title and message first', 'warning');
      return;
    }

    // Store preview data for sending
    state.previewData = {
      title,
      message,
      imageUrl,
      category: elements.categorySelect.value,
      data: elements.dataInput.value.trim()
    };

    // Update modal content
    elements.previewTitle.textContent = title;
    elements.previewMessage.textContent = message;
    
    // Format timestamp
    const now = new Date();
    const formattedTime = now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    let recipientText = '';
    if (state.notificationTarget === 'single' && state.selectedUserName) {
      recipientText = ` • To: ${state.selectedUserName}`;
    } else if (state.notificationTarget === 'all') {
      recipientText = ` • To: All Users (${state.users.length})`;
    }
    
    elements.previewTimestamp.textContent = `Will be sent at: ${formattedTime}${recipientText}`;

    if (imageUrl) {
      elements.previewImage.src = imageUrl;
      elements.previewImageSection.style.display = 'block';
      // Handle image load error
      elements.previewImage.onerror = () => {
        elements.previewImageSection.style.display = 'none';
        console.warn('Failed to load preview image');
      };
    } else {
      elements.previewImageSection.style.display = 'none';
    }

    elements.modal.classList.remove('hidden');
  }

  function closePreviewModal() {
    elements.modal.classList.add('hidden');
  }

  // ========== Send Notification ==========
  async function handleSendNotification() {
    if (!validateNotificationData()) {
      return;
    }

    showStatus('Preparing notification...', 'info');
    await sendNotificationToFirestore();
  }

  function validateNotificationData() {
    const title = elements.titleInput.value.trim();
    const message = elements.messageInput.value.trim();
    const category = elements.categorySelect.value;

    if (!title || !message || !category) {
      showStatus('Please fill in all required fields', 'error');
      return false;
    }

    if (state.notificationTarget === 'single' && !state.selectedUserId) {
      showStatus('Please select a user', 'error');
      return false;
    }

    // Validate JSON data if provided
    if (elements.dataInput.value.trim()) {
      try {
        JSON.parse(elements.dataInput.value.trim());
      } catch (error) {
        showStatus('Invalid JSON in Additional Data field', 'error');
        return false;
      }
    }

    return true;
  }

  async function sendNotificationToFirestore() {
    try {
      const db = window.firebase.firestore();
      elements.sendBtn.disabled = true;
      showStatus('Sending notification...', 'info');

      const notificationPayload = {
        title: elements.titleInput.value.trim(),
        body: elements.messageInput.value.trim(),
        type: elements.categorySelect.value,
        imageUrl: elements.imageInput.value.trim() || null,
        data: {},
        timestamp: new Date(),
        sentBy: firebase.auth().currentUser.email,
        sentByName: document.getElementById('profile-header-name').textContent,
        isRead: false
      };

      // Parse additional data if provided
      if (elements.dataInput.value.trim()) {
        try {
          notificationPayload.data = JSON.parse(elements.dataInput.value.trim());
        } catch (e) {
          console.warn('Could not parse additional data, skipping');
        }
      }

      let targetUserIds = [];

      if (state.notificationTarget === 'single') {
        targetUserIds = [state.selectedUserId];
      } else if (state.notificationTarget === 'multiple') {
        // In future, implement multi-select
        showStatus('Multiple user selection not yet implemented', 'warning');
        elements.sendBtn.disabled = false;
        return;
      } else if (state.notificationTarget === 'all') {
        targetUserIds = state.users.map(u => u.id);
      }

      // Send to each user
      let successCount = 0;
      let failureCount = 0;
      const results = [];
      const batch = db.batch();

      // Create a record in admin_notifications
      const adminNotifRef = db.collection('admin_notifications').doc();
      batch.set(adminNotifRef, {
        ...notificationPayload,
        targetType: state.notificationTarget,
        targetUserIds: targetUserIds,
        targetCount: targetUserIds.length
      });

      for (const userId of targetUserIds) {
        try {
          // Store notification in Firestore under user's notifications collection
          const userNotifRef = db
            .collection('users')
            .doc(userId)
            .collection('notifications')
            .doc();
          
          batch.set(userNotifRef, {
            ...notificationPayload,
            userId: userId
          });

          // Try to send push notification via Cloud Function (optional, won't fail the batch)
          sendPushNotification(userId, notificationPayload).catch(err => {
            console.warn(`Push notification failed for user ${userId}:`, err);
          });

          results.push({
            userId,
            success: true
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to prepare notification for user ${userId}:`, error);
          results.push({
            userId,
            success: false,
            error: error.message
          });
          failureCount++;
        }
      }

      // Commit the batch
      try {
        await batch.commit();
        console.log('Batch write successful');
      } catch (error) {
        console.error('Batch write failed:', error);
        throw new Error('Failed to save notifications to database');
      }

      // Show results
      if (successCount > 0) {
        showStatus(
          `✅ Notification sent to ${successCount} user(s)${failureCount > 0 ? ` (${failureCount} failed)` : ''}`,
          'success'
        );
        resetForm();
        await loadRecentNotifications();
      } else {
        showStatus(`❌ Failed to send notifications: ${failureCount} user(s)`, 'error');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      showStatus(`Error: ${error.message}`, 'error');
    } finally {
      elements.sendBtn.disabled = false;
    }
  }

  async function sendPushNotification(userId, notificationPayload) {
    try {
      // Check if user has FCM tokens first
      const db = window.firebase.firestore();
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        console.warn(`User ${userId} not found`);
        return;
      }

      const userData = userDoc.data();
      const fcmTokens = userData.fcmTokens || [];

      if (fcmTokens.length === 0) {
        console.warn(`User ${userId} has no FCM tokens registered`);
        return;
      }

      // Try to send via Cloud Function
      const response = await fetch(
        'https://us-central1-kingsleycarwashapp.cloudfunctions.net/sendNotificationToUser',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            title: notificationPayload.title,
            body: notificationPayload.body,
            data: notificationPayload.data,
            imageUrl: notificationPayload.imageUrl
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.warn(`Push notification to ${userId} failed:`, error);
        // Don't throw - notification is still stored in Firestore
      } else {
        console.log(`Push notification sent successfully to ${userId}`);
      }
    } catch (error) {
      console.warn(`Could not send push notification to ${userId}:`, error);
      // Don't throw - notification is still stored in Firestore
    }
  }

  // ========== Recent Notifications ==========
  async function loadRecentNotifications() {
    try {
      const db = window.firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      if (!currentUser) return;

      // Load recent notifications from admin_notifications collection
      const snapshot = await db
        .collection('admin_notifications')
        .where('sentBy', '==', currentUser.email)
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

      state.recentNotifications = [];
      snapshot.forEach(doc => {
        state.recentNotifications.push({
          id: doc.id,
          ...doc.data()
        });
      });

      renderRecentNotifications();
    } catch (error) {
      console.error('Error loading recent notifications:', error);
      elements.recentList.innerHTML = '<p class="placeholder-text">Error loading recent notifications</p>';
    }
  }

  function renderRecentNotifications() {
    if (state.recentNotifications.length === 0) {
      elements.recentList.innerHTML = '<p class="placeholder-text">No notifications sent yet</p>';
      return;
    }

    elements.recentList.innerHTML = state.recentNotifications.map(notif => `
      <div class="notification-item recent-item">
        <div class="notification-icon">
          <span class="material-symbols-outlined">notifications</span>
        </div>
        <div class="notification-details">
          <p class="notification-title">${notif.title}</p>
          <p class="notification-body">${notif.body}</p>
          <small class="text-muted">${formatTimestamp(notif.timestamp)} • To: ${notif.userId}</small>
        </div>
      </div>
    `).join('');
  }

  // ========== Utilities ==========
  function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function showStatus(message, type = 'info') {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message ${type}`;
    elements.statusMessage.classList.remove('hidden');

    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        elements.statusMessage.classList.add('hidden');
      }, 5000);
    }
  }

  function resetForm() {
    elements.form.reset();
    elements.titleInput.value = '';
    elements.messageInput.value = '';
    elements.messageInput.focus();
    elements.imagePreview.style.display = 'none';
    elements.charCount.textContent = '0';
    elements.selectedUserInfo.textContent = '';
    state.selectedUserId = null;
    state.selectedUserName = null;
    validateForm();
  }

  // Mobile menu toggle
  const menuBtn = document.getElementById('menu-btn');
  const closeBtn = document.getElementById('close-btn');
  const sidebar = document.querySelector('aside');

  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      sidebar.style.display = 'flex';
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      sidebar.style.display = 'none';
    });
  }
});
