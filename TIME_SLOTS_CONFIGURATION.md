# Flexible Time Slots Configuration

## Overview
The appointment system now supports flexible time slot configuration through a Firebase-backed settings system. Admins can dynamically add, edit, enable/disable, and delete time slots without modifying code.

## Features

### 1. **Admin Dashboard Management**
- New page: `time-slots-settings.html`
- Add new time slots with custom start and end times
- Edit existing time slots
- Enable/disable time slots (inactive slots won't appear in the mobile app)
- Delete time slots
- Real-time statistics (total slots, active slots, last updated)

### 2. **Mobile App Integration**
- Mobile app reads time slots from Firebase collection `time_slots_config/slots`
- Only active slots are displayed to customers
- Slots are automatically synchronized across all platforms

### 3. **Backward Compatibility**
- System falls back to default time slots if Firebase collection doesn't exist
- Existing appointment scheduler continues to work seamlessly

## Installation & Setup

### Step 1: Deploy Firestore Rules
```powershell
# Run the deployment script
.\deploy-time-slots.ps1

# Or manually deploy
firebase deploy --only firestore:rules
```

### Step 2: Initialize Time Slots (First Time Only)
```bash
# Option A: Run the initialization script
node initialize-time-slots.js

# Option B: Use the admin dashboard
# Navigate to Time Slots Settings page and manually add slots
```

### Step 3: Access the Settings Page
1. Log in to the admin dashboard
2. Add a link to `time-slots-settings.html` in your navigation menu
3. Or access directly via: `https://your-domain.com/time-slots-settings.html`

## Firebase Collection Structure

### Collection: `time_slots_config`
### Document: `slots`

```json
{
  "slots": [
    {
      "id": "unique-id",
      "start": "8:20 AM",
      "end": "9:20 AM",
      "isActive": true
    },
    {
      "id": "unique-id-2",
      "start": "9:20 AM",
      "end": "10:20 AM",
      "isActive": false
    }
  ],
  "updatedAt": "2025-12-08T10:30:00.000Z",
  "updatedBy": "admin@example.com",
  "version": "1.0"
}
```

### Fields:
- **id**: Unique identifier for the time slot
- **start**: Start time in 12-hour format (e.g., "8:20 AM")
- **end**: End time in 12-hour format (e.g., "9:20 AM")
- **isActive**: Boolean - whether the slot is available for booking

## Mobile App Integration

### Reading Time Slots in Flutter/React Native

```javascript
// Example: Fetch time slots in JavaScript
const db = firebase.firestore();

async function getTimeSlots() {
  const doc = await db.collection('time_slots_config').doc('slots').get();
  
  if (doc.exists) {
    const data = doc.data();
    const activeSlots = data.slots.filter(slot => slot.isActive);
    return activeSlots;
  }
  
  return [];
}
```

```dart
// Example: Fetch time slots in Flutter
Future<List<Map<String, dynamic>>> getTimeSlots() async {
  final doc = await FirebaseFirestore.instance
      .collection('time_slots_config')
      .doc('slots')
      .get();
  
  if (doc.exists) {
    final data = doc.data() as Map<String, dynamic>;
    final slots = List<Map<String, dynamic>>.from(data['slots'] ?? []);
    return slots.where((slot) => slot['isActive'] == true).toList();
  }
  
  return [];
}
```

## API Endpoints (Optional)

If you want to create REST endpoints for the mobile app:

```javascript
// Express.js example
app.get('/api/time-slots', async (req, res) => {
  try {
    const doc = await admin.firestore()
      .collection('time_slots_config')
      .doc('slots')
      .get();
    
    if (doc.exists) {
      const data = doc.data();
      const activeSlots = data.slots.filter(slot => slot.isActive);
      res.json({ success: true, slots: activeSlots });
    } else {
      res.status(404).json({ success: false, message: 'No slots configured' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Files Modified/Created

### New Files:
- `time-slots-settings.html` - Admin UI for managing time slots
- `time-slots-settings.js` - JavaScript logic for time slot management
- `initialize-time-slots.js` - Script to initialize default time slots
- `deploy-time-slots.ps1` - Deployment script for rules and initialization
- `firestore.rules` - Updated Firestore security rules
- `TIME_SLOTS_CONFIGURATION.md` - This documentation file

### Modified Files:
- `appointment-scheduler.js` - Updated to read from Firebase collection
- `style.css` - Added styles for time slots settings page

## Security Rules

The Firestore rules allow:
- **Read**: All authenticated users (including mobile app users)
- **Write**: Admin users only

```javascript
match /time_slots_config/{document=**} {
  allow read: if isAuthenticated();
  allow write: if isAdmin();
}
```

## Default Time Slots

The system initializes with these time slots:
- 8:20 AM - 9:20 AM
- 9:20 AM - 10:20 AM
- 10:20 AM - 11:20 AM
- 11:20 AM - 12:10 PM
- 12:10 PM - 1:00 PM
- 1:20 PM - 2:20 PM
- 2:20 PM - 3:20 PM
- 3:50 PM - 4:50 PM
- 4:50 PM - 5:50 PM
- 5:50 PM - 6:50 PM
- 6:50 PM - 7:50 PM
- 7:50 PM - 8:50 PM

Each slot has an **ON/OFF toggle button** that:
- Immediately syncs with Firebase when clicked
- **Prevents appointments** from being booked when turned OFF
- Only shows active (ON) slots in the mobile app

## Troubleshooting

### Time slots not appearing in mobile app
1. Verify Firebase rules are deployed: `firebase deploy --only firestore:rules`
2. Check if slots exist in Firestore console
3. Ensure slots are marked as `isActive: true`
4. Verify mobile app user is authenticated

### Cannot save time slots in admin dashboard
1. Check if admin user is authenticated
2. Verify user has admin role in Firestore `users` collection
3. Check browser console for errors
4. Verify Firebase rules are properly deployed

### Slots not updating in real-time
1. The system doesn't use real-time listeners by default
2. Refresh the page to see latest changes
3. Or implement Firestore snapshot listeners for real-time updates

## Future Enhancements

Potential improvements:
- Real-time synchronization with Firestore listeners
- Bulk import/export of time slots
- Different time slots for different days of the week
- Holiday/special day configurations
- Slot capacity management (multiple bookings per slot)
- Time zone support

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify Firestore rules are deployed
3. Check Firebase Authentication status
4. Review the collection structure in Firestore console

---

**Version**: 1.0  
**Last Updated**: December 8, 2025  
**Maintained by**: Kingsley Carwash Development Team
