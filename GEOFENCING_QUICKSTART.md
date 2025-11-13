# 🚀 Geofencing System - Quick Start Guide

## What Was Implemented

You now have a **complete geofencing notification system** that:

✅ Allows admins to add carwash locations  
✅ Automatically detects when customers are nearby  
✅ Sends real-time push notifications to customers  
✅ Respects operating hours  
✅ Prevents notification spam (1 per hour per location)  

---

## 📁 New Files Created

| File | Purpose |
|------|---------|
| `functions/index.js` | Cloud Function that detects geofences & sends notifications |
| `customer-geofencing.js` | Customer-side location tracking module |
| `customer-dashboard.html` | Sample customer dashboard showing geofencing status |
| `GEOFENCING_SETUP.md` | Complete technical setup guide |

---

## ⚡ Quick Setup (5 Steps)

### 1️⃣ Deploy Cloud Function
```powershell
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 2️⃣ Enable Firebase Cloud Messaging
1. Go to Firebase Console → Project Settings → Cloud Messaging
2. Copy the **Public Key** (VAPID key)

### 3️⃣ Update VAPID Key
In `customer-geofencing.js` line ~160, replace:
```javascript
vapidKey: 'YOUR_ACTUAL_VAPID_KEY_HERE'  // ← Paste your key here
```

### 4️⃣ Add Customer Module to Your App
Add to any customer-facing page:
```html
<script src="firebase-setup.js"></script>
<script src="auth-guard.js"></script>
<script src="customer-geofencing.js"></script>
```

### 5️⃣ Test It Out
1. Open `geofencing.html` → Add a test location
2. Open `customer-dashboard.html` → Grant permissions
3. Move to the location → Should receive notification! 🎉

---

## 🎯 How It Works

```
Admin Dashboard (geofencing.html)
    ↓ Stores locations in Firebase
    ↓
Customer App (customer-geofencing.js)
    ↓ Tracks location every 30 seconds
    ↓
Firestore (user_locations collection)
    ↓ Auto-triggers Cloud Function
    ↓
Cloud Function (functions/index.js)
    ↓ Checks if within geofence radius
    ↓
Firebase Messaging
    ↓ Sends push notification
    ↓
Customer's Phone/Browser 📱✅
```

---

## 📊 Collections in Firestore

### Admin Settings
```
admin_settings/
  └─ geofencing
     ├─ isEnabled: true
     ├─ notificationMessage: "Visit us now!"
     ├─ operatingHours: {Monday: {isOpen: true, start: "08:00", end: "20:00"}, ...}
     └─ notificationsSent: 247
```

### Geofencing Locations
```
geofencing_locations/
  ├─ location_1
  │  ├─ name: "Downtown Branch"
  │  ├─ latitude: 14.6091
  │  ├─ longitude: 121.0223
  │  └─ radius: 500 (meters)
```

### User Locations (Tracked Automatically)
```
user_locations/
  └─ user_123
     ├─ latitude: 14.6095
     ├─ longitude: 121.0225
     ├─ accuracy: 15
     └─ timestamp: "2024-11-13T10:30:00Z"
```

### User FCM Tokens
```
users/
  └─ user_123
     ├─ email: "customer@example.com"
     ├─ fcmTokens: ["token1", "token2"]
     └─ lastGeofenceNotifications: {location_1: "2024-11-13T10:30:00Z"}
```

---

## 🔧 Customization Options

### Change Update Frequency
In `customer-geofencing.js`:
```javascript
this.updateInterval = 30000;  // milliseconds
// 30000 = 30 seconds (balanced)
// 10000 = 10 seconds (more accurate, drains battery)
// 60000 = 60 seconds (battery friendly)
```

### Change Notification Cooldown
In `functions/index.js`:
```javascript
return hoursDiff >= 1;  // Change 1 to any number of hours
```

### Customize Notification Message
In Admin Dashboard → Geofencing Settings → Custom Message textarea

---

## ✅ Testing Checklist

- [ ] Cloud Function deployed successfully
- [ ] VAPID key added to `customer-geofencing.js`
- [ ] Customer module included in your app
- [ ] Admin can add locations in `geofencing.html`
- [ ] Geofencing toggle is enabled
- [ ] Operating hours overlap with current time
- [ ] Customer opens app and grants permissions
- [ ] Check browser console: `window.geofencing.getStatus()`
- [ ] Location tracking shows "Active"
- [ ] FCM Token shows "Ready"
- [ ] Notification permission shows "✅"
- [ ] Move to a test location
- [ ] Receive push notification 🎉

---

## 🐛 Debugging

### Check if tracking is active:
```javascript
// In browser console on customer page
window.geofencing.getStatus()
// Should output:
// {isTracking: true, userId: "...", hasNotificationPermission: true, hasFCMToken: true}
```

### Check Cloud Function logs:
```powershell
firebase functions:log

# Look for indicators:
# 📍 = Location update received
# ✅ = Notification sent
# ❌ = Error occurred
# ⏰ = Outside operating hours
```

### Check Firestore data:
1. Firebase Console → Firestore
2. Collections:
   - `user_locations/` → See latest customer positions
   - `users/` → See FCM tokens stored
   - `geofencing_locations/` → See configured locations

---

## 📱 For Mobile Apps

If building a React Native or Flutter app:

**React Native:**
```bash
npm install react-native-geolocation-service react-native-firebase
```

**Flutter:**
```bash
flutter pub add geolocator firebase_messaging
```

Both should:
1. Get location every 30 seconds
2. POST to `user_locations/{userId}` in Firestore
3. Request FCM permission
4. Handle push notifications

---

## 🚨 Important Notes

⚠️ **VAPID Key Required**: Without setting the VAPID key, FCM won't work  
⚠️ **Permissions Required**: Users must grant location & notification access  
⚠️ **HTTPS Only**: Geolocation API requires HTTPS (except localhost)  
⚠️ **Battery Impact**: Location tracking uses battery; consider letting users disable it  
⚠️ **Privacy**: Store location data securely; inform users about tracking  

---

## 📞 Troubleshooting

| Issue | Solution |
|-------|----------|
| No notifications | Check VAPID key, Cloud Function logs, geofencing enabled |
| Location not tracking | Check permission granted, `updateInterval` not too long |
| High battery drain | Increase `updateInterval` from 30000 to 60000ms |
| Function not deployed | Run `npm install` in functions/, then redeploy |
| Customer page broken | Ensure `firebase-setup.js` loaded before `customer-geofencing.js` |

---

## 📈 Next Steps

1. **Deploy to Production**
   ```powershell
   firebase deploy
   ```

2. **Monitor Performance**
   - Check Cloud Function logs daily
   - Monitor `notificationsSent` counter in admin dashboard

3. **Gather Feedback**
   - Track if customers find notifications helpful
   - Adjust frequency/message based on feedback

4. **Expand**
   - Add promotion links to notifications
   - Track which promotions drive traffic
   - A/B test different notification messages

---

## 📚 Full Documentation

See `GEOFENCING_SETUP.md` for:
- Complete architecture diagram
- Security rules setup
- Detailed troubleshooting guide
- Performance monitoring
- Future enhancement ideas

---

**System Ready! 🎉**

You can now start:
1. ✅ Testing in `customer-dashboard.html`
2. ✅ Adding locations in `geofencing.html`
3. ✅ Receiving real-time notifications when nearby

Questions? Check `GEOFENCING_SETUP.md` or Cloud Function logs for detailed diagnostics.
