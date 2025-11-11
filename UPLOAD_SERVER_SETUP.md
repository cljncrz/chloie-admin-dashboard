# Media Upload Server Setup Guide

## Problem Solved ✅
The CORS issue at `firebasestorage.googleapis.com` is a Google infrastructure restriction that cannot be fixed from the client side. This backend server proxies uploads through a Node.js server, completely bypassing CORS.

## Quick Setup (3 Steps)

### Step 1: Get Firebase Service Account Key
This is the CRITICAL step. Without this, the server cannot authenticate with Firebase.

1. **Open Firebase Console**
   - Go to: https://console.firebase.google.com
   - Select: **kingsleycarwashapp** project

2. **Get Service Account**
   - Click ⚙️ **Project Settings** (gear icon at top-left)
   - Click **Service Accounts** tab
   - Click **Generate New Private Key** button
   - A JSON file will download automatically

3. **Save the Key**
   - Rename the downloaded file to: `firebase-service-account.json`
   - Place it in your project root directory (same level as `server.js`)
   - **IMPORTANT:** Add this file to `.gitignore` (don't commit it to GitHub)

### Step 2: Install Dependencies
Open terminal/PowerShell in your project directory:
```powershell
npm install
```

### Step 3: Start the Server
```powershell
npm start
```

**Expected Output:**
```
✅ Firebase Admin SDK initialized

🚀 Server running at http://localhost:5000
📤 Upload endpoint: POST http://localhost:5000/api/upload
📋 Get media: GET http://localhost:5000/api/media
🗑️  Delete media: DELETE http://localhost:5000/api/media/:id
❤️  Health check: GET http://localhost:5000/health
```

---

## Troubleshooting

### Error: "firebase-service-account.json not found"
**Solution:** You need to download the Firebase service account key
- Steps are in "Step 1: Get Firebase Service Account Key" above
- Make sure the file is named EXACTLY: `firebase-service-account.json`
- Make sure it's in the project root (not in a subfolder)

### Error: "Bucket name not specified"
**Solution:** The server configuration is missing the bucket name
- Make sure you followed all steps above
- Restart with: `npm start`

### Error: "Port 5000 already in use"
**Solution:** Either close the other app using port 5000, or change the port:
```powershell
$env:PORT=5001; npm start
```
Then update `API_URL` in `media-manager.js` to: `http://localhost:5001/api/upload`

### "Backend server is not running" error in the app
**Solution:** Make sure the server is actually running
- Open PowerShell in the project directory
- Run: `npm start`
- Check that you see the "🚀 Server running" message

---

## How It Works

1. **Frontend** (media-manager.js) converts file to base64 and sends to server
2. **Server** (server.js) receives the request
3. **Server** authenticates with Firebase using the service account key
4. **Server** uploads the file to Firebase Storage
5. **Server** saves metadata to Firestore
6. **Server** returns download URL to frontend
7. **Frontend** displays the file in Media Manager

**No CORS errors!** ✅

---

## Keep the Server Running

You have two options:

### Option 1: Keep Terminal Open (Development)
Just keep the terminal/PowerShell window open with the server running.

### Option 2: Run in Background (Windows)
Create a batch file to run the server in the background:

1. Create a file named `start-server.bat` in your project root:
```batch
@echo off
echo Starting Media Upload Server...
npm start
pause
```

2. Double-click it to start the server

---

## For Production Deployment

If you deploy your app to production (e.g., Netlify, Vercel), you'll also need to deploy this server:

**Option A: Deploy to Heroku** (Free tier available)
```powershell
heroku login
heroku create your-app-name
git push heroku main
```

**Option B: Deploy to Google Cloud Run** (Free tier available)
```powershell
gcloud run deploy media-server --source .
```

**Option C: Deploy to Azure** (Free trial available)
Check Azure App Service documentation

For any of these, set the `API_URL` in `media-manager.js` to your production server URL instead of `http://localhost:5000`.

---

## Security Notes

✅ The server accepts uploads only to `/media` folder  
✅ Firebase Storage Rules control access (set to allow authenticated users)  
✅ Service account key is private and should NEVER be committed to GitHub  
✅ Add `firebase-service-account.json` to `.gitignore`

---

## File Structure

After completing all steps, your project should look like:

```
project-root/
├── server.js                      (backend server)
├── firebase-service-account.json  (DO NOT COMMIT - add to .gitignore)
├── media-manager.js               (updated to use server)
├── media-manager.html
├── package.json
├── package-lock.json
├── .gitignore                     (should contain firebase-service-account.json)
└── ... other files
```

---

## Still Having Issues?

1. Check that `firebase-service-account.json` exists in project root
2. Make sure it's a valid JSON file (try opening it in VS Code)
3. Check server console for specific error messages
4. Restart the server: Ctrl+C then `npm start`
5. Hard refresh browser: Ctrl+Shift+R
6. Check browser console (F12) for error messages
