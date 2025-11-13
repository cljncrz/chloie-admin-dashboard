# Notification System - Deployment Guide

## Complete Deployment Steps

### Phase 1: Preparation (15 minutes)

#### 1.1 Verify Firebase Project
```bash
# Check Firebase project
firebase projects:list

# Ensure you're in the correct project
firebase use kingsleycarwashapp

# Initialize if needed
firebase init
```

#### 1.2 Check Node.js & Tools
```bash
# Verify Node.js version (14+ required for Cloud Functions)
node --version

# Verify npm
npm --version

# Verify Firebase CLI
firebase --version
```

#### 1.3 Update Dependencies
```bash
# Go to functions directory
cd functions

# Check package.json dependencies
cat package.json

# Install/update dependencies
npm install

# Verify installations
npm list
```

### Phase 2: Code Updates (10 minutes)

#### 2.1 Update Cloud Functions

✅ **Already Done:**
- `sendNotifications.js` updated to store notifications in Firestore
- Both push and Firestore storage implemented
- CORS headers configured

#### 2.2 Verify Admin Interface

✅ **Already Done:**
- `send-notification.html` - Admin UI page created
- `send-notification.js` - JavaScript functionality created
- CSS styles added to `style.css`
- Sidebar links added to `index.html` and `notifications.html`

#### 2.3 Check File Structure
```
✅ send-notification.html - Admin page
✅ send-notification.js - Frontend logic
✅ functions/sendNotifications.js - Cloud Functions
✅ style.css - Updated with notification styles
✅ firebase-config.js - Firebase initialization
```

### Phase 3: Firestore Setup (10 minutes)

#### 3.1 Create/Verify Collections

**Required Collections:**
- `users` - Already exists
- `users/{userId}/notifications` - Will be auto-created on first notification

#### 3.2 Set Security Rules

Go to Firebase Console > Firestore > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Default deny all
    match /{document=**} {
      allow read, write: if false;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId;
      
      // User's notifications subcollection
      match /notifications/{notificationId} {
        allow read: if request.auth.uid == userId;
        allow create: if request.auth.uid != null;
        allow update, delete: if request.auth.uid == userId;
      }
    }
  }
}
```

#### 3.3 Create Indexes (if needed)

Go to Firebase Console > Firestore > Indexes

Create index for efficient notification queries:
- Collection: `users/{userId}/notifications`
- Fields: `timestamp (Descending)`
- Status: Should auto-create on first query

### Phase 4: Cloud Functions Deployment (10 minutes)

#### 4.1 Prepare Functions
```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Build/verify
npm run build  # if available

# Check for errors
npm test       # if available
```

#### 4.2 Deploy Functions
```bash
# From project root (not functions directory)
cd ..

# Deploy only functions
firebase deploy --only functions

# Expected output:
# i deploying functions, hosting
# i functions: clearing previous imports for functions
# ✔ functions: Uploading 3 functions (xxx MB)
# ✔ functions[sendNotificationToUser]: Successful
# ✔ functions[sendBulkNotification]: Successful
# ✔ functions[onAppointmentUpdated]: Successful
```

#### 4.3 Verify Deployment
```bash
# List deployed functions
firebase functions:list

# Check function logs (no errors expected yet)
firebase functions:log --lines 50

# Get function details
firebase functions:describe sendNotificationToUser
```

### Phase 5: Testing (15 minutes)

#### 5.1 Test Admin Interface

1. Open admin dashboard: `http://localhost:3000` (or your URL)
2. Navigate to "Send Notifications" from sidebar
3. Select a test user from dropdown
4. Fill in notification form:
   - Title: "Test Notification"
   - Message: "This is a test"
   - Category: "General Announcement"
5. Click Preview
6. Click "Proceed to Send"
7. Should see success message

#### 5.2 Verify Firestore Storage

In Firebase Console:
1. Go to Firestore Database
2. Navigate to: `users > [testUserId] > notifications`
3. Should see a new document with:
   - title: "Test Notification"
   - body: "This is a test"
   - timestamp: Current time
   - isRead: false

#### 5.3 Verify Cloud Function Logs

```bash
# Check function execution logs
firebase functions:log --lines 100

# Look for "Notifications sent successfully" message
```

#### 5.4 Test Mobile App Integration

1. Install mobile app on device
2. Login with test user account
3. Grant notification permissions
4. Send notification from admin dashboard
5. Should receive push notification on device
6. Check app's notifications page - should appear in list

### Phase 6: Production Validation (15 minutes)

#### 6.1 Security Checklist

- [ ] Firestore rules prevent unauthorized access
- [ ] Only authenticated users can trigger functions
- [ ] Admins can only create/update notifications
- [ ] Regular users can only read their own notifications
- [ ] No sensitive data in notification objects

#### 6.2 Performance Checklist

- [ ] Function execution time < 5 seconds
- [ ] Firestore write costs are reasonable
- [ ] FCM delivery time < 1 second
- [ ] No excessive database queries

#### 6.3 Error Handling Checklist

- [ ] Invalid user ID shows error message
- [ ] Network timeout handled gracefully
- [ ] Missing FCM token handled correctly
- [ ] Invalid JSON data shows validation error

### Phase 7: Monitoring Setup (10 minutes)

#### 7.1 Firebase Console Monitoring

Go to Firebase Console > Monitoring:
- [ ] Check Cloud Functions metrics
- [ ] Monitor Firestore read/write operations
- [ ] Track error rates

#### 7.2 Set Up Alerts (Optional)

1. Go to Cloud Monitoring
2. Create alert policy for:
   - Function execution errors
   - High response times
   - Quota limits

#### 7.3 View Logs

```bash
# Real-time function logs
firebase functions:log

# Filter by function
firebase functions:log --only sendNotificationToUser

# Save logs to file
firebase functions:log > function_logs.txt
```

### Phase 8: Documentation & Handoff (5 minutes)

#### 8.1 Documentation Generated

✅ **Created:**
- `NOTIFICATION_SYSTEM_GUIDE.md` - Complete system documentation
- `NOTIFICATION_SETUP_CHECKLIST.md` - Setup verification checklist
- `MOBILE_APP_NOTIFICATION_GUIDE.md` - Mobile app integration guide
- `NOTIFICATION_QUICK_REFERENCE.md` - Quick reference card
- `NOTIFICATION_DEPLOYMENT_GUIDE.md` - This file

#### 8.2 Share with Team

- [ ] Send documentation to backend team
- [ ] Share mobile app guide with iOS/Android developers
- [ ] Provide admin quick reference to support team
- [ ] Schedule training session if needed

## Troubleshooting Deployment

### Issue: Functions deployment fails

```bash
# Clear and reinstall
rm -rf functions/node_modules
npm cache clean --force
cd functions && npm install
cd .. && firebase deploy --only functions
```

### Issue: "Permission denied" error

```bash
# Check authentication
firebase login

# Verify project
firebase use kingsleycarwashapp

# Check firebaserc
cat .firebaserc
```

### Issue: Functions timeout

```bash
# Check function configuration
firebase functions:describe sendNotificationToUser

# May need to increase timeout in functions/index.js
```

### Issue: CORS errors in admin dashboard

```javascript
// Verify Cloud Function has CORS headers:
res.set("Access-Control-Allow-Origin", "*");
res.set("Access-Control-Allow-Methods", "GET, POST");
res.set("Access-Control-Allow-Headers", "Content-Type");
```

### Issue: Firestore not storing notifications

```bash
# Check Firestore rules in console
# Verify user document exists
# Check Cloud Function logs for write errors
firebase functions:log | grep -i "firestore"
```

## Post-Deployment Checklist

After deployment, verify everything works:

- [ ] Admin can access "Send Notifications" page
- [ ] Can select users from dropdown
- [ ] Can compose and preview notifications
- [ ] Notifications send successfully
- [ ] Notifications appear in Firestore
- [ ] Mobile app receives push notifications
- [ ] Cloud Function logs show no errors
- [ ] "Recently Sent" list populates correctly
- [ ] Users can view notifications in app
- [ ] Status messages display correctly

## Rollback Plan

If issues occur, rollback with:

```bash
# Redeploy previous version (if using version control)
git revert HEAD
firebase deploy --only functions

# OR, manually revert the sendNotifications.js file
# and redeploy
```

## Performance Metrics to Monitor

### Cloud Functions
- **Execution time**: Should be < 3 seconds
- **Memory usage**: 256MB or higher recommended
- **Errors**: Should be < 1% of requests

### Firestore
- **Write operations**: Should be < 1000/day for testing
- **Read operations**: Monitor for optimization
- **Storage**: Should be < 1GB for testing

### FCM
- **Delivery time**: < 1 second average
- **Delivery rate**: Should be > 95%
- **Token validity**: Monitor for expired tokens

## Maintenance Tasks

### Daily
- [ ] Monitor error logs
- [ ] Check failed notifications

### Weekly
- [ ] Review notification analytics
- [ ] Check Firestore storage usage
- [ ] Monitor function costs

### Monthly
- [ ] Optimize slow queries
- [ ] Archive old notifications
- [ ] Review and update security rules
- [ ] Audit admin access

## Success Criteria

Project is successfully deployed when:

✅ Admin can send notifications without errors
✅ Notifications appear in Firestore within 5 seconds
✅ Mobile app receives push notifications
✅ Cloud Function execution time < 3 seconds
✅ No unhandled errors in logs
✅ All UI elements render correctly
✅ Form validation works properly
✅ Recent notifications list updates
✅ Preview modal displays correctly
✅ Mobile app integration confirmed

## Next Steps

1. **Mobile App**: Implement notification listeners
2. **Admin Training**: Train staff on system usage
3. **User Communication**: Inform users about notifications
4. **Analytics**: Set up tracking for notification engagement
5. **Optimization**: Monitor and optimize based on usage

---

**Deployment Date:** _________________
**Deployed By:** _________________
**Verification Status:** ✅ Verified / ⚠️ Pending / ❌ Failed

**Notes:**
```
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________
```

**Support Contact:** _________________
**Emergency Rollback Contact:** _________________
