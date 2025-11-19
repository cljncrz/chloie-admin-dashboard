# Firebase Storage CORS Fix - Complete Guide

## The Problem
Firebase Storage blocks uploads from localhost (127.0.0.1:5500) due to CORS policy.
Error: "Access to XMLHttpRequest has been blocked by CORS policy"

## Solution 1: Apply CORS via Google Cloud SDK (RECOMMENDED)

### Step 1: Install Google Cloud SDK
The installer (GoogleCloudSDKInstaller.exe) is already downloaded in this folder.
Run it and follow the installation wizard.

### Step 2: Initialize gcloud
After installation, open a NEW PowerShell window and run:

```powershell
gcloud init
```

This will:
- Open your browser for authentication
- Let you select your project (kingsleycarwashapp)

### Step 3: Apply CORS Configuration
Run these commands in PowerShell:

```powershell
# Navigate to project directory
cd "c:\Users\mkrc0\Desktop\Kingsley Dashboard GITHUB\chloie-admin-dashboard"

# Apply CORS to your Firebase Storage bucket
gsutil cors set cors.json gs://kingsleycarwashapp.appspot.com

# Verify CORS is applied
gsutil cors get gs://kingsleycarwashapp.appspot.com
```

### Step 4: Test Your Upload
Refresh your browser and try uploading an image again. It should work!

---

## Solution 2: Apply CORS via Google Cloud Console

If you prefer not to install SDK:

1. Go to: https://console.cloud.google.com/storage/browser
2. Login with your Firebase/Google account
3. Select project: kingsleycarwashapp
4. Click on bucket: kingsleycarwashapp.appspot.com
5. Click "Edit bucket" (three dots menu) → "Edit CORS configuration"
6. Paste this configuration:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "DELETE", "POST", "OPTIONS", "PUT"],
    "responseHeader": ["*"],
    "maxAgeSeconds": 3600
  }
]
```

7. Click "Save"

---

## Solution 3: Quick PowerShell Script (After SDK Installed)

I've created a script that will do everything automatically:

```powershell
.\fix-cors-quick.ps1
```

---

## Verification

After applying CORS, you can verify it worked by running:

```powershell
gsutil cors get gs://kingsleycarwashapp.appspot.com
```

You should see the CORS configuration output.

---

## What This Does

The CORS configuration allows:
✓ All origins (*) - including localhost
✓ All HTTP methods (GET, POST, PUT, DELETE, etc.)
✓ All response headers
✓ 1-hour cache (3600 seconds)

This enables your admin dashboard to upload images directly to Firebase Storage!

---

## Need Help?

If you encounter any errors:
1. Make sure you're logged into the correct Google account
2. Verify you have Owner/Editor permissions on the Firebase project
3. Try refreshing your browser after applying CORS
4. Check the browser console for any new error messages
