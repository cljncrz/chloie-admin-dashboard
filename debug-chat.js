/**
 * Chat Debugging Script
 * Run this in the browser console to diagnose chat issues
 */

async function debugChat() {
  console.log("🔍 Chat System Debug Started...\n");

  try {
    // Check if Firebase is initialized
    if (!window.firebase) {
      console.error("❌ Firebase not initialized");
      return;
    }
    console.log("✅ Firebase initialized");

    // Check if auth is ready
    const auth = window.firebase.auth();
    const currentUser = await new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged(user => {
        unsubscribe();
        resolve(user);
      });
    });

    if (!currentUser) {
      console.error("❌ User not logged in");
      return;
    }
    console.log("✅ User logged in:", currentUser.email);

    // Get Firestore
    const db = window.firebase.firestore();
    console.log("✅ Firestore initialized");

    // Check chat_rooms collection
    console.log("\n📋 Checking chat_rooms collection...");
    const chatRoomsSnapshot = await db.collection('chat_rooms').get();
    console.log(`✅ Found ${chatRoomsSnapshot.size} chat room(s)`);

    if (chatRoomsSnapshot.empty) {
      console.warn("⚠️ No chat rooms found. Waiting for mobile app to send first message.");
      return;
    }

    // List all chat rooms
    chatRoomsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n  Room ${index + 1}: ${doc.id}`);
      console.log(`  - Customer: ${data.customerName || 'Unknown'}`);
      console.log(`  - Last Message: ${data.lastMessage || 'None'}`);
      console.log(`  - Unread: ${data.isUnread || false}`);
      console.log(`  - Timestamp: ${data.timestamp?.toDate?.() || 'None'}`);
    });

    // Check adminNotifications collection
    console.log("\n📬 Checking adminNotifications collection...");
    const notificationsSnapshot = await db.collection('adminNotifications').get();
    console.log(`✅ Found ${notificationsSnapshot.size} notification(s)`);

    notificationsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n  Notification ${index + 1}: ${doc.id}`);
      console.log(`  - Title: ${data.title}`);
      console.log(`  - Read: ${data.isRead}`);
      console.log(`  - Created: ${data.createdAt?.toDate?.() || 'Unknown'}`);
    });

    // Check Chat Notification Handler
    console.log("\n🔔 Checking Chat Notification Handler...");
    if (window.chatNotificationHandler) {
      console.log("✅ ChatNotificationHandler exists");
      console.log(`   Unread count: ${window.chatNotificationHandler.messageCount}`);
    } else {
      console.warn("⚠️ ChatNotificationHandler not initialized");
    }

    // Check Cloud Function logs status
    console.log("\n☁️ Cloud Function Status:");
    console.log("Run in terminal: firebase functions:log --limit 50");
    console.log("This will show you when messages trigger the function.");

    console.log("\n✅ Debug Complete!\n");

  } catch (error) {
    console.error("❌ Error during debug:", error);
  }
}

// Run the debug
debugChat();

// Also create a listener to watch for real-time changes
console.log("\n👂 Setting up real-time listener for chat_rooms...");
const db = window.firebase.firestore();
db.collection('chat_rooms').onSnapshot(
  (snapshot) => {
    console.log(`📊 Chat rooms updated: ${snapshot.size} room(s)`);
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        console.log(`✨ NEW: ${change.doc.id} - ${change.doc.data().customerName}`);
      } else if (change.type === 'modified') {
        console.log(`✏️  UPDATED: ${change.doc.id}`);
      } else if (change.type === 'removed') {
        console.log(`🗑️  DELETED: ${change.doc.id}`);
      }
    });
  },
  (error) => {
    console.error("❌ Listener error:", error);
  }
);
