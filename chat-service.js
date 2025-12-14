/**
 * Chat Service Module
 * 
 * Handles all chat-related operations with Firestore:
 * - Real-time conversation listeners
 * - Message management
 * - User data fetching
 * - File uploads (when implemented)
 * 
 * This service abstracts Firebase operations from the UI logic.
 */

class ChatService {
  constructor() {
    this.db = null;
    this.auth = null;
    this.unsubscribers = new Map(); // Store unsubscribe functions keyed by conversation ID
  }

  /**
   * Initialize the chat service with Firebase instances
   * @param {Object} firebase - Firebase instance
   */
  async initialize(firebase) {
    this.db = firebase.firestore();
    this.auth = firebase.auth();
    return this;
  }

  /**
   * Format a Firestore timestamp to a readable string
   * @param {Object} timestamp - Firestore timestamp
   * @returns {string} Formatted time string
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  /**
   * Format file size in bytes to readable string
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get current admin user data
   * @returns {Promise<Object>} Admin data object
   */
  async getCurrentAdmin() {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) return null;

      const adminDoc = await this.db.collection('admins').doc(currentUser.uid).get();
      if (adminDoc.exists) {
        return {
          uid: currentUser.uid,
          name: adminDoc.data().name || currentUser.displayName || 'Admin',
          email: adminDoc.data().email || currentUser.email || '',
          profilePic: adminDoc.data().profilePic || './images/redicon.png',
          role: adminDoc.data().role || 'Admin'
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching admin data:', error);
      return null;
    }
  }

  /**
   * Listen to chat rooms list in real-time
   * @param {Function} onUpdate - Callback function with chats array
   * @returns {Function} Unsubscribe function
   */
  listenToConversations(onUpdate) {
    if (!this.db) throw new Error('ChatService not initialized');

    return this.db.collection('chat_rooms')
      .onSnapshot(
        (snapshot) => {
          const chats = [];
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            // Fallbacks for mobile payloads
            const lastMsg = data.lastMessage || data.lastMessageText || data.last_message || '';
            const lastMsgTime = data.lastMessageTime || data.last_message_time || data.lastMessageTimestamp || data.createdAt || null;
            const userName = data.userName || data.customerName || data.name || 'Unknown User';
            const userEmail = data.userEmail || data.email || '';
            const profilePic = data.profilePic || data.customerProfilePic || data.photoURL || './images/redicon.png';
            chats.push({
              id: doc.id,
              userName,
              userEmail,
              userId: data.userId || doc.id,
              profilePic,
              isVerified: data.isVerified || false,
              lastMessage: lastMsg || 'No messages yet',
              lastMessageTime: lastMsgTime ? this.formatTimestamp(lastMsgTime) : '',
              lastMessageSenderId: data.lastMessageSenderId || '',
              lastMessageSenderRole: data.lastMessageSenderRole || data.last_message_sender_role || 'customer',
              unreadCount: data.unreadCount || 0,
              createdAt: data.createdAt ? this.formatTimestamp(data.createdAt) : '',
              rawLastMessageTime: lastMsgTime || data.createdAt // Fallback to createdAt if no lastMessageTime
            });
          });
          
          // Sort by most recent (either lastMessageTime or createdAt)
          chats.sort((a, b) => {
            const getTime = (t) => {
              if (!t) return 0;
              if (t.toDate) return t.toDate().getTime();
              if (t.seconds) return t.seconds * 1000; // Firestore Timestamp-like object
              if (typeof t === 'number') return t;
              const d = new Date(t);
              return isNaN(d.getTime()) ? 0 : d.getTime();
            };
            return getTime(b.rawLastMessageTime) - getTime(a.rawLastMessageTime);
          });
          
          onUpdate(chats);
        },
        (error) => {
          console.error('Error listening to conversations:', error);
          onUpdate([]);
        }
      );
  }

  /**
   * Listen to messages in a conversation
   * @param {string} conversationId - Chat room ID
   * @param {Function} onUpdate - Callback with messages array
   * @returns {Function} Unsubscribe function
   */
  listenToMessages(conversationId, onUpdate) {
    if (!this.db) throw new Error('ChatService not initialized');

    // Unsubscribe from previous listener if exists
    if (this.unsubscribers.has(conversationId)) {
      this.unsubscribers.get(conversationId)();
    }

    const unsubscribe = this.db.collection('chat_rooms')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .onSnapshot(
        (snapshot) => {
          const messages = [];
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            const isAdmin = data.isAdmin || data.senderRole === 'admin';
            // Fallbacks for mobile payloads
            const text = data.text || data.message || data.body || '';
            const type = data.type || (data.mediaUrl ? 'image' : 'text');
            const ts = data.timestamp || data.createdAt || data.sentAt || data.time || null;
            const senderRole = data.senderRole || (isAdmin ? 'admin' : (data.role || 'customer'));
            messages.push({
              id: doc.id,
              senderId: data.senderId || '',
              senderName: data.senderName || data.name || 'Unknown',
              senderRole,
              senderProfilePic: data.senderProfilePic || data.profilePic || './images/redicon.png',
              type, // 'text', 'image', 'video', 'file'
              text,
              mediaUrl: data.mediaUrl || data.url || '',
              fileName: data.fileName || '',
              fileSize: data.fileSize || 0,
              timestamp: ts ? this.formatTimestamp(ts) : '',
              rawTimestamp: ts,
              status: data.status || 'sent', // 'sent', 'delivered', 'read'
              isAdmin: isAdmin
            });
          });
          onUpdate(messages);
        },
        (error) => {
          console.error('Error listening to messages:', error);
          onUpdate([]);
        }
      );

    // Store unsubscriber
    this.unsubscribers.set(conversationId, unsubscribe);
    return unsubscribe;
  }

  /**
   * Send a text message to a conversation
   * @param {string} conversationId - Chat room ID
   * @param {string} messageText - Message content
   * @param {Object} adminData - Current admin data
   * @returns {Promise<Object>} Message data object
   */
  async sendMessage(conversationId, messageText, adminData) {
    if (!this.db || !this.auth.currentUser) {
      throw new Error('Not authenticated or service not initialized');
    }

    const adminId = this.auth.currentUser.uid;
    
    const newMessage = {
      senderId: adminId,
      senderName: adminData?.name || 'Admin',
      senderEmail: adminData?.email || '',
      senderProfilePic: adminData?.profilePic || './images/redicon.png',
      senderRole: 'admin',
      type: 'text',
      text: messageText,
      timestamp: this.db.FieldValue.serverTimestamp(),
      status: 'sent',
      isAdmin: true
    };

    try {
      // Add message to messages subcollection
      const messageRef = await this.db.collection('chat_rooms')
        .doc(conversationId)
        .collection('messages')
        .add(newMessage);

      // Update chat room's last message info
      await this.db.collection('chat_rooms')
        .doc(conversationId)
        .update({
          lastMessage: messageText,
          lastMessageSenderId: adminId,
          lastMessageSenderRole: 'admin',
          lastMessageTime: this.db.FieldValue.serverTimestamp()
        });

      return {
        id: messageRef.id,
        ...newMessage
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Create a new chat room with a customer
   * @param {Object} userData - Customer user data
   * @returns {Promise<string>} Chat room ID
   */
  async createChatRoom(userData) {
    if (!this.db) throw new Error('ChatService not initialized');

    const chatRoomData = {
      userName: userData.name || 'Unknown',
      userEmail: userData.email || '',
      userId: userData.id || userData.email || userData.phone,
      profilePic: userData.profilePic || userData.photoURL || './images/redicon.png',
      isVerified: userData.isVerified || false,
      lastMessage: 'Chat started',
      lastMessageSenderId: this.auth.currentUser?.uid || 'system',
      lastMessageSenderRole: 'admin',
      lastMessageTime: this.db.FieldValue.serverTimestamp(),
      createdAt: this.db.FieldValue.serverTimestamp(),
      unreadCount: 0
    };

    try {
      // Check if chat already exists with this email
      const existing = await this.db.collection('chat_rooms')
        .where('userEmail', '==', userData.email)
        .get();

      if (!existing.empty) {
        return existing.docs[0].id;
      }

      // Create new chat room
      const docRef = await this.db.collection('chat_rooms').add(chatRoomData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating chat room:', error);
      throw error;
    }
  }

  /**
   * Delete a conversation
   * @param {string} conversationId - Chat room ID
   * @returns {Promise<void>}
   */
  async deleteConversation(conversationId) {
    if (!this.db) throw new Error('ChatService not initialized');

    try {
      // Get all messages in the conversation
      const messagesSnapshot = await this.db.collection('chat_rooms')
        .doc(conversationId)
        .collection('messages')
        .get();

      // Delete all messages
      const batch = this.db.batch();
      messagesSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Delete the chat room document
      batch.delete(this.db.collection('chat_rooms').doc(conversationId));

      await batch.commit();
      
      // Stop listening to this conversation
      if (this.unsubscribers.has(conversationId)) {
        this.unsubscribers.get(conversationId)();
        this.unsubscribers.delete(conversationId);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  /**
   * Mark a conversation as read
   * @param {string} conversationId - Chat room ID
   * @returns {Promise<void>}
   */
  async markAsRead(conversationId) {
    if (!this.db) throw new Error('ChatService not initialized');

    try {
      await this.db.collection('chat_rooms')
        .doc(conversationId)
        .update({
          unreadCount: 0
        });
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }

  /**
   * Get a specific chat room
   * @param {string} conversationId - Chat room ID
   * @returns {Promise<Object>} Chat room data
   */
  async getChatRoom(conversationId) {
    if (!this.db) throw new Error('ChatService not initialized');

    try {
      const doc = await this.db.collection('chat_rooms')
        .doc(conversationId)
        .get();

      if (doc.exists) {
        const data = doc.data();
        return {
          id: doc.id,
          userName: data.userName || 'Unknown',
          userEmail: data.userEmail || '',
          userId: data.userId || '',
          profilePic: data.profilePic || './images/redicon.png',
          isVerified: data.isVerified || false,
          ...data
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting chat room:', error);
      return null;
    }
  }

  /**
   * Ensure chat room has proper timestamps (fixes missing timestamps from app)
   * @param {string} conversationId - Chat room ID
   * @returns {Promise<void>}
   */
  async ensureChatRoomTimestamps(conversationId) {
    if (!this.db) throw new Error('ChatService not initialized');

    try {
      const doc = await this.db.collection('chat_rooms')
        .doc(conversationId)
        .get();

      if (!doc.exists) return;

      const data = doc.data();
      const updates = {};

      // If no lastMessageTime, set it
      if (!data.lastMessageTime) {
        updates.lastMessageTime = this.db.FieldValue.serverTimestamp();
      }

      // If no createdAt, set it
      if (!data.createdAt) {
        updates.createdAt = this.db.FieldValue.serverTimestamp();
      }

      // If there are updates to make
      if (Object.keys(updates).length > 0) {
        await this.db.collection('chat_rooms')
          .doc(conversationId)
          .update(updates);
      }
    } catch (error) {
      console.error('Error ensuring chat room timestamps:', error);
    }
  }

  /**
   * Clean up all listeners
   */
  stopAllListeners() {
    this.unsubscribers.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.unsubscribers.clear();
  }

  /**
   * Search conversations by name or message
   * @param {Array} conversations - Array of conversations
   * @param {string} searchTerm - Search term
   * @returns {Array} Filtered conversations
   */
  searchConversations(conversations, searchTerm) {
    if (!searchTerm) return conversations;
    const lower = searchTerm.toLowerCase();
    return conversations.filter(conv =>
      conv.userName.toLowerCase().includes(lower) ||
      conv.userEmail.toLowerCase().includes(lower) ||
      conv.lastMessage.toLowerCase().includes(lower)
    );
  }

  /**
   * Get total unread count across all conversations
   * @param {Array} conversations - Array of conversations
   * @returns {number} Total unread messages
   */
  getUnreadCount(conversations) {
    return conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
  }
}

// Create and export a singleton instance
window.chatService = new ChatService();
