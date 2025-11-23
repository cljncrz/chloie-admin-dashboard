#!/usr/bin/env pwsh
# Quick diagnostics script to check Firestore data

Write-Host "🔍 Checking Firestore Chat Rooms and Notifications..." -ForegroundColor Cyan
Write-Host ""

# Check if firebase CLI is available
$firebaseCmd = Get-Command firebase -ErrorAction SilentlyContinue

if ($null -eq $firebaseCmd) {
    Write-Host "❌ Firebase CLI not found in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Firebase CLI found: $($firebaseCmd.Path)" -ForegroundColor Green

# Use Firebase CLI to check the data (requires valid credentials)
# Note: These commands are for informational purposes only

Write-Host "`n📋 Firebase Project Info:" -ForegroundColor Cyan
firebase projects:list

Write-Host "`n☁️  Cloud Functions Status:" -ForegroundColor Cyan
firebase functions:list

Write-Host "`n💡 To view Firestore data, use:" -ForegroundColor Yellow
Write-Host "   1. Open Firebase Console: https://console.firebase.google.com" -ForegroundColor Gray
Write-Host "   2. Select kingsleycarwashapp project" -ForegroundColor Gray
Write-Host "   3. Go to Firestore Database" -ForegroundColor Gray
Write-Host "   4. Check 'chat_rooms' collection" -ForegroundColor Gray
Write-Host "   5. Check 'adminNotifications' collection" -ForegroundColor Gray

Write-Host "`n💡 To view Cloud Function logs:" -ForegroundColor Yellow
Write-Host "   firebase functions:log --limit 50" -ForegroundColor Gray

Write-Host "`n💡 To test the notification system manually:" -ForegroundColor Yellow
Write-Host "   Create a test message in Firestore Console:" -ForegroundColor Gray
Write-Host "   1. Go to chat_rooms collection" -ForegroundColor Gray
Write-Host "   2. Select a room (or create test data)" -ForegroundColor Gray
Write-Host "   3. Go to messages subcollection" -ForegroundColor Gray
Write-Host "   4. Add a new document with:" -ForegroundColor Gray
Write-Host "      - text: 'Test message from mobile'" -ForegroundColor Gray
Write-Host "      - timestamp: now" -ForegroundColor Gray
Write-Host "      - senderId: 'customer-xyz'" -ForegroundColor Gray
Write-Host "      - senderName: 'Test Customer'" -ForegroundColor Gray
Write-Host "      - isAdmin: false" -ForegroundColor Gray
Write-Host "   5. Check if notification appears in admin dashboard" -ForegroundColor Gray

Write-Host "`n💡 For debugging in browser console:" -ForegroundColor Yellow
Write-Host "   1. Refresh the admin dashboard page (F5)" -ForegroundColor Gray
Write-Host "   2. Open browser DevTools (F12)" -ForegroundColor Gray
Write-Host "   3. Go to Console tab" -ForegroundColor Gray
Write-Host "   4. Paste and run the debug-chat.js script contents" -ForegroundColor Gray

Write-Host ""
