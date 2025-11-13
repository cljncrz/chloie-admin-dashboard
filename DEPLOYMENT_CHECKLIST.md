# Push Notifications - Deployment Checklist

## Pre-Deployment

- [ ] Firebase project ID is correct: `kingsleycarwashapp`
- [ ] Firebase Admin SDK credentials available
- [ ] Node.js v16+ installed
- [ ] npm dependencies can be installed

## Step 1: Deploy Cloud Functions

```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Deploy functions to Firebase
firebase deploy --only functions
```

**Verify:**
- [ ] All functions deployed successfully in Firebase Console
- [ ] No errors in deployment log

**Deployed Functions:**
- [ ] `sendNotificationToUser` - HTTP endpoint
- [ ] `sendBulkNotification` - HTTP endpoint  
- [ ] `onAppointmentUpdated` - Firestore trigger
- [ ] `onPaymentReceived` - Firestore trigger
- [ ] `onNewReview` - Firestore trigger

## Step 2: Start Node.js Server

```bash
# Navigate to project root
cd ..

# Install dependencies (if not done)
npm install

# Start server
npm start
```

**Expected Output:**
```
✅ Firebase Admin SDK initialized
🚀 Server running at http://localhost:5000
📤 Upload endpoint: POST http://localhost:5000/api/upload
📢 Send notifications: POST http://localhost:5000/api/notifications/send
❤️  Health check: GET http://localhost:5000/health
```

**Verify:**
- [ ] Server started without errors
- [ ] Health endpoint works: `curl http://localhost:5000/health`

## Step 3: Configure Firestore

Create collections and set security rules:

```javascript
// Firestore Collections
collections/
  ├── users/              // Store FCM tokens
  │   └── {userId}
  │       ├── fcmTokens: string[]
  │       ├── name: string
  │       └── email: string
  │
  ├── notifications/      // Notification logs
  │   └── {notificationId}
  │       ├── userId: string
  │       ├── type: string
  │       ├── title: string
  │       ├── body: string
  │       ├── sentAt: timestamp
  │       └── read: boolean
  │
  ├── appointments/       // Appointments for triggers
  │   └── {appointmentId}
  │       ├── customerId: string
  │       ├── status: string
  │       └── ...
  │
  └── payments/           // Payments for triggers
      └── {paymentId}
          ├── customerId: string
          ├── amount: number
          └── ...
```

**Firestore Security Rules (Recommendations):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Notifications collection
    match /notifications/{notification} {
      allow create: if request.auth != null;
      allow read: if request.auth.uid == resource.data.userId;
    }
    
    // Appointments triggers
    match /appointments/{appointment} {
      allow read: if request.auth != null;
    }
    
    // Payments triggers
    match /payments/{payment} {
      allow read: if request.auth != null;
    }
  }
}
```

**Verify:**
- [ ] Collections created in Firestore
- [ ] Security rules deployed

## Step 4: Test Notifications

### Test 1: Single Notification
```bash
curl -X POST http://localhost:5000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "title": "Test Notification",
    "body": "This is a test message",
    "type": "test",
    "data": { "testKey": "testValue" }
  }'
```

**Verify:**
- [ ] Response shows success
- [ ] User has FCM tokens registered (if not, test won't send)

### Test 2: Register FCM Token
```bash
curl -X POST http://localhost:5000/api/notifications/register-token \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "fcmToken": "sample-fcm-token-from-mobile-app"
  }'
```

**Verify:**
- [ ] Token registered successfully
- [ ] Firestore shows token in `users/test-user-123/fcmTokens`

### Test 3: Browser Console Test
```javascript
// Open browser console on any page with notification-service.js
await NotificationService.sendNotification('test-user-123', {
  title: 'Browser Test',
  body: 'Sent from browser console',
  type: 'test'
});
```

**Verify:**
- [ ] No errors in console
- [ ] Response indicates success or user has no tokens

## Step 5: Verify Admin Integration

### Test Appointment Approval
1. [ ] Open Appointments page in admin dashboard
2. [ ] Create or select a pending appointment
3. [ ] Approve the appointment
4. [ ] Verify:
   - [ ] Toast notification shows "Notification sent to [Customer Name]"
   - [ ] Appointment status changes to "Approved"
   - [ ] Check Firestore `notifications` collection for log entry

### Test Appointment Denial
1. [ ] Select another pending appointment
2. [ ] Click "Deny"
3. [ ] Verify:
   - [ ] Toast shows cancellation notification sent
   - [ ] Status changes to "Denied"
   - [ ] Notification logged in Firestore

## Step 6: Mobile App Integration (When Ready)

- [ ] Mobile app implements Firebase Cloud Messaging
- [ ] Mobile app requests notification permissions
- [ ] Mobile app registers FCM token on login:
  ```
  POST /api/notifications/register-token
  Body: { userId, fcmToken }
  ```
- [ ] Mobile app listens for incoming notifications
- [ ] Mobile app handles foreground notifications
- [ ] Mobile app handles background notifications

## Step 7: Production Deployment

### Firebase Hosting
```bash
firebase deploy --only hosting
```
- [ ] Hosting deployed
- [ ] Custom domain configured (if applicable)

### Production Environment Variables
```bash
# server.js environment
PORT=5000
NODE_ENV=production
FIREBASE_PROJECT_ID=kingsleycarwashapp
```

- [ ] Set in production server
- [ ] Firebase credentials secured

### Monitoring
- [ ] Set up Firebase Cloud Function monitoring
- [ ] Enable Cloud Logging
- [ ] Set up alerts for failed notifications
- [ ] Monitor Firestore write volume

## Step 8: Documentation

- [ ] Team trained on notification system
- [ ] Documentation shared: `NOTIFICATIONS_SETUP.md`
- [ ] Quick start guide available: `NOTIFICATIONS_QUICKSTART.md`
- [ ] API endpoints documented
- [ ] Mobile app integration guide provided

## Rollback Plan

If issues occur:

```bash
# Stop server
# (Ctrl+C in terminal)

# Rollback Cloud Functions
firebase deploy --only functions

# Clear invalid FCM tokens (manual cleanup)
# Delete Firestore notifications collection if needed

# Restart server
npm start
```

## Post-Deployment

- [ ] Monitor Firestore notifications collection for logs
- [ ] Check Cloud Function logs for errors
- [ ] Verify customer notifications in mobile app
- [ ] Monitor system performance
- [ ] Gather feedback from mobile app users

## Support Contacts

- **Firebase Console:** https://console.firebase.google.com/
- **Cloud Functions Logs:** Firebase Console > Cloud Functions > Logs
- **Firestore Console:** Firebase Console > Firestore
- **Server Logs:** Check terminal running `npm start`

## Common Issues & Solutions

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| "User not found" | User doesn't exist in Firestore | Register user first |
| "No FCM tokens" | User has no registered devices | Mobile app needs to register token |
| "Invalid token" | Token is invalid or expired | System auto-removes, user re-registers |
| CORS errors | Server CORS not configured | Verify `cors()` in server.js |
| Functions not deployed | Deployment failed | Check Firebase permissions, run deploy again |
| Notifications delayed | Cold start | Functions warming up, normal first call |

---

## Success Criteria

✅ All tests passed
✅ Notifications appear in mobile app
✅ Admin dashboard shows success messages
✅ Firestore logs all notifications
✅ No errors in Cloud Function logs
✅ Server handles high volume without errors
✅ Production environment ready

---

**Deployment completed:** _______________  
**Deployed by:** _______________  
**Notes:** _______________________________________________

