# Chat Feature - Quick Reference Guide

## What Changed?

The chat feature has been completely rewritten with a cleaner, more maintainable architecture.

| Item | Before | After |
|------|--------|-------|
| chat.js size | 981 lines | 280 lines |
| Architecture | Monolithic | Service + UI |
| Testability | Poor | Excellent |
| Code duplication | High | None |

---

## Files Overview

### 1. `chat-service.js` (NEW)
**Purpose:** Handles all Firestore operations

**When to modify:**
- When you need to change how data is fetched from Firestore
- When adding new database operations
- When changing message format/structure

**Key methods:**
```javascript
chatService.listenToConversations(callback)
chatService.listenToMessages(convId, callback)
chatService.sendMessage(convId, text, adminData)
chatService.deleteConversation(convId)
```

### 2. `chat.js` (REVISED)
**Purpose:** Handles UI and user interactions

**When to modify:**
- When changing how UI looks or behaves
- When adding new buttons/interactions
- When modifying event handlers
- When adding new UI features

**Key functions:**
```javascript
renderConversationsList(filter)      // Draw conversation list
renderMessages(messages)             // Draw message thread
selectConversation(convId)          // Handle conversation selection
handleSendMessage(e)                // Handle sending messages
```

### 3. `chats.html` (UPDATED)
**Purpose:** Page structure

**What changed:**
- Added `<script src="chat-service.js" defer></script>`
- This must load BEFORE `chat.js`

---

## Adding New Features

### Feature: Add button to mute notifications
1. Open `chats.html` - add button to `#chat-message-header`
2. Open `chat.js` - add click handler
3. Add business logic if needed

**Example:**
```javascript
// In chat.js
const muteBtn = document.getElementById('mute-notifications-btn');
muteBtn?.addEventListener('click', async () => {
  // Handle mute
});
```

### Feature: Show typing indicator
1. Open `chat-service.js` - add method to handle typing status
2. Open `chat.js` - call service method and update UI

**Example:**
```javascript
// In chat-service.js
async setTypingStatus(conversationId, isTyping) {
  // Update firestore
}

// In chat.js
messageInput.addEventListener('input', () => {
  chatService.setTypingStatus(currentConversationId, true);
});
```

### Feature: Add message reactions
1. Open `chat-service.js` - add `addReaction()` and `removeReaction()` methods
2. Open `chat.js` - add UI for reaction buttons
3. Add CSS styling for reactions

---

## Common Tasks

### Task: Check why conversations aren't showing

**Debugging steps:**
1. Open browser DevTools → Console
2. Check for errors
3. Add this to chat.js after initialization:
   ```javascript
   chatService.listenToConversations((convs) => {
     console.log('Conversations:', convs);
   });
   ```
4. Verify `chat_rooms` collection has data in Firebase Console

### Task: Add custom time format

**Location:** `chat-service.js` - `formatTimestamp()` method

**Current format:** "just now", "5m ago", "2h ago", "3d ago", "Dec 7"

**To change:**
```javascript
formatTimestamp(timestamp) {
  // Modify this method
}
```

### Task: Hide unread badge

**Location:** `chat.js` - `renderConversationsList()` function

**Find this line:**
```javascript
const unreadBadge = conv.unreadCount > 0 ? `<span class="unread-badge">${conv.unreadCount}</span>` : '';
```

**Change to:**
```javascript
const unreadBadge = ''; // Hide badges
```

### Task: Change conversation item height

**Location:** `style.css`

**Find:**
```css
.chat-conversation-item {
    padding: 1rem 1.2rem;
    ...
}
```

**Modify padding value**

---

## State Management

### Global State (in chat.js)
```javascript
let allConversations = [];        // All conversations
let currentConversationId = null; // Selected conversation
let currentAdminData = null;      // Logged-in admin
```

**Flow:**
1. Admin loads page
2. `init()` fetches `currentAdminData`
3. `listenToConversations()` populates `allConversations`
4. User clicks conversation → `selectConversation()` sets `currentConversationId`
5. `listenToMessages()` loads messages for that conversation

---

## Error Handling

All async operations in `chat-service.js` include try-catch blocks.

**In chat.js:**
```javascript
try {
  await chatService.sendMessage(convId, text, adminData);
} catch (error) {
  alert('Failed to send message');
  console.error(error);
}
```

**To debug:**
- Open browser console
- Look for error messages
- Check network requests in DevTools
- Verify Firebase credentials

---

## Performance Tips

1. **Search is fast** - done in JavaScript, not Firestore
2. **Listeners are minimal** - one per open conversation
3. **No memory leaks** - listeners cleaned up on unload
4. **Batch updates** - uses DocumentFragment for DOM updates

**Monitor performance:**
```javascript
// Add to chat.js
console.time('renderConversations');
renderConversationsList();
console.timeEnd('renderConversations');
```

---

## Testing Manually

### Test 1: Real-time sync
1. Open chat in 2 browser tabs
2. Send message from one tab
3. Verify it appears in other tab within 1 second

### Test 2: Search
1. Open chats page
2. Type customer name in search
3. Verify list filters correctly

### Test 3: Delete
1. Right-click conversation (or hover menu)
2. Click delete
3. Confirm deletion works

### Test 4: Performance
1. Open DevTools → Performance
2. Record while loading chats
3. Check that it completes in <2 seconds

---

## Firestore Rules (Relevant)

```javascript
match /chat_rooms/{document=**} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == request.resource.data.lastMessageSenderId;
}
```

Means:
- Only authenticated users can read chats
- Only the sender can write messages

---

## Related Files

- `auth-guard.js` - Verifies user is logged in before page loads
- `get-admin-name.js` - Gets admin profile name
- `global-updates.js` - Updates chat badge in navbar
- `style.css` - All chat styling
- `chats.html` - HTML structure

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | ? | Original implementation (981 lines) |
| 2.0 | Dec 7, 2025 | Complete revision (280 lines, new service layer) |

---

## Need Help?

1. **Code won't run?** Check console errors and Firestore permissions
2. **Conversations missing?** Verify `chat_rooms` collection in Firebase
3. **Real-time updates slow?** Check internet connection and Firestore quota
4. **UI looks wrong?** Clear cache and reload, check browser zoom level
5. **Something else?** Add `console.log()` statements to trace execution

---

**Last Updated:** December 7, 2025
