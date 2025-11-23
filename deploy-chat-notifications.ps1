# Deploy Chat Notification System (Windows PowerShell)
# Usage: .\deploy-chat-notifications.ps1

param(
    [switch]$SkipChecks = $false
)

Write-Host "🚀 Deploying Chat Notification System" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# Check if Firebase CLI is installed
Write-Host "Checking Firebase CLI installation..." -ForegroundColor Yellow
try {
    firebase --version | Out-Null
    Write-Host "✅ Firebase CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI not found. Install it first:" -ForegroundColor Red
    Write-Host "   npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Check if we're in the right directory
if (!(Test-Path "firebase.json")) {
    Write-Host "❌ firebase.json not found. Run this script from project root." -ForegroundColor Red
    exit 1
}

if (!$SkipChecks) {
    Write-Host ""
    Write-Host "📋 Deployment Checklist:" -ForegroundColor Cyan
    Write-Host "========================" -ForegroundColor Cyan
    Write-Host ""

    # Check 1: Handler script exists
    if (Test-Path "chat-notification-handler.js") {
        Write-Host "✅ chat-notification-handler.js found" -ForegroundColor Green
    } else {
        Write-Host "❌ chat-notification-handler.js NOT found" -ForegroundColor Red
        Write-Host "   Make sure the file exists in project root" -ForegroundColor Yellow
        exit 1
    }

    # Check 2: Functions directory
    if (Test-Path "functions") {
        Write-Host "✅ functions/ directory found" -ForegroundColor Green
    } else {
        Write-Host "❌ functions/ directory NOT found" -ForegroundColor Red
        exit 1
    }

    # Check 3: index.js has onNewChatMessage
    $indexContent = Get-Content "functions\index.js" -Raw
    if ($indexContent -match "onNewChatMessage") {
        Write-Host "✅ onNewChatMessage Cloud Function found in index.js" -ForegroundColor Green
    } else {
        Write-Host "❌ onNewChatMessage NOT found in functions/index.js" -ForegroundColor Red
        Write-Host "   Make sure the function is added to index.js" -ForegroundColor Yellow
        exit 1
    }

    Write-Host ""
    Write-Host "📦 Installation Steps:" -ForegroundColor Cyan
    Write-Host "=====================" -ForegroundColor Cyan
    Write-Host ""

    # Install functions dependencies
    Write-Host "1️⃣  Installing Cloud Functions dependencies..." -ForegroundColor Yellow
    Push-Location functions
    if (!(Test-Path "node_modules")) {
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ npm install failed in functions/" -ForegroundColor Red
            Pop-Location
            exit 1
        }
    } else {
        Write-Host "   Dependencies already installed" -ForegroundColor Gray
    }
    Pop-Location
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔐 Firebase Setup:" -ForegroundColor Cyan
Write-Host "=================" -ForegroundColor Cyan
Write-Host ""

# Check Firebase login
Write-Host "Checking Firebase authentication..." -ForegroundColor Yellow
$firebaseAuth = firebase projects:list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Firebase not authenticated" -ForegroundColor Red
    Write-Host "   Run: firebase login" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Firebase authenticated" -ForegroundColor Green

Write-Host ""
Write-Host "🚀 Deploying Cloud Functions:" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Deploy only the chat message function
firebase deploy --only functions:onNewChatMessage

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cloud Function deployed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✨ Verification:" -ForegroundColor Cyan
Write-Host "===============" -ForegroundColor Cyan
Write-Host ""

# List deployed functions
Write-Host "Deployed functions:" -ForegroundColor Yellow
firebase functions:list

Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Green
Write-Host "==============" -ForegroundColor Green
Write-Host ""
Write-Host "1. Add this to your admin HTML file (e.g., index.html):" -ForegroundColor White
Write-Host "   <script src=`"chat-notification-handler.js`"></script>" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Update Firestore Rules (allow admins to read adminNotifications)" -ForegroundColor White
Write-Host ""
Write-Host "3. Test:" -ForegroundColor White
Write-Host "   - Send message from mobile app" -ForegroundColor Gray
Write-Host "   - Check admin dashboard for notification" -ForegroundColor Gray
Write-Host "   - Check browser console for debug messages" -ForegroundColor Gray
Write-Host ""
Write-Host "4. View Cloud Function logs:" -ForegroundColor White
Write-Host "   firebase functions:log --limit 50" -ForegroundColor Cyan
Write-Host ""
Write-Host "5. View Cloud Function details:" -ForegroundColor White
Write-Host "   firebase functions:describe onNewChatMessage" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Yellow
Write-Host "- CHAT_MESSAGING_SYSTEM.md - Full technical guide" -ForegroundColor Gray
Write-Host "- CHAT_SETUP_QUICKSTART.md - Quick setup guide" -ForegroundColor Gray
Write-Host "- CHAT_CODE_EXAMPLES.md - Code examples" -ForegroundColor Gray
Write-Host "- CHAT_SOLUTION_SUMMARY.md - Solution overview" -ForegroundColor Gray
