# Quick Start Guide: Timeslot Availability Feature

## What's New?
You can now **block specific timeslots** to prevent users from booking them in the mobile app. This is useful when a slot becomes fully booked or needs to be reserved.

## Where to Find It
1. Open your admin dashboard
2. Navigate to **Appointments** page
3. Look at the right sidebar
4. Scroll down past the slot summary to see **"Timeslot Availability"**

## How It Works

### Visual Guide
- **🟢 Green Button (Available)**: Click to block this slot from users
- **🟠 Orange Button (Booked)**: Has existing appointments, cannot be toggled
- **🔴 Red Button (Blocked)**: Click to make this slot available again

### Steps to Block a Timeslot
1. Select a date from the calendar
2. Find the timeslot you want to block (green button)
3. Click the button
4. It turns red and shows "Blocked"
5. ✅ Done! Users can't book this slot anymore

### Steps to Unblock a Timeslot
1. Select a date from the calendar
2. Find the blocked timeslot (red button)
3. Click the button
4. It turns green and shows "Available"
5. ✅ Done! Users can book this slot again

## Important Notes

⚠️ **You cannot block timeslots that already have bookings** (orange buttons)
- This protects existing appointments
- First cancel or reschedule existing appointments if needed

💾 **Changes are automatically saved**
- Your blocked slots persist even after page refresh
- All admin sessions see the same blocked slots

📱 **Mobile app must be updated**
- The mobile app needs to fetch blocked slots from Firestore
- See `TIMESLOT_AVAILABILITY_FEATURE.md` for integration details

## Testing Instructions

### Test 1: Block a Slot
1. Go to Appointments page
2. Select today's date or any future date
3. Find a green (available) timeslot
4. Click it → Should turn red with "Blocked" status
5. Refresh the page → Blocked slot should still be red

### Test 2: Unblock a Slot
1. Find a red (blocked) timeslot
2. Click it → Should turn green with "Available" status
3. Refresh the page → Slot should still be green

### Test 3: Verify Firestore
1. Open Firebase Console
2. Go to Firestore Database
3. Navigate to: `settings` → `unavailableSlots`
4. Check the `slots` array contains your blocked slots
5. Format: `[{ date: 'YYYY-MM-DD', time: '8:20 AM' }]`

### Test 4: Cannot Block Booked Slots
1. Find an orange (booked) timeslot
2. Try to click it → Should show "Cannot toggle" tooltip
3. Button should be disabled (faded appearance)

## Troubleshooting

### Buttons Not Responding
- **Check**: Browser console for JavaScript errors
- **Fix**: Refresh the page and try again

### Changes Not Saving
- **Check**: Firebase connection (look for errors in console)
- **Check**: Firestore permissions for `settings` collection
- **Fix**: Verify Firebase is initialized properly

### Timeslot Grid Not Showing
- **Check**: Scroll down in the right sidebar
- **Check**: Make sure you're on the Appointments page
- **Fix**: Try selecting a different date in the calendar

## What's Next?

### For Admin Dashboard Users
- Start blocking timeslots as they become fully booked
- Monitor the slot availability counters
- Keep track of which dates have the most blocks

### For Developers
- Integrate the mobile app to check blocked slots
- Follow instructions in `TIMESLOT_AVAILABILITY_FEATURE.md`
- Test that users cannot book blocked slots

## Questions?

If you need help or encounter issues:
1. Check the detailed documentation: `TIMESLOT_AVAILABILITY_FEATURE.md`
2. Review the browser console for error messages
3. Verify Firebase/Firestore connectivity

---

**Feature Version**: 1.0  
**Date**: December 7, 2025  
**Status**: ✅ Ready to Use
