# Firebase Configuration Guide

## Overview
This project uses a centralized Firebase configuration system that supports both frontend (browser) and backend (Node.js) environments.

## Files
- **`firebase-config.js`** - Main Firebase initialization (frontend & browser)
- **`config.js`** - Configuration helper module
- **`.env`** - Environment variables (⚠️ **DO NOT commit this file**)
- **`.env.example`** - Template for environment variables

## Setting Up Firebase Configuration

### 1. Frontend (Browser)

#### Option A: Direct inclusion (Current Setup)
Include `firebase-config.js` in your HTML before other scripts:

```html
<script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js"></script>
<script src="firebase-config.js"></script>
<!-- Your other scripts can now use: auth, db, storage -->
```

#### Option B: Get config dynamically
```javascript
const config = getFirebaseConfig();
console.log(config.projectId); // "kingsleycarwashapp"
```

### 2. Backend (Node.js / Express)

#### Initialize from config module
```javascript
// In your server.js or route handler
require('dotenv').config();
const { getFirebaseConfig } = require('./firebase-config.js');

const firebaseConfig = getFirebaseConfig();
console.log(firebaseConfig);
```

#### Access services (Admin SDK)
```javascript
const admin = require('firebase-admin');
const db = admin.firestore();
const bucket = admin.storage().bucket();
```

## Environment Variables

### Setup Instructions

1. **Create a `.env` file** from the template:
```bash
cp .env.example .env
```

2. **Fill in your Firebase credentials** in `.env`:
```
FIREBASE_API_KEY=AIzaSyCFToN0U0Q3zmLZiTJAwPURrCgnCH7wPe0
FIREBASE_AUTH_DOMAIN=kingsleycarwashapp.firebaseapp.com
FIREBASE_DATABASE_URL=https://kingsleycarwashapp-default-rtdb.firebaseio.com
FIREBASE_PROJECT_ID=kingsleycarwashapp
FIREBASE_STORAGE_BUCKET=kingsleycarwashapp.appspot.com
FIREBASE_MESSAGING_SENDER_ID=508373593061
FIREBASE_APP_ID=1:508373593061:web:86a490e83f1016e5dc1d0c
```

3. **For Firebase Admin SDK** (Backend):
```
FIREBASE_SERVICE_ACCOUNT=/path/to/firebase-service-account.json
# OR
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"..."}'
```

### Finding Your Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **kingsleycarwashapp**
3. Click **Settings (⚙️)** → **Project Settings**
4. Copy values from **General** tab
5. For **Service Account**: 
   - Click **Service Accounts** tab
   - Click **Generate New Private Key**
   - Download the JSON file

## Usage Examples

### Frontend - Authentication
```javascript
// Get current user
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("Logged in:", user.email);
  }
});

// Sign out
auth.signOut().then(() => console.log("Signed out"));
```

### Frontend - Firestore
```javascript
// Fetch data
db.collection('appointments').get().then((snapshot) => {
  snapshot.forEach((doc) => {
    console.log(doc.data());
  });
});

// Add data
db.collection('appointments').add({
  date: new Date(),
  customer: 'John Doe'
});
```

### Frontend - Storage
```javascript
// Upload file
const file = document.getElementById('fileInput').files[0];
const storageRef = storage.ref('uploads/' + file.name);
storageRef.put(file).then(() => console.log("Upload complete"));

// Download file
storage.ref('uploads/file.pdf').getDownloadURL().then((url) => {
  console.log("Download URL:", url);
});
```

### Backend - Firestore (Admin SDK)
```javascript
// Get all documents
const snapshot = await db.collection('appointments').get();
snapshot.forEach((doc) => {
  console.log(doc.id, doc.data());
});

// Create document
await db.collection('appointments').add({
  date: new Date(),
  customer: 'John Doe',
  status: 'completed'
});

// Update document
await db.collection('appointments').doc('doc-id').update({
  status: 'pending'
});

// Delete document
await db.collection('appointments').doc('doc-id').delete();
```

### Backend - Storage (Admin SDK)
```javascript
// Upload file
const bucket = admin.storage().bucket();
const file = bucket.file('uploads/myfile.pdf');

await file.save(fileBuffer, {
  metadata: {
    contentType: 'application/pdf'
  }
});

// Download file
const [contents] = await file.download();
console.log(contents.toString());

// Get download URL
const [url] = await file.getSignedUrl({
  version: 'v4',
  action: 'read',
  expires: Date.now() + 15 * 60 * 1000, // 15 minutes
});
console.log(url);
```

## Security Best Practices

✅ **DO:**
- Keep `.env` file private (never commit to Git)
- Use environment variables for sensitive data
- Restrict Firebase Security Rules in Console
- Use service accounts only on backend
- Rotate service account keys regularly

❌ **DON'T:**
- Commit `.env` files
- Share API keys publicly
- Use admin credentials on frontend
- Expose `firebase-service-account.json`
- Use weak Firestore Security Rules

## Troubleshooting

### Error: "FIREBASE_API_KEY is not defined"
**Solution:** Make sure `.env` file exists and has all required variables:
```bash
cat .env  # Check the file contents
```

### Error: "Firebase app not initialized"
**Solution:** Ensure `firebase-config.js` is loaded before other scripts:
```html
<!-- Correct order: -->
<script src="firebase-config.js"></script>
<script src="your-app.js"></script>
```

### Error: "Service account not found"
**Solution:** Download it from Firebase Console:
1. Firebase Console → Project Settings → Service Accounts
2. Generate New Private Key
3. Save as `firebase-service-account.json` OR set `FIREBASE_SERVICE_ACCOUNT` env var

### Cannot access Firebase services
**Solution:** Check that Firebase is initialized:
```javascript
if (firebase.apps.length > 0) {
  console.log("Firebase initialized");
  const auth = firebase.auth();
}
```

## Starting the Server

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

The server will run on `http://localhost:5000` (default PORT in `.env`)

## Related Files
- `server.js` - Express backend server
- `firebase-init.js` - Alternative initialization (if used)
- `firebase-service-account.json` - (⚠️ NOT in Git, keep private)

