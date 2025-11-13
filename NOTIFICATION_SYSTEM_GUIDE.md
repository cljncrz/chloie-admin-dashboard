# Admin Notification System - Implementation Guide

## Overview

The admin dashboard now includes a comprehensive notification system that allows admins to send push notifications to mobile app users. Notifications are:

1. **Stored in Firestore** - Under each user's `notifications` subcollection
2. **Sent as Push Notifications** - Via Firebase Cloud Messaging (FCM)
3. **Tracked** - Recent sent notifications are displayed for reference
4. **Multi-targeted** - Can be sent to single users, multiple users, or all users

## System Architecture

### Components

1. **Admin Interface** (`send-notification.html` + `send-notification.js`)
   - User-friendly form for composing notifications
   - Live preview before sending
   - User search and selection
   - Notification category selection

2. **Cloud Functions** (`functions/sendNotifications.js`)
   - `sendNotificationToUser` - HTTP endpoint to send notifications
   - Stores notifications in Firestore
   - Manages FCM token validation

3. **Firestore Collections**
   - `users/{userId}/notifications` - Stores all notifications received by a user
   - Each notification includes timestamp, read status, and metadata

## Admin Interface Features

### Access the Feature

Navigate to **Send Notifications** from the admin sidebar menu.

### Sending a Notification

#### Step 1: Select Target
Choose one of three options:
- **Single User** - Select a specific user from the dropdown
- **Multiple Users** - Select multiple users (feature ready for implementation)
- **All Users** - Broadcast to all registered users

#### Step 2: Choose Category
Select the notification category:
- **Appointment Update** - For appointment-related notifications
- **Promotion** - For promotional offers
- **Payment Confirmation** - For payment-related messages
- **Service Update** - For service-related changes
- **General Announcement** - For general broadcasts
- **Reminder** - For reminders
- **Custom** - For custom notification types

#### Step 3: Compose Message
- **Title** - Short, impactful title (appears in notification header)
- **Message** - Detailed notification body (max 500 characters)
- **Image URL** (Optional) - Include an image with the notification
- **Additional Data** (Optional) - Custom JSON data for mobile app handling

#### Step 4: Preview and Send
1. Click **Preview** to see how the notification will appear
2. Review the preview modal
3. Click **Proceed to Send** or go back to edit
4. Notification is sent and stored in Firestore

### User Search
When sending to a single user, use the search field to quickly find users by:
- Full name
- Email address

## Firestore Data Structure

### Notification Document

```json
{
  "userId": "user123",
  "title": "Appointment Confirmed",
  "body": "Your appointment has been confirmed for tomorrow at 2:00 PM",
  "type": "appointment",
  "imageUrl": "https://example.com/image.jpg",
  "data": {
    "appointmentId": "apt123",
    "link": "/appointment-details"
  },
  "timestamp": "2024-11-13T10:30:00Z",
  "sentBy": "admin@example.com",
  "sentByName": "Admin Name",
  "isRead": false
}
```

### Collection Path
```
/users/{userId}/notifications/{notificationId}
```

## API Integration

### Cloud Function Endpoint

**Function:** `sendNotificationToUser`

**URL:** 
```
https://us-central1-kingsleycarwashapp.cloudfunctions.net/sendNotificationToUser
```

**Method:** POST

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "userId": "user123",
  "title": "Notification Title",
  "body": "Notification message body",
  "data": {
    "customKey": "customValue"
  },
  "imageUrl": "https://example.com/image.jpg"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Notifications sent successfully",
  "notificationsSent": 1,
  "failedSends": 0,
  "invalidTokensRemoved": 0,
  "notificationDocId": "notification123"
}
```

## Mobile App Integration

### Receiving Notifications

The mobile app should:

1. **Listen to Firestore Changes**
   ```javascript
   db.collection('users').doc(userId)
     .collection('notifications')
     .orderBy('timestamp', 'desc')
     .onSnapshot(snapshot => {
       // Handle new notifications
     });
   ```

2. **Handle Push Notifications**
   - Listen to FCM messages
   - Display notifications in UI
   - Update notification UI when new notifications arrive

3. **Mark as Read**
   ```javascript
   await db.collection('users').doc(userId)
     .collection('notifications').doc(notificationId)
     .update({ isRead: true });
   ```

### Data Handling

The mobile app can access notification data via the `data` field:
```javascript
const notificationData = notification.data;
if (notificationData.appointmentId) {
  // Navigate to appointment details
}
```

## Admin Dashboard Features

### Recent Notifications List

The admin dashboard displays recently sent notifications:
- Shows notification title and message
- Displays timestamp of when it was sent
- Indicates which user received it
- Shows the sender's email for audit trail

### Notification Status

The system provides real-time feedback:
- **Success** - Notification was stored and FCM token was found
- **Warning** - Notification was stored but user had no FCM tokens (will be delivered on next app open)
- **Error** - Notification failed to send

## Environment Configuration

### Required Firebase Settings

The system requires:
1. **Firestore Database** - Enabled and accessible
2. **Firebase Cloud Messaging** - Enabled for push notifications
3. **Firebase Admin SDK** - Properly configured in Cloud Functions

### Deployment

To deploy the Cloud Functions:

```bash
cd functions
npm install
firebase deploy --only functions
```

## Best Practices

### Message Composition
- **Keep titles concise** - Max 65 characters for mobile display
- **Make messages actionable** - Tell users what to do
- **Include timestamps** - Users know when actions are relevant
- **Use emojis sparingly** - For clarity, not clutter

### Notification Categories
- Use consistent categories for user preference management
- Each category can be tracked separately in analytics
- Users can mute specific categories in app settings

### Timing
- Send promotional notifications during business hours
- Critical notifications (appointments, payments) can be sent anytime
- Avoid sending multiple notifications within short intervals

### User Privacy
- Include sender information (admin email)
- Store notification history for audit trail
- Users can view all sent notifications from their profile

## Troubleshooting

### Issue: Notification sent but not received

**Possible Causes:**
1. **User has no FCM tokens** - App must be installed and permission granted
2. **Invalid FCM token** - Token expired or revoked (system auto-removes)
3. **Network issues** - Check user's internet connection

**Solution:**
- Request user to open app to register new FCM token
- Check Cloud Functions logs for specific errors

### Issue: "User not found" error

**Possible Causes:**
1. User ID doesn't exist in database
2. User document was deleted

**Solution:**
- Verify user ID in the search dropdown
- Check Firestore console to confirm user exists

### Issue: Custom JSON data not working

**Possible Causes:**
1. Invalid JSON format
2. Syntax errors in JSON

**Solution:**
- Use JSON validator before submitting
- Check browser console for parsing errors

## Monitoring and Analytics

### Checking Notification Status

Monitor notifications via Firebase Console:
1. Go to **Firestore Database**
2. Navigate to `users/{userId}/notifications`
3. View all sent notifications with metadata

### Viewing Cloud Function Logs

```bash
firebase functions:log
```

This shows:
- Notification send attempts
- FCM token validation results
- Error messages and stack traces

## Future Enhancements

### Planned Features
1. **Multi-user selection** - Send to custom user groups
2. **Scheduled notifications** - Schedule for later delivery
3. **Notification templates** - Pre-built message templates
4. **Recipient groups** - Create user groups for targeting
5. **Analytics dashboard** - Track notification delivery and engagement
6. **A/B testing** - Test different message variations
7. **Notification history** - Advanced filtering and search

## Support

For issues or questions:
1. Check Cloud Functions logs
2. Verify Firestore database structure
3. Ensure FCM tokens are properly stored
4. Review Firebase Console for any errors

## File Reference

- **Frontend:** `send-notification.html`, `send-notification.js`
- **Cloud Functions:** `functions/sendNotifications.js`
- **Styles:** Added to `style.css`
- **Sidebar Link:** Added to all admin pages

---

**Last Updated:** November 13, 2025  
**Version:** 1.0  
**Compatibility:** Firebase v9+, Modern browsers
