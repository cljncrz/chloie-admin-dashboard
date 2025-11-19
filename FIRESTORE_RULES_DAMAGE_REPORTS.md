# Firestore Security Rules for Damage Reports

## Issue
The `damage_reports` collection is currently not accessible due to Firestore security rules. You're seeing this error:
```
Missing or insufficient permissions
```

## Solution

You need to update your Firestore security rules to allow the admin dashboard to read damage reports.

### Option 1: Allow authenticated users to read damage reports (Recommended)

Go to Firebase Console → Firestore Database → Rules and add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Existing rules...
    
    // Damage Reports - Allow authenticated users to read
    match /damage_reports/{reportId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // If you want to allow creating/updating reports
    }
  }
}
```

### Option 2: Allow only admin users to read damage reports (More secure)

If you have an admin role field in your users collection:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is admin
    function isAdmin() {
      return request.auth != null && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Existing rules...
    
    // Damage Reports - Allow only admins
    match /damage_reports/{reportId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
  }
}
```

### Option 3: Temporary - Allow all reads (NOT recommended for production)

⚠️ **Use this only for testing!**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Existing rules...
    
    // Damage Reports - TEMPORARY: Allow all reads
    match /damage_reports/{reportId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Steps to Update Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **kingsleycarwashapp**
3. Navigate to **Firestore Database** (left sidebar)
4. Click on the **Rules** tab
5. Add the appropriate rule from above
6. Click **Publish**

## Verifying the Collection Name

If the collection doesn't exist or is named differently in your Firestore:

1. Go to Firebase Console → Firestore Database → Data tab
2. Look for collections related to damage reports
3. Possible collection names might be:
   - `damage_reports`
   - `damageReports`
   - `bookings` (with a damageReport field)
   - `reports`

If the collection name is different, update line 126 in `damage-reports.js`:
```javascript
const snapshot = await db.collection('YOUR_ACTUAL_COLLECTION_NAME').get();
```

## Testing

After updating the rules:
1. Refresh the damage-reports.html page
2. Check the browser console for any errors
3. You should see: "Damage reports loaded from Firestore: [...]"
