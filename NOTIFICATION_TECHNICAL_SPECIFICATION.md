# Notification System - Technical Specification

**Version:** 1.0  
**Date:** November 13, 2025  
**Status:** Ready for Implementation  
**Author:** Development Team  

---

## 1. System Overview

### 1.1 Purpose
Enable administrators to send push notifications to mobile app users with persistent storage in Firestore.

### 1.2 Scope
- Admin dashboard interface for composing notifications
- Cloud Functions for FCM delivery and Firestore storage
- Firestore persistent storage of notification history
- Mobile app integration for receiving and displaying notifications

### 1.3 Goals
- ✅ Real-time push notification delivery
- ✅ Persistent notification history in Firestore
- ✅ User-friendly admin interface
- ✅ Flexible notification categories
- ✅ Image and custom data support
- ✅ Comprehensive error handling

---

## 2. Architecture

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD (Web)                     │
├─────────────────────────────────────────────────────────────┤
│  send-notification.html / send-notification.js              │
│  - User selection & search                                   │
│  - Notification composition                                  │
│  - Preview & send functionality                              │
│  - Recent notifications display                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   Firebase Firestore         │
        │ users/{userId}/notifications │
        │                              │
        │  Persistent Storage Layer    │
        └──────────┬───────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
   ┌─────────┐         ┌───────────────┐
   │ Firestore        │ Cloud Function │
   │Database  │         │ sendNotif...  │
   │Listen   │         │ FCM Delivery  │
   └─────────┘         └───────────────┘
        │                     │
        │                     ▼
        │              Firebase Cloud
        │              Messaging (FCM)
        │                     │
        └─────────────────────┤
                              ▼
                    ┌──────────────────┐
                    │   MOBILE APP     │
                    │  (iOS/Android)   │
                    │                  │
                    │ - FCM Listener   │
                    │ - Firestore Sync │
                    │ - UI Display     │
                    │ - Mark as Read   │
                    │ - Delete         │
                    └──────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | HTML5, CSS3, JavaScript ES6+ | Latest |
| Backend | Node.js Cloud Functions | 14+ |
| Database | Firestore | Latest |
| Messaging | Firebase Cloud Messaging | Latest |
| Authentication | Firebase Auth | Latest |
| Storage | Cloud Storage (for images) | Latest |

---

## 3. Data Models

### 3.1 Notification Document Schema

```javascript
{
  // Identifiers
  userId: string,                    // Recipient user ID
  
  // Content
  title: string,                     // Max 100 characters
  body: string,                      // Max 500 characters
  type: string,                      // appointment|promotion|payment|service|general|reminder|custom
  
  // Media
  imageUrl: string (optional),       // URL to notification image
  
  // Metadata
  data: {                            // Custom data object
    [key: string]: string
  },
  
  // Timestamps
  timestamp: Timestamp,              // When notification was sent
  sentAt: Timestamp,                 // Server timestamp
  
  // Sender Info
  sentBy: string,                    // Admin email address
  sentByName: string,                // Admin display name
  
  // Status
  isRead: boolean,                   // Default: false
  createdAt: Timestamp,              // Auto-generated
  updatedAt: Timestamp               // Auto-generated
}
```

### 3.2 Firestore Collection Path

```
/users/{userId}/notifications/{notificationId}
```

### 3.3 Indexes Required

**Index 1: Timestamp Descending**
```
Collection: users/{userId}/notifications
Field: timestamp (Descending)
Status: Create after first query
```

---

## 4. API Specification

### 4.1 Cloud Function: sendNotificationToUser

**Type:** HTTP Callable Function

**Endpoint:**
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

**Request Payload:**
```json
{
  "userId": "user_123",
  "title": "Appointment Confirmed",
  "body": "Your appointment is confirmed for tomorrow at 2:00 PM",
  "data": {
    "appointmentId": "apt_456",
    "appointmentTime": "2024-11-14 14:00"
  },
  "imageUrl": "https://example.com/image.jpg"
}
```

**Request Validation:**
- ✅ userId: Required, must exist in Firestore
- ✅ title: Required, string (1-100 chars)
- ✅ body: Required, string (1-500 chars)
- ✅ data: Optional, JSON object
- ✅ imageUrl: Optional, valid URL

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Notifications sent successfully",
  "notificationsSent": 1,
  "failedSends": 0,
  "invalidTokensRemoved": 0,
  "notificationDocId": "doc_789"
}
```

**Response (Error - 400):**
```json
{
  "error": "Missing required fields: userId, title, body"
}
```

**Response (Error - 404):**
```json
{
  "error": "User not found"
}
```

**Response (Error - 500):**
```json
{
  "error": "Failed to send notification",
  "details": "Detailed error message"
}
```

**Error Codes:**
- 400: Bad Request (validation error)
- 404: Not Found (user not found)
- 405: Method Not Allowed
- 500: Internal Server Error

### 4.2 Cloud Function: sendBulkNotification

**Endpoint:** Same as sendNotificationToUser (reuses function)

**Request Payload:**
```json
{
  "userIds": ["user_1", "user_2", "user_3"],
  "title": "New Promotion",
  "body": "Get 20% off on car wash services",
  "data": {
    "promotionId": "promo_789",
    "code": "CARWASH20"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk notifications completed",
  "totalSent": 3,
  "totalFailed": 0
}
```

---

## 5. Frontend Specification

### 5.1 Admin Interface Components

#### 5.1.1 Notification Target Selector
- Radio buttons: Single User | Multiple Users | All Users
- Toggles visibility of user selection section

#### 5.1.2 User Selection
- Dropdown with all users from Firestore
- Search input for filtering users
- Displays user name and email
- Validates selection before sending

#### 5.1.3 Notification Category Dropdown
Options:
- Appointment Update
- Promotion
- Payment Confirmation
- Service Update
- General Announcement
- Reminder
- Custom

#### 5.1.4 Message Composition
- Title input (max 100 characters)
- Message textarea (max 500 characters)
- Character counter for message
- Real-time validation

#### 5.1.5 Optional Fields
- Image URL input with preview
- Custom data JSON textarea
- JSON validation

#### 5.1.6 Preview Modal
- Shows notification as it will appear
- Displays title, message, image
- Confirmation buttons (Send / Cancel)

#### 5.1.7 Recent Notifications List
- Shows last 10 sent notifications
- Displays title, message, timestamp
- Shows recipient user ID
- Shows sender (admin email)

#### 5.1.8 Status Messages
- Success: "✅ Notification sent to X user(s)"
- Error: "❌ Error: [message]"
- Info: "⏳ Sending notification..."
- Warning: "⚠️ User has no FCM tokens"

### 5.2 Form Validation

**Required Fields:**
- [ ] Title (1-100 characters)
- [ ] Message (1-500 characters)
- [ ] Category (select one)
- [ ] User(s) (for single mode)

**Optional Fields Validation:**
- [ ] Image URL: Valid URL format
- [ ] Custom Data: Valid JSON format

**Error Messages:**
```
"Please fill in all required fields"
"Title must be between 1 and 100 characters"
"Message must be between 1 and 500 characters"
"Please select a category"
"Please select a user"
"Invalid image URL"
"Invalid JSON in custom data"
```

---

## 6. Cloud Functions Specification

### 6.1 sendNotificationToUser Implementation

**Steps:**
1. Validate request (CORS check)
2. Extract and validate payload
3. Query user document from Firestore
4. Check for FCM tokens
5. Build FCM message payload
6. Send to all user FCM tokens
7. Store notification in Firestore
8. Handle errors and invalid tokens
9. Return response

**Error Handling:**
- User not found → Return 404
- No FCM tokens → Return 200 (notification still stored)
- Invalid token → Auto-remove and continue
- Network error → Retry logic
- Firestore error → Log and return 500

### 6.2 FCM Payload Structure

```javascript
{
  notification: {
    title: "string",
    body: "string",
    imageUrl: "string" // optional
  },
  data: {
    // Custom data
    "key": "value"
  },
  android: {
    priority: "high",
    notification: {
      sound: "default",
      clickAction: "FLUTTER_NOTIFICATION_CLICK"
    }
  },
  apns: {
    payload: {
      aps: {
        "mutable-content": true,
        sound: "default",
        badge: 1
      }
    }
  },
  webpush: {
    data: {}, // Custom data
    fcmOptions: {
      link: "/"
    }
  }
}
```

### 6.3 Firestore Write Operation

**Collection:** `users/{userId}/notifications`

**Document Fields:**
```javascript
{
  userId,
  title,
  body,
  type: data.notificationType || "general",
  data,
  imageUrl,
  timestamp: admin.firestore.FieldValue.serverTimestamp(),
  isRead: false,
  sentAt: admin.firestore.FieldValue.serverTimestamp(),
  sentBy: admin.auth().currentUser.email,
  sentByName: admin.auth().currentUser.displayName
}
```

---

## 7. Firestore Security Rules

### 7.1 Recommended Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Block all by default
    match /{document=**} {
      allow read, write: if false;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId;
      
      // Notifications subcollection
      match /notifications/{notificationId} {
        allow read: if request.auth.uid == userId;
        allow create: if request.auth.uid != null;
        allow update: if request.auth.uid == userId && 
                      request.resource.data.keys().hasOnly(['isRead']);
        allow delete: if request.auth.uid == userId;
      }
    }
  }
}
```

### 7.2 Security Properties

- ✅ Users can only read their own notifications
- ✅ Users can only update isRead status
- ✅ Users can delete their own notifications
- ✅ Authenticated users can create notifications
- ✅ Admin override available through custom claims

---

## 8. Mobile App Integration

### 8.1 Required Implementations

**FCM Token Registration:**
```javascript
// On app launch
void registerFCMToken(String userId) {
  messaging.getToken().then((token) {
    db.collection('users').doc(userId).update({
      fcmTokens: FieldValue.arrayUnion([token])
    });
  });
}
```

**FCM Message Handler:**
```javascript
// Listen to messages
messaging.onMessage.listen((message) {
  // Handle notification
  displayNotification(message);
});
```

**Firestore Listener:**
```javascript
// Listen to notification collection
db.collection('users')
  .doc(userId)
  .collection('notifications')
  .orderBy('timestamp', 'desc')
  .snapshots()
  .listen((snapshot) {
    // Update UI with notifications
  });
```

### 8.2 Notification Actions

**Mark as Read:**
```javascript
db.collection('users')
  .doc(userId)
  .collection('notifications')
  .doc(notificationId)
  .update({ isRead: true });
```

**Delete Notification:**
```javascript
db.collection('users')
  .doc(userId)
  .collection('notifications')
  .doc(notificationId)
  .delete();
```

---

## 9. Performance Specifications

### 9.1 Cloud Function Performance

| Metric | Target | Max Acceptable |
|--------|--------|-----------------|
| Execution Time | < 2s | < 5s |
| Memory Usage | 256MB | 512MB |
| Cold Start | < 5s | < 10s |
| Timeout | 60s | N/A |

### 9.2 Firestore Performance

| Operation | Target | Max Acceptable |
|-----------|--------|-----------------|
| Write | < 100ms | < 500ms |
| Read | < 100ms | < 500ms |
| Query | < 200ms | < 1000ms |
| Storage | < 1GB | < 10GB |

### 9.3 FCM Delivery

| Metric | Target | Max Acceptable |
|--------|--------|-----------------|
| Delivery Time | < 1s | < 5s |
| Delivery Rate | > 99% | > 95% |
| Token Refresh | < 1s | < 5s |

---

## 10. Testing Specifications

### 10.1 Unit Testing

**Frontend:**
- Form validation tests
- User search functionality
- Preview modal display
- Status message display
- Error handling

**Backend:**
- FCM payload structure
- Firestore write operations
- Error handling and retries
- Token validation

### 10.2 Integration Testing

- End-to-end notification flow
- Admin send → Firestore store → FCM delivery
- Multiple user scenarios
- Error recovery

### 10.3 Load Testing

- 1000+ simultaneous notifications
- 100+ concurrent users
- Firestore write limits
- FCM rate limits

---

## 11. Deployment Specifications

### 11.1 Environment Configuration

**Required Environment Variables:**
```
FIREBASE_PROJECT_ID=kingsleycarwashapp
FIREBASE_REGION=us-central1
ADMIN_EMAIL=admin@example.com
```

### 11.2 Deployment Steps

1. Install dependencies: `npm install`
2. Configure Firebase: `firebase init`
3. Deploy functions: `firebase deploy --only functions`
4. Verify deployment: `firebase functions:list`

### 11.3 Rollback Procedures

```bash
# Rollback to previous version
git revert HEAD
firebase deploy --only functions

# OR manually revert file and redeploy
```

---

## 12. Monitoring & Logging

### 12.1 Metrics to Monitor

- Function execution time
- Error rate
- FCM delivery rate
- Firestore write operations
- Storage usage
- Cost estimates

### 12.2 Logging Configuration

```javascript
// Log levels
- DEBUG: Detailed info for debugging
- INFO: General information
- WARN: Warnings about potential issues
- ERROR: Error messages

// Log format
[TIMESTAMP] [LEVEL] [FUNCTION] Message
```

### 12.3 Alert Thresholds

- Function error rate > 5% → Alert
- Function execution time > 5s → Alert
- Firestore errors > 10 per hour → Alert
- FCM delivery rate < 95% → Alert

---

## 13. Security Specifications

### 13.1 Authentication

- ✅ Firebase Authentication required
- ✅ Custom claims for admin verification
- ✅ Email/password or OAuth providers

### 13.2 Authorization

- ✅ Users can only access their own notifications
- ✅ Admins can send to any user
- ✅ Role-based access control

### 13.3 Data Protection

- ✅ HTTPS/TLS encryption in transit
- ✅ Firestore encryption at rest
- ✅ No sensitive data in notifications
- ✅ CORS headers for API

### 13.4 Rate Limiting

- Cloud Functions: 100 requests/second
- Firestore: Auto-scaling limits
- FCM: Device level throttling

---

## 14. Versioning & Changelog

### 14.1 Version History

**v1.0** - November 13, 2025
- Initial implementation
- Basic notification functionality
- Firestore storage
- FCM integration
- Admin dashboard

### 14.2 Future Versions

**v1.1** - TBD
- Scheduled notifications
- Notification templates
- User groups/segments
- Advanced analytics

**v2.0** - TBD
- A/B testing
- Notification preferences
- Rich notifications
- Advanced targeting

---

## 15. Appendix

### 15.1 Useful Links

- [Firebase Documentation](https://firebase.google.com/docs)
- [Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [FCM Documentation](https://firebase.google.com/docs/cloud-messaging)

### 15.2 Code Examples

See associated files:
- `NOTIFICATION_SYSTEM_GUIDE.md` - Implementation examples
- `MOBILE_APP_NOTIFICATION_GUIDE.md` - Mobile integration examples
- `send-notification.js` - Frontend implementation
- `functions/sendNotifications.js` - Backend implementation

### 15.3 Support Resources

- Setup Checklist: `NOTIFICATION_SETUP_CHECKLIST.md`
- Deployment Guide: `NOTIFICATION_DEPLOYMENT_GUIDE.md`
- Quick Reference: `NOTIFICATION_QUICK_REFERENCE.md`

---

**Document Version:** 1.0  
**Last Updated:** November 13, 2025  
**Status:** ✅ Approved for Implementation  
**Next Review:** After v1.0 production deployment
