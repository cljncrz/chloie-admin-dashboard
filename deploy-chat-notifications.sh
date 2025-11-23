#!/usr/bin/env bash
# Deploy Chat Notification System
# Usage: ./deploy-chat-notifications.sh

set -e

echo "🚀 Deploying Chat Notification System"
echo "======================================"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install it first:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    echo "❌ firebase.json not found. Run this script from project root."
    exit 1
fi

echo ""
echo "📋 Deployment Checklist:"
echo "========================"

# Check 1: Handler script exists
if [ -f "chat-notification-handler.js" ]; then
    echo "✅ chat-notification-handler.js found"
else
    echo "❌ chat-notification-handler.js NOT found"
    echo "   Make sure the file exists in project root"
    exit 1
fi

# Check 2: Functions directory
if [ -d "functions" ]; then
    echo "✅ functions/ directory found"
else
    echo "❌ functions/ directory NOT found"
    exit 1
fi

# Check 3: index.js has onNewChatMessage
if grep -q "onNewChatMessage" "functions/index.js"; then
    echo "✅ onNewChatMessage Cloud Function found in index.js"
else
    echo "❌ onNewChatMessage NOT found in functions/index.js"
    echo "   Make sure the function is added to index.js"
    exit 1
fi

echo ""
echo "📦 Installation Steps:"
echo "====================="

# Install functions dependencies
echo "1️⃣  Installing Cloud Functions dependencies..."
cd functions
if ! npm install; then
    echo "❌ npm install failed in functions/"
    exit 1
fi
cd ..
echo "✅ Dependencies installed"

echo ""
echo "🔐 Firebase Setup:"
echo "=================="

# Check Firebase login
echo "Checking Firebase authentication..."
if firebase projects:list > /dev/null 2>&1; then
    echo "✅ Firebase authenticated"
else
    echo "❌ Firebase not authenticated"
    echo "   Run: firebase login"
    exit 1
fi

echo ""
echo "🚀 Deploying Cloud Functions:"
echo "============================="

# Deploy only the chat message function
firebase deploy --only functions:onNewChatMessage

if [ $? -eq 0 ]; then
    echo "✅ Cloud Function deployed successfully"
else
    echo "❌ Deployment failed"
    exit 1
fi

echo ""
echo "✨ Verification:"
echo "==============="

# List deployed functions
echo "Deployed functions:"
firebase functions:list

echo ""
echo "📝 Next Steps:"
echo "=============="
echo ""
echo "1. Add this to your admin HTML file (e.g., index.html):"
echo "   <script src=\"chat-notification-handler.js\"></script>"
echo ""
echo "2. Update Firestore Rules (allow admins to read adminNotifications)"
echo ""
echo "3. Test:"
echo "   - Send message from mobile app"
echo "   - Check admin dashboard for notification"
echo "   - Check browser console for debug messages"
echo ""
echo "4. View Cloud Function logs:"
echo "   firebase functions:log --limit 50"
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📚 Documentation:"
echo "- CHAT_MESSAGING_SYSTEM.md - Full technical guide"
echo "- CHAT_SETUP_QUICKSTART.md - Quick setup guide"
echo "- CHAT_CODE_EXAMPLES.md - Code examples"
