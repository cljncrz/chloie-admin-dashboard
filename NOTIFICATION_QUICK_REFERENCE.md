# Notification System - Quick Reference

## 📱 For Admins

### How to Send a Notification

1. **Navigate**: Click "Send Notifications" in sidebar
2. **Target**: Choose single user, multiple users, or all users
3. **Category**: Select notification type (Appointment, Promotion, etc.)
4. **Compose**: Write title and message (max 500 characters)
5. **Optional**: Add image URL and custom data
6. **Preview**: Click Preview button to see how it looks
7. **Send**: Click "Send Notification"

### What Gets Stored in Firestore

Each notification creates a document at:
```
/users/{userId}/notifications/{notificationId}
```

Contains:
- ✅ Title & message
- ✅ Notification type/category
- ✅ Image URL (if provided)
- ✅ Custom data (JSON)
- ✅ Timestamp
- ✅ Admin email & name
- ✅ Read status

### What Gets Sent to Mobile App

**Push Notification:**
- Title and message appear instantly on device
- Sound/vibration based on user preferences
- Only if user has app installed and enabled notifications

**Firestore Storage:**
- Same notification stored permanently in user's notifications list
- User can view notification history anytime
- User can mark as read or delete

## 📲 For Mobile App Developers

### What to Expect from Admin

Notification object contains:
```javascript
{
  userId: "abc123",
  title: "Appointment Confirmed",
  body: "Your appointment is confirmed",
  type: "appointment",
  imageUrl: "https://...",
  data: { appointmentId: "apt123" },
  timestamp: Timestamp,
  isRead: false
}
```

### How to Handle Different Types

| Type | Action | Example |
|------|--------|---------|
| `appointment` | Show in appointments tab | Jump to appointment details |
| `promotion` | Show in promotions tab | Apply promo code |
| `payment` | Show confirmation | Mark payment as received |
| `service` | Update service status | Refresh service list |
| `general` | Show in notifications | Display as-is |
| `reminder` | Show notification | Set reminder on device |

### Integration Steps

1. **Register FCM Token** (on app launch)
   ```javascript
   const token = await messaging.getToken();
   await db.collection('users').doc(userId).update({
     fcmTokens: firebase.firestore.FieldValue.arrayUnion([token])
   });
   ```

2. **Listen to Push Messages**
   ```javascript
   messaging.onMessage(message => {
     // Handle notification
   });
   ```

3. **Listen to Firestore**
   ```javascript
   db.collection('users').doc(userId)
     .collection('notifications')
     .orderBy('timestamp', 'desc')
     .onSnapshot(snapshot => {
       // Update UI with notifications
     });
   ```

4. **Mark as Read**
   ```javascript
   db.collection('users').doc(userId)
     .collection('notifications').doc(notifId)
     .update({ isRead: true });
   ```

## 🔧 Firestore Structure

### Collection Path
```
users/
  └─ {userId}/
     └─ notifications/
        ├─ doc1 { title, body, timestamp, ... }
        ├─ doc2 { ... }
        └─ doc3 { ... }
```

### Creating a Notification (Admin Only)
```javascript
await db
  .collection('users')
  .doc(userId)
  .collection('notifications')
  .add({
    title: "Title",
    body: "Message",
    type: "appointment",
    timestamp: new Date(),
    isRead: false
  });
```

### Reading Notifications (User Only)
```javascript
const notifications = await db
  .collection('users')
  .doc(userId)
  .collection('notifications')
  .orderBy('timestamp', 'desc')
  .get();
```

## 🔐 Security Rules

```javascript
match /users/{userId}/notifications/{document=**} {
  allow read: if request.auth.uid == userId;
  allow create, update, delete: if request.auth.uid == userId ||
    request.auth.token.admin == true;
}
```

**What This Means:**
- ✅ Users can read their own notifications
- ✅ Users can manage their own notifications (mark read, delete)
- ✅ Admins can send notifications to any user
- ❌ Users cannot read other users' notifications
- ❌ Non-admins cannot send notifications

## 🚀 Cloud Function

### Endpoint
```
POST https://us-central1-kingsleycarwashapp.cloudfunctions.net/sendNotificationToUser
```

### Request
```json
{
  "userId": "user123",
  "title": "Title",
  "body": "Message",
  "data": { "key": "value" },
  "imageUrl": "https://..."
}
```

### Response
```json
{
  "success": true,
  "notificationsSent": 1,
  "failedSends": 0,
  "notificationDocId": "abc123"
}
```

## 📊 Notification Categories

| Category | Use Case | Example |
|----------|----------|---------|
| **Appointment** | Appointment updates | "Appointment confirmed" |
| **Promotion** | Marketing offers | "20% off promotion" |
| **Payment** | Payment status | "Payment received" |
| **Service** | Service updates | "Service completed" |
| **General** | Broadcasts | "New feature announcement" |
| **Reminder** | User reminders | "Your appointment is tomorrow" |
| **Custom** | Other types | Any custom notification |

## ⚡ Quick Troubleshooting

### "User not found"
- ❓ User ID doesn't exist in database
- ✅ Select user from dropdown instead of typing

### "No FCM tokens"
- ❓ User hasn't installed app or revoked permissions
- ✅ Send anyway - notification stores in Firestore
- ✅ User gets it when they open app

### Notification not appearing
- ❓ User hasn't enabled notifications on device
- ✅ Check mobile app notification settings
- ✅ Verify notification stored in Firestore

### Can't send notification
- ❓ Form validation failed
- ✅ Check required fields (Title, Message, Category)
- ✅ Verify message JSON is valid (if using custom data)

## 📋 Notification Checklist

Before sending important notifications:

- [ ] Selected correct user(s)
- [ ] Chose appropriate category
- [ ] Title is clear and concise
- [ ] Message is helpful and actionable
- [ ] Checked preview for typos
- [ ] Image displays correctly (if used)
- [ ] Custom data is valid JSON (if used)
- [ ] Timing is appropriate for user

## 💡 Pro Tips

1. **Use Emojis Sparingly** - 🔔 works, but keep it professional
2. **Keep Titles Short** - Under 65 characters
3. **Make Messages Actionable** - Tell users what to do
4. **Include Context** - "Your appointment at 2 PM" not just "Appointment confirmed"
5. **Use Images Wisely** - Only when it adds value
6. **Test First** - Send to yourself or test user
7. **Monitor Engagement** - Check which notifications get high read rates
8. **Avoid Spam** - Don't send too many notifications

## 📞 Support

### For Admin Issues
- Check Dashboard > Send Notifications page
- Verify user exists in Customers list
- Check Cloud Function logs in Firebase Console

### For Mobile App Issues
- Verify FCM token is registered
- Check Firestore notifications collection
- Ensure app has notification permissions

### For Deployment Issues
- Verify Cloud Functions deployed successfully
- Check Firebase project ID is correct
- Ensure Firestore database is active

---

**Keep This Reference Handy!** 📌

**Bookmark:** Send Notifications page in admin dashboard
**Remember:** Test notifications before sending to all users
**Note:** Users see notifications in app notification history forever (unless deleted)
