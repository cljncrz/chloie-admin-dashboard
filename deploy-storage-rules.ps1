# Deploy Firebase Storage Rules
Write-Host "Deploying Firebase Storage Rules..." -ForegroundColor Cyan

try {
    # Check if Firebase CLI is installed
    $firebaseVersion = firebase --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Firebase CLI is not installed. Installing now..." -ForegroundColor Yellow
        npm install -g firebase-tools
    } else {
        Write-Host "Firebase CLI version: $firebaseVersion" -ForegroundColor Green
    }
    
    # Deploy storage rules
    Write-Host "`nDeploying storage rules..." -ForegroundColor Cyan
    firebase deploy --only storage
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nStorage rules deployed successfully!" -ForegroundColor Green
    } else {
        Write-Host "`nFailed to deploy storage rules. Please check your Firebase configuration." -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
