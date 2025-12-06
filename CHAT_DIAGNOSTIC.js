/**
 * Chat Diagnostic Script
 * 
 * Run this in browser console while on /chats.html page to diagnose why new chats aren't appearing
 */

async function diagnoseChatIssue() {
  console.log('🔍 Starting chat diagnostic...\n');
  
  // Wait for Firebase to initialize
  if (!window.firebaseInitPromise) {
    console.error('❌ Firebase not initialized');
    return;
  }
  
  await window.firebaseInitPromise;
  
  const db = window.firebase.firestore();
  const auth = window.firebase.auth();
  
  console.log('✅ Firebase initialized');
  console.log(`📧 Current user: ${auth.currentUser?.email || 'Not logged in'}\n`);
  
  // Check 1: Can we read chat_rooms collection?
  console.log('CHECK 1: Reading chat_rooms collection...');
  try {
    const snapshot = await db.collection('chat_rooms').limit(100).get();
    console.log(`✅ Found ${snapshot.size} chat room(s)\n`);
    
    if (snapshot.size === 0) {
      console.warn('⚠️  No chat rooms found. Waiting for mobile app to send first message.');
    } else {
      snapshot.docs.forEach((doc, idx) => {
        const data = doc.data();
        console.log(`\n📍 Chat Room ${idx + 1}: ${doc.id}`);
        console.log(`   User: ${data.userName || data.customerName || 'Unknown'}`);
        console.log(`   Email: ${data.userEmail || 'N/A'}`);
        console.log(`   Last Message: "${(data.lastMessage || 'None').substring(0, 50)}..."`);
        console.log(`   LastMessageTime exists: ${!!data.lastMessageTime}`);
        console.log(`   CreatedAt exists: ${!!data.createdAt}`);
        console.log(`   Unread count: ${data.unreadCount || 0}`);
        
        if (data.lastMessageTime) {
          const date = data.lastMessageTime.toDate?.() || data.lastMessageTime;
          console.log(`   Last updated: ${new Date(date).toLocaleString()}`);
        } else if (data.createdAt) {
          const date = data.createdAt.toDate?.() || data.createdAt;
          console.log(`   Created: ${new Date(date).toLocaleString()}`);
        } else {
          console.warn(`   ⚠️  No timestamp fields found!`);
        }
      });
    }
  } catch (error) {
    console.error('❌ Error reading chat_rooms:', error.message);
    return;
  }
  
  // Check 2: Test sorting by querying without orderBy (like our fix)
  console.log('\n\nCHECK 2: Testing real-time listener (like the dashboard)...');
  try {
    const chats = [];
    const unsubscribe = db.collection('chat_rooms').onSnapshot((snapshot) => {
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        chats.push({
          id: doc.id,
          userName: data.userName || 'Unknown',
          rawLastMessageTime: data.lastMessageTime || data.createdAt,
          timestamp: data.lastMessageTime?.toDate?.() || data.createdAt?.toDate?.() || new Date(0)
        });
      });
      
      // Sort like the new chat-service.js does
      chats.sort((a, b) => {
        const timeA = a.timestamp?.getTime?.() || 0;
        const timeB = b.timestamp?.getTime?.() || 0;
        return timeB - timeA;
      });
      
      console.log(`✅ Real-time listener got ${chats.length} chat(s) (sorted by timestamp)`);
      chats.forEach((chat, idx) => {
        console.log(`   ${idx + 1}. ${chat.userName} - ${chat.timestamp.toLocaleString()}`);
      });
      
      unsubscribe();
    });
  } catch (error) {
    console.error('❌ Error setting up listener:', error.message);
  }
  
  // Check 3: Check messages in the first chat room (if exists)
  console.log('\n\nCHECK 3: Checking messages in first chat room...');
  try {
    const roomsSnapshot = await db.collection('chat_rooms').limit(1).get();
    
    if (roomsSnapshot.empty) {
      console.log('⚠️  No chat rooms to check');
    } else {
      const roomId = roomsSnapshot.docs[0].id;
      const messagesSnapshot = await db.collection('chat_rooms')
        .doc(roomId)
        .collection('messages')
        .limit(5)
        .get();
      
      console.log(`✅ Found ${messagesSnapshot.size} message(s) in room ${roomId}\n`);
      
      messagesSnapshot.docs.forEach((doc, idx) => {
        const msg = doc.data();
        console.log(`Message ${idx + 1}:`);
        console.log(`  From: ${msg.senderName || 'Unknown'} (isAdmin: ${msg.isAdmin})`);
        console.log(`  Text: "${(msg.text || msg.type || 'No text').substring(0, 50)}..."`);
        console.log(`  Time: ${msg.timestamp?.toDate?.() || 'No timestamp'}`);
      });
    }
  } catch (error) {
    console.error('❌ Error reading messages:', error.message);
  }
  
  // Check 4: Admin notifications
  console.log('\n\nCHECK 4: Checking admin notifications...');
  try {
    const notifSnapshot = await db.collection('adminNotifications').limit(5).get();
    console.log(`✅ Found ${notifSnapshot.size} notification(s)\n`);
    
    notifSnapshot.docs.forEach((doc, idx) => {
      const notif = doc.data();
      console.log(`Notification ${idx + 1}:`);
      console.log(`  Type: ${notif.notificationType}`);
      console.log(`  Title: ${notif.title}`);
      console.log(`  Read: ${notif.isRead ? 'Yes' : 'No'}`);
    });
  } catch (error) {
    console.error('❌ Error reading notifications:', error.message);
  }
  
  // Check 5: Security rules test
  console.log('\n\nCHECK 5: Testing write permissions...');
  try {
    const testWrite = await db.collection('chat_rooms').add({
      testMessage: 'This is a test',
      timestamp: db.FieldValue.serverTimestamp()
    });
    console.log(`✅ Write test passed (ID: ${testWrite.id})`);
    
    // Clean up
    await testWrite.delete();
    console.log('   Cleaned up test document');
  } catch (error) {
    console.error('❌ Write test failed:', error.message);
    console.log('   This might be a security rules issue');
  }
  
  console.log('\n\n✅ Diagnostic complete!');
  console.log('\nSummary:');
  console.log('- If no chat rooms appear, the mobile app hasn\'t created one yet');
  console.log('- If chat rooms exist but have no timestamps, they won\'t sort correctly');
  console.log('- The fix applies serverTimestamp() to fix missing timestamps');
}

// Run the diagnostic
diagnoseChatIssue().catch(err => console.error('Diagnostic error:', err));
