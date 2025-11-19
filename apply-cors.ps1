# PowerShell script to apply CORS configuration to Firebase Storage
# This fixes the CORS error when uploading images from localhost

Write-Host "Firebase Storage CORS Configuration" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Google Cloud SDK is installed
$gcloudPath = Get-Command gcloud -ErrorAction SilentlyContinue

if (-not $gcloudPath) {
    Write-Host "ERROR: Google Cloud SDK (gcloud) is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install it from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "After installation, run these commands:" -ForegroundColor Yellow
    Write-Host "  1. gcloud auth login" -ForegroundColor Green
    Write-Host "  2. gcloud config set project kingsleycarwashapp" -ForegroundColor Green
    Write-Host "  3. gsutil cors set cors.json gs://kingsleycarwashapp.appspot.com" -ForegroundColor Green
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "Google Cloud SDK found!" -ForegroundColor Green
Write-Host ""

# Check if cors.json exists
if (-not (Test-Path "cors.json")) {
    Write-Host "ERROR: cors.json file not found!" -ForegroundColor Red
    Write-Host "Make sure you're running this script from the project directory." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "Applying CORS configuration to Firebase Storage..." -ForegroundColor Yellow
Write-Host ""

try {
    # Apply CORS configuration
    gsutil cors set cors.json gs://kingsleycarwashapp.appspot.com
    
    Write-Host ""
    Write-Host "SUCCESS! CORS configuration applied." -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now upload images without CORS errors!" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to apply CORS configuration." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Please try running these commands manually:" -ForegroundColor Yellow
    Write-Host "  1. gcloud auth login" -ForegroundColor Green
    Write-Host "  2. gcloud config set project kingsleycarwashapp" -ForegroundColor Green
    Write-Host "  3. gsutil cors set cors.json gs://kingsleycarwashapp.appspot.com" -ForegroundColor Green
}

Write-Host ""
Read-Host "Press Enter to exit"
