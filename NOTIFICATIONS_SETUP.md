# Push Notifications Implementation Guide

## Overview
Your admin dashboard now has full push notification capability to send real-time notifications to mobile app users. The system includes:

- **Firebase Cloud Functions** for automated triggers
- **Node.js Server Endpoints** for on-demand notifications
- **Notification Service Utility** for easy integration
- **Event-based Automation** for appointments, payments, and reviews

---

## Architecture

### Components

1. **Firebase Cloud Functions** (`functions/sendNotifications.js`)
   - `sendNotificationToUser` - Send to individual users
   - `sendBulkNotification` - Send to multiple users
   - `onAppointmentUpdated` - Auto-trigger on status changes
   - `onPaymentReceived` - Auto-trigger when payments are created
   - `onNewReview` - Auto-trigger when reviews are submitted

2. **Node.js Server** (`server.js`)
   - `POST /api/notifications/send` - Send notification
   - `POST /api/notifications/register-token` - Register FCM token
   - `POST /api/notifications/unregister-token` - Unregister FCM token

3. **Notification Service** (`notification-service.js`)
   - Client-side utility module
   - Pre-built notification methods for common scenarios
   - Toast notification helpers

---

## Setup Instructions

### Step 1: Deploy Cloud Functions

```bash
cd functions
npm install
firebase deploy --only functions
```

### Step 2: Start Node.js Server

```bash
npm install
node server.js
```

The server will run on `http://localhost:5000`

### Step 3: Configure Your HTML Files

Add the notification service script to any page that needs to send notifications:

```html
<script src="notification-service.js"></script>
```

---

## Usage Examples

### 1. Send Single Notification

```javascript
// Send notification to a customer when appointment is approved
await NotificationService.sendNotification('customer-id-123', {
  title: '✅ Appointment Confirmed',
  body: 'Your Full Package Detailing appointment has been confirmed for Oct 28, 2:00 PM.',
  type: 'appointment_confirmed',
  data: {
    appointmentId: 'appt-456',
    serviceName: 'Full Package Detailing'
  }
});
```

### 2. Send Bulk Notification (Promotion)

```javascript
// Send promotion to all customers
const customerIds = ['customer1', 'customer2', 'customer3'];
await NotificationService.notifyNewPromotion(customerIds, {
  id: 'promo-789',
  title: 'Holiday Special - 20% Off',
  description: 'Get 20% off all premium services this weekend!',
  discount: '20%',
  imageUrl: 'https://example.com/promo.jpg'
});
```

### 3. Appointment Confirmation

```javascript
// In appointment-scheduler.js, after approving appointment:
await NotificationService.notifyAppointmentConfirmed(
  appointment.customerId,
  {
    id: appointment.serviceId,
    serviceName: appointment.service,
    dateTime: appointment.datetime,
    technician: selectedTechnician
  }
);
```

### 4. Payment Received Notification

```javascript
// After processing payment
await NotificationService.notifyPaymentReceived(
  customerId,
  {
    id: 'payment-001',
    amount: 199.99,
    serviceName: 'Premium Detailing',
    method: 'Credit Card'
  }
);
```

### 5. Service Completion

```javascript
// When marking service as completed
await NotificationService.notifyServiceCompleted(
  customerId,
  {
    id: appointment.serviceId,
    serviceName: appointment.service
  }
);
```

### 6. Review Request

```javascript
// Request customer feedback
await NotificationService.notifyReviewRequest(
  customerId,
  {
    serviceName: appointment.service,
    appointmentId: appointment.serviceId
  }
);
```

### 7. Show Toast (In-Dashboard Notification)

```javascript
// Provide visual feedback on the admin dashboard
NotificationService.showToast(
  'Notification sent successfully',
  'success',
  3000 // 3 second duration
);
```

---

## Integration Points

### Appointments Page (`appointments.js`)

Add after approving appointment:
```javascript
await NotificationService.notifyAppointmentConfirmed(
  appointment.customerId,
  {
    id: appointment.serviceId,
    serviceName: appointment.service,
    dateTime: appointment.datetime,
    technician: selectedTechnician
  }
);
```

### Scheduler (`appointment-scheduler.js`)

Already integrated with the approve button. Just ensure:
```javascript
<script src="notification-service.js"></script>
```
is included in the HTML.

### Payment Page (`payment-monitoring.js`)

Add when payment is recorded:
```javascript
await NotificationService.notifyPaymentReceived(
  customerId,
  {
    id: payment.id,
    amount: payment.amount,
    serviceName: serviceName,
    method: payment.method
  }
);
```

### Reviews Page (`reviews.js`)

Add when requesting reviews:
```javascript
await NotificationService.notifyReviewRequest(
  customerId,
  {
    serviceName: appointmentService,
    appointmentId: appointmentId
  }
);
```

### Promotions Page (`create-promotion.js`)

Add when creating new promotion:
```javascript
// Get all customer IDs
const customersSnapshot = await db.collection('customers').get();
const customerIds = customersSnapshot.docs.map(doc => doc.id);

await NotificationService.notifyNewPromotion(
  customerIds,
  {
    id: promotionId,
    title: formData.title,
    description: formData.description,
    discount: formData.discount,
    imageUrl: promotionImageUrl
  }
);
```

---

## Firestore Data Structure

### Users Collection

Store FCM tokens in the `users` collection:

```firestore
users/
  {userId}/
    fcmTokens: string[]     // Array of device tokens
    name: string
    email: string
    phone: string
    lastTokenRegistered: timestamp
```

### Notifications Collection

Auto-logged notifications:

```firestore
notifications/
  {notificationId}/
    userId: string
    type: string            // 'appointment', 'payment', 'promotion', etc.
    title: string
    body: string
    data: object
    imageUrl: string (optional)
    sentAt: timestamp
    read: boolean
    successCount: number    // How many devices received it
    failureCount: number    // How many failed
```

### Appointments Collection

Update your appointments collection if not already present:

```firestore
appointments/
  {appointmentId}/
    customerId: string      // Link to customer
    serviceName: string
    dateTime: string
    status: string          // 'Pending', 'Approved', 'In Progress', 'Completed', 'Cancelled'
    technician: string
    createdAt: timestamp
    updatedAt: timestamp
```

---

## Mobile App Integration

### For Flutter/React Native Apps

When user logs in, register their FCM token:

```javascript
// JavaScript equivalent for web testing
import messaging from '@react-native-firebase/messaging';

async function registerFCMToken(userId) {
  const token = await messaging().getToken();
  
  await fetch('http://localhost:5000/api/notifications/register-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, fcmToken: token })
  });
}

// Call on app launch
registerFCMToken(currentUserId);
```

### Handle Foreground Notifications

```javascript
messaging().onMessage((remoteMessage) => {
  console.log('Notification received:', remoteMessage);
  // Display local notification or update UI
});
```

### Handle Background Notifications

```javascript
messaging().setBackgroundMessageHandler((remoteMessage) => {
  console.log('Background notification:', remoteMessage);
  // Process notification in background
});
```

---

## Testing

### Test with cURL

```bash
# Test sending notification
curl -X POST http://localhost:5000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "customer-123",
    "title": "Test Notification",
    "body": "This is a test message",
    "type": "test",
    "data": { "testKey": "testValue" }
  }'

# Register FCM token
curl -X POST http://localhost:5000/api/notifications/register-token \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "customer-123",
    "fcmToken": "sample-fcm-token-abc123"
  }'
```

### Test in Browser Console

```javascript
// After including notification-service.js
await NotificationService.sendNotification('test-user', {
  title: 'Test',
  body: 'This is a test',
  type: 'test'
});
```

---

## Troubleshooting

### Notifications Not Sending

1. **Check FCM tokens are registered**
   - Verify tokens exist in Firestore `users` collection
   - Ensure tokens are valid and not expired

2. **Verify Firebase Admin SDK is initialized**
   - Check server logs for initialization messages
   - Ensure `firebase-service-account.json` is properly configured

3. **Check Firebase Cloud Messaging is enabled**
   - Go to Firebase Console
   - Enable Cloud Messaging API

### Handling Invalid Tokens

The system automatically:
- Removes invalid tokens from Firestore
- Logs failed send attempts
- Returns failure count in response

Manual cleanup:
```javascript
// Remove old tokens (older than 30 days)
await db.collection('users').doc(userId).update({
  fcmTokens: admin.firestore.FieldValue.arrayRemove(oldToken)
});
```

---

## Environment Variables

### server.js

```env
PORT=5000
NODE_ENV=development
```

### functions/sendNotifications.js

No additional env vars needed, uses Firebase Admin SDK automatically.

---

## Best Practices

1. **Always validate recipient IDs** before sending
2. **Use batch operations** for sending to many users
3. **Include relevant data** in notifications for deep linking
4. **Monitor delivery rates** via Firestore logs
5. **Implement retry logic** for failed sends
6. **Rate limit notifications** to prevent spam
7. **Test thoroughly** on staging before production

---

## Next Steps

1. ✅ Deploy Cloud Functions: `firebase deploy --only functions`
2. ✅ Start Node.js server: `npm start`
3. ✅ Add notification service to HTML pages
4. ✅ Integrate with appointment approval workflow
5. ✅ Test sending notifications from admin dashboard
6. ✅ Configure mobile app to register FCM tokens
7. ✅ Monitor Firestore notifications collection for logs

---

## Support

For issues or questions:
- Check Firebase Console Cloud Messaging status
- Review server logs for error messages
- Test with sample notifications in browser console
- Verify Firestore security rules allow notifications collection

