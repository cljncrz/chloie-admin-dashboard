/**
 * Cloud Function: Handle new chat messages from mobile app users
 * 
 * Triggered when a new message is added to chat_rooms/{chatRoomId}/messages
 * Creates an admin notification for incoming messages
 * 
 * Firestore Structure:
 * chat_rooms/
 *   {chatRoomId}/
 *     - customerName
 *     - customerId
 *     - profilePic
 *     - lastMessage
 *     - timestamp
 *     - isUnread: false (initially)
 *     messages/ (subcollection)
 *       {messageId}/
 *         - text
 *         - senderId
 *         - senderName
 *         - type (text, image, video, file)
 *         - timestamp
 *         - isAdmin: false (customer message) or true (admin message)
 *         - mediaUrl (for images, videos, files)
 *         - status (sent, delivered, read)
 */

const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

/**
 * Cloud Function: Trigger when new message is created in chat_rooms/{chatRoomId}/messages
 * Creates admin notification for incoming customer messages
 */
exports.onNewChatMessage = onDocumentWritten(
  "chat_rooms/{chatRoomId}/messages/{messageId}",
  async (event) => {
    try {
      const chatRoomId = event.params.chatRoomId;
      const messageId = event.params.messageId;
      const newData = event.data.after.data();
      const oldData = event.data.before.data();

      // Only process new messages (not updates)
      if (!newData || oldData) {
        return; // Not a new message or message was deleted
      }

      // Only notify for customer messages, not admin messages
      if (newData.isAdmin === true) {
        logger.log(`📨 Admin message detected, skipping notification: ${messageId}`);
        return;
      }

      logger.log(`💬 New customer message detected in chat ${chatRoomId}: ${messageId}`);

      // Get chat room data to get customer info
      const chatRoomDoc = await admin
        .firestore()
        .collection("chat_rooms")
        .doc(chatRoomId)
        .get();

      if (!chatRoomDoc.exists) {
        logger.error(`❌ Chat room not found: ${chatRoomId}`);
        return;
      }

      const chatRoomData = chatRoomDoc.data();
      const customerName = chatRoomData.customerName || "Customer";
      const customerId = chatRoomData.customerId || newData.senderId || chatRoomId;
      const customerProfilePic = chatRoomData.profilePic || "./images/user-avatar.png";

      // Construct message preview
      let messagePreview = "";
      if (newData.type === "text") {
        messagePreview = newData.text || "New message";
      } else if (newData.type === "image") {
        messagePreview = "📷 Sent an image";
      } else if (newData.type === "video") {
        messagePreview = "🎥 Sent a video";
      } else if (newData.type === "file") {
        messagePreview = `📎 Sent: ${newData.fileName || "file"}`;
      } else {
        messagePreview = "New message";
      }

      // Truncate message preview to 100 characters
      if (messagePreview.length > 100) {
        messagePreview = messagePreview.substring(0, 97) + "...";
      }

      const title = `New message from ${customerName}`;
      const message = messagePreview;
      const notificationType = "new_chat_message";
      const relatedPage = "chats.html";

      // Create or update admin notification
      await createOrUpdateAdminNotification(
        notificationType,
        chatRoomId, // Use chatRoomId as the reference ID
        title,
        message,
        relatedPage,
        {
          chatRoomId: chatRoomId,
          customerId: customerId,
          customerName: customerName,
          customerProfilePic: customerProfilePic,
          messageId: messageId,
          messageType: newData.type,
          messageText: newData.type === "text" ? newData.text : null,
          senderName: newData.senderName || customerName,
        }
      );

      // Mark chat room as having unread messages
      await admin
        .firestore()
        .collection("chat_rooms")
        .doc(chatRoomId)
        .update({
          isUnread: true,
          lastMessage: messagePreview,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      logger.log(`✅ Notification created for chat message from ${customerName}`);
    } catch (error) {
      logger.error(`❌ Error in onNewChatMessage: ${error.message}`, error);
    }
  }
);

/**
 * Helper function to create or update admin notification
 * @param {string} notificationType - Type of notification
 * @param {string} referenceId - Reference to the resource (chatRoomId, appointmentId, etc.)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} relatedPage - Page to navigate to when clicked
 * @param {Object} metadata - Additional metadata to store with notification
 */
async function createOrUpdateAdminNotification(
  notificationType,
  referenceId,
  title,
  message,
  relatedPage,
  metadata = {}
) {
  try {
    const db = admin.firestore();
    const notificationId = `${notificationType}_${referenceId}`;

    // Check if notification already exists
    const existingDoc = await db
      .collection("adminNotifications")
      .doc(notificationId)
      .get();

    if (existingDoc.exists && existingDoc.data().isRead === true) {
      // Don't spam already-read notifications, but update the data
      await db
        .collection("adminNotifications")
        .doc(notificationId)
        .update({
          title: title,
          message: message,
          metadata: metadata,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      return;
    }

    // Create or update notification
    await db
      .collection("adminNotifications")
      .doc(notificationId)
      .set(
        {
          notificationType: notificationType,
          referenceId: referenceId,
          title: title,
          message: message,
          relatedPage: relatedPage,
          metadata: metadata,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    logger.log(`✅ Notification saved: ${notificationId}`);
  } catch (error) {
    logger.error(
      `❌ Error creating/updating notification: ${error.message}`,
      error
    );
  }
}

module.exports = { createOrUpdateAdminNotification };
