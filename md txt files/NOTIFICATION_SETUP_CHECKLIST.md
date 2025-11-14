# Notification System - Setup Checklist

## Pre-Deployment Checklist

### 1. Firestore Database Setup
- [ ] Firestore database is created in Firebase project
- [ ] Database is in production mode or has appropriate security rules
- [ ] Collections exist: `users`

### 2. Firebase Cloud Messaging (FCM) Setup
- [ ] FCM is enabled in Firebase Console
- [ ] Server API key is generated
- [ ] Web API key is generated and added to firebase-config.js

### 3. Cloud Functions
- [ ] Cloud Functions are enabled in Firebase project
- [ ] `functions/sendNotifications.js` contains all notification functions
- [ ] `functions/package.json` has required dependencies:
  - [ ] firebase-admin
  - [ ] firebase-functions
- [ ] Deploy functions with: `firebase deploy --only functions`

### 4. Security Rules
- [ ] Firestore security rules allow users to read their own notifications
- [ ] Recommended rule:
```javascript
match /users/{userId}/notifications/{document=**} {
  allow read: if request.auth.uid == userId;
  allow create, update: if request.auth.token.email == 'admin@your-domain.com';
}
```

### 5. Admin Panel Setup
- [ ] `send-notification.html` is accessible from sidebar
- [ ] `send-notification.js` is properly included
- [ ] Styles in `style.css` are loaded correctly
- [ ] Admin user has Firebase auth token

### 6. Mobile App Integration
- [ ] Mobile app registers FCM token on app launch
- [ ] Token is stored in `users/{userId}/fcmTokens` array
- [ ] App listens to `users/{userId}/notifications` collection
- [ ] App handles incoming push notifications

### 7. Testing

#### Manual Testing
- [ ] Admin can access Send Notifications page
- [ ] User search dropdown loads all users
- [ ] Can select a user and compose message
- [ ] Preview modal displays correctly
- [ ] Message is sent successfully

#### Functional Testing
- [ ] Notification appears in Firestore
- [ ] Admin sees notification in "Recently Sent" list
- [ ] Mobile app receives push notification
- [ ] Notification appears in app UI
- [ ] Can mark notification as read

#### Error Handling
- [ ] Invalid JSON data shows error message
- [ ] Missing required fields prevents sending
- [ ] User with no FCM token shows warning
- [ ] Network errors are handled gracefully

### 8. Deployment Steps

```bash
# 1. Install dependencies
cd functions
npm install

# 2. Deploy Cloud Functions
firebase deploy --only functions

# 3. Verify deployment
firebase functions:list

# 4. Check logs
firebase functions:log
```

### 9. Post-Deployment Verification

- [ ] Cloud Function URL is accessible
- [ ] CORS headers are properly set
- [ ] Firestore rules allow notifications to be written
- [ ] Mobile app can receive push notifications
- [ ] Admin dashboard is fully functional

## Configuration Variables

### Firebase Project ID
```
kingsleycarwashapp
```

### Cloud Function Endpoint
```
https://us-central1-kingsleycarwashapp.cloudfunctions.net/sendNotificationToUser
```

### Firestore Collections
```
users/{userId}/notifications
```

### Admin Email (Update if needed)
```
Set in send-notification.js
```

## Troubleshooting Deployment

### Issue: Functions not deploying
```bash
# Solution: Check Node.js version
node --version  # Should be 14+ for Node runtime

# Clear cache and reinstall
rm -rf node_modules
npm install
firebase deploy --only functions
```

### Issue: CORS errors in admin dashboard
```
Check Cloud Function has:
res.set("Access-Control-Allow-Origin", "*");
res.set("Access-Control-Allow-Methods", "GET, POST");
```

### Issue: Notifications not storing in Firestore
```
Check:
1. Firestore security rules allow writes
2. User document exists in database
3. Cloud Function has admin.firestore() initialized
```

## Security Considerations

1. **Admin Authentication**
   - Only authenticated admins can access send notification page
   - Auth guard checks user role

2. **Firestore Rules**
   - Regular users can only read their own notifications
   - Only admins can create notifications

3. **Data Validation**
   - JSON validation for custom data
   - Character limits on titles and messages
   - URL validation for image URLs

4. **Token Management**
   - Invalid FCM tokens are automatically removed
   - Tokens expire and are refreshed by mobile app

## Performance Optimization

### Bulk Sending
For sending to 100+ users:
1. Use Cloud Tasks for scheduling
2. Batch send in groups of 500
3. Add delays between batches to avoid rate limits

### Firestore Optimization
1. Index notifications by timestamp for faster queries
2. Use collection groups for cross-user searches
3. Archive old notifications periodically

## Maintenance

### Regular Tasks
- [ ] Monitor Cloud Function costs
- [ ] Review error logs weekly
- [ ] Test notification delivery monthly
- [ ] Update security rules as needed

### Monthly Checklist
- [ ] Check for deprecated Firebase APIs
- [ ] Review FCM token refresh rates
- [ ] Analyze notification engagement
- [ ] Update documentation as needed

---

**Setup Completed Date:** _________________  
**Verified By:** _________________  
**Notes:**
```
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________
```
