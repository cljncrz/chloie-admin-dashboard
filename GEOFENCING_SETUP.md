# 🌍 Geofencing Notification System - Complete Setup Guide

## 📋 Overview

This system enables real-time push notifications to customers when they enter a Kingsley Carwash geofencing radius. It consists of three components:

1. **Admin Dashboard** (`geofencing.html/js`) - Admins add locations, set hours
2. **Cloud Function** (`functions/index.js`) - Backend geofence checking
3. **Customer Module** (`customer-geofencing.js`) - Tracks customer location & receives notifications

---

## 🚀 Setup Instructions

### Step 1: Update Firebase Configuration

#### 1.1 Enable Cloud Functions
```bash
# In your project directory
firebase init functions
# Select JavaScript
# Install dependencies: npm install
```

#### 1.2 Set Cloud Functions Permissions
In Firebase Console → Project Settings → Permissions:
1. Go to IAM & Admin
2. Add roles to the default Cloud Functions service account:
   - Cloud Functions Developer
   - Cloud Functions Service Agent
   - Firebase Admin

---

### Step 2: Deploy Cloud Function

#### 2.1 Install Dependencies
```powershell
cd functions
npm install
cd ..
```

#### 2.2 Deploy Function
```powershell
firebase deploy --only functions
```

Expected output:
```
✔  Deploy complete!

Function URL (checkGeofence): https://[region]-[project].cloudfunctions.net/checkGeofence
Function URL (healthCheck): https://[region]-[project].cloudfunctions.net/healthCheck
```

#### 2.3 Test the Function
```powershell
curl https://[region]-[project].cloudfunctions.net/healthCheck
```

---

### Step 3: Enable Firebase Cloud Messaging (FCM)

#### 3.1 Get VAPID Key
1. Go to Firebase Console → Project Settings → Cloud Messaging
2. Copy the "Server API Key" (for backend)
3. Copy the "Web Push certificates" → "Key pair" → Public key (VAPID key)

#### 3.2 Set VAPID Key in customer-geofencing.js
In `customer-geofencing.js`, line ~160:
```javascript
const token = await messaging.getToken({
  vapidKey: 'YOUR_ACTUAL_VAPID_KEY_HERE'  // Replace this
});
```

#### 3.3 Set Server API Key in Cloud Functions (Optional for future use)
```javascript
// In functions/index.js, you can use:
process.env.FIREBASE_API_KEY
```

---

### Step 4: Setup Firestore Security Rules

Update your Firestore rules to allow location tracking:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // User locations - anyone can write their own, admins can read all
    match /user_locations/{userId} {
      allow read: if request.auth.uid == userId || 
                     isAdmin(request.auth.uid);
      allow write: if request.auth.uid == userId;
    }

    // Users - can read/write own data
    match /users/{userId} {
      allow read: if request.auth.uid == userId || 
                     isAdmin(request.auth.uid);
      allow write: if request.auth.uid == userId || 
                      isAdmin(request.auth.uid);
    }

    // Geofencing locations - anyone can read, only admins write
    match /geofencing_locations/{document=**} {
      allow read: if true;
      allow write: if isAdmin(request.auth.uid);
    }

    // Admin settings - only admins
    match /admin_settings/{document=**} {
      allow read: if true;
      allow write: if isAdmin(request.auth.uid);
    }

    // Helper function to check if user is admin
    function isAdmin(uid) {
      return exists(/databases/$(database)/documents/users/$(uid)) &&
             get(/databases/$(database)/documents/users/$(uid)).data.role == 'admin';
    }
  }
}
```

---

### Step 5: Add Customer Module to Customer Pages

Add this to any customer-facing page (e.g., `customer-dashboard.html`):

```html
<!-- In <head> -->
<script src="firebase-setup.js"></script>
<script src="auth-guard.js"></script>

<!-- In <body> after other scripts -->
<script src="customer-geofencing.js"></script>
```

---

### Step 6: Initialize Geofencing in Customer App

```javascript
// When customer logs in
import { CustomerGeofencing } from './customer-geofencing.js';

const geofencing = new CustomerGeofencing();
await geofencing.init(currentUser.uid);

// To check status
console.log(window.geofencing.getStatus());

// To stop tracking (e.g., on logout)
window.geofencing.stopTracking();
```

---

## 📱 How It Works

### Data Flow:

```
1. Customer opens app
   ↓
2. Browser requests location permission
   ↓
3. Customer grants permission
   ↓
4. Location tracking starts (every 30 seconds)
   ↓
5. Location sent to Firebase (user_locations collection)
   ↓
6. Cloud Function triggers automatically
   ↓
7. Checks distance to all geofencing locations
   ↓
8. If within radius AND:
   - Geofencing is enabled
   - Currently within operating hours
   - Not notified in past hour
   ↓
9. Sends push notification via FCM
   ↓
10. Customer receives notification on phone/browser
```

### Database Structure:

```
admin_settings/
  └─ geofencing
     ├─ isEnabled: boolean
     ├─ operatingHours: object (by day)
     ├─ notificationMessage: string
     ├─ notificationsSent: number
     └─ updatedAt: ISO string

geofencing_locations/
  ├─ location_1
  │  ├─ name: "Downtown Branch"
  │  ├─ address: "123 Main St"
  │  ├─ latitude: 14.6091
  │  ├─ longitude: 121.0223
  │  ├─ radius: 500 (meters)
  │  ├─ createdAt: ISO string
  │  └─ updatedAt: ISO string

user_locations/
  └─ user_id
     ├─ latitude: 14.6095
     ├─ longitude: 121.0225
     ├─ accuracy: 15 (meters)
     └─ timestamp: ISO string

users/
  └─ user_id
     ├─ email: "customer@example.com"
     ├─ fcmTokens: ["token1", "token2"]
     ├─ lastGeofenceNotifications: {
     │    "location_1": "2024-11-13T10:30:00Z"
     │  }
     └─ lastTokenUpdate: ISO string
```

---

## 🧪 Testing

### Test Admin Dashboard:
1. Go to `geofencing.html`
2. Add a test location with your coordinates
3. Enable geofencing
4. Set current time within operating hours

### Test Cloud Function:
```powershell
# Check function logs
firebase functions:log

# Or in Firebase Console → Functions → Logs
```

### Test Customer Module:
1. Open browser console on customer page
2. Check: `window.geofencing.getStatus()`
3. Should see:
   ```javascript
   {
     isTracking: true,
     userId: "user_id",
     hasNotificationPermission: true,
     hasFCMToken: true
   }
   ```

### Simulate Location Update:
```javascript
// In browser console
navigator.geolocation.getCurrentPosition((pos) => {
  console.log(pos.coords);
});
```

---

## 🔧 Configuration

### Adjust Update Frequency
In `customer-geofencing.js`:
```javascript
this.updateInterval = 30000; // milliseconds (30s = every 30 seconds)
```

Recommended values:
- `30000` - Balanced (good for finding nearby locations)
- `10000` - More frequent (battery drain, accurate)
- `60000` - Less frequent (battery friendly)

### Adjust Notification Cooldown
In `functions/index.js`, line ~131:
```javascript
// Send notification only once per hour per location
return hoursDiff >= 1;  // Change 1 to any number of hours
```

---

## 📊 Monitor Performance

### View Cloud Function Logs:
```powershell
firebase functions:log --only checkGeofence
```

### View Statistics in Admin Dashboard:
- **Active Locations Count** - Number of locations configured
- **Geofencing Status** - Enabled/Disabled
- **Notifications Sent** - Total notifications sent today

### Check in Firestore:
```
admin_settings/geofencing → notificationsSent
user_locations/{userId} → Check latest timestamp
```

---

## 🐛 Troubleshooting

### Issue: No notifications received

**Check these in order:**

1. **Is geofencing enabled?**
   ```javascript
   // Admin dashboard
   // Verify toggle is ON and within operating hours
   ```

2. **Does admin have locations configured?**
   ```javascript
   // Check: geofencing_locations collection is not empty
   ```

3. **Is customer location being tracked?**
   ```javascript
   // Browser console
   console.log(window.geofencing.getStatus());
   // Should show: isTracking: true
   ```

4. **Has customer granted location permission?**
   ```javascript
   // Browser console
   // Manually request permission
   window.geofencing.requestLocationPermission();
   ```

5. **Has customer granted notification permission?**
   ```javascript
   // Browser console
   // Check notification status
   console.log(Notification.permission); // should be 'granted'
   ```

6. **Check Cloud Function logs:**
   ```powershell
   firebase functions:log
   ```
   Look for ✅ or ❌ indicators in logs

7. **Verify FCM token is stored:**
   ```javascript
   // Firestore: users/{userId} → fcmTokens array
   // Should contain at least one token
   ```

### Issue: Function not deploying

```powershell
# Clear cache and try again
rm -r functions/node_modules
cd functions && npm install && cd ..
firebase deploy --only functions
```

### Issue: High battery drain

Increase `updateInterval` in `customer-geofencing.js`:
```javascript
this.updateInterval = 60000; // 60 seconds instead of 30
```

---

## 🔐 Security Best Practices

1. **Limit location data retention**: Set Firestore TTL policy on `user_locations` (30 days)
2. **Encrypt sensitive coordinates**: Consider storing hashes for comparing distances
3. **Validate all inputs**: Cloud Function validates coordinates and radius
4. **Use HTTPS only**: All requests are encrypted via Firebase
5. **Audit notifications**: Monitor `notificationsSent` count for anomalies
6. **Disable in production until fully tested**: Use Firestore rules to control access

---

## 📈 Future Enhancements

- [ ] Add heatmap showing where customers are located
- [ ] Scheduled notifications at specific times
- [ ] Custom notification templates per location
- [ ] Analytics: Geofence entry/exit tracking
- [ ] A/B testing: Different messages for different users
- [ ] Integration with loyalty program rewards
- [ ] Real-time customer count at each location
- [ ] Predictive analytics: Busiest times per location

---

## 📞 Support

If you encounter issues:

1. Check Cloud Function logs: `firebase functions:log`
2. Verify Firestore collection structure matches docs
3. Ensure FCM is enabled in Firebase Console
4. Check browser console for JavaScript errors
5. Verify network connectivity
6. Test with hardcoded location first

---

**Version**: 1.0  
**Last Updated**: November 13, 2025  
**System**: Kingsley Carwash Geofencing & Notification System
