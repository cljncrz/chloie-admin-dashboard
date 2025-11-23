# 📋 Quick Reference Card - Chat Notifications

## 30-Second Overview

```
Mobile User Sends Message
    ↓ (stored in Firestore)
Cloud Function Triggers (auto)
    ↓ (creates notification)
Admin Dashboard Listener (real-time)
    ↓ (displays)
🔔 Browser Notification + Badge + Sound
```

---

## 5-Minute Setup

### 1. Add to HTML
```html
<script src="chat-notification-handler.js"></script>
```

### 2. Deploy Function
```powershell
cd functions
firebase deploy --only functions:onNewChatMessage
```

### 3. Test
Send message from mobile app → See notification

---

## File Locations

| What | Where | Status |
|------|-------|--------|
| Handler Script | `chat-notification-handler.js` | ✅ Ready |
| Cloud Function | `functions/index.js` | ✅ Updated |
| Quick Setup | `docs/CHAT_SETUP_QUICKSTART.md` | ✅ Ready |
| Full Docs | `docs/CHAT_MESSAGING_SYSTEM.md` | ✅ Ready |
| Examples | `docs/CHAT_CODE_EXAMPLES.md` | ✅ Ready |
| Diagrams | `docs/CHAT_DIAGRAMS.md` | ✅ Ready |

---

## Key Concepts

### Message Structure
```javascript
{
  text: "Hello admin",
  senderId: "user_123",
  isAdmin: false,  // ← Important!
  type: "text",
  timestamp: serverTimestamp()
}
```

### Notification Structure
```javascript
{
  notificationType: "new_chat_message",
  title: "New message from John",
  message: "Hello admin",
  isRead: false,
  metadata: { /* context */ }
}
```

---

## Critical Points

✅ **Messages:** `isAdmin: false` for customers
✅ **Admin replies:** `isAdmin: true` (no notification)
✅ **Listener:** Watches `adminNotifications` (isRead: false)
✅ **Trigger:** Cloud Function on new message
✅ **Cost:** ~$0.20 per 1,000 messages

---

## Common Tasks

### View Notifications
```javascript
console.log(window.chatNotificationHandler.messageCount);
```

### Mark as Read
```javascript
window.chatNotificationHandler.markAsRead('chat_room_123');
```

### Check Cloud Function Logs
```powershell
firebase functions:log --limit 50
```

### Request Notification Permission
```javascript
Notification.requestPermission();
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No notifications | Check script loaded + permission granted |
| Admin gets notified for own messages | Set `isAdmin: true` on admin messages |
| Duplicate notifications | Not an issue - same notification ID |
| Script error | Check browser console (F12) |
| Cloud Function error | Check: `firebase functions:log` |

---

## Firestore Rules

```
match /adminNotifications/{notificationId} {
  allow read, write: if request.auth.token.admin == true;
}
```

---

## Message Flow

```
1. Customer: sends message
2. Mobile app: stores in chat_rooms/{id}/messages
3. Cloud Function: detects, validates, creates notification
4. Admin dashboard: listens, displays notification
5. Admin: clicks → opens chat → responds
6. Cloud Function: skips notification for admin message
```

---

## API Quick Reference

### ChatNotificationHandler
```javascript
new ChatNotificationHandler()
  .init()                              // Initialize
  .markAsRead(chatRoomId)              // Mark read
  .playNotificationSound()             // Play sound
  .destroy()                           // Cleanup
```

### Cloud Function
```javascript
exports.onNewChatMessage = 
  onDocumentWritten("chat_rooms/{id}/messages/{msgId}", handler)
```

---

## Cost Breakdown

| Operation | Cost |
|-----------|------|
| 1,000 messages | $0.20 |
| 10,000 messages | $2.00 |
| 100,000 messages | $20.00 |
| 1,000,000 messages | $200.00 |

---

## Checklist

- [ ] Read CHAT_README.md
- [ ] Add handler to HTML
- [ ] Deploy Cloud Function
- [ ] Update Firestore Rules
- [ ] Test notification
- [ ] Grant permissions
- [ ] Check logs

---

## Emergency Commands

### Redeploy function
```powershell
firebase deploy --only functions:onNewChatMessage
```

### View logs
```powershell
firebase functions:log
```

### Check status
```powershell
firebase functions:list | grep onNewChatMessage
```

---

## Browser Compatibility

✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+
✅ Mobile browsers

---

## Documentation Map

```
Quick Questions?
  → CHAT_SETUP_QUICKSTART.md

Want to Understand?
  → CHAT_MESSAGING_SYSTEM.md

Need Code?
  → CHAT_CODE_EXAMPLES.md

See Architecture?
  → CHAT_DIAGRAMS.md

Full Details?
  → CHAT_SOLUTION_SUMMARY.md
```

---

## Phone Home

**Problem:** Admin needs real-time notifications for chat messages
**Solution:** Cloud Function + Real-time Listener
**Time:** 5 minutes to set up
**Cost:** $0.20 per 1,000 messages
**Result:** Never miss a message again! 🎉

---

**That's it! You're ready to implement.** 🚀

👉 Start with: `docs/CHAT_README.md`
