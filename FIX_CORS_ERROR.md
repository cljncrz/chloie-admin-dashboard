# Fix Firebase Storage CORS Error

## Problem
You're getting this error when trying to upload images:
```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...' 
has been blocked by CORS policy
```

## Solution

You need to configure CORS on your Firebase Storage bucket. Follow these steps:

### Option 1: Using Google Cloud Console (Easiest)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project: **kingsleycarwashapp**
3. Go to **Cloud Storage** > **Buckets**
4. Click on **kingsleycarwashapp.appspot.com**
5. Click on the **CONFIGURATION** tab
6. Under **CORS**, click **Edit CORS configuration**
7. Paste this JSON:

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

8. Click **Save**

### Option 2: Using Command Line

1. **Install Google Cloud SDK** (if not already installed):
   - Download from: https://cloud.google.com/sdk/docs/install
   - Run the installer

2. **Authenticate and configure**:
   ```powershell
   gcloud auth login
   gcloud config set project kingsleycarwashapp
   ```

3. **Apply CORS configuration**:
   ```powershell
   gsutil cors set cors.json gs://kingsleycarwashapp.appspot.com
   ```

### Option 3: Run the PowerShell Script

1. Open PowerShell in the project directory
2. Run:
   ```powershell
   .\apply-cors.ps1
   ```

## After Applying CORS

1. Wait 1-2 minutes for changes to propagate
2. Clear your browser cache (Ctrl+Shift+Delete)
3. Refresh your page
4. Try uploading an image again

## Alternative: Deploy Your App

The CORS issue only happens on localhost. If you deploy your app to Firebase Hosting or another domain, the issue won't occur.

To deploy quickly:
```powershell
firebase deploy --only hosting
```

Your app will be accessible at: https://kingsleycarwashapp.web.app

## Notes

- The current CORS config allows ALL origins (`"*"`) which is fine for development
- For production, you should restrict origins to your actual domain
- CORS changes can take a few minutes to propagate
