# Flutter/Dart Integration Guide - Kingsley Carwash Mobile App

Complete guide to integrate your Flutter mobile app with the admin dashboard's Firebase real-time updates and push notifications.

---

## 📱 Overview

Your Flutter app will:
1. **Register FCM tokens** when user logs in
2. **Listen for real-time updates** to appointments via Firestore
3. **Receive push notifications** when admin makes changes
4. **Display notifications** in foreground and background
5. **Update UI automatically** with appointment status changes

---

## 🔧 Prerequisites

- Flutter 3.0+ installed
- Firebase Cloud Messaging (FCM) configured
- Firebase Firestore configured
- Admin dashboard backend running on `http://localhost:5000`

---

## 📦 Add Dependencies

Add these to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^2.24.0
  firebase_auth: ^4.13.0
  firebase_messaging: ^14.7.0
  firebase_firestore: ^4.14.0
  cloud_firestore: ^4.14.0
  http: ^1.1.0
  uuid: ^4.0.0
  fluttertoast: ^8.2.0

dev_dependencies:
  flutter_test:
    sdk: flutter
```

Then run:
```bash
flutter pub get
```

---

## 🚀 Implementation

### 1. Firebase Initialization

Create `lib/services/firebase_service.dart`:

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class FirebaseService {
  static Future<void> initializeFirebase() async {
    await Firebase.initializeApp(
      options: const FirebaseOptions(
        apiKey: 'AIzaSyCFToN0U0Q3zmLZiTJAwPURrCgnCH7wPe0',
        appId: '1:123456789:android:abcdefg123456',
        messagingSenderId: '123456789',
        projectId: 'kingsleycarwashapp',
        databaseURL: 'https://kingsleycarwashapp-default-rtdb.firebaseio.com',
        storageBucket: 'kingsleycarwashapp.appspot.com',
      ),
    );
  }

  static FirebaseAuth getAuth() => FirebaseAuth.instance;
  static FirebaseFirestore getFirestore() => FirebaseFirestore.instance;
  static FirebaseMessaging getMessaging() => FirebaseMessaging.instance;
}
```

---

### 2. Notification Service

Create `lib/services/notification_service.dart`:

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

class NotificationService {
  static const String BASE_URL = 'http://localhost:5000';
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  /// Initialize notifications and register token
  static Future<void> initialize(String userId) async {
    // Request notification permissions
    NotificationSettings settings = await _messaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('✅ Notification permission granted');

      // Get FCM token
      String? token = await _messaging.getToken();
      
      if (token != null) {
        await registerFCMToken(userId, token);
      }

      // Listen for token refresh
      _messaging.onTokenRefresh.listen((newToken) {
        registerFCMToken(userId, newToken);
      });

      // Handle foreground notifications
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        _handleForegroundNotification(message);
      });

      // Handle background notifications
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        _handleNotificationTap(message);
      });

      // Handle background notification (when app is terminated)
      FirebaseMessaging.onBackgroundMessage(_handleBackgroundNotification);
    } else {
      print('❌ Notification permission denied');
    }
  }

  /// Register FCM token with backend
  static Future<void> registerFCMToken(String userId, String fcmToken) async {
    try {
      final response = await http.post(
        Uri.parse('$BASE_URL/api/notifications/register-token'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': userId,
          'fcmToken': fcmToken,
        }),
      );

      if (response.statusCode == 200) {
        print('✅ FCM Token registered: $fcmToken');
      } else {
        print('❌ Failed to register FCM token: ${response.body}');
      }
    } catch (e) {
      print('❌ Error registering FCM token: $e');
    }
  }

  /// Unregister FCM token when user logs out
  static Future<void> unregisterFCMToken(String userId, String fcmToken) async {
    try {
      final response = await http.post(
        Uri.parse('$BASE_URL/api/notifications/unregister-token'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': userId,
          'fcmToken': fcmToken,
        }),
      );

      if (response.statusCode == 200) {
        print('✅ FCM Token unregistered');
      }
    } catch (e) {
      print('❌ Error unregistering FCM token: $e');
    }
  }

  /// Handle foreground notifications
  static void _handleForegroundNotification(RemoteMessage message) {
    print('🔔 Foreground notification received');
    print('Title: ${message.notification?.title}');
    print('Body: ${message.notification?.body}');
    print('Data: ${message.data}');

    // Show toast
    Fluttertoast.showToast(
      msg: message.notification?.body ?? 'New notification',
      toastLength: Toast.LENGTH_LONG,
      gravity: ToastGravity.TOP,
    );

    // Update UI with notification data
    _handleNotificationData(message.data);
  }

  /// Handle background notifications
  static Future<void> _handleBackgroundNotification(RemoteMessage message) async {
    print('🔔 Background notification received');
    print('Title: ${message.notification?.title}');
    print('Body: ${message.notification?.body}');
  }

  /// Handle notification tap
  static void _handleNotificationTap(RemoteMessage message) {
    print('👆 Notification tapped');
    _handleNotificationData(message.data);
  }

  /// Process notification data
  static void _handleNotificationData(Map<String, dynamic> data) {
    final type = data['type'];
    final appointmentId = data['appointmentId'];
    final action = data['action'];

    print('Notification type: $type');
    print('Appointment ID: $appointmentId');
    print('Action: $action');

    // Route to appropriate screen based on notification type
    switch (type) {
      case 'appointment_confirmed':
      case 'appointment_cancelled':
      case 'appointment_rescheduled':
      case 'service_started':
      case 'service_completed':
        // Navigate to appointment details
        _navigateToAppointment(appointmentId);
        break;
      case 'payment_received':
        // Navigate to payment history
        _navigateToPayments();
        break;
      case 'review_request':
        // Navigate to review page
        _navigateToReviews();
        break;
      default:
        print('Unknown notification type: $type');
    }
  }

  static void _navigateToAppointment(String appointmentId) {
    // TODO: Navigate to appointment details screen
    print('Navigating to appointment: $appointmentId');
  }

  static void _navigateToPayments() {
    // TODO: Navigate to payments screen
    print('Navigating to payments');
  }

  static void _navigateToReviews() {
    // TODO: Navigate to reviews screen
    print('Navigating to reviews');
  }
}
```

---

### 3. Real-Time Appointment Listener

Create `lib/services/appointment_listener.dart`:

```dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fluttertoast/fluttertoast.dart';

class AppointmentListener {
  static final FirebaseFirestore _db = FirebaseFirestore.instance;
  static StreamSubscription? _appointmentSubscription;

  /// Listen for real-time appointment updates
  static void listenToAppointments(String customerId) {
    _appointmentSubscription = _db
        .collection('bookings')
        .where('customerId', isEqualTo: customerId)
        .snapshots()
        .listen(
          (QuerySnapshot snapshot) {
            for (var change in snapshot.docChanges) {
              final appointment = change.doc.data() as Map<String, dynamic>;

              switch (change.type) {
                case DocumentChangeType.added:
                  _handleNewAppointment(appointment);
                  break;
                case DocumentChangeType.modified:
                  _handleAppointmentUpdate(appointment);
                  break;
                case DocumentChangeType.removed:
                  _handleAppointmentCancelled(appointment);
                  break;
              }
            }
          },
          onError: (error) {
            print('❌ Error listening to appointments: $error');
            Fluttertoast.showToast(msg: 'Error loading appointments');
          },
        );
  }

  /// Listen for walk-in updates
  static void listenToWalkIns(String customerId) {
    _db
        .collection('walkins')
        .where('customerId', isEqualTo: customerId)
        .snapshots()
        .listen(
          (QuerySnapshot snapshot) {
            for (var change in snapshot.docChanges) {
              final walkin = change.doc.data() as Map<String, dynamic>;

              if (change.type == DocumentChangeType.modified) {
                _handleWalkInUpdate(walkin);
              }
            }
          },
        );
  }

  /// Handle new appointment
  static void _handleNewAppointment(Map<String, dynamic> appointment) {
    print('✅ New appointment added: ${appointment['serviceId']}');
    Fluttertoast.showToast(msg: 'New appointment created');
    // TODO: Refresh appointments list in UI
  }

  /// Handle appointment status update
  static void _handleAppointmentUpdate(Map<String, dynamic> appointment) {
    final status = appointment['status'];
    final serviceName = appointment['serviceNames'] ?? 'Service';

    print('🔄 Appointment updated: $status');

    switch (status) {
      case 'In Progress':
        Fluttertoast.showToast(
          msg: '$serviceName service started!',
          gravity: ToastGravity.TOP,
        );
        break;
      case 'Completed':
        Fluttertoast.showToast(
          msg: '$serviceName service completed!',
          gravity: ToastGravity.TOP,
        );
        break;
      case 'Cancelled':
        Fluttertoast.showToast(
          msg: 'Appointment cancelled',
          gravity: ToastGravity.TOP,
        );
        break;
    }

    // TODO: Update appointment in UI
  }

  /// Handle appointment cancellation
  static void _handleAppointmentCancelled(Map<String, dynamic> appointment) {
    print('❌ Appointment cancelled: ${appointment['serviceId']}');
    Fluttertoast.showToast(msg: 'Appointment cancelled');
    // TODO: Remove appointment from UI
  }

  /// Handle walk-in update
  static void _handleWalkInUpdate(Map<String, dynamic> walkin) {
    final status = walkin['status'];
    print('🚗 Walk-in updated: $status');
    // TODO: Update walk-in details in UI
  }

  /// Stop listening to updates
  static void stopListening() {
    _appointmentSubscription?.cancel();
    print('Stopped listening to appointments');
  }
}
```

---

### 4. Authentication Integration

Create `lib/services/auth_service.dart`:

```dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'notification_service.dart';
import 'appointment_listener.dart';

class AuthService {
  static final FirebaseAuth _auth = FirebaseAuth.instance;
  static final FirebaseFirestore _db = FirebaseFirestore.instance;

  /// Login user and initialize services
  static Future<UserCredential?> loginUser(String email, String password) async {
    try {
      UserCredential userCredential = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      User? user = userCredential.user;
      
      if (user != null) {
        // Get user data from Firestore
        final userDoc = await _db.collection('users').doc(user.uid).get();
        final userData = userDoc.data() ?? {};

        print('✅ User logged in: ${user.email}');

        // Initialize notifications
        await NotificationService.initialize(user.uid);

        // Listen to appointments
        AppointmentListener.listenToAppointments(user.uid);
        AppointmentListener.listenToWalkIns(user.uid);

        return userCredential;
      }
    } on FirebaseAuthException catch (e) {
      print('❌ Login error: ${e.message}');
      rethrow;
    }

    return null;
  }

  /// Logout user
  static Future<void> logoutUser() async {
    try {
      // Get current user ID and FCM token before logout
      User? user = _auth.currentUser;
      
      if (user != null) {
        String? fcmToken = await NotificationService._messaging.getToken();
        if (fcmToken != null) {
          await NotificationService.unregisterFCMToken(user.uid, fcmToken);
        }
      }

      // Stop listening to appointments
      AppointmentListener.stopListening();

      // Sign out
      await _auth.signOut();
      print('✅ User logged out');
    } on FirebaseAuthException catch (e) {
      print('❌ Logout error: ${e.message}');
      rethrow;
    }
  }

  /// Get current user
  static User? getCurrentUser() {
    return _auth.currentUser;
  }

  /// Check if user is logged in
  static bool isLoggedIn() {
    return _auth.currentUser != null;
  }
}
```

---

### 5. Main App Setup

Update your `lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'services/firebase_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Firebase
  await FirebaseService.initializeFirebase();
  
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kingsley Carwash',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({Key? key}) : super(key: key);

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kingsley Carwash'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Welcome to Kingsley Carwash'),
            ElevatedButton(
              onPressed: () {
                // Navigate to login
              },
              child: const Text('Login'),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

### 6. Appointment Details Widget

Create `lib/screens/appointment_details.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class AppointmentDetailsScreen extends StatelessWidget {
  final String appointmentId;

  const AppointmentDetailsScreen({
    Key? key,
    required this.appointmentId,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Appointment Details'),
      ),
      body: StreamBuilder<DocumentSnapshot>(
        stream: FirebaseFirestore.instance
            .collection('bookings')
            .doc(appointmentId)
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (!snapshot.hasData || !snapshot.data!.exists) {
            return const Center(child: Text('Appointment not found'));
          }

          final appointment = snapshot.data!.data() as Map<String, dynamic>;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Status badge
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: _getStatusColor(appointment['status']),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    appointment['status'] ?? 'Unknown',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Service details
                _buildDetailRow('Service:', appointment['serviceNames']),
                _buildDetailRow('Date & Time:', appointment['datetime']),
                _buildDetailRow('Car:', appointment['carName']),
                _buildDetailRow('Plate:', appointment['plate']),
                _buildDetailRow('Technician:', appointment['technician']),
                _buildDetailRow('Price:', 'P${appointment['price']}'),
                _buildDetailRow(
                  'Payment:',
                  appointment['paymentStatus'] ?? 'Unpaid',
                ),

                const SizedBox(height: 20),

                // Additional info
                if (appointment['startTime'] != null)
                  _buildDetailRow('Start Time:', appointment['startTime']),
                
                if (appointment['completedTime'] != null)
                  _buildDetailRow('Completed:', appointment['completedTime']),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildDetailRow(String label, dynamic value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              color: Colors.grey,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value?.toString() ?? 'N/A',
              style: const TextStyle(fontSize: 16),
            ),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(String? status) {
    switch (status?.toLowerCase()) {
      case 'pending':
        return Colors.orange;
      case 'in progress':
        return Colors.blue;
      case 'completed':
        return Colors.green;
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }
}
```

---

## 📋 Integration Checklist

### On App Launch
- [ ] Firebase initialized
- [ ] User authenticated
- [ ] FCM token obtained
- [ ] Token registered with backend
- [ ] Foreground notification handler set up
- [ ] Background notification handler set up
- [ ] Appointment listener started

### On User Login
- [ ] Call `AuthService.loginUser(email, password)`
- [ ] Check if login successful
- [ ] Initialize `NotificationService`
- [ ] Register FCM token
- [ ] Start `AppointmentListener`

### On User Logout
- [ ] Call `AuthService.logoutUser()`
- [ ] Unregister FCM token
- [ ] Stop appointment listener
- [ ] Clear cached data

### On Notification Received
- [ ] Display toast notification
- [ ] Update appointment UI
- [ ] Refresh appointment list
- [ ] Handle notification tap

---

## 🧪 Testing

### 1. Test FCM Token Registration

```dart
// In your login screen or test
final userId = FirebaseAuth.instance.currentUser!.uid;
final fcmToken = await FirebaseMessaging.instance.getToken();
await NotificationService.registerFCMToken(userId, fcmToken);
```

### 2. Send Test Notification from Admin Dashboard

Go to admin dashboard and:
1. Navigate to Appointments page
2. Find a pending appointment
3. Click "Approve" or "Start Service"
4. Check if mobile app receives notification

### 3. Verify Real-Time Updates

```dart
// Monitor console logs
print('✅ Appointment updated in real-time');
```

---

## 🔗 API Endpoints Used

### From Flutter App

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/notifications/register-token` | POST | Register FCM token |
| `/api/notifications/unregister-token` | POST | Unregister FCM token |
| `/appointments/{id}` | GET | Get appointment details |

### From Admin Dashboard

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/notifications/send` | POST | Send push notification |
| Firestore listeners | - | Real-time updates |

---

## 🐛 Troubleshooting

### Notifications Not Received

1. **Check FCM token is registered**
   ```dart
   final token = await FirebaseMessaging.instance.getToken();
   print('FCM Token: $token');
   ```

2. **Verify permissions granted**
   ```dart
   final settings = await FirebaseMessaging.instance.requestPermission();
   print('Auth status: ${settings.authorizationStatus}');
   ```

3. **Check server logs**
   ```bash
   # Terminal running Node server
   npm start
   # Look for FCM token registration logs
   ```

### App Crashes on Notification

1. Make sure notification handlers don't access UI context directly
2. Use `runZoned` wrapper for background handler
3. Check Flutter Firebase plugin versions match

### Real-Time Updates Not Working

1. Verify Firestore security rules allow read access
2. Check internet connection
3. Ensure user has correct `customerId` in Firestore

---

## 📚 Additional Resources

- [Firebase Cloud Messaging - Flutter](https://firebase.flutter.dev/docs/messaging/overview)
- [Cloud Firestore - Flutter](https://firebase.flutter.dev/docs/firestore/start)
- [Firebase Authentication - Flutter](https://firebase.flutter.dev/docs/auth/overview)
- [Admin Dashboard Documentation](./README_NOTIFICATIONS.md)

---

## ✅ Implementation Status

- [x] FCM token registration
- [x] Notification handling (foreground/background)
- [x] Real-time Firestore listeners
- [x] Appointment status updates
- [x] User authentication integration
- [x] Error handling
- [x] Toast notifications

---

**Last Updated:** November 13, 2025  
**Status:** Ready for Implementation ✅
