# Quick CORS Fix Script
# Run this AFTER Google Cloud SDK is installed

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "  Firebase Storage CORS Quick Fix" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if gcloud is available
$gcloud = Get-Command gcloud -ErrorAction SilentlyContinue

if (-not $gcloud) {
    Write-Host "❌ Google Cloud SDK not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please:" -ForegroundColor Yellow
    Write-Host "1. Complete the Google Cloud SDK installation" -ForegroundColor White
    Write-Host "2. Close and reopen PowerShell" -ForegroundColor White
    Write-Host "3. Run this script again" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✓ Google Cloud SDK found!" -ForegroundColor Green
Write-Host ""

# Check if user is authenticated
Write-Host "Checking authentication..." -ForegroundColor Yellow
$authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($authCheck)) {
    Write-Host "❌ Not authenticated with Google Cloud" -ForegroundColor Red
    Write-Host ""
    Write-Host "Running authentication..." -ForegroundColor Yellow
    gcloud auth login
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Authentication failed!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "✓ Authenticated as: $authCheck" -ForegroundColor Green
Write-Host ""

# Set project
Write-Host "Setting project to kingsleycarwashapp..." -ForegroundColor Yellow
gcloud config set project kingsleycarwashapp

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set project!" -ForegroundColor Red
    Write-Host "Make sure you have access to the kingsleycarwashapp project." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✓ Project set successfully!" -ForegroundColor Green
Write-Host ""

# Check if cors.json exists
if (-not (Test-Path "cors.json")) {
    Write-Host "❌ cors.json not found!" -ForegroundColor Red
    Write-Host "Make sure you're in the project directory." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Apply CORS
Write-Host "Applying CORS configuration..." -ForegroundColor Yellow
Write-Host "Bucket: gs://kingsleycarwashapp.appspot.com" -ForegroundColor Cyan
Write-Host ""

gsutil cors set cors.json gs://kingsleycarwashapp.appspot.com

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Failed to apply CORS!" -ForegroundColor Red
    Write-Host "You may need additional permissions. Contact the project owner." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "✓ CORS configuration applied successfully!" -ForegroundColor Green
Write-Host ""

# Verify CORS
Write-Host "Verifying CORS configuration..." -ForegroundColor Yellow
Write-Host ""
gsutil cors get gs://kingsleycarwashapp.appspot.com

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  SUCCESS! CORS is now configured! 🎉" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Refresh your browser (Ctrl + Shift + R)" -ForegroundColor White
Write-Host "2. Try uploading an image again" -ForegroundColor White
Write-Host "3. It should work without CORS errors!" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter to exit"
