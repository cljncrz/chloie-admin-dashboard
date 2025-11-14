# Push Notifications - Visual Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      YOUR ADMIN DASHBOARD                        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Appointments Page (appointment.html)                     │   │
│  │ ┌────────────────────────────────────────────────────┐   │   │
│  │ │ Pending Approvals Modal                            │   │   │
│  │ │                                                    │   │   │
│  │ │ ┌──────────────────────────────────────────────┐  │   │   │
│  │ │ │ Booking: Juan Dela Cruz - Full Detailing   │  │   │   │
│  │ │ │ Technician: [Select...▼]                   │  │   │   │
│  │ │ │ [Approve ✓] [Deny ✗]                       │  │   │   │
│  │ │ └──────────────────────────────────────────────┘  │   │   │
│  │ │                                                    │   │   │
│  │ │ Clicking "Approve"                                │   │   │
│  │ │ ↓↓↓                                               │   │   │
│  │ │ 1. Updates Firestore                             │   │   │
│  │ │ 2. Calls NotificationService                      │   │   │
│  │ │ 3. Shows toast: "Notification sent to Juan"       │   │   │
│  │ │                                                    │   │   │
│  │ └────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
            ┌───────────────────────────────┐
            │  NotificationService (JS)     │
            │                               │
            │  notifyAppointmentConfirmed() │
            │  ↓                            │
            │  Calls Server API             │
            └───────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │   Node.js Server (localhost:5000)   │
        │                                     │
        │   POST /api/notifications/send      │
        │   ├─ Gets FCM tokens from          │
        │   │  Firestore users collection    │
        │   ├─ Sends to Firebase Cloud       │
        │   │  Messaging (FCM)               │
        │   └─ Logs to notifications         │
        │      collection                    │
        └─────────────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │   Firebase Cloud Messaging (FCM)    │
        │                                     │
        │   Routes notification to all        │
        │   registered mobile devices         │
        └─────────────────────────────────────┘
                            ↓
                 ┌──────────────────┐
                 │   MOBILE APPS    │
                 │                  │
                 │ ┌──────────────┐ │
                 │ │ 📱 Device 1  │ │
                 │ │ Notification │ │
                 │ │ "✅ Appt     │ │
                 │ │  Confirmed"  │ │
                 │ └──────────────┘ │
                 │                  │
                 │ ┌──────────────┐ │
                 │ │ 📱 Device 2  │ │
                 │ │ Notification │ │
                 │ │ "✅ Appt     │ │
                 │ │  Confirmed"  │ │
                 │ └──────────────┘ │
                 └──────────────────┘
```

---

## Data Flow Diagram

```
                     STEP 1: Setup
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
    Mobile App         Admin Dashboard    Server
        │                 │                 │
        │ Register Token   │                 │
        ├────────────────>│                 │
        │                 │                 │
        │                 │ Store Token     │
        │                 │─────────────────>│
        │                 │                 │
        │            STEP 2: Action         │
        │                 │                 │
        │                 │ Approve Appt    │
        │                 │─────────────────>│
        │                 │                 │
        │                 │ Send Notif      │
        │    <────────────┼─────────────────┤
        │ Receive Push    │                 │
        │  Notification   │                 │
        │                 │                 │
```

---

## Notification Flow

```
ADMIN DASHBOARD ACTIONS                MOBILE APP NOTIFICATIONS
    ↓                                           ↑
    ├─ Approve Appointment ──────────────────> 📱 "✅ Appointment Confirmed"
    │                                          Oct 28, 2:00 PM
    │
    ├─ Deny Appointment ────────────────────> 📱 "❌ Appointment Cancelled"
    │                                         
    │
    ├─ Mark Service Complete ──────────────> 📱 "✨ Service Completed"
    │                                        
    │
    ├─ Record Payment ──────────────────────> 📱 "💳 Payment Received"
    │                                        $199.99
    │
    ├─ Create Promotion ───────────────────> 📱 "🎉 30% Off Summer Sale"
    │  (to multiple customers)               All premium services
    │
    └─ Request Review ─────────────────────> 📱 "⭐ Rate Your Experience"
```

---

## File Organization

```
Project Root
│
├─ functions/                          [Cloud Functions]
│  ├─ index.js                         ← Exports notification functions
│  ├─ sendNotifications.js             ← NEW! FCM logic
│  └─ package.json
│
├─ notification-service.js             ← NEW! Client utility
├─ notification-service.js             ← Client library (already exists)
│
├─ server.js                           ← Updated! Notification endpoints
├─ appointment.html                    ← Updated! Added script tag
├─ appointment-scheduler.js            ← Updated! Integration
│
├─ NOTIFICATIONS_SETUP.md              ← NEW! Full documentation
├─ NOTIFICATIONS_QUICKSTART.md         ← NEW! Quick reference
├─ DEPLOYMENT_CHECKLIST.md             ← NEW! Setup steps
└─ IMPLEMENTATION_COMPLETE.md          ← NEW! Summary
```

---

## Firestore Data Structure

```
Firebase Project: kingsleycarwashapp
│
├─ users (collection)
│  │
│  └─ {userId} (document)
│     ├─ name: "Juan Dela Cruz"
│     ├─ email: "juan@example.com"
│     ├─ phone: "+1234567890"
│     ├─ fcmTokens: [                  ← Mobile device tokens
│     │   "token1_from_iphone",
│     │   "token2_from_android"
│     │ ]
│     └─ lastTokenRegistered: 2025-11-13T...
│
├─ notifications (collection)
│  │
│  └─ {notificationId} (document)
│     ├─ userId: "customer-123"
│     ├─ type: "appointment_confirmed"
│     ├─ title: "✅ Appointment Confirmed"
│     ├─ body: "Your appointment for Full Detailing..."
│     ├─ data: {
│     │   appointmentId: "appt-456",
│     │   serviceName: "Full Package Detailing"
│     │ }
│     ├─ sentAt: 2025-11-13T10:30:45Z
│     ├─ read: false
│     ├─ successCount: 2               ← Sent to 2 devices
│     └─ failureCount: 0               ← 0 failures
│
├─ appointments (collection)
│  │
│  └─ {appointmentId} (document)       ← Triggers notifications
│     ├─ customerId: "customer-123"
│     ├─ status: "Approved"
│     ├─ service: "Full Package Detailing"
│     └─ ...
│
└─ payments (collection)
   │
   └─ {paymentId} (document)           ← Triggers notifications
      ├─ customerId: "customer-123"
      ├─ amount: 199.99
      └─ ...
```

---

## Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│             YOUR ADMIN DASHBOARD                             │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Appointments │  │  Payments    │  │  Promotions  │       │
│  │              │  │              │  │              │       │
│  │ ✓ INTEGRATED │  │ ⚙ TO-DO     │  │ ⚙ TO-DO      │       │
│  │              │  │              │  │              │       │
│  │ Sends notif  │  │ Add notif    │  │ Add notif    │       │
│  │ on approve/  │  │ on payment   │  │ on create    │       │
│  │ deny         │  │ recorded     │  │ promotion    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Reviews    │  │  Technicians │  │  Dashboard   │       │
│  │              │  │              │  │              │       │
│  │ ⚙ TO-DO     │  │ ⚙ OPTIONAL   │  │ ✓ COMPLETE   │       │
│  │              │  │              │  │              │       │
│  │ Add notif    │  │ Assignment   │  │ Uses notif   │       │
│  │ for reviews  │  │ updates      │  │ service      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         │
         └────► All use same NotificationService class
```

---

## Usage Flow Chart

```
START HERE
    │
    ├─ Is page using notifications?
    │  │
    │  ├─ YES: Add script tag
    │  │       <script src="notification-service.js"></script>
    │  │
    │  └─ NO: Add it first
    │
    ├─ Ready to send notification?
    │  │
    │  ├─ Single user: 
    │  │  await NotificationService.sendNotification(userId, {...})
    │  │
    │  ├─ Multiple users:
    │  │  await NotificationService.sendBulkNotification([userIds], {...})
    │  │
    │  └─ Specific scenario:
    │     └─ Appointment: notifyAppointmentConfirmed()
    │     └─ Payment: notifyPaymentReceived()
    │     └─ Promotion: notifyNewPromotion()
    │     └─ Review: notifyReviewRequest()
    │
    ├─ Call returns success?
    │  │
    │  ├─ YES: Notification queued for mobile users
    │  │       Show toast: NotificationService.showToast("Success", "success")
    │  │
    │  └─ NO: Check if user has FCM tokens registered
    │         Check browser console for errors
    │
    └─ END
```

---

## Deployment Timeline

```
WEEK 1 - SETUP
  │
  ├─ Monday: Deploy Cloud Functions
  │          firebase deploy --only functions
  │
  ├─ Tuesday: Start Node.js server
  │           npm start
  │
  ├─ Wednesday: Test appointment notifications
  │             Verify dashboard integration
  │
  └─ Thursday: Verify Firestore logs
              Check notification collection

WEEK 2 - MOBILE APP
  │
  ├─ Friday: Mobile app team implements FCM
  │
  ├─ Following Monday: Test token registration
  │                   curl /api/notifications/register-token
  │
  ├─ Tuesday: End-to-end testing
  │          Approve appointment → See notification on app
  │
  └─ Wednesday: Deploy to production
              Monitor notifications collection

WEEK 3 - EXPAND
  │
  ├─ Integrate payments notifications
  ├─ Integrate promotion notifications
  ├─ Integrate review notifications
  │
  └─ Monitor system performance
```

---

## Success Checklist

```
PHASE 1: SETUP ✓
  ✓ Cloud Functions deployed
  ✓ Node.js server running
  ✓ notification-service.js added to pages
  ✓ Server endpoints responding

PHASE 2: INTEGRATION ✓
  ✓ Appointment approval sends notification
  ✓ Appointment denial sends notification
  ✓ Toast messages show to admin
  ✓ Firestore logs notifications

PHASE 3: TESTING
  ⚙ Mobile app registers FCM tokens
  ⚙ Notifications received in mobile app
  ⚙ Full end-to-end test passes
  ⚙ Performance is acceptable

PHASE 4: PRODUCTION
  ⚙ Deploy to production server
  ⚙ Monitor Firestore collection
  ⚙ Monitor Cloud Function logs
  ⚙ Gather user feedback
```

---

## Quick Reference

```
GET STARTED IN 3 STEPS:

1️⃣  Deploy Cloud Functions
    $ cd functions && firebase deploy --only functions

2️⃣  Start Node Server
    $ npm start

3️⃣  Test It!
    Open admin dashboard → Approve appointment → See "Notification sent" toast

DONE! 🎉
```

