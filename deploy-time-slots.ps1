# Deploy Firestore Rules and Initialize Time Slots
# Run this script to deploy the updated Firestore rules and initialize time slots configuration

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploying Firestore Rules" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Deploy Firestore rules
Write-Host "📤 Deploying Firestore rules..." -ForegroundColor Yellow
firebase deploy --only firestore:rules

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Firestore rules deployed successfully!" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Initializing Time Slots" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Ask if user wants to initialize time slots
    $response = Read-Host "Do you want to initialize default time slots? (y/n)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "🚀 Initializing time slots..." -ForegroundColor Yellow
        node initialize-time-slots.js
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ All done!" -ForegroundColor Green
            Write-Host ""
            Write-Host "📋 Next steps:" -ForegroundColor Cyan
            Write-Host "1. Open the admin dashboard" -ForegroundColor White
            Write-Host "2. Navigate to Time Slots Settings page" -ForegroundColor White
            Write-Host "3. Manage your time slots as needed" -ForegroundColor White
        } else {
            Write-Host "❌ Failed to initialize time slots" -ForegroundColor Red
            Write-Host "You can manually initialize them using the Time Slots Settings page in the admin dashboard" -ForegroundColor Yellow
        }
    } else {
        Write-Host ""
        Write-Host "⏭️ Skipping time slots initialization" -ForegroundColor Yellow
        Write-Host "You can initialize them later using the Time Slots Settings page" -ForegroundColor White
    }
} else {
    Write-Host "❌ Failed to deploy Firestore rules" -ForegroundColor Red
    Write-Host "Please check the error messages above" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
