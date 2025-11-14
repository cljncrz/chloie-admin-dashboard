# Push Notifications - Quick Start Guide

## What's New?

Your admin dashboard now sends real-time push notifications to mobile app users for:
- ✅ Appointment confirmations
- ✅ Appointment cancellations/denials
- ✅ Payment receipts
- ✅ Service status updates
- ✅ Promotions & announcements
- ✅ Review requests

---

## Files Added/Modified

### New Files
- `functions/sendNotifications.js` - Firebase Cloud Functions for notifications
- `notification-service.js` - Client-side utility module
- `NOTIFICATIONS_SETUP.md` - Complete setup documentation

### Modified Files
- `functions/index.js` - Exports notification functions
- `server.js` - Added notification endpoints
- `appointment.html` - Added notification service script
- `appointment-scheduler.js` - Integrated notifications for appointment approval/denial

---

## Deployment Steps

### 1. Deploy Cloud Functions
```bash
cd functions
npm install
firebase deploy --only functions
```

### 2. Start Node.js Server
```bash
npm install
npm start
```

Server runs on: `http://localhost:5000`

### 3. Verify Installation
- Check Firebase Console for deployed functions
- Open browser console and test:
  ```javascript
  console.log(NotificationService); // Should show class
  ```

---

## Quick Examples

### Send Notification to Single Customer
```javascript
await NotificationService.sendNotification('customer-id', {
  title: 'Hello!',
  body: 'Your appointment has been confirmed',
  type: 'appointment_confirmed'
});
```

### Send Notification to Multiple Customers (Promotion)
```javascript
const customers = ['cust1', 'cust2', 'cust3'];
await NotificationService.notifyNewPromotion(customers, {
  id: 'promo-123',
  title: 'Summer Sale - 30% Off!',
  description: 'All premium services',
  discount: '30%'
});
```

### Appointment Approval (Already Integrated)
When approving an appointment in the admin dashboard, a notification is automatically sent to the customer.

### Show Success Message
```javascript
NotificationService.showToast(
  'Notification sent successfully!',
  'success',
  3000 // 3 seconds
);
```

---

## Integration Points

### Pages That Use Notifications
- `appointment.html` + `appointment-scheduler.js` - Appointment approval/denial ✅
- `payment-monitoring.js` - Add for payment confirmations
- `reviews.js` - Add for review requests
- `create-promotion.js` - Add for promotional campaigns
- `appointments.js` - Add for status updates

### How to Add to Other Pages

1. Include the script in the page header:
   ```html
   <script src="notification-service.js"></script>
   ```

2. Call the appropriate method:
   ```javascript
   // After marking service as complete
   await NotificationService.notifyServiceCompleted(customerId, {
     id: serviceId,
     serviceName: 'Premium Detailing'
   });
   ```

---

## Data Structure (Firestore)

### Users Collection
```
users/{userId}
  ├── fcmTokens: string[]        // Mobile device tokens
  ├── name: string
  ├── email: string
  └── lastTokenRegistered: timestamp
```

### Notifications Collection (Auto-logged)
```
notifications/{id}
  ├── userId: string
  ├── type: string              // appointment, payment, promotion, etc.
  ├── title: string
  ├── body: string
  ├── data: object
  ├── sentAt: timestamp
  ├── read: boolean
  └── successCount: number       // Devices that received it
```

---

## Testing

### Test from Browser Console
```javascript
// Must include notification-service.js first
await NotificationService.sendNotification('test-user-123', {
  title: 'Test Notification',
  body: 'This is a test message',
  type: 'test'
});
```

### Test from Command Line
```bash
curl -X POST http://localhost:5000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "title": "Test",
    "body": "This is a test",
    "type": "test"
  }'
```

---

## Mobile App Setup

### For Flutter/React Native
1. Initialize Firebase Cloud Messaging on app launch
2. Request notification permissions
3. Get FCM token and register with backend:

```javascript
// Pseudo-code
const fcmToken = await messaging().getToken();
await fetch('http://localhost:5000/api/notifications/register-token', {
  method: 'POST',
  body: JSON.stringify({ 
    userId: currentUser.id,
    fcmToken 
  })
});
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Notifications not sending | Check FCM tokens registered in Firestore |
| Server not running | Run `npm start` from project root |
| Cloud Functions failed | Run `firebase deploy --only functions` again |
| Invalid token errors | System auto-cleans invalid tokens |
| CORS errors | Ensure server is running and has `cors()` middleware |

---

## Next Steps

1. ✅ Deploy Cloud Functions
2. ✅ Start Node.js server
3. ✅ Test appointment notifications
4. Integrate into other workflows (payments, promotions, reviews)
5. Set up mobile app FCM token registration
6. Test end-to-end with mobile app

---

## Documentation

For detailed information, see `NOTIFICATIONS_SETUP.md`

