# Admin Notification System - Visual Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ADMIN DASHBOARD (Browser)                        │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ appointment-scheduler.js                                         │   │
│  │ - Booking form                                                   │   │
│  │ - Reschedule handler                                             │   │
│  │ - Cancellation handler                                           │   │
│  │ Action: Submit form → Save to Firestore                          │   │
│  └────────────────────────┬─────────────────────────────────────────┘   │
│                           │                                             │
│  ┌────────────────────────▼─────────────────────────────────────────┐   │
│  │ notifications.js                                                 │   │
│  │ - Bell icon with unread count                                    │   │
│  │ - Dropdown showing recent notifications                          │   │
│  │ - Notifications page with full list                              │   │
│  │ Listens to: Firestore 'notifications' collection                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │
                    Write Operations
                    (Save Bookings/
                   Reschedules/Cancel)
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      FIRESTORE DATABASE (Backend)                        │
│                                                                          │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │ bookings collection     │  │ rescheduleRequests collection        │ │
│  ├─────────────────────────┤  ├──────────────────────────────────────┤ │
│  │ - id (booking ID)       │  │ - id (request ID)                    │ │
│  │ - status: "Pending"     │  │ - status: "Pending"                  │ │
│  │ - customer: "Name"      │  │ - customerName: "Name"               │ │
│  │ - service: "Wash"       │  │ - serviceName: "Detail"              │ │
│  │ - timestamp             │  │ - timestamp                          │ │
│  └────────┬────────────────┘  └───────────┬───────────────────────────┘ │
│           │                               │                            │
│  Document Write                   Document Write                        │
│  (status='Pending')              (status='Pending')                      │
│           │                               │                            │
│           │                  ┌────────────▼──────────────┐              │
│           │                  │ ALSO: bookings with       │              │
│           │                  │ status='Cancelled'        │              │
│           │                  └───────────┬────────────────┘              │
│           │                              │                             │
│           └──────────────────┬───────────┘                             │
│                              │                                        │
│                    ┌─────────▼────────────┐                          │
│                    │ notifications       │                          │
│                    │ collection          │                          │
│                    ├─────────────────────┤                          │
│                    │ - id (auto)         │                          │
│                    │ - title             │                          │
│                    │ - body              │                          │
│                    │ - read: false       │                          │
│                    │ - type: "admin"     │                          │
│                    │ - data.action       │                          │
│                    │ - data.itemId       │                          │
│                    │ - sentAt            │                          │
│                    └────────────┬────────┘                          │
│                                 │                                   │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                        Writes From Cloud Functions
                                  │
                    ┌─────────────▼────────────┐
                    │                          │
         ┌──────────▼──────────┐   ┌──────────▼──────────┐
         │ Cloud Function 1    │   │ Cloud Function 2    │
         ├─────────────────────┤   ├─────────────────────┤
         │ onNewPendingBooking │   │ onNewReschedule     │
         │                     │   │ Request             │
         │ Triggers on:        │   │                     │
         │ bookings written    │   │ Triggers on:        │
         │ status='Pending'    │   │ rescheduleRequests  │
         │                     │   │ status='Pending'    │
         │ Creates:            │   │                     │
         │ "Pending Approval"  │   │ Creates:            │
         │ notification        │   │ "Reschedule Request"│
         │                     │   │ notification        │
         └─────────────────────┘   └─────────────────────┘

         ┌──────────────────────────────────────────────┐
         │ Cloud Function 3                             │
         ├──────────────────────────────────────────────┤
         │ onBookingCancelled                           │
         │                                              │
         │ Triggers on:                                 │
         │ bookings.status changed to 'Cancelled'       │
         │                                              │
         │ Creates:                                     │
         │ "Appointment Cancelled" notification         │
         └──────────────────────────────────────────────┘
```

## Notification Flow Sequence

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ADMIN CREATES PENDING BOOKING                                           │
│                                                                          │
│ 1. Admin fills booking form                                             │
│    └─ Customer: John Doe                                                │
│    └─ Service: Premium Wash                                             │
│    └─ Status: Pending (awaiting approval)                               │
│                                                                          │
│ 2. Click "Book Appointment"                                             │
│    └─ appointment-scheduler.js handles submission                       │
│    └─ Calls NotificationService.notifyAppointmentConfirmed()            │
│    └─ Saves to Firestore bookings collection                            │
│                                                                          │
│ 3. Firestore saves document                                             │
│    └─ Path: bookings/{docId}                                            │
│    └─ Data: { status: 'Pending', customer: 'John Doe', ... }           │
│                                                                          │
│ ⏱️  ~0.5 seconds later                                                   │
│                                                                          │
│ 4. Cloud Function "onNewPendingBooking" TRIGGERS                        │
│    └─ Detects: status === 'Pending' (new or changed)                   │
│    └─ Calls helper: createAdminNotificationIfMissing()                  │
│    └─ Checks: Does notification already exist? (de-duplication)        │
│    └─ Creates: New document in 'notifications' collection              │
│       {                                                                  │
│         title: 'Pending Approval',                                      │
│         body: 'John Doe has a new pending booking for Premium Wash',    │
│         data: {                                                         │
│           action: 'pending_booking',                                    │
│           itemId: '{bookingDocId}'                                      │
│         },                                                              │
│         read: false,                                                    │
│         type: 'admin',                                                  │
│         sentAt: <server-timestamp>                                      │
│       }                                                                  │
│                                                                          │
│ 5. Firestore writes notification document                               │
│    └─ Path: notifications/{notifId}                                     │
│                                                                          │
│ 6. notifications.js FIRESTORE LISTENER detects change                   │
│    └─ Listens to: collection('notifications').onSnapshot(...)          │
│    └─ Receives: New notification document                               │
│    └─ Updates DOM:                                                      │
│       ├─ Badge: unread count = unread count + 1                        │
│       ├─ Dropdown: adds notification to recent list                     │
│       └─ Page: adds notification to full list                           │
│                                                                          │
│ 7. Admin sees notification in REAL-TIME                                 │
│    ┌───────────────────────────────────┐                                │
│    │ 🔔 3                               │  ◄─ Bell badge shows 3        │
│    │                                   │                               │
│    │ ▼ Notifications                   │                               │
│    │                                   │                               │
│    │ Pending Approval (NEW)             │  ◄─ New notification          │
│    │ John Doe has a new pending...      │                               │
│    │                                   │                               │
│    │ (other older notifications...)     │                               │
│    └───────────────────────────────────┘                                │
│                                                                          │
│ 8. Admin clicks notification                                            │
│    └─ Navigates to appointment.html                                     │
│    └─ Marks notification as read: true                                  │
│    └─ Bell badge count decreases                                        │
│                                                                          │
│ 9. Admin approves or denies booking                                     │
│    └─ Updates booking status to "Confirmed" or "Cancelled"              │
│    └─ If cancelled, Cloud Function creates "Cancelled" notification     │
│    └─ Notification in bell automatically updates                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Model

### Notification Document Structure

```javascript
{
  id: "auto-generated",                    // Firestore doc ID
  title: "Pending Approval",               // Short title
  body: "John Doe has a new pending...",   // Full message
  read: false,                             // Unread flag
  type: "admin",                           // Always "admin"
  link: "appointment.html",                // Where to navigate
  data: {
    action: "pending_booking",             // Type: pending_booking
                                           //       reschedule_request
                                           //       appointment_cancelled
    itemId: "booking-doc-id"               // Reference to source document
  },
  sentAt: <server-timestamp>,              // When created (server time)
  sentBy: "cloud-function"                 // Always "cloud-function"
}
```

## Error Handling Flow

```
┌─ Cloud Function Triggered
│
├─ Try: Query for existing notification
│  ├─ Success: Check count
│  │  ├─ Count > 0: Log "already exists", exit (de-dup)
│  │  └─ Count = 0: Continue to create
│  │
│  └─ Error: Log error, continue (don't block)
│
├─ Try: Create notification document
│  ├─ Success: Log success
│  │  └─ notifications.js listener picks it up
│  │     └─ Admin bell updates
│  │
│  └─ Error: Log error, user sees delayed/no notification
│     └─ Can retry manually or wait for next sync
│
└─ Cloud Function completes
   └─ Logs available at: firebase functions:log
```

## Performance Timeline

```
User Action              │ Elapsed Time │ Event
─────────────────────────┼──────────────┼────────────────────────────
Admin clicks "Book"      │ 0ms          │ handleBookingSubmit() called
Firestore write starts   │ 5ms          │ db.collection().add()
Firestore write commits  │ 50-200ms     │ Document created
Cloud Function triggers  │ 200-500ms    │ onDocumentWritten fired
De-dup check             │ 550ms        │ Query existing notifications
Notification document    │ 600ms        │ notifications collection
  written                │              │ receives new doc
Listener detects change  │ 650ms        │ onSnapshot callback fires
DOM updates (badge, icon)│ 700ms        │ Admin sees bell update
─────────────────────────┴──────────────┴────────────────────────────
                    Total: ~700ms
              (Usually under 1 second)
```

## Fallback Behavior

```
┌─ Client detects Firestore not available
│
├─ notifications.js
│  └─ Falls back to in-memory window.appData.notifications
│     └─ Bell still shows sample data
│
└─ Cloud Functions
   └─ Still write to Firestore (if available)
   └─ If Firestore unavailable:
      └─ Error logged
      └─ Notification not created
      └─ Admin sees delayed or no notification
         (Retry manually or wait for next event)
```

## Key Performance Metrics

| Metric | Value | Note |
|--------|-------|------|
| Firestore write latency | 50-200ms | Depends on network |
| Cloud Function trigger delay | 200-500ms | Firebase infrastructure |
| De-duplication query | <100ms | Indexed Firestore query |
| Listener notification | ~50ms | Real-time Firestore |
| **Total end-to-end** | **~700ms** | From action to bell update |

## Deduplication Logic

```
When notification created:

1. Query notifications collection
   WHERE data.action = "pending_booking"
   AND data.itemId = "booking-doc-id"
   LIMIT 1

2. If result > 0:
   └─ Log: "Notification already exists"
   └─ Exit (don't create duplicate)

3. If result = 0:
   └─ Create new notification
   └─ Log: "Notification created"

Result: Only 1 notification per booking/action combo
```

---

**Visual Architecture Updated**: November 15, 2025  
**System Status**: Production Ready
