# PowerShell script to add 'defer' attribute to all auth-guard.js script tags

$htmlFiles = Get-ChildItem -Path . -Filter *.html -Recurse | Where-Object { $_.DirectoryName -eq $PWD.Path }

foreach ($file in $htmlFiles) {
    Write-Host "Processing: $($file.Name)"
    
    $content = Get-Content $file.FullName -Raw
    
    # Replace <script src="auth-guard.js"></script> with <script src="auth-guard.js" defer></script>
    $newContent = $content -replace '<script src="auth-guard\.js"></script>', '<script src="auth-guard.js" defer></script>'
    
    # Only write if changes were made
    if ($content -ne $newContent) {
        Set-Content -Path $file.FullName -Value $newContent -NoNewline
        Write-Host "  Updated: $($file.Name)" -ForegroundColor Green
    } else {
        Write-Host "  No changes needed: $($file.Name)" -ForegroundColor Yellow
    }
}

Write-Host "`nAll HTML files processed!" -ForegroundColor Cyan
