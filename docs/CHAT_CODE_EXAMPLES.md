/**
 * PRACTICAL EXAMPLES - Chat Messaging System
 * 
 * This file contains copy-paste ready examples for implementing chat notifications
 */

// ============================================================
// EXAMPLE 1: Add to Admin Dashboard HTML
// ============================================================

/*
  File: index.html (or dashboard.html)
  
  Add this to the <head> or before </body>:
*/

const HTML_EXAMPLE = `
<!DOCTYPE html>
<html>
<head>
    <title>Admin Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Other head content -->
</head>
<body>
    <!-- Your dashboard content -->
    <div id="dashboard">
        <!-- ... -->
    </div>
    
    <!-- Scripts - order matters! -->
    
    <!-- 1. Firebase (from CDN) -->
    <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-auth-compat.js"></script>
    
    <!-- 2. Firebase config -->
    <script src="firebase-config.js"></script>
    
    <!-- 3. Global utilities -->
    <script src="global-updates.js"></script>
    
    <!-- 4. NOTIFICATION HANDLER (NEW!) -->
    <script src="chat-notification-handler.js"></script>
    
    <!-- 5. Your app scripts -->
    <script src="dashboard.js"></script>
    <script src="chat.js"></script>
    
</body>
</html>
`;

// ============================================================
// EXAMPLE 2: Mobile App - Sending Message (React/React Native)
// ============================================================

const MOBILE_SEND_MESSAGE_EXAMPLE = `
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';

const sendChatMessage = async (chatRoomId, messageText, userId, userName) => {
  try {
    const db = getFirestore();
    
    // Add message to subcollection
    const messagesRef = collection(
      db, 
      'chat_rooms', 
      chatRoomId, 
      'messages'
    );
    
    const newMessage = await addDoc(messagesRef, {
      text: messageText,
      type: 'text',
      senderId: userId,
      senderName: userName,
      timestamp: serverTimestamp(),
      status: 'sent',
      isAdmin: false  // IMPORTANT! This is a customer message
    });
    
    console.log('Message sent:', newMessage.id);
    
    // Update chat room's last message
    const chatRoomRef = doc(db, 'chat_rooms', chatRoomId);
    await updateDoc(chatRoomRef, {
      lastMessage: messageText,
      timestamp: serverTimestamp()
    });
    
    return newMessage.id;
    
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Usage:
sendChatMessage(
  'chat_room_123',
  'Hello, I need help!',
  'user_john_456',
  'John Doe'
);
`;

// ============================================================
// EXAMPLE 3: Admin Dashboard - Detect New Notifications
// ============================================================

const ADMIN_DETECT_NOTIFICATIONS_EXAMPLE = `
// In browser console of admin dashboard:

// Check if handler is initialized
console.log(window.chatNotificationHandler);
// Should output: ChatNotificationHandler { messageCount: 3, ... }

// Check current unread count
console.log('Unread messages:', window.chatNotificationHandler.messageCount);

// Listen to console for new notifications
// Should see: "💬 3 unread chat message(s)" when message arrives

// Mark a chat as read
await window.chatNotificationHandler.markAsRead('chat_room_123');

// Check notification permission status
console.log('Permission:', Notification.permission);
// Should be: "granted"

// Request permission manually (if user hasn't been asked)
Notification.requestPermission().then(permission => {
  console.log('Permission:', permission);
});
`;

// ============================================================
// EXAMPLE 4: Integration with Existing chat.js
// ============================================================

const CHAT_JS_INTEGRATION = `
// In your existing chat.js file, when opening a conversation:

const renderMessages = (conversationId) => {
  // ... existing code ...
  
  const chat = chats.find(c => c.id === conversationId);
  if (!chat) return;

  currentConversationId = conversationId;

  // NEW: Mark notification as read when opening chat
  if (window.chatNotificationHandler) {
    window.chatNotificationHandler.markAsRead(conversationId);
  }

  // ... rest of existing code ...
  messageListEl.innerHTML = '<p>Loading messages...</p>';
};

// When admin sends a message:
const handleSendMessage = (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !currentConversationId) return;

  const adminId = auth.currentUser ? auth.currentUser.uid : null;
  if (!adminId) {
    alert('You must be logged in to send messages.');
    return;
  }

  const newMessage = {
    senderId: adminId,
    senderName: currentAdminData?.name || 'Admin',
    senderEmail: currentAdminData?.email || '',
    senderProfilePic: currentAdminData?.profilePic || './images/redicon.png',
    type: 'text',
    text: text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'sent',
    isAdmin: true  // IMPORTANT! Must be true for admin messages
  };

  // Send to Firestore
  db.collection('chat_rooms')
    .doc(currentConversationId)
    .collection('messages')
    .add(newMessage)
    .then(() => {
      console.log('Message sent');
      messageInput.value = '';
    })
    .catch(error => {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    });
};
`;

// ============================================================
// EXAMPLE 5: Firestore Rules for Chat
// ============================================================

const FIRESTORE_RULES_EXAMPLE = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Chat rooms collection
    match /chat_rooms/{chatRoomId} {
      // Admins can read all chat rooms
      // Customers can only read their own
      allow read: if request.auth != null && 
        (request.auth.token.admin == true || 
         request.auth.uid == resource.data.customerId);
      
      // Only admins can update chat room (mark as read, etc.)
      allow update: if request.auth.token.admin == true;
      
      // Messages subcollection
      match /messages/{messageId} {
        // Admins can read all messages
        // Customers can only read messages from their own chat room
        allow read: if request.auth != null && 
          (request.auth.token.admin == true || 
           request.auth.uid == get(/databases/$(database)/documents/chat_rooms/$(chatRoomId)).data.customerId);
        
        // Anyone can create a message if they are the sender
        allow create: if request.auth != null &&
          request.resource.data.senderId == request.auth.uid;
        
        // Only the sender can update their own message status
        allow update: if request.auth != null &&
          resource.data.senderId == request.auth.uid;
      }
    }
    
    // Admin notifications collection
    match /adminNotifications/{notificationId} {
      // Only admins can read and write admin notifications
      allow read, write: if request.auth.token.admin == true;
    }
  }
}
`;

// ============================================================
// EXAMPLE 6: Testing Cloud Function Locally
// ============================================================

const CLOUD_FUNCTION_TEST = `
// File: functions/test-chat-message.js

const admin = require('firebase-admin');

// Initialize Firebase
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Simulate a customer sending a message
 * This will trigger the onNewChatMessage cloud function
 */
async function simulateChatMessage() {
  try {
    const chatRoomId = 'test_chat_room_123';
    const customerId = 'test_customer_456';
    
    // Create/update chat room
    await db.collection('chat_rooms').doc(chatRoomId).set({
      customerName: 'Test Customer',
      customerId: customerId,
      profilePic: 'https://via.placeholder.com/50',
      lastMessage: 'Test message',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      isUnread: false
    });
    
    // Add a message (this triggers the Cloud Function)
    await db
      .collection('chat_rooms')
      .doc(chatRoomId)
      .collection('messages')
      .add({
        text: 'Hello admin! I need help with my appointment.',
        type: 'text',
        senderId: customerId,
        senderName: 'Test Customer',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
        isAdmin: false  // Customer message
      });
    
    console.log('✅ Simulated message sent');
    
    // Check if notification was created
    const notifications = await db
      .collection('adminNotifications')
      .where('notificationType', '==', 'new_chat_message')
      .limit(1)
      .get();
    
    if (notifications.empty) {
      console.log('⏳ Notification not created yet (Cloud Function may still be executing)');
    } else {
      console.log('✅ Notification created:');
      console.log(notifications.docs[0].data());
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

simulateChatMessage();

// Run with: node functions/test-chat-message.js
`;

// ============================================================
// EXAMPLE 7: Handle Message with Image/Video
// ============================================================

const SEND_MEDIA_MESSAGE = `
// Mobile app: Send image message

import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp,
  doc,
  updateDoc
} from 'firebase/firestore';

const sendImageMessage = async (chatRoomId, imageFile, userId, userName) => {
  try {
    const storage = getStorage();
    const db = getFirestore();
    
    // 1. Upload image to Storage
    const timestamp = Date.now();
    const filename = 'images/\${chatRoomId}/\${timestamp}.jpg';
    const storageRef = ref(storage, filename);
    
    const snapshot = await uploadBytes(storageRef, imageFile);
    const imageUrl = await getDownloadURL(snapshot.ref);
    
    console.log('Image uploaded:', imageUrl);
    
    // 2. Add message to Firestore with image URL
    const messagesRef = collection(
      db,
      'chat_rooms',
      chatRoomId,
      'messages'
    );
    
    const newMessage = await addDoc(messagesRef, {
      type: 'image',  // Important!
      mediaUrl: imageUrl,
      senderId: userId,
      senderName: userName,
      timestamp: serverTimestamp(),
      status: 'sent',
      isAdmin: false
    });
    
    // 3. Update chat room
    const chatRoomRef = doc(db, 'chat_rooms', chatRoomId);
    await updateDoc(chatRoomRef, {
      lastMessage: '📷 Sent an image',
      timestamp: serverTimestamp()
    });
    
    console.log('Image message sent:', newMessage.id);
    return newMessage.id;
    
  } catch (error) {
    console.error('Error sending image:', error);
    throw error;
  }
};

// Admin receives notification with "📷 Sent an image"
`;

// ============================================================
// EXAMPLE 8: Listen to Chat Messages in Real-time
// ============================================================

const LISTEN_TO_MESSAGES = `
// Listen to messages in a specific chat room (for admin or customer)

import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  limit,
  onSnapshot 
} from 'firebase/firestore';

const listenToMessages = (chatRoomId) => {
  const db = getFirestore();
  
  const messagesRef = collection(
    db,
    'chat_rooms',
    chatRoomId,
    'messages'
  );
  
  const q = query(
    messagesRef,
    orderBy('timestamp', 'desc'),
    limit(50)  // Last 50 messages
  );
  
  // Real-time listener
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const messages = [];
    
    snapshot.docs.reverse().forEach((doc) => {
      const msgData = doc.data();
      messages.push({
        id: doc.id,
        ...msgData,
        timestamp: msgData.timestamp?.toDate() // Convert to JS Date
      });
    });
    
    console.log('Messages updated:', messages.length);
    updateMessageUI(messages);
  });
  
  // Return unsubscribe function to stop listening
  return unsubscribe;
};

// Usage:
const unsubscribe = listenToMessages('chat_room_123');

// Stop listening later
// unsubscribe();
`;

// ============================================================
// Export all examples
// ============================================================

module.exports = {
  HTML_EXAMPLE,
  MOBILE_SEND_MESSAGE_EXAMPLE,
  ADMIN_DETECT_NOTIFICATIONS_EXAMPLE,
  CHAT_JS_INTEGRATION,
  FIRESTORE_RULES_EXAMPLE,
  CLOUD_FUNCTION_TEST,
  SEND_MEDIA_MESSAGE,
  LISTEN_TO_MESSAGES
};

/*
  USAGE:
  
  Copy and paste the examples that match your platform:
  
  - WEB ADMIN: Use HTML_EXAMPLE, CHAT_JS_INTEGRATION, FIRESTORE_RULES_EXAMPLE
  - MOBILE: Use MOBILE_SEND_MESSAGE_EXAMPLE, SEND_MEDIA_MESSAGE, LISTEN_TO_MESSAGES
  - TESTING: Use CLOUD_FUNCTION_TEST
  
  Each example is fully functional and ready to use.
*/
