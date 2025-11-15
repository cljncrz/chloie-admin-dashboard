# Cloud Functions Deployment Guide

## Overview

The admin notification system has been moved to **Cloud Functions** for server-side, reliable notification creation. Three Cloud Functions now automatically create persisted admin notifications when:

1. **New pending booking** is created (`onNewPendingBooking`)
2. **New reschedule request** is created (`onNewRescheduleRequest`)
3. **Booking is cancelled** (`onBookingCancelled`)

## Cloud Functions Added

### 1. `onNewPendingBooking`
- **Trigger**: Firestore document write to `bookings` collection
- **Condition**: Document status is `'Pending'` and is new or status changed to `'Pending'`
- **Action**: Creates admin notification in `notifications` collection
- **Deduplication**: Checks for existing notification with same `action:itemId` before creating

### 2. `onNewRescheduleRequest`
- **Trigger**: Firestore document write to `rescheduleRequests` collection
- **Condition**: Document status is `'Pending'` and is new or status changed to `'Pending'`
- **Action**: Creates admin notification in `notifications` collection
- **Deduplication**: Checks for existing notification with same `action:itemId` before creating

### 3. `onBookingCancelled`
- **Trigger**: Firestore document write to `bookings` collection
- **Condition**: Document status changed to `'Cancelled'`
- **Action**: Creates admin notification in `notifications` collection
- **Deduplication**: Checks for existing notification with same `action:itemId` before creating

## Deployment Steps

### Prerequisites
- Firebase project set up (`kingsleycarwashapp`)
- Firebase CLI installed: `npm install -g firebase-tools`
- Authenticated with Firebase: `firebase login`

### Deploy Cloud Functions

1. Navigate to the functions directory:
   ```bash
   cd functions
   ```

2. Install dependencies (if not already done):
   ```bash
   npm install
   ```

3. Deploy the functions:
   ```bash
   firebase deploy --only functions
   ```

   Or deploy specific functions:
   ```bash
   firebase deploy --only functions:onNewPendingBooking,functions:onNewRescheduleRequest,functions:onBookingCancelled
   ```

4. View logs to verify deployment:
   ```bash
   firebase functions:log
   ```

### Testing the Functions

#### Test 1: Create a Pending Booking
1. In Firebase Console → Firestore → `bookings` collection
2. Add a new document with:
   ```json
   {
     "status": "Pending",
     "customer": "John Doe",
     "customerName": "John Doe",
     "service": "Premium Wash",
     "serviceNames": "Premium Wash",
     "timestamp": "2025-11-15T10:00:00Z"
   }
   ```
3. Check `notifications` collection - a new admin notification should appear
4. In the admin dashboard notification bell, the notification should display

#### Test 2: Create a Pending Reschedule Request
1. In Firebase Console → Firestore → `rescheduleRequests` collection
2. Add a new document with:
   ```json
   {
     "status": "Pending",
     "customerName": "Jane Smith",
     "customer": "Jane Smith",
     "serviceName": "Interior Detailing",
     "service": "Interior Detailing",
     "timestamp": "2025-11-15T10:00:00Z"
   }
   ```
3. Check `notifications` collection - a new admin notification should appear
4. In the admin dashboard notification bell, the notification should display

#### Test 3: Cancel a Booking
1. In Firebase Console → Firestore → `bookings` collection
2. Find an existing booking or create one with `status: "Confirmed"`
3. Update the status to `"Cancelled"`
4. Check `notifications` collection - a new "Appointment Cancelled" admin notification should appear
5. In the admin dashboard notification bell, the notification should display

### Monitoring

#### View Real-Time Logs
```bash
firebase functions:log --follow
```

#### Common Log Messages
- ✅ `Created admin notification {id} for {action}:{itemId}` - Successfully created
- 📌 `Admin notification already exists for {action}:{itemId}` - De-duplication worked
- ❌ `Error creating admin notification: {error}` - Something went wrong
- 📅 `New pending booking detected: {bookingId}` - Booking trigger fired
- 🔄 `New reschedule request detected: {requestId}` - Reschedule trigger fired
- ❌ `Booking cancelled detected: {bookingId}` - Cancellation trigger fired

## Client-Side Changes

### `notifications.js` (already updated)
- Listens to `notifications` collection via Firestore snapshot listener
- Displays persisted notifications in the admin bell and notifications page
- Marks notifications as read when clicked

### `appointment-scheduler.js` (updated)
- Removed client-side listeners (now Cloud Functions handle this)
- Client still creates local bookings/reschedules which trigger Cloud Functions

## Workflow

1. **Admin creates booking/reschedule/cancellation** via UI
2. **Data saved to Firestore** (bookings or rescheduleRequests collection)
3. **Cloud Function triggered** (onDocumentWritten)
4. **Admin notification created** in `notifications` collection by Cloud Function
5. **Admin clients listen** to `notifications` collection (notifications.js)
6. **Notification bell updates** in real-time on all admin devices

## Rollback

If you need to disable these functions temporarily:

```bash
# Delete specific functions
firebase functions:delete onNewPendingBooking onNewRescheduleRequest onBookingCancelled

# Or redeploy without these functions
# (remove their exports from functions/index.js)
firebase deploy --only functions
```

## Environment Notes

- **Node.js Version**: 22 (in functions/package.json)
- **Firebase Admin SDK**: ^12.6.0
- **Firebase Functions SDK**: ^6.0.1

## Troubleshooting

### Issue: Functions not deploying
- **Solution**: Ensure Firebase CLI is authenticated: `firebase login`

### Issue: Notifications not appearing
- **Check**: Firestore rules allow writing to `notifications` collection
- **Check**: Cloud Functions have proper permissions (default: allowed)
- **View logs**: `firebase functions:log --follow`

### Issue: Duplicate notifications
- **Expected**: De-duplication logic prevents this (queries for existing notification first)
- **If still happening**: Check if Cloud Function restarted mid-execution (check logs)

### Issue: Field names mismatch
- **Root cause**: Different documents might store customer/service names in different fields
- **Solution**: Logic prioritizes `customerName`/`serviceName`, falls back to `customer`/`service`

## Next Steps

1. Deploy Cloud Functions to production
2. Test all three notification flows in staging environment
3. Monitor logs for errors in production
4. Verify admin notifications appear correctly on all admin devices
5. Consider adding more metadata to notifications (booking time, location, etc.) for better UX
