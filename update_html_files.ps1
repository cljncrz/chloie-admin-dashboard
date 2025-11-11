# Script to update HTML files to use Firebase modular SDK v10
$files = @(
    "create-promotion.html",
    "create-service.html",
    "customer-profile.html",
    "edit-promotion.html",
    "technicians.html",
    "services.html",
    "media-manager.html",
    "promotions.html",
    "reviews.html",
    "sales.html",
    "add-walk-in.html",
    "appointment-details.html",
    "payment-monitoring.html",
    "profile-page.html",
    "promotion-profile.html",
    "review-details.html",
    "service-profile.html",
    "technician-profile.html",
    "todo-lists.html",
    "walk-in-details.html"
)

$oldPattern = @"
  <!-- Firebase SDKs -->
  <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
  <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>
  <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-storage.js"></script>

  <script src="firebase-config.js"></script>
  <!-- Authentication Guard -->
  <script src="auth-guard.js"></script>
"@

$newPattern = @"
  <!-- Firebase SDK (v9 modular) -->
  <!-- Load Firebase initialization first (before any other scripts that depend on it) -->
  <script type="module">
    import { auth, db, storage } from "./firebase-config.js";
    // Make Firebase services globally available for other scripts
    window.firebaseAuth = auth;
    window.firebaseDb = db;
    window.firebaseStorage = storage;
  </script>
  <!-- Authentication Guard -->
  <script type="module" src="auth-guard.js"></script>
"@

foreach ($file in $files) {
    $path = Join-Path $PSScriptRoot $file
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        $newContent = $content -replace [regex]::Escape($oldPattern), $newPattern
        # Also update script tags to be modules
        $newContent = $newContent -replace 'src="all-data\.js"', 'type="module" src="all-data.js"'
        $newContent = $newContent -replace 'src="global-updates\.js"', 'type="module" src="global-updates.js"'
        $newContent = $newContent -replace 'src="script\.js"', 'type="module" src="script.js"'
        $newContent = $newContent -replace 'src="notifications\.js"', 'type="module" src="notifications.js"'
        # Fix specific script tags based on the file
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file)
        if ($baseName -ne "") {
            $newContent = $newContent -replace "src=""$baseName\.js""", "type=""module"" src=""$baseName.js"""
        }
        
        Set-Content $path $newContent
        Write-Host "Updated: $file"
    }
}

Write-Host "All files updated successfully!"
