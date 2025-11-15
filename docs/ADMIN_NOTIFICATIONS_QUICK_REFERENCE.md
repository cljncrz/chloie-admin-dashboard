# Admin Notifications - Quick Start Guide

## What Changed?

Admin notifications are now **created server-side by Cloud Functions** instead of client-side listeners. This makes them more reliable and available to all admins across devices.

## Three Notification Types (Automatic)

### 1. 📅 Pending Approval
**When**: New booking created with `status: 'Pending'`
**Message**: "{Customer} has a new pending booking for {Service}."
**Action**: Admin can approve or deny

### 2. 🔄 Reschedule Request  
**When**: New reschedule request with `status: 'Pending'`
**Message**: "{Customer} requested to reschedule {Service}."
**Action**: Admin can approve or deny

### 3. ❌ Appointment Cancelled
**When**: Booking status changed to `'Cancelled'`
**Message**: "{Customer}'s appointment for {Service} was cancelled."
**Action**: Admin is notified

## How to Use

### For Admins
1. **Check Bell Icon**: Notifications appear in the bell dropdown automatically
2. **Click to View**: Click notifications to see details on the notifications page
3. **Mark as Read**: Click notification to mark as read
4. **Clear All**: Use "Clear All" button to dismiss read notifications

### For Developers

#### Deploy Cloud Functions
```bash
firebase deploy --only functions
```

#### View Logs
```bash
firebase functions:log --follow
```

#### Test Notifications
```bash
node test-cloud-functions.js
```

## Files Involved

| File | Purpose |
|------|---------|
| `functions/index.js` | Cloud Functions that create notifications |
| `notifications.js` | Admin UI that displays notifications |
| `appointment-scheduler.js` | Admin creates appointments/reschedules |
| `appointment.html` | Notifications page |

## Key Features

✅ **Automatic**: No manual trigger needed  
✅ **Reliable**: Server-side, works across all admin devices  
✅ **Persistent**: Notifications saved in Firestore  
✅ **Real-time**: Updates appear instantly  
✅ **De-duped**: No duplicate notifications  
✅ **Fallback**: Works with or without Firebase  

## Testing Checklist

- [ ] Create pending booking → notification appears in bell
- [ ] Approve pending booking → notification marked as actioned
- [ ] Request reschedule → notification appears
- [ ] Cancel appointment → notification appears
- [ ] Close browser & reopen → notifications still visible

## Support

**Cloud Function Status**: `firebase functions:list`  
**Recent Logs**: `firebase functions:log`  
**Documentation**: See `CLOUD_FUNCTIONS_DEPLOYMENT.md`

---

**TL;DR**: Notifications for pending bookings, reschedules, and cancellations now appear automatically on the admin bell and persist across sessions. No configuration needed.
