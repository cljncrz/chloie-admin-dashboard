# Deploy Chat Notification System
# Usage: .\deploy-chat.ps1

Write-Host "Deploying Chat Notification System" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

# Check Firebase CLI
Write-Host "Checking Firebase CLI..." -ForegroundColor Yellow
try {
    firebase --version | Out-Null
    Write-Host "Firebase CLI found" -ForegroundColor Green
} catch {
    Write-Host "Firebase CLI not found. Run: npm install -g firebase-tools" -ForegroundColor Red
    exit 1
}

# Check firebase.json exists
if (!(Test-Path "firebase.json")) {
    Write-Host "firebase.json not found. Run from project root." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Deployment Checklist:" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan
Write-Host ""

# Check handler script
if (Test-Path "chat-notification-handler.js") {
    Write-Host "✓ chat-notification-handler.js found" -ForegroundColor Green
} else {
    Write-Host "✗ chat-notification-handler.js NOT found" -ForegroundColor Red
    exit 1
}

# Check functions directory
if (Test-Path "functions") {
    Write-Host "✓ functions/ directory found" -ForegroundColor Green
} else {
    Write-Host "✗ functions/ directory NOT found" -ForegroundColor Red
    exit 1
}

# Check index.js
$indexContent = Get-Content "functions\index.js" -Raw
if ($indexContent -match "onNewChatMessage") {
    Write-Host "✓ onNewChatMessage Cloud Function found" -ForegroundColor Green
} else {
    Write-Host "✗ onNewChatMessage NOT found in functions/index.js" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Installation:" -ForegroundColor Cyan
Write-Host "============" -ForegroundColor Cyan
Write-Host ""

# Install dependencies
Write-Host "Installing Cloud Functions dependencies..." -ForegroundColor Yellow
Push-Location functions
if (!(Test-Path "node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
} else {
    Write-Host "Dependencies already installed" -ForegroundColor Gray
}
Pop-Location
Write-Host "✓ Dependencies installed" -ForegroundColor Green

Write-Host ""
Write-Host "Firebase Setup:" -ForegroundColor Cyan
Write-Host "==============" -ForegroundColor Cyan
Write-Host ""

# Check Firebase auth
Write-Host "Checking Firebase authentication..." -ForegroundColor Yellow
$firebaseAuth = firebase projects:list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Firebase not authenticated. Run: firebase login" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Firebase authenticated" -ForegroundColor Green

Write-Host ""
Write-Host "Deploying Cloud Functions:" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Deploy function
firebase deploy --only functions:onNewChatMessage

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Cloud Function deployed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Verification:" -ForegroundColor Cyan
Write-Host "============" -ForegroundColor Cyan
Write-Host ""

Write-Host "Deployed functions:" -ForegroundColor Yellow
firebase functions:list

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Green
Write-Host "===========" -ForegroundColor Green
Write-Host ""
Write-Host "1. Add to your admin HTML file:" -ForegroundColor White
Write-Host '   <script src="chat-notification-handler.js"></script>' -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Update Firestore Rules (allow admins to read adminNotifications)" -ForegroundColor White
Write-Host ""
Write-Host "3. Test: Send message from mobile app and check admin dashboard" -ForegroundColor White
Write-Host ""
Write-Host "4. View Cloud Function logs:" -ForegroundColor White
Write-Host "   firebase functions:log --limit 50" -ForegroundColor Cyan
Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Yellow
Write-Host "- docs/CHAT_README.md" -ForegroundColor Gray
Write-Host "- docs/CHAT_SETUP_QUICKSTART.md" -ForegroundColor Gray
Write-Host "- docs/CHAT_MESSAGING_SYSTEM.md" -ForegroundColor Gray
