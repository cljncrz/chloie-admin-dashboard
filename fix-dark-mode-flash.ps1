# PowerShell script to add dark mode prevention script to all HTML files

$themeScript = @'
  
  <!-- Prevent dark mode flash -->
  <script>
    (function() {
      const theme = localStorage.getItem('theme');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark-theme-variables');
        document.body.classList.add('dark-theme-variables');
      }
    })();
  </script>
'@

# Get all HTML files except login.html (since it might have different structure)
$htmlFiles = Get-ChildItem -Path "." -Filter "*.html" | Where-Object { $_.Name -ne "login.html" }

foreach ($file in $htmlFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    
    # Check if the script is already present
    if ($content -notmatch "Prevent dark mode flash") {
        # Insert the script right after the stylesheet link
        $updatedContent = $content -replace '(<link rel="stylesheet" href="style\.css" />)', "`$1$themeScript"
        
        # Write the updated content back to the file
        Set-Content -Path $file.FullName -Value $updatedContent -NoNewline
        
        Write-Host "Updated: $($file.Name)" -ForegroundColor Green
    } else {
        Write-Host "Skipped (already updated): $($file.Name)" -ForegroundColor Yellow
    }
}

Write-Host "`nDone! Updated all HTML files to prevent dark mode flash." -ForegroundColor Cyan
