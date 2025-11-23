# Chat Messaging System & Admin Notifications

## Overview

The chat system enables mobile app users to send messages to admins, with real-time notifications displayed in the admin dashboard. Messages are stored in Firestore with a hierarchical structure for better organization and scalability.

---

## Architecture

### Firestore Collection Structure

```
chat_rooms/                          // Collection for all chat conversations
├── {chatRoomId}/                    // Document for each conversation
│   ├── customerName: string         // Customer's full name
│   ├── customerId: string           // Customer's user ID
│   ├── profilePic: string           // Customer's profile picture URL
│   ├── lastMessage: string          // Preview of last message
│   ├── timestamp: Timestamp         // Last message time
│   ├── isUnread: boolean            // Chat has unread messages
│   └── messages/                    // Subcollection for messages
│       └── {messageId}/             // Individual message document
│           ├── text: string         // Message text (for text messages)
│           ├── type: string         // Message type: "text", "image", "video", "file"
│           ├── senderId: string     // User ID of sender
│           ├── senderName: string   // Display name of sender
│           ├── timestamp: Timestamp // When message was sent
│           ├── isAdmin: boolean     // true if sent by admin, false if by customer
│           ├── status: string       // "sent", "delivered", or "read"
│           ├── mediaUrl: string     // URL for images/videos/files (optional)
│           └── fileName: string     // File name for file type messages (optional)

adminNotifications/                  // Collection for admin notifications
├── {notificationId}/                // Unique notification document
│   ├── notificationType: string     // Type: "new_chat_message", etc.
│   ├── referenceId: string          // Related resource ID (chatRoomId)
│   ├── title: string                // Notification title
│   ├── message: string              // Notification message
│   ├── relatedPage: string          // Page to open when clicked
│   ├── isRead: boolean              // Whether admin has seen it
│   ├── metadata: Object             // Extra data:
│   │   ├── chatRoomId: string
│   │   ├── customerId: string
│   │   ├── customerName: string
│   │   ├── customerProfilePic: string
│   │   ├── messageId: string
│   │   ├── messageType: string
│   │   └── messageText: string
│   ├── createdAt: Timestamp
│   └── updatedAt: Timestamp
```

---

## How It Works

### 1. Mobile User Sends a Message

When a customer sends a message from the mobile app:

```javascript
// Mobile app adds message to Firestore
db.collection('chat_rooms')
  .doc(chatRoomId)
  .collection('messages')
  .add({
    text: 'Hello, I need help with my appointment',
    senderId: userId,
    senderName: customerName,
    type: 'text',
    timestamp: serverTimestamp(),
    isAdmin: false,
    status: 'sent'
  });
```

### 2. Cloud Function Triggers

Firebase Cloud Function `onNewChatMessage` automatically triggers:

1. **Detects the new message** - Listens to `chat_rooms/{chatRoomId}/messages/{messageId}`
2. **Validates it's from customer** - Checks `isAdmin !== true`
3. **Fetches chat room data** - Gets customer info
4. **Creates notification** - Adds to `adminNotifications` collection
5. **Marks chat as unread** - Sets `chat_rooms/{chatRoomId}.isUnread = true`

```javascript
// Cloud Function (functions/index.js)
exports.onNewChatMessage = onDocumentWritten(
  "chat_rooms/{chatRoomId}/messages/{messageId}",
  async (event) => {
    // ... validation and extraction ...
    
    // Create notification for admin
    await createOrUpdateAdminNotification(
      'new_chat_message',
      chatRoomId,
      `New message from ${customerName}`,
      messagePreview,
      'chats.html',
      { chatRoomId, customerName, ... }
    );
    
    // Mark chat as unread
    await db.collection('chat_rooms').doc(chatRoomId).update({
      isUnread: true,
      lastMessage: messagePreview
    });
  }
);
```

### 3. Admin Dashboard Receives Notification

The `chat-notification-handler.js` script runs in the browser and:

1. **Listens to adminNotifications** - Real-time Firestore listener
2. **Filters unread chat messages** - Only processes new ones
3. **Shows notifications** to admin:
   - Browser notification (if permitted)
   - In-app toast notification
   - Plays notification sound
   - Updates chat badge count

```javascript
// Admin Dashboard (chat-notification-handler.js)
const chatHandler = new ChatNotificationHandler();
await chatHandler.init();

// Listener setup
db.collection('adminNotifications')
  .where('notificationType', '==', 'new_chat_message')
  .where('isRead', '==', false)
  .onSnapshot((snapshot) => {
    messageCount = snapshot.docs.length;
    updateBadge();
    snapshot.docs.forEach(doc => showNotification(doc.data()));
  });
```

### 4. Admin Responds

When the admin types and sends a message:

```javascript
// Admin sends message (chat.js)
db.collection('chat_rooms')
  .doc(currentConversationId)
  .collection('messages')
  .add({
    text: adminMessage,
    senderId: adminId,
    senderName: adminName,
    type: 'text',
    timestamp: serverTimestamp(),
    isAdmin: true,  // Important: marks this as admin message
    status: 'sent'
  });
```

**Important:** Cloud Function skips sending notification for admin messages because `isAdmin: true`.

---

## Real-Time Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   MOBILE APP USER                              │
├─────────────────────────────────────────────────────────────────┤
│  1. Types message: "Can I reschedule?"                         │
│  2. Sends to Firestore: chat_rooms/{id}/messages/{msgId}       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                 CLOUD FUNCTION TRIGGERED                        │
├─────────────────────────────────────────────────────────────────┤
│  onNewChatMessage() fires automatically                        │
│  1. Validates: isAdmin !== true ✓                              │
│  2. Fetches: chat_rooms/{chatRoomId} data                      │
│  3. Creates: adminNotifications/new_chat_message_{id}          │
│  4. Updates: chat_rooms/{id}.isUnread = true                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              ADMIN DASHBOARD (BROWSER)                          │
├─────────────────────────────────────────────────────────────────┤
│  ChatNotificationHandler real-time listener                    │
│  1. Detects new adminNotification (isRead: false)             │
│  2. Plays notification sound 🔔                                │
│  3. Shows browser notification                                 │
│  4. Updates chat badge (e.g., "3 new messages")               │
│  5. Shows in-app toast: "New message from John"                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
          ADMIN CLICKS NOTIFICATION
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              ADMIN OPENS CHATS.HTML                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Opens chat with John                                        │
│  2. Reads the full message                                      │
│  3. Types response                                              │
│  4. Sends message with isAdmin: true                            │
│  5. Cloud Function skips notification (admin message)           │
│  6. Mobile app receives message                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Files

### 1. Cloud Function: `functions/index.js`

Handles the server-side logic for incoming messages:

- **Function Name:** `onNewChatMessage`
- **Trigger:** `chat_rooms/{chatRoomId}/messages/{messageId}` (onCreate/onWrite)
- **Actions:**
  - Validates message is from customer (not admin)
  - Creates notification record in `adminNotifications`
  - Updates chat room's `isUnread` and `lastMessage` fields
  - Logs all activities

**Key Code:**
```javascript
exports.onNewChatMessage = onDocumentWritten(
  "chat_rooms/{chatRoomId}/messages/{messageId}",
  async (event) => {
    // Only process new customer messages
    if (newData.isAdmin === true) return;
    
    // Create notification
    await createOrUpdateAdminNotification(...);
  }
);
```

### 2. Handler Script: `chat-notification-handler.js`

Runs in the admin dashboard and displays real-time notifications:

- **Class:** `ChatNotificationHandler`
- **Features:**
  - Real-time listener on `adminNotifications` collection
  - Filters for unread chat message notifications
  - Shows browser notifications + in-app toasts
  - Plays notification sound
  - Updates badge count
  - Marks notifications as read

**Key Code:**
```javascript
class ChatNotificationHandler {
  async init() {
    // Set up real-time listener
    this.setupNotificationListener(db);
  }
  
  setupNotificationListener(db) {
    db.collection('adminNotifications')
      .where('notificationType', '==', 'new_chat_message')
      .where('isRead', '==', false)
      .onSnapshot(snapshot => {
        this.handleNotificationUpdate(snapshot);
      });
  }
}
```

### 3. Existing Chat System: `chat.js`

Already handles:
- Displaying chat conversations
- Loading messages from `chat_rooms/{id}/messages`
- Sending admin responses
- Managing chat UI

**Must include this script in HTML:**
```html
<script src="chat-notification-handler.js"></script>
```

---

## Firestore Security Rules

To protect the chat data, update your Firestore rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Chat rooms - admins can read/write all, customers can only read their own
    match /chat_rooms/{chatRoomId} {
      allow read: if request.auth != null && 
        (request.auth.token.admin == true || 
         request.auth.uid == resource.data.customerId);
      
      allow update: if request.auth.token.admin == true;
      
      // Messages subcollection
      match /messages/{messageId} {
        allow read: if request.auth != null && 
          (request.auth.token.admin == true || 
           request.auth.uid == get(/databases/$(database)/documents/chat_rooms/$(chatRoomId)).data.customerId);
        
        allow create: if request.auth != null &&
          request.resource.data.senderId == request.auth.uid;
      }
    }
    
    // Admin notifications - only admins can read
    match /adminNotifications/{notificationId} {
      allow read, write: if request.auth.token.admin == true;
    }
  }
}
```

---

## Setup Instructions

### Step 1: Deploy Cloud Function

```bash
cd functions
npm install
firebase deploy --only functions:onNewChatMessage
```

### Step 2: Include Handler Script in Admin Dashboard

Add this line to your HTML file (e.g., `index.html` or before closing `</body>`):

```html
<script src="chat-notification-handler.js"></script>
```

### Step 3: Update Firestore Rules

Replace your existing rules with the ones in the "Firestore Security Rules" section above.

### Step 4: Test

1. Send a message from mobile app
2. Check admin dashboard for notification
3. Click notification to open chat
4. Respond as admin

---

## Troubleshooting

### Issue: Notifications not showing

**Check:**
1. ✓ Cloud Function deployed successfully
   ```bash
   firebase functions:list
   ```
2. ✓ `chat-notification-handler.js` included in HTML
3. ✓ Browser notification permission granted
   - Check browser settings
   - Call `Notification.requestPermission()`
4. ✓ Messages have `isAdmin: false` (customer messages)
5. ✓ Firestore rules allow reading `adminNotifications`

**Debug:**
```javascript
// In browser console
console.log(window.chatNotificationHandler.messageCount);
// Should show number of unread notifications
```

### Issue: Admin receiving notifications for their own messages

**Fix:** Ensure messages sent by admin have `isAdmin: true`

```javascript
// Correct - no notification triggered
const adminMessage = {
  text: 'How can I help?',
  isAdmin: true,  // This prevents notification
  senderId: adminId,
  timestamp: serverTimestamp()
};
```

### Issue: Duplicate notifications

**Fix:** Cloud Function uses unique notification ID to prevent duplicates

```javascript
const notificationId = `${notificationType}_${referenceId}`;
// Example: "new_chat_message_abc123"
```

---

## Performance Considerations

### Optimizations

1. **Subcollection for messages** - Keeps chat_rooms document small, reduces read costs
2. **Indexed queries** - Firestore auto-indexes for better performance
3. **Unread filter** - Only queries unread notifications (fewer documents)
4. **One notification per chat** - Updates instead of creating new ones

### Estimated Costs (per 1000 message exchanges)

- Cloud Function executions: ~$0.04
- Firestore reads: ~$0.10 (reads chat room + notifications)
- Firestore writes: ~$0.15 (creates notification + updates chat room)
- **Total: ~$0.29 per 1000 messages**

---

## API Reference

### ChatNotificationHandler Class

```javascript
// Initialize
const handler = new ChatNotificationHandler();
await handler.init();

// Mark notification as read
await handler.markAsRead(chatRoomId);

// Request permission
ChatNotificationHandler.requestNotificationPermission();

// Clean up
handler.destroy();
```

### Cloud Function - Helper

```javascript
// Create or update admin notification
async createOrUpdateAdminNotification(
  notificationType,      // "new_chat_message"
  referenceId,           // chatRoomId
  title,                 // "New message from John"
  message,               // "Can I reschedule?"
  relatedPage,           // "chats.html"
  metadata = {}          // Extra data
)
```

---

## Future Enhancements

1. **Push Notifications** - Send to admin mobile devices
2. **Email Notifications** - Optional email for offline admins
3. **Message Read Receipts** - Show when customer reads admin's message
4. **Typing Indicators** - Show "admin is typing..."
5. **Message Reactions** - Emoji reactions to messages
6. **Archived Chats** - Archive closed conversations
7. **Search** - Full-text search in messages

---

## Summary

✅ **Mobile users send messages** → Chat room created, message added
✅ **Cloud Function auto-triggers** → Creates admin notification
✅ **Admin dashboard shows notification** → Real-time badge + toast
✅ **Admin clicks notification** → Opens chat, can respond
✅ **Admin responds** → Cloud Function skips notification (prevents spam)
✅ **Mobile app receives response** → Full-duplex communication complete

The system is **fully automated** - admins receive notifications immediately as customers send messages!
