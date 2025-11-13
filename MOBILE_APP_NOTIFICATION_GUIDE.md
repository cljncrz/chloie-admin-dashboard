# Mobile App - Notification Integration Guide

## Overview

The mobile app receives notifications through two channels:

1. **Push Notifications** - Real-time delivery via Firebase Cloud Messaging (FCM)
2. **Firestore Storage** - Persistent notification history for offline access

## Setup Requirements

### 1. FCM Token Registration

Register the device's FCM token when the app launches:

```javascript
// Pseudocode for Flutter/React Native
void setupNotifications() {
  // Get FCM token
  String? token = await FirebaseMessaging.instance.getToken();
  
  if (token != null) {
    // Store in Firestore under current user
    await FirebaseFirestore.instance
        .collection('users')
        .doc(userId)
        .update({
          'fcmTokens': FieldValue.arrayUnion([token])
        });
  }
}
```

### 2. Handle FCM Messages

Listen for incoming push notifications:

```javascript
// Pseudocode
void initFCMListener() {
  FirebaseMessaging.onMessage.listen((RemoteMessage message) {
    // Handle foreground notification
    print('Got a message: ${message.notification?.title}');
    
    // Store in Firestore (optional, for logging)
    addNotificationToUI(message);
  });
  
  FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
    // Handle notification when app is opened from background
    handleNotificationTap(message);
  });
}
```

### 3. Display Notifications

Show notifications in the app UI:

```javascript
void addNotificationToUI(RemoteMessage message) {
  final notification = {
    'title': message.notification?.title ?? 'New Notification',
    'body': message.notification?.body ?? '',
    'data': message.data,
    'timestamp': DateTime.now(),
    'isRead': false
  };
  
  // Add to your notifications list/state
  setState(() {
    notifications.insert(0, notification);
  });
}
```

## Receiving Notifications from Firestore

### 1. Listen to User's Notifications Collection

```javascript
Stream<List<Notification>> getNotificationsStream(String userId) {
  return FirebaseFirestore.instance
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .orderBy('timestamp', descending: true)
      .snapshots()
      .map((snapshot) => snapshot.docs
          .map((doc) => Notification.fromFirestore(doc))
          .toList());
}

// In your widget
StreamBuilder(
  stream: getNotificationsStream(currentUserId),
  builder: (context, snapshot) {
    if (snapshot.hasData) {
      List<Notification> notifications = snapshot.data ?? [];
      return NotificationsList(notifications: notifications);
    }
    return LoadingWidget();
  }
)
```

### 2. Notification Model

```javascript
class Notification {
  final String id;
  final String userId;
  final String title;
  final String body;
  final String? type;
  final String? imageUrl;
  final Map<String, dynamic> data;
  final DateTime timestamp;
  final bool isRead;
  
  Notification({
    required this.id,
    required this.userId,
    required this.title,
    required this.body,
    this.type,
    this.imageUrl,
    this.data = const {},
    required this.timestamp,
    this.isRead = false,
  });
  
  factory Notification.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Notification(
      id: doc.id,
      userId: data['userId'] ?? '',
      title: data['title'] ?? '',
      body: data['body'] ?? '',
      type: data['type'],
      imageUrl: data['imageUrl'],
      data: data['data'] ?? {},
      timestamp: (data['timestamp'] as Timestamp).toDate(),
      isRead: data['isRead'] ?? false,
    );
  }
}
```

## Notification Actions

### 1. Mark as Read

```javascript
Future<void> markAsRead(String userId, String notificationId) async {
  await FirebaseFirestore.instance
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .doc(notificationId)
      .update({'isRead': true});
}
```

### 2. Delete Notification

```javascript
Future<void> deleteNotification(String userId, String notificationId) async {
  await FirebaseFirestore.instance
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .doc(notificationId)
      .delete();
}
```

### 3. Clear All Notifications

```javascript
Future<void> clearAllNotifications(String userId) async {
  final batch = FirebaseFirestore.instance.batch();
  
  final notifs = await FirebaseFirestore.instance
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .get();
  
  for (var doc in notifs.docs) {
    batch.delete(doc.reference);
  }
  
  await batch.commit();
}
```

## Handling Notification Data

Different notification types have different data structures:

### Appointment Notification
```json
{
  "title": "Appointment Confirmed",
  "body": "Your appointment has been confirmed for tomorrow",
  "type": "appointment",
  "data": {
    "appointmentId": "apt123",
    "link": "/appointment-details"
  }
}
```

**Handle in app:**
```javascript
if (notification.type == 'appointment' && notification.data.containsKey('appointmentId')) {
  navigateToAppointmentDetails(notification.data['appointmentId']);
}
```

### Promotion Notification
```json
{
  "title": "New Promotion",
  "body": "Get 20% off on car wash services",
  "type": "promotion",
  "data": {
    "promotionId": "promo123",
    "code": "CARWASH20"
  }
}
```

**Handle in app:**
```javascript
if (notification.type == 'promotion') {
  showPromotionDialog(notification);
  applyPromoCode(notification.data['code']);
}
```

## Push Notification Payload Example

When a notification is sent from the admin dashboard, here's what the mobile app receives:

```javascript
RemoteMessage {
  notification: {
    title: "Appointment Confirmed",
    body: "Your appointment has been confirmed!"
  },
  data: {
    appointmentId: "apt123",
    type: "appointment_confirmed"
  }
}
```

## UI Components

### Notification Item Widget

```javascript
class NotificationItem extends StatelessWidget {
  final Notification notification;
  final VoidCallback onTap;
  final VoidCallback onDelete;
  
  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: Key(notification.id),
      onDismissed: (_) => onDelete(),
      background: Container(color: Colors.red),
      child: ListTile(
        leading: CircleAvatar(
          child: Icon(Icons.notifications),
        ),
        title: Text(notification.title),
        subtitle: Text(notification.body),
        trailing: Icon(
          notification.isRead 
            ? Icons.done_all 
            : Icons.mail
        ),
        onTap: onTap,
      ),
    );
  }
}
```

### Notifications List Page

```javascript
class NotificationsPage extends StatefulWidget {
  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  late final Stream<List<Notification>> _notificationsStream;
  
  @override
  void initState() {
    super.initState();
    _notificationsStream = getNotificationsStream(currentUserId);
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () => clearAllNotifications(currentUserId),
            child: Text('Clear All')
          )
        ],
      ),
      body: StreamBuilder(
        stream: _notificationsStream,
        builder: (context, snapshot) {
          if (!snapshot.hasData) return Center(child: CircularProgressIndicator());
          
          List<Notification> notifications = snapshot.data ?? [];
          
          if (notifications.isEmpty) {
            return Center(child: Text('No notifications'));
          }
          
          return ListView.builder(
            itemCount: notifications.length,
            itemBuilder: (context, index) {
              return NotificationItem(
                notification: notifications[index],
                onTap: () => _handleNotificationTap(notifications[index]),
                onDelete: () => deleteNotification(currentUserId, notifications[index].id),
              );
            },
          );
        },
      ),
    );
  }
  
  void _handleNotificationTap(Notification notification) {
    // Mark as read
    markAsRead(currentUserId, notification.id);
    
    // Handle based on type
    switch (notification.type) {
      case 'appointment':
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => AppointmentDetailPage(
              appointmentId: notification.data['appointmentId']
            ),
          ),
        );
        break;
      case 'promotion':
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => PromotionsPage()),
        );
        break;
      default:
        // Show notification detail dialog
        showNotificationDetail(context, notification);
    }
  }
}
```

## Backend Integration

### Firestore Security Rules

Recommended rules for notifications:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
      
      // User's notifications subcollection
      match /notifications/{notificationId} {
        allow read: if request.auth.uid == userId;
        allow create: if request.auth.token.email matches /.*@(admin|company)\.com/;
        allow update: if request.auth.uid == userId && (
          resource.data.keys().hasOnly(['isRead', 'data'])
        );
        allow delete: if request.auth.uid == userId;
      }
    }
  }
}
```

## Error Handling

### Handle Missing FCM Token

```javascript
Future<void> registerFCMToken() async {
  try {
    String? token = await FirebaseMessaging.instance.getToken();
    
    if (token != null) {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(userId)
          .update({
            'fcmTokens': FieldValue.arrayUnion([token])
          });
    } else {
      print('Error: Could not get FCM token');
      // Retry or show user message
    }
  } catch (e) {
    print('Error registering FCM token: $e');
  }
}
```

### Handle Notification Delivery Failures

```javascript
Future<void> checkNotificationDelivery() async {
  try {
    final docs = await FirebaseFirestore.instance
        .collection('users')
        .doc(userId)
        .collection('notifications')
        .orderBy('timestamp', descending: true)
        .limit(10)
        .get();
    
    // Handle unread notifications
    for (var doc in docs.docs) {
      if (!doc['isRead']) {
        // Show in UI or send notification reminder
      }
    }
  } catch (e) {
    print('Error checking notifications: $e');
  }
}
```

## Testing

### Test Push Notifications

Use Firebase Console to send test notifications:
1. Go to Cloud Messaging in Firebase Console
2. Send a test notification to the FCM token
3. Verify it appears on the device

### Test Firestore Notifications

Manually add a notification document to Firestore:
```json
{
  "userId": "test-user-id",
  "title": "Test Notification",
  "body": "This is a test",
  "type": "general",
  "timestamp": "2024-11-13T10:00:00Z",
  "isRead": false
}
```

## Troubleshooting

### Issue: Not receiving FCM tokens
- Verify Firebase project is configured in mobile app
- Check app permissions (Android: POST_NOTIFICATIONS)
- Ensure user is authenticated before registering token

### Issue: Notifications not appearing
- Check Firestore collection path is correct
- Verify user ID matches in both FCM tokens and notifications
- Check security rules aren't blocking reads

### Issue: Old notifications not showing
- Add index on (timestamp) field in Firestore
- Increase query limit if needed
- Check for data type mismatches in timestamp field

## Best Practices

1. **Always register FCM token on app start**
2. **Refresh token periodically** - FCM tokens can expire
3. **Handle both push and Firestore notifications** - For redundancy
4. **Mark notifications as read** - Track user engagement
5. **Batch delete old notifications** - Keep database clean
6. **Show notification badge** - Indicate unread count
7. **Handle offline mode** - Firestore cached data
8. **Test on real devices** - Emulator FCM has limitations

## API Endpoints

### Admin Sends Notification
```
POST https://us-central1-kingsleycarwashapp.cloudfunctions.net/sendNotificationToUser
Content-Type: application/json

{
  "userId": "user123",
  "title": "Notification Title",
  "body": "Notification body",
  "data": { "customKey": "value" },
  "imageUrl": "https://example.com/image.jpg"
}
```

## Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Firestore Realtime Database](https://firebase.google.com/docs/firestore/manage-data)
- [Flutter Firebase Setup](https://firebase.flutter.dev/)
- [React Native Firebase Setup](https://rnfirebase.io/)

---

**Last Updated:** November 13, 2025  
**Version:** 1.0
