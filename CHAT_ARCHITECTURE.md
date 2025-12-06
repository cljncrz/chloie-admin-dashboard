# Chat Feature Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD                      │
│                                                         │
│  ┌─────────────┐      ┌──────────────────────────┐     │
│  │   Browser   │      │   Kingsley Carwash App   │     │
│  │  (Chrome)   │◄────►│   (Mobile/Web)           │     │
│  └──────┬──────┘      └──────────────────────────┘     │
│         │                                               │
│         │ HTTP Requests                                │
│         ▼                                               │
│  ┌─────────────────────────────────────────────┐      │
│  │           chats.html                        │      │
│  │  ┌─────────────────────────────────────┐    │      │
│  │  │ Conversation List    │ Message View │    │      │
│  │  │ ┌─────────────────┐  │ ┌──────────┐│    │      │
│  │  │ │ Conversation 1  │  │ │ Header   ││    │      │
│  │  │ │ Conversation 2  │  │ │ Messages ││    │      │
│  │  │ │ Conversation 3  │  │ │ Input    ││    │      │
│  │  │ │ Conversation 4  │  │ │ Form     ││    │      │
│  │  │ └─────────────────┘  │ └──────────┘│    │      │
│  │  └─────────────────────────────────────┘    │      │
│  └─────────────────────────────────────────────┘      │
│         │         │                                    │
│         │         └──────────────────────────┐        │
│         │                                    │        │
└─────────┼────────────────────────────────────┼────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────────────────────────────────────┐
│           JavaScript Layer                         │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  chat.js (287 lines)                         │ │
│  │  - UI Rendering                             │ │
│  │  - Event Handling                           │ │
│  │  - State Management                         │ │
│  │  - User Interactions                        │ │
│  │                                              │ │
│  │  Functions:                                 │ │
│  │  • renderConversationsList()               │ │
│  │  • renderMessages()                        │ │
│  │  • selectConversation()                    │ │
│  │  • handleSendMessage()                     │ │
│  │  • deleteConversation()                    │ │
│  └──────────────────────────────────────────────┘ │
│         │                                          │
│         ▼                                          │
│  ┌──────────────────────────────────────────────┐ │
│  │  chat-service.js (367 lines)                 │ │
│  │  - Business Logic                           │ │
│  │  - Data Layer                               │ │
│  │  - Firestore Operations                     │ │
│  │  - Real-time Listeners                      │ │
│  │                                              │ │
│  │  Methods:                                   │ │
│  │  • initialize()                             │ │
│  │  • listenToConversations()                  │ │
│  │  • listenToMessages()                       │ │
│  │  • sendMessage()                            │ │
│  │  • deleteConversation()                     │ │
│  │  • markAsRead()                             │ │
│  │  • formatTimestamp()                        │ │
│  │  • formatFileSize()                         │ │
│  │  • searchConversations()                    │ │
│  │  • getUnreadCount()                         │ │
│  └──────────────────────────────────────────────┘ │
│         │                                          │
│         ▼                                          │
│    Firestore SDK                                  │
└─────────────────────────────────────────────────────┘
          │
          │ WebSocket (Real-time)
          │
          ▼
┌─────────────────────────────────────────────────────┐
│           Firebase Firestore                       │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  Collection: chat_rooms                      │ │
│  │                                              │ │
│  │  Document: {roomId}                          │ │
│  │  ├─ userName                                 │ │
│  │  ├─ userEmail                                │ │
│  │  ├─ profilePic                               │ │
│  │  ├─ lastMessage                              │ │
│  │  ├─ lastMessageTime                          │ │
│  │  ├─ unreadCount                              │ │
│  │  │                                           │ │
│  │  └─ Subcollection: messages                  │ │
│  │     ├─ Message 1                             │ │
│  │     │  ├─ senderId                           │ │
│  │     │  ├─ text                               │ │
│  │     │  ├─ timestamp                          │ │
│  │     │  └─ isAdmin                            │ │
│  │     ├─ Message 2                             │ │
│  │     └─ Message 3                             │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌─────────────┐
│  Page Load  │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────┐
│  firebase-setup.js                   │
│  (Initialize Firebase SDK)           │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  chat.js addEventListener            │
│  (DOMContentLoaded)                  │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  chatService.initialize()            │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  getCurrentAdmin()                   │
│  Fetch admin data from 'admins' coll │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  listenToConversations()             │
│  Set up real-time listener           │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Firestore returns chat_rooms        │
│  (Real-time updates via WebSocket)   │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  onSnapshot callback fires           │
│  allConversations updated            │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  renderConversationsList()           │
│  DOM updated with conversations      │
└──────┬───────────────────────────────┘
       │
       ├──────────────────────────────────────┐
       │                                      │
       ▼                                      ▼
┌─────────────────────────┐     ┌──────────────────────────┐
│ User clicks             │     │ User types message        │
│ conversation            │     │                           │
└────────┬────────────────┘     └───────┬──────────────────┘
         │                              │
         ▼                              ▼
    selectConversation()         handleSendMessage()
         │                              │
         ▼                              ▼
listenToMessages()          chatService.sendMessage()
         │                              │
         ▼                              ▼
    Firestore listener      Add to messages subcollection
         │                              │
         ▼                              ▼
Firestore returns messages   Update lastMessage in chat_room
         │                              │
         ▼                              ▼
 renderMessages()            listenToMessages() fires
         │                              │
         ▼                              ▼
Messages render in DOM       Messages render updated

         │
         └─────────────────────────────┐
                                       │
                                       ▼
                          Ready for next user action
```

---

## Service Layer Interface

```
┌─────────────────────────────────────────────────────┐
│           ChatService Class                          │
│                                                     │
│  PUBLIC METHODS:                                   │
│  ─────────────────────────────────────────────    │
│                                                     │
│  • initialize(firebase)                            │
│    └─ Returns: Promise<ChatService>                │
│                                                     │
│  • getCurrentAdmin()                               │
│    └─ Returns: Promise<AdminData | null>           │
│                                                     │
│  • listenToConversations(callback)                 │
│    └─ Returns: unsubscribe function                │
│                                                     │
│  • listenToMessages(conversationId, callback)      │
│    └─ Returns: unsubscribe function                │
│                                                     │
│  • sendMessage(conversationId, text, adminData)    │
│    └─ Returns: Promise<MessageData>                │
│                                                     │
│  • createChatRoom(userData)                        │
│    └─ Returns: Promise<string> (room ID)           │
│                                                     │
│  • deleteConversation(conversationId)              │
│    └─ Returns: Promise<void>                       │
│                                                     │
│  • markAsRead(conversationId)                      │
│    └─ Returns: Promise<void>                       │
│                                                     │
│  • getChatRoom(conversationId)                     │
│    └─ Returns: Promise<ChatRoomData | null>        │
│                                                     │
│  • searchConversations(convs, term)                │
│    └─ Returns: Array<ConversationData>             │
│                                                     │
│  • getUnreadCount(conversations)                   │
│    └─ Returns: number                              │
│                                                     │
│  • formatTimestamp(timestamp)                      │
│    └─ Returns: string                              │
│                                                     │
│  • formatFileSize(bytes)                           │
│    └─ Returns: string                              │
│                                                     │
│  • stopAllListeners()                              │
│    └─ Returns: void                                │
│                                                     │
│  PRIVATE STATE:                                    │
│  ────────────────────────────────────────────    │
│                                                     │
│  • db (Firestore instance)                         │
│  • auth (Firebase Auth instance)                   │
│  • unsubscribers (Map of listeners)                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## File Dependency Graph

```
index.html
├─ firebase-setup.js
├─ auth-guard.js
├─ get-admin-name.js
├─ header-profile-picture.js
├─ all-data.js
├─ global-updates.js
├─ script.js
└─ notifications.js

chats.html
├─ firebase-setup.js
├─ auth-guard.js
├─ get-admin-name.js
├─ header-profile-picture.js
├─ style.css
├─ all-data.js
├─ global-updates.js
├─ script.js
├─ notifications.js
├─ chat-service.js ◄─── NEW SERVICE LAYER
│  └─ Depends on: firebase SDK
└─ chat.js ◄─────────── USES CHAT SERVICE
   └─ Depends on: chat-service.js, style.css
```

---

## State Management

```
┌─────────────────────────────────────────────────┐
│          chat.js Global State                   │
│                                                 │
│  allConversations: Array<ConversationData>     │
│  ├─ Updated by: listenToConversations()        │
│  └─ Used by: renderConversationsList()         │
│                                                 │
│  currentConversationId: string | null          │
│  ├─ Set by: selectConversation()               │
│  └─ Used by: handleSendMessage(), header       │
│                                                 │
│  currentAdminData: AdminData | null            │
│  ├─ Set by: getCurrentAdmin()                  │
│  └─ Used by: sendMessage()                     │
│                                                 │
└─────────────────────────────────────────────────┘

                    │
                    │ Flow
                    ▼

┌─────────────────────────────────────────────────┐
│       Message Rendering State                   │
│                                                 │
│  When renderMessages() is called:              │
│  1. Clear messageListEl                         │
│  2. Loop through messages array                 │
│  3. Create message elements                     │
│  4. Append to DOM                               │
│  5. Auto-scroll to bottom                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Event Flow

```
USER ACTION                → EVENT HANDLER              → SERVICE METHOD
──────────────────────────   ─────────────────────────   ─────────────────

Page loads          ──►  DOMContentLoaded        ──►  initialize()
                        init()                        listenToConversations()

Click conversation  ──►  selectConversation()   ──►  listenToMessages()

Search box typing   ──►  search listener        ──►  searchConversations()

Send message        ──►  handleSendMessage()    ──►  sendMessage()

Delete conversation ──►  deleteConversation()   ──►  deleteConversation()
                        (after confirm)               + update UI

Unload page         ──►  beforeunload listener  ──►  stopAllListeners()
```

---

## Security Model

```
┌─────────────────────────────────────────────────────┐
│           SECURITY LAYERS                           │
│                                                     │
│  Layer 1: Authentication                           │
│  ─────────────────────────────                    │
│  • auth-guard.js checks if user is logged in     │
│  • Only logged-in admins can access chats        │
│                                                     │
│  Layer 2: Authorization                           │
│  ─────────────────────────────                    │
│  • Firestore rules check request.auth.uid        │
│  • Only room participants can read messages       │
│  • Only message sender can write messages        │
│                                                     │
│  Layer 3: Input Validation                        │
│  ─────────────────────────────                    │
│  • escapeHtml() prevents XSS attacks             │
│  • Service validates data structure              │
│  • Type checking in JavaScript                   │
│                                                     │
│  Layer 4: Output Encoding                         │
│  ─────────────────────────────                    │
│  • All user text rendered as .textContent        │
│  • Not using .innerHTML for user data            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
┌────────────────────────────────────────────────┐
│          Client Browser (Admin)                │
│                                                │
│  ┌──────────────────────────────────────┐     │
│  │ chats.html                           │     │
│  │ + chat.js (287 lines)                │     │
│  │ + chat-service.js (367 lines)        │     │
│  │ + style.css (chat styles)            │     │
│  │ + Firebase SDK                       │     │
│  └──────────────────────────────────────┘     │
│                                                │
└─────────────────────────┬──────────────────────┘
                          │
                HTTP + WebSocket
                          │
         ┌────────────────┴────────────────┐
         │                                 │
         ▼                                 ▼
┌──────────────────────┐      ┌─────────────────────┐
│ Firebase Console    │      │ Firestore Database  │
│ (Configuration)     │      │                     │
│                     │      │ • chat_rooms        │
└──────────────────────┘      │ • messages          │
                              │ • users             │
                              │ • admins            │
                              └─────────────────────┘
```

---

## Performance Characteristics

```
Operation              │ Time      │ Triggers  │ Notes
───────────────────────┼───────────┼───────────┼─────────────────
Page Load              │ 1-2s      │ 1x        │ Includes Firebase init
Load conversations     │ 500-800ms │ Streaming │ Real-time via WebSocket
Load messages          │ 200-500ms │ Streaming │ Real-time via WebSocket
Send message           │ 100-300ms │ On-demand │ Firestore write
Delete conversation    │ 200-400ms │ On-demand │ Batch delete
Search/Filter          │ <10ms     │ On input  │ Local JS, no API
Update UI rendering    │ 50-150ms  │ Varies    │ DocumentFragment batch
Memory per chat        │ ~2KB      │ Per chat  │ Scales with data
```

---

**Architecture Last Updated:** December 7, 2025
