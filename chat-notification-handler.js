/**
 * Chat Notification Handler
 * 
 * This module listens for admin notifications about incoming chat messages
 * and displays them in real-time on the admin dashboard.
 * 
 * Features:
 * - Real-time listener on adminNotifications collection
 * - Filters for chat message notifications (type: "new_chat_message")
 * - Updates chat badge count
 * - Triggers visual/audio notifications
 * - Integrates with existing notification system
 */

class ChatNotificationHandler {
  constructor() {
    this.unsubscribeListener = null;
    this.notificationBadge = null;
    this.messageCount = 0;
  }

  /**
   * Initialize the chat notification handler
   * Should be called after Firebase is initialized
   */
  async init() {
    try {
      await window.firebaseInitPromise;
      
      const db = window.firebase.firestore();
      const auth = window.firebase.auth();

      // Wait for user to be logged in
      const currentUser = await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged(user => {
          unsubscribe();
          resolve(user);
        });
      });

      if (!currentUser) {
        console.log('❌ User not authenticated');
        return;
      }

      console.log('✅ ChatNotificationHandler initialized');
      
      // Set up real-time listener for admin notifications
      this.setupNotificationListener(db);
    } catch (error) {
      console.error('❌ Error initializing ChatNotificationHandler:', error);
    }
  }

  /**
   * Set up real-time listener for admin notifications
   * @param {Object} db - Firestore database instance
   */
  setupNotificationListener(db) {
    // Unsubscribe from previous listener if exists
    if (this.unsubscribeListener) {
      this.unsubscribeListener();
    }

    // Listen for unread chat message notifications
    this.unsubscribeListener = db
      .collection('adminNotifications')
      .where('notificationType', '==', 'new_chat_message')
      .where('isRead', '==', false)
      .onSnapshot(
        (snapshot) => {
          this.handleNotificationUpdate(snapshot);
        },
        (error) => {
          console.error('❌ Error listening to chat notifications:', error);
        }
      );

    console.log('📡 Chat notification listener started');
  }

  /**
   * Handle notification snapshot updates
   * @param {Object} snapshot - Firestore snapshot
   */
  handleNotificationUpdate(snapshot) {
    // Count total unread chat notifications
    this.messageCount = snapshot.docs.length;

    console.log(`💬 ${this.messageCount} unread chat message(s)`);

    // Update badge
    this.updateBadge();

    // Process each notification
    snapshot.docs.forEach((doc) => {
      const notification = doc.data();
      
      // Show toast notification for new messages
      if (notification.metadata?.chatRoomId) {
        this.showNotification(notification);
      }
    });
  }

  /**
   * Update the chat notification badge
   */
  updateBadge() {
    // Call global update function if available
    if (window.updateGlobalChatBadge) {
      window.updateGlobalChatBadge();
    }

    // Also update local badge if exists
    const badge = document.querySelector('.chat-badge');
    if (badge) {
      if (this.messageCount > 0) {
        badge.textContent = this.messageCount;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  /**
   * Show a notification for incoming message
   * @param {Object} notification - Notification data from Firestore
   */
  showNotification(notification) {
    const { title, message, metadata } = notification;
    
    // Play notification sound
    this.playNotificationSound();

    // Show browser notification if available
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(title, {
        body: message,
        icon: metadata?.customerProfilePic || './images/user-avatar.png',
        badge: './images/redicon.png',
        tag: `chat-${metadata?.chatRoomId}`,
        requireInteraction: false,
        silent: false
      });

      browserNotification.onclick = () => {
        window.focus();
        
        // Navigate to chats page
        if (!window.location.pathname.includes('chats.html')) {
          window.location.href = 'chats.html';
        }
        
        // Open the specific chat in the chat system
        if (window.openChatConversation) {
          window.openChatConversation(metadata.chatRoomId);
        }
        
        browserNotification.close();
      };
    }

    // Show in-app toast notification if service exists
    if (window.notificationService?.showNotification) {
      window.notificationService.showNotification(
        title,
        message,
        'info',
        () => {
          // When clicked, navigate to chat
          if (window.location.pathname.includes('chats.html')) {
            if (window.openChatConversation) {
              window.openChatConversation(metadata.chatRoomId);
            }
          } else {
            window.location.href = `chats.html?chatId=${metadata.chatRoomId}`;
          }
        }
      );
    }
  }

  /**
   * Play notification sound for incoming message
   */
  playNotificationSound() {
    try {
      // Create a pleasant notification sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioContext.currentTime;

      // Create a simple two-tone notification
      const frequencies = [800, 600]; // Two notes
      
      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        const startTime = now + (index * 0.15);
        const duration = 0.15;
        
        gainNode.gain.setValueAtTime(0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      });
    } catch (error) {
      console.log('⚠️ Could not play notification sound:', error);
    }
  }

  /**
   * Mark a chat notification as read in Firestore
   * @param {string} chatRoomId - The chat room ID
   */
  async markAsRead(chatRoomId) {
    try {
      const db = window.firebase.firestore();
      const notificationId = `new_chat_message_${chatRoomId}`;
      
      await db
        .collection('adminNotifications')
        .doc(notificationId)
        .update({
          isRead: true,
          readAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });

      console.log(`✅ Notification marked as read for chat ${chatRoomId}`);
      
      // Refresh badge
      this.updateBadge();
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  }

  /**
   * Request notification permission from user
   */
  static requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          console.log('✅ Notification permission granted');
        } else {
          console.log('⚠️ Notification permission denied');
        }
      });
    }
  }

  /**
   * Clean up - unsubscribe from listener
   */
  destroy() {
    if (this.unsubscribeListener) {
      this.unsubscribeListener();
      console.log('🛑 Chat notification listener stopped');
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Create global instance
  window.chatNotificationHandler = new ChatNotificationHandler();
  
  // Initialize
  await window.chatNotificationHandler.init();
  
  // Request notification permission on startup
  ChatNotificationHandler.requestNotificationPermission();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  window.chatNotificationHandler?.destroy();
});
