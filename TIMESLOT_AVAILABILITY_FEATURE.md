# Timeslot Availability Feature

## Overview
Admins can now mark specific timeslots as unavailable when they become fully booked or need to be blocked for other reasons. This prevents users in the mobile app from booking those slots.

## Features

### 1. **Visual Timeslot Management**
- Each timeslot is displayed with a colored button indicating its status:
  - **Green (Available)**: Slot is open and can be blocked by admin
  - **Orange (Booked)**: Slot has existing bookings and cannot be toggled
  - **Red (Blocked)**: Slot is manually marked unavailable by admin

### 2. **Interactive Toggle**
- Click on any **Available** (green) slot to block it from users
- Click on any **Blocked** (red) slot to make it available again
- **Booked** (orange) slots cannot be toggled to protect existing appointments

### 3. **Data Persistence**
- Unavailable slots are stored in Firestore under `settings/unavailableSlots`
- Data structure: `{ date: 'YYYY-MM-DD', time: 'HH:MM AM/PM' }`
- Changes are automatically saved and synced across all admin sessions

### 4. **Mobile App Integration**
- The mobile app should check the `unavailableSlots` collection when displaying available timeslots
- Blocked slots will not appear as options for users to book

## How to Use

1. **Navigate to Appointments Page**
   - Go to the Appointments section in the admin dashboard
   - The calendar and timeslot controls are visible on the right side

2. **Select a Date**
   - Click on any date in the calendar to view its timeslots
   - The timeslot grid will update to show all slots for that day

3. **Block a Timeslot**
   - Find an available (green) timeslot
   - Click the button to block it
   - The button will turn red and show "Blocked" status
   - A success toast notification will appear

4. **Unblock a Timeslot**
   - Find a blocked (red) timeslot
   - Click the button to unblock it
   - The button will turn green and show "Available" status
   - A success toast notification will appear

## Technical Implementation

### Files Modified
1. **appointment-scheduler.js**
   - Added `unavailableSlots` array to state
   - Created `loadUnavailableSlots()` function to fetch from Firestore
   - Created `saveUnavailableSlots()` function to persist to Firestore
   - Created `toggleSlotAvailability()` function for admin actions
   - Updated `generateTimeSlots()` to check blocked slots
   - Updated `renderQueue()` to display timeslot controls
   - Added event listener for timeslot toggle buttons

2. **style.css**
   - Added `.timeslot-toggle-btn` styles with hover and active states
   - Added responsive grid layout for timeslots
   - Included accessibility features (cursor styles, transitions)

### Firestore Structure
```javascript
// Collection: settings
// Document: unavailableSlots
{
  slots: [
    { date: '2025-12-15', time: '8:20 AM' },
    { date: '2025-12-15', time: '10:20 AM' },
    { date: '2025-12-20', time: '2:20 PM' }
  ],
  updatedAt: '2025-12-07T10:30:00.000Z'
}
```

### Code Flow
```
1. Page Load
   └── loadUnavailableSlots() 
       └── Fetch from Firestore settings/unavailableSlots
       └── Store in unavailableSlots array

2. Admin Clicks Timeslot Button
   └── toggleSlotAvailability(dateStr, timeStr)
       ├── Check if slot exists in unavailableSlots array
       ├── If exists: Remove from array (unblock)
       ├── If not exists: Add to array (block)
       ├── saveUnavailableSlots() → Update Firestore
       └── renderQueue() → Refresh UI

3. Render Timeslots
   └── generateTimeSlots()
       └── Check each slot against unavailableSlots array
       └── Mark as unavailable if found
       └── Return slots with availability status
```

## Mobile App Integration Guide

For the mobile app to respect blocked timeslots, implement the following:

### 1. Fetch Unavailable Slots
```javascript
// In your mobile app's booking flow
const unavailableSlotsDoc = await firebase
  .firestore()
  .collection('settings')
  .doc('unavailableSlots')
  .get();

const blockedSlots = unavailableSlotsDoc.exists 
  ? unavailableSlotsDoc.data().slots || []
  : [];
```

### 2. Filter Available Slots
```javascript
// When generating timeslot options for a selected date
const selectedDateStr = selectedDate.toISOString().split('T')[0]; // 'YYYY-MM-DD'

const availableSlots = allTimeSlots.filter(slot => {
  // Check if slot is blocked by admin
  const isBlocked = blockedSlots.some(
    blocked => blocked.date === selectedDateStr && blocked.time === slot.startTime
  );
  
  // Check if slot has existing booking
  const hasBooking = existingBookings.some(
    booking => booking.datetime.includes(slot.startTime)
  );
  
  return !isBlocked && !hasBooking;
});
```

### 3. Real-time Updates (Optional)
```javascript
// Listen for changes to unavailable slots
firebase.firestore()
  .collection('settings')
  .doc('unavailableSlots')
  .onSnapshot(doc => {
    if (doc.exists) {
      const blockedSlots = doc.data().slots || [];
      // Update UI to reflect changes
      refreshTimeslotDisplay(blockedSlots);
    }
  });
```

## Testing Checklist

- [ ] Block an available timeslot → Verify it turns red with "Blocked" status
- [ ] Unblock a blocked timeslot → Verify it turns green with "Available" status
- [ ] Try to toggle a booked (orange) slot → Verify it's disabled and shows tooltip
- [ ] Navigate to different dates → Verify timeslot controls update correctly
- [ ] Refresh the page → Verify blocked slots persist after reload
- [ ] Check Firestore console → Verify `settings/unavailableSlots` document exists
- [ ] Multiple admin sessions → Verify changes sync across sessions
- [ ] Mobile app → Verify blocked slots don't appear as booking options

## Future Enhancements

1. **Bulk Operations**
   - Add "Block All Available" button for a specific date
   - Add "Unblock All" button to clear all blocks for a date

2. **Scheduling**
   - Allow admins to schedule blocks in advance
   - Auto-expire blocks after a certain date/time

3. **Reason Tracking**
   - Add optional notes/reasons when blocking a slot
   - Display reasons in admin tooltip

4. **Notification**
   - Notify admins when a slot becomes fully booked
   - Suggest auto-blocking fully booked slots

5. **Analytics**
   - Track which timeslots are most frequently blocked
   - Report on blocked vs available slot ratios

## Support

If you encounter any issues with the timeslot availability feature:
1. Check browser console for JavaScript errors
2. Verify Firestore permissions allow read/write to `settings` collection
3. Ensure Firebase is properly initialized (`window.db` exists)
4. Check that the `showSuccessToast` function is available

## Version History

- **v1.0** (2025-12-07): Initial implementation
  - Basic block/unblock functionality
  - Firestore persistence
  - Visual status indicators
  - Responsive grid layout
