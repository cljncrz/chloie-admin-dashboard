# Chat Messaging - Quick Setup Guide

## ✨ What This Solves

**Problem:** Admin receives chat messages from mobile app users in Firestore `chat_rooms` collection and needs to be notified.

**Solution:** Automatic real-time notifications when customers send messages.

---

## 🚀 Quick Start (5 minutes)

### Step 1: Add notification handler to your HTML

Add this line before closing `</body>` tag in your admin dashboard pages:

```html
<script src="chat-notification-handler.js"></script>
```

**Example - `index.html`:**
```html
<!DOCTYPE html>
<html>
<head>
    ...
</head>
<body>
    ...
    <script src="firebase-config.js"></script>
    <script src="chat-notification-handler.js"></script>
    <script src="dashboard.js"></script>
</body>
</html>
```

### Step 2: Deploy Cloud Function

1. Open terminal in project root
2. Run:
   ```powershell
   cd functions
   npm install
   firebase deploy --only functions:onNewChatMessage
   ```

3. Verify deployment:
   ```powershell
   firebase functions:list
   ```
   Should show: `onNewChatMessage` ✓

### Step 3: (Optional) Update Firestore Rules

If your current rules don't allow reading `adminNotifications`, add:

```
match /adminNotifications/{notificationId} {
  allow read, write: if request.auth.token.admin == true;
}
```

---

## 🔍 How It Works

```
Mobile User Sends Message
          ↓
Cloud Function Triggers (auto)
          ↓
Creates Admin Notification
          ↓
Admin Dashboard Shows Badge + Toast
          ↓
Admin Clicks → Opens Chat
          ↓
Admin Responds
```

---

## ✅ Testing

1. **Open admin dashboard** - should see notification permission request
2. **Send message from mobile app** (or simulate in test)
3. **Watch admin dashboard**:
   - Badge updates (e.g., "3" on chat icon)
   - Toast notification appears
   - Sound plays (if enabled)
4. **Click notification** → Opens chat conversation

---

## 📁 Files Created/Modified

### New Files:
- `chat-notification-handler.js` - Real-time notification listener
- `functions/onNewChatMessage.js` - Cloud Function template
- `docs/CHAT_MESSAGING_SYSTEM.md` - Full documentation

### Modified Files:
- `functions/index.js` - Added `onNewChatMessage` export

### Already Working:
- `chat.js` - Existing chat UI (no changes needed)
- `notification-service.js` - Existing notification service

---

## 🎯 Key Features

✅ **Real-time** - Notifications appear instantly
✅ **No spam** - Skips notifications for admin messages
✅ **Unread tracking** - Shows count of new messages
✅ **Browser notifications** - Desktop alerts + sound
✅ **Smart updates** - Groups messages from same customer
✅ **Firestore efficient** - Uses subcollections to minimize reads

---

## 🔧 Customization

### Change notification sound:

Edit `chat-notification-handler.js`, line ~150:
```javascript
const frequencies = [800, 600]; // Change these numbers for different pitch
```

### Disable browser notifications:

Remove this from `chat-notification-handler.js`:
```javascript
if ('Notification' in window && Notification.permission === 'granted') {
  // ... browser notification code ...
}
```

### Auto-mark notifications as read:

Add to your chat.js when opening a conversation:
```javascript
if (window.chatNotificationHandler) {
  window.chatNotificationHandler.markAsRead(conversationId);
}
```

---

## 🚨 Troubleshooting

### Q: Notifications not showing?

A: Check these in order:
1. Open browser DevTools (F12) → Console
   - Look for "✅ ChatNotificationHandler initialized" message
   - If missing: Check script is loaded in HTML
2. Check notification permission
   ```javascript
   console.log(Notification.permission); // Should be "granted"
   ```
3. Verify Cloud Function deployed
   ```powershell
   firebase functions:list | grep onNewChatMessage
   ```
4. Check Firestore - should have `adminNotifications` collection with documents

### Q: Can admin see their own messages as notifications?

A: No! Cloud Function checks `isAdmin: true` and skips those.

### Q: Multiple notifications for one message?

A: No! System uses unique notification ID: `new_chat_message_{chatRoomId}`

### Q: Why is badge not updating?

A: Make sure `global-updates.js` has `updateGlobalChatBadge()` function. If not:

```javascript
// Add to global-updates.js
window.updateGlobalChatBadge = () => {
  const count = window.chatNotificationHandler?.messageCount || 0;
  const badge = document.querySelector('.chat-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'block' : 'none';
  }
};
```

---

## 📊 Data Flow Example

```json
// 1. Mobile user sends message
POST /chat_rooms/abc123/messages/msg456
{
  "text": "Can I reschedule my appointment?",
  "senderId": "user_john_123",
  "senderName": "John Doe",
  "type": "text",
  "timestamp": "2025-11-24T15:30:00Z",
  "isAdmin": false,
  "status": "sent"
}

// 2. Cloud Function creates notification
POST /adminNotifications/new_chat_message_abc123
{
  "notificationType": "new_chat_message",
  "referenceId": "abc123",
  "title": "New message from John Doe",
  "message": "Can I reschedule my appointment?",
  "isRead": false,
  "metadata": {
    "chatRoomId": "abc123",
    "customerId": "user_john_123",
    "customerName": "John Doe",
    "messageText": "Can I reschedule my appointment?"
  }
}

// 3. Admin dashboard listener detects:
// → Updates badge: "+1"
// → Shows toast: "New message from John Doe"
// → Plays sound: 🔔
// → Shows browser notification

// 4. Admin clicks notification → Opens chats.html → Selects John's chat → Responds
```

---

## 🎓 Understanding the Architecture

### Why Cloud Functions?

- **Automatic** - Triggers immediately when message added
- **Scalable** - Handles millions of messages
- **Cost-effective** - Only runs when needed
- **Secure** - Runs on server, not exposed to client

### Why adminNotifications collection?

- **Real-time updates** - Admin dashboard can listen for changes
- **Filtering** - Only show unread notifications
- **History** - Keep record of all notifications
- **Metadata** - Store extra context (customer name, chat ID, etc.)

### Why check isAdmin?

- **Prevents spam** - Admin's responses don't trigger notifications
- **Clean notifications** - Only important (customer) messages notify
- **Better UX** - Admin focused on new customer inquiries

---

## 💡 Pro Tips

1. **Test locally first** - Use Firebase emulator:
   ```powershell
   firebase emulators:start --only functions,firestore
   ```

2. **Monitor function logs**:
   ```powershell
   firebase functions:log
   ```

3. **Check cost** - View estimates:
   ```powershell
   firebase functions:describe onNewChatMessage
   ```

4. **Debug in production** - Check Firebase Console:
   - Go to Functions → onNewChatMessage → Logs
   - See execution history and errors

---

## 📞 Support

If issues persist, check:

1. **Cloud Function Logs** - Firebase Console → Functions → Logs
2. **Firestore Rules** - Make sure `adminNotifications` is readable by admins
3. **Browser Console** - F12 → Console for JavaScript errors
4. **Network Tab** - F12 → Network to verify Firestore calls

---

## ✨ Next Steps

1. ✅ Add `chat-notification-handler.js` to HTML
2. ✅ Deploy Cloud Function
3. ✅ Test with actual message
4. ✅ Customize sounds/colors as desired
5. ✅ Deploy to production

**You're all set!** Admin will now receive real-time notifications for incoming chat messages. 🎉
