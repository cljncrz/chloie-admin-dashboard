# Firebase Setup Guide - Timeslot Availability

## ✅ Current Status

Your Firebase is **already configured and working**! Here's what's set up:

### 1. Firebase Configuration ✅
- **Project**: kingsleycarwashapp
- **Config File**: `firebase-setup.js` (loaded on every page)
- **Auth**: Email/Password authentication
- **Firestore**: Persistent local cache enabled

### 2. Firestore Collections Used ✅

#### `time_slots_config/slots`
Stores the time slot definitions (what times are available for booking)
```javascript
{
  slots: [
    { id: "...", start: "8:20 AM", end: "9:20 AM", isActive: true },
    { id: "...", start: "9:20 AM", end: "10:20 AM", isActive: true },
    // ... more slots
  ],
  updatedAt: "2024-12-08T...",
  updatedBy: "admin@example.com"
}
```

#### `settings/unavailableSlots`
Stores which specific time slots on specific dates are blocked
```javascript
{
  slots: [
    { date: "Sun Dec 08 2024", time: "8:20 AM - 9:20 AM" },
    { date: "Mon Dec 09 2024", time: "10:20 AM - 11:20 AM" }
  ],
  updatedAt: "2024-12-08T..."
}
```

### 3. Security Rules ✅
Your `firestore.rules` already has the correct permissions:
- `time_slots_config`: Read by authenticated users, Write by admins only
- `settings`: Read and Write by admins only

---

## 🚀 How to Verify It's Working

### Test 1: Check Time Slots Page
1. Open your admin dashboard
2. Navigate to **Time Slots Settings** page (`time-slots-settings.html`)
3. You should see your 12 configured time slots
4. Try toggling a slot ON/OFF - it should save to Firebase
5. Refresh the page - the state should persist

### Test 2: Check Appointment Scheduler
1. Open **Appointments** page (`appointment.html`)
2. Select a date on the calendar
3. You should see time slots for that day
4. Click a time slot to toggle availability
5. The button should show "Timeslot marked as unavailable/available"
6. Refresh - the blocked slots should remain blocked

### Test 3: Check Firebase Console
1. Go to https://console.firebase.google.com
2. Select your project: **kingsleycarwashapp**
3. Navigate to **Firestore Database**
4. Check these collections:
   - `time_slots_config` → `slots` document
   - `settings` → `unavailableSlots` document

---

## 🔧 If Something Doesn't Work

### Issue: "window.db is not defined"
**Solution**: Make sure `firebase-setup.js` is loaded in your HTML:
```html
<script type="module" src="firebase-setup.js"></script>
```

### Issue: "Permission denied" errors
**Solution**: Deploy your Firestore rules:
```powershell
firebase deploy --only firestore:rules
```

### Issue: Changes not saving to Firebase
**Check:**
1. Open browser console (F12)
2. Look for Firebase errors
3. Check if you're logged in as admin
4. Verify your internet connection

### Issue: Time slots not loading
**Solution**: Initialize the collections manually:
1. Go to Firebase Console → Firestore Database
2. Create collection: `time_slots_config`
3. Create document: `slots`
4. Use the Time Slots Settings page to add slots via UI

---

## 📱 Mobile App Integration

When your mobile app needs to read available time slots:

### Read Time Slot Definitions
```dart
// Get all time slot definitions
final doc = await FirebaseFirestore.instance
    .collection('time_slots_config')
    .doc('slots')
    .get();

final slots = doc.data()!['slots'] as List;
final activeSlots = slots.where((slot) => slot['isActive'] == true).toList();
```

### Check if a Slot is Blocked
```dart
// Get unavailable slots for appointment scheduling
final settingsDoc = await FirebaseFirestore.instance
    .collection('settings')
    .doc('unavailableSlots')
    .get();

final unavailableSlots = settingsDoc.data()?['slots'] ?? [];

// Check if specific date/time is blocked
bool isSlotBlocked(String date, String time) {
  return unavailableSlots.any((slot) => 
    slot['date'] == date && slot['time'] == time
  );
}
```

---

## 🎯 Quick Commands

### Deploy Firestore Rules
```powershell
firebase deploy --only firestore:rules
```

### Check Firebase Project
```powershell
firebase projects:list
```

### Test Firestore Locally (Optional)
```powershell
firebase emulators:start --only firestore
```

---

## ✨ Features Working

✅ Time slot definitions stored in Firebase
✅ Admin can add/edit/delete time slots via UI
✅ Admin can toggle slots ON/OFF (availability)
✅ Admin can block specific dates/times in appointment scheduler
✅ Changes sync immediately across all tabs
✅ Mobile app can read the configurations
✅ Security rules protect admin-only operations

---

## 📞 Need Help?

If you encounter any issues:
1. Check browser console (F12) for errors
2. Verify you're logged in as admin
3. Check Firebase Console for data
4. Ensure firestore.rules are deployed
5. Test your internet connection

**Everything is already configured and should be working!** 🎉
