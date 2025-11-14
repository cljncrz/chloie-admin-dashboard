# Firebase Setup - Updated Configuration

## Overview
This project has been updated to use **Firebase SDK (Modular v9+)** via a centralized module initializer (`firebase-setup.js`). The setup initializes Firebase using the modular SDK and exposes a compat-like shim (`window.firebase`) for backward compatibility.

## What Changed

### Before (Broken)
- Multiple Firebase compat CDN scripts scattered in HTML
- Circular imports between `firebase-config.js` and application code
- `window.firebase` was undefined, causing "ReferenceError: firebase is not defined"
- `window.firebaseInitPromise` was never set, causing "Cannot read properties of undefined (reading 'then')"

### After (Fixed)
- Single, reliable module initializer: `firebase-setup.js`
- No circular imports
- `window.firebase` is properly initialized with compat-like API
- `window.firebaseInitPromise` is resolved immediately
- All 20+ HTML pages now load the module before other scripts

## New HTML Pattern

All HTML files now include the module like this (placed in `<head>` before other scripts):

```html
<head>
  <!-- ... other head content ... -->
  <link rel="stylesheet" href="style.css" />
  
  <!-- Initialize Firebase via module (provides compat-like API + initialization promise) -->
  <script type="module" src="firebase-setup.js"></script>
  
  <!-- Your page scripts can now use window.firebase.* -->
  <script src="auth-guard.js"></script>
  <script src="script.js"></script>
</head>
```

## How It Works

`firebase-setup.js` does the following:
1. Imports modular Firebase SDK functions from CDN
2. Initializes the Firebase app with your project config
3. Creates a `window.firebase` object that mimics the compat API
4. Sets `window.firebaseInitPromise` as a resolved promise
5. Exports `auth`, `db`, and `storage` for module-based code

## Frontend - Using the Compat Shim

All your existing code continues to work unchanged:

```javascript
// In your JS files (script.js, appointments.js, auth-guard.js, etc.):
document.addEventListener('DOMContentLoaded', async () => {
    // ✓ Works — promise is resolved
    await window.firebaseInitPromise;
    
    // ✓ Works — window.firebase is defined
    const db = window.firebase.firestore();
    const auth = window.firebase.auth();
    const storage = window.firebase.storage();
    
    // Example: fetch data from Firestore
    const snapshot = await db.collection('bookings').get();
    snapshot.forEach(doc => {
        console.log(doc.id, doc.data());
    });
});
```

## API Examples

### Authentication
```javascript
// Sign in
await window.firebase.auth().signInWithEmailAndPassword(email, password);

// Get current user
const user = window.firebase.auth().currentUser;
console.log(user.uid, user.email);

// Listen to auth state changes
window.firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log("Logged in:", user.email);
    } else {
        console.log("Logged out");
    }
});

// Sign out
await window.firebase.auth().signOut();

// Update profile
await user.updateProfile({ displayName: 'John Doe' });
```

### Firestore Database
```javascript
const db = window.firebase.firestore();

// Get all documents in a collection
const snapshot = await db.collection('users').get();
snapshot.docs.forEach(doc => {
    console.log(doc.id, doc.data());
});

// Get a single document
const docSnap = await db.collection('users').doc(userId).get();
if (docSnap.exists()) {
    console.log(docSnap.data());
}

// Create/set a document
await db.collection('users').doc(userId).set({
    name: 'Jane Doe',
    email: 'jane@example.com'
});

// Update a document
await db.collection('users').doc(userId).update({
    age: 30,
    updatedAt: window.firebase.firestore().FieldValue.serverTimestamp()
});

// Delete a document
await db.collection('users').doc(userId).delete();

// Query with where condition
const q = db.collection('users').where('age', '>', 25).get();
```

### Cloud Storage
```javascript
const storage = window.firebase.storage();

// Upload a file
const fileRef = storage.ref(`profile-pictures/${userId}/photo.jpg`);
await fileRef.put(blob);

// Get download URL
const url = await fileRef.getDownloadURL();

// Delete a file
await fileRef.delete();
```

## Files Updated

All HTML files now use `firebase-setup.js`:
- index.html
- login.html
- appointment.html
- appointments.html (if exists)
- customers.html
- services.html
- technicians.html
- dashboard.html (if exists)
- ... and 12+ others

## Environment Configuration

The Firebase config is **hardcoded in `firebase-setup.js`** for the browser:
- API Key: `AIzaSyCFToN0U0Q3zmLZiTJAwPURrCgnCH7wPe0`
- Project ID: `kingsleycarwashapp`
- Auth Domain: `kingsleycarwashapp.firebaseapp.com`
- Firestore: Default database
- Storage: `gs://kingsleycarwashapp.appspot.com`

This is **safe** because web API keys are public by design.

## Troubleshooting

### Error: "firebase is not defined"
✓ **Fixed** — `window.firebase` is now always defined by `firebase-setup.js`

### Error: "Cannot read properties of undefined (reading 'then')"
✓ **Fixed** — `window.firebaseInitPromise` is now always defined

### Error: "ReferenceError: Cannot read properties of undefined (reading 'firestore')"
- Make sure your page includes `<script type="module" src="firebase-setup.js"></script>` in the `<head>`
- Check browser console (F12) for any errors loading `firebase-setup.js`
- Ensure `firebase-setup.js` exists in the project root

### Module not loading (404 error)
- Verify `firebase-setup.js` is in the project root directory
- Clear browser cache (Ctrl+Shift+Del / Cmd+Shift+Del)
- Restart your local server if running one

## Next Steps (Optional Cleanup)

If you want to clean up the legacy Firebase initialization:
- Delete or archive `firebase-config.js` (it's no longer used)
- Delete `firebase-init.js` (it's no longer used)
- Remove any remaining compat CDN script tags from HTML files (already done)

## Questions or Issues?

If you encounter any problems:
1. Check browser console (F12) for error messages
2. Verify `firebase-setup.js` loads (in Network tab)
3. Test with console commands:
   ```javascript
   Boolean(window.firebase)  // Should be true
   typeof window.firebase.auth  // Should be "function"
   window.firebaseInitPromise.then(() => console.log('OK'))  // Should log 'OK'
   ```
