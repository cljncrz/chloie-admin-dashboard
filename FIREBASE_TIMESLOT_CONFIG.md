# Firebase Configuration Reference - Timeslot Availability

## Overview

The Kingsley Admin Dashboard uses Firebase Firestore to manage timeslot availability with the following configuration:

## Collection Structure

### Primary Collection: `timeslot_availability`

**Purpose**: Store blocked/unavailable timeslots for each date

**Location**: `timeslot_availability/{dateString}`

**Document Structure**:
```javascript
{
  date: "2025-12-15",                    // YYYY-MM-DD format
  slots: {
    "8:20 AM": false,                   // false = blocked/unavailable
    "9:20 AM": true,                    // true = available (optional)
    "10:20 AM": false,
    "11:20 AM": true,
    ...
  },
  updatedAt: "2025-12-15T10:30:00.000Z", // ISO timestamp
  updatedBy: "admin"                     // User who made the change
}
```

**Rules** (firestore.rules):
```
match /timeslot_availability/{dateDoc} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && isAdmin(request.auth.uid);
}
```

### Secondary Collection: `time_slots_config`

**Purpose**: Store the master list of available timeslots

**Location**: `time_slots_config/slots`

**Document Structure**:
```javascript
{
  slots: [
    { start: "8:20 AM", end: "9:20 AM", isActive: true },
    { start: "9:20 AM", end: "10:20 AM", isActive: true },
    { start: "10:20 AM", end: "11:20 AM", isActive: true },
    // ... 12 total slots
  ],
  updatedAt: timestamp,
  updatedBy: "admin"
}
```

**Rules** (firestore.rules):
```
match /time_slots_config/{document=**} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && isAdmin(request.auth.uid);
}
```

### General Settings Collection: `settings`

**Purpose**: Store other settings

**Note**: The `settings` collection still exists in firestore.rules but is NOT used for timeslot availability anymore. Timeslot data exclusively uses `timeslot_availability` collection.

**Rules** (firestore.rules):
```
match /settings/{document=**} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && isAdmin(request.auth.uid);
}
```

## JavaScript Implementation

### Files Using Timeslot Availability

#### 1. `appointment-scheduler.js`

**Functions**:
- `loadUnavailableSlots()` - Reads from `timeslot_availability/{selectedDate}`
- `saveUnavailableSlots()` - Writes to `timeslot_availability/{selectedDate}`
- `toggleSlotAvailability(dateStr, timeStr)` - Toggles a slot

**Storage Key Format**:
- Uses slot start time as key: "8:20 AM", "9:20 AM", etc.
- Stores `false` for blocked slots
- Omits or stores `true` for available slots

**Example Usage**:
```javascript
// Read unavailable slots for a date
const doc = await db.collection('timeslot_availability').doc('2025-12-15').get();
if (doc.exists) {
  const slots = doc.data().slots; // { "8:20 AM": false, ... }
}

// Save/update slots
await db.collection('timeslot_availability').doc('2025-12-15').set({
  date: '2025-12-15',
  slots: { "8:20 AM": false, "9:20 AM": true },
  updatedAt: new Date().toISOString(),
  updatedBy: 'admin'
}, { merge: true });
```

#### 2. `appointments.js`

**Functions**:
- `getTimeslotAvailability(dateStr)` - Reads from `timeslot_availability/{dateStr}`
- `updateTimeslotAvailability(dateStr, slotId, slotStart, isEnabled)` - Writes to `timeslot_availability/{dateStr}`
- `renderTimeslotControls()` - Displays UI for toggling slots

**Storage Key Format**:
- Uses slot start time as key: "8:20 AM", "9:20 AM", etc. (matches appointment-scheduler.js)
- Stores `false` for disabled/blocked slots
- Defaults to `true` if property doesn't exist

**Example Usage**:
```javascript
// Read availability for a specific date
const dateStr = "2025-12-15";
const db = window.firebase.firestore();
const doc = await db.collection('timeslot_availability').doc(dateStr).get();
if (doc.exists) {
  const availability = doc.data();
  const isSlotEnabled = availability.slots?.["8:20 AM"] !== false;
}

// Update a single slot
await db.collection('timeslot_availability').doc(dateStr).set({
  date: dateStr,
  "slots.8:20 AM": false,  // Block this slot
  updatedAt: db.FieldValue.serverTimestamp(),
  updatedBy: 'admin'
}, { merge: true });
```

#### 3. `time-slots-settings.js`

**Functions**:
- `toggleSlot(slotId)` - Toggles slot active status in `time_slots_config`
- `saveTimeSlots()` - Saves slot definitions

**Note**: This file manages the TIME SLOT DEFINITIONS (what slots exist), not the daily availability.

## Data Synchronization

### Page Load Flow
1. **appointment.html** loads (contains both calendar and timeslot controls)
2. **firebase-setup.js** initializes Firebase
3. **appointment-scheduler.js** loads and calls:
   - `loadTimeSlotDefinitions()` → reads from `time_slots_config/slots`
   - `loadUnavailableSlots()` → reads from `timeslot_availability/{selectedDate}`
4. **appointments.js** loads and calls `renderTimeslotControls()`

### Date Change Flow
1. User clicks date in calendar
2. `renderQueue()` is called
3. `loadUnavailableSlots()` fetches data for NEW date from `timeslot_availability/{newDate}`
4. `renderTimeslotAvailability()` displays the UI with correct button states
5. `renderTimeslotControls()` also updates (if on appointments page)

### Toggle Slot Flow
1. Admin clicks a slot button
2. Local state is updated in `unavailableSlots` array
3. `saveUnavailableSlots()` OR `updateTimeslotAvailability()` writes to Firestore
4. Both pages check the same Firestore collection, so changes sync automatically

## Firestore Rules Summary

```firestore
// Timeslot Availability - any authenticated user can read, admins can write
match /timeslot_availability/{dateDoc} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && isAdmin(request.auth.uid);
}

// Time Slots Configuration - any authenticated user can read, admins can write
match /time_slots_config/{document=**} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && isAdmin(request.auth.uid);
}

// General Settings (not used for timeslots anymore)
match /settings/{document=**} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && isAdmin(request.auth.uid);
}
```

## Testing & Debugging

### Console Logs

When the system is working correctly, you should see in the browser console:

```
✅ Loaded time slots from Firebase: 12
✅ Loaded unavailable slots for 2025-12-15: [
  {date: "2025-12-15", time: "8:20 AM"},
  {date: "2025-12-15", time: "10:20 AM"}
]
✅ Unavailable slots saved to Firestore
```

### Manual Testing in Firebase Console

1. Navigate to Firestore in Firebase Console
2. Go to `timeslot_availability` collection
3. Create a test document with date `2025-12-15`:
```json
{
  "date": "2025-12-15",
  "slots": {
    "8:20 AM": false,
    "9:20 AM": true,
    "10:20 AM": false
  },
  "updatedAt": "2025-12-15T10:30:00.000Z",
  "updatedBy": "admin"
}
```
4. Refresh the dashboard and select date 2025-12-15
5. Verify buttons show red (8:20 AM, 10:20 AM) and green (9:20 AM)

### Testing Toggle Functionality

1. Open appointment.html in browser
2. Select a date in the calendar
3. Click a green "Available" button
4. Verify:
   - Button turns red
   - Console shows success message
   - Firestore console shows data updated

5. Refresh the page
6. Verify:
   - Button is still red (data persisted)
   - Console shows data loaded from Firestore

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Toggle doesn't save | Not authenticated | Ensure user is logged in with admin role |
| Changes don't persist after refresh | Reading from wrong collection | Verify using `timeslot_availability` collection |
| Buttons show wrong colors | Different data structures in code | Ensure all code uses slot start time as key |
| Changes don't sync between pages | Data not reloaded on date change | Verify `loadUnavailableSlots()` is called in `renderQueue()` |

## Migration Notes

**Previous Structure** (deprecated):
```
settings/unavailableSlots:
{
  slots: [{date: '2025-12-15', time: '8:20 AM'}, ...]
}
```

**New Structure** (current):
```
timeslot_availability/2025-12-15:
{
  date: '2025-12-15',
  slots: {
    '8:20 AM': false,
    '9:20 AM': true
  }
}
```

All code has been updated to use the new structure. The old `settings/unavailableSlots` collection is no longer used.

## Firebase Project Details

**Project ID**: `kingsleycarwashapp`

**Services Used**:
- Authentication (Firebase Auth)
- Firestore Database (Cloud Firestore)
- Cloud Storage

**Configuration File**: `firebase-setup.js` (module-based initializer)

**Backup Config**: `firebase-config.example.js` (legacy compat API)
