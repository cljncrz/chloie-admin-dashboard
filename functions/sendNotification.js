/**
 * Firebase Cloud Function to send push notifications to mobile app users
 * Deploy with: firebase deploy --only functions:sendNotification
 *
 * This function sends Firebase Cloud Messaging (FCM) notifications to registered mobile devices
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK (done once per function)
admin.initializeApp();

const db = admin.firestore();

/**
 * HTTP function to send notifications to mobile app users
 * Called by the admin dashboard backend when events occur (new appointment, payment, etc.)
 *
 * POST /sendNotification
 * Body: {
 *   recipientIds: string[], // User IDs to send notification to
 *   title: string,          // Notification title
 *   body: string,           // Notification body/message
 *   type: string,           // 'appointment', 'payment', 'review', 'promotion', etc.
 *   data: object,           // Additional data to include in notification
 *   targetTopic?: string    // (Optional) FCM topic instead of individual users
 * }
 *
 * Returns: {
 *   success: boolean,
 *   message: string,
 *   sentCount: number,      // Number of devices notified
 *   failedCount: number
 * }
 */
exports.sendNotification = functions.https.onRequest(async (req, res) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({error: "Method not allowed. Use POST."});
  }

  try {
    const {recipientIds, targetTopic, title, body, type, data} = req.body;

    // Validate input
    if (!title || !body || !type) {
      return res.status(400).json({
        error: "Missing required fields: title, body, type",
      });
    }

    if (!recipientIds && !targetTopic) {
      return res.status(400).json({
        error: "Either recipientIds array or targetTopic must be provided",
      });
    }

    let sentCount = 0;
    let failedCount = 0;
    const failedUsers = [];

    // --- Send via Topic (if specified) ---
    if (targetTopic) {
      try {
        const message = {
          topic: targetTopic,
          notification: {
            title: title,
            body: body,
          },
          data: data || {},
          android: {
            priority: "high",
            notification: {
              title: title,
              body: body,
              sound: "default",
              click_action: "FLUTTER_NOTIFICATION_CLICK",
            },
          },
          apns: {
            headers: {
              "apns-priority": "10",
            },
            payload: {
              aps: {
                "sound": "default",
                "content-available": 1,
              },
            },
          },
        };

        await admin.messaging().send(message);
        console.log(`✅ Topic notification sent to: ${targetTopic}`);
        return res.status(200).json({
          success: true,
          message: `Notification sent to topic: ${targetTopic}`,
          method: "topic",
        });
      } catch (error) {
        console.error(`❌ Failed to send topic notification:`, error);
        return res.status(500).json({
          success: false,
          error: "Failed to send topic notification",
          details: error.message,
        });
      }
    }

    // --- Send to Individual Users ---
    for (const userId of recipientIds) {
      try {
        // Get user's FCM tokens from Firestore
        const userDoc = await db.collection("users").doc(userId).get();

        if (!userDoc.exists) {
          console.warn(`⚠️ User not found: ${userId}`);
          failedCount++;
          failedUsers.push(userId);
          continue;
        }

        const userData = userDoc.data();
        const fcmTokens = userData.fcmTokens || [];

        if (!fcmTokens || fcmTokens.length === 0) {
          console.warn(`⚠️ No FCM tokens found for user: ${userId}`);
          failedCount++;
          failedUsers.push(userId);
          continue;
        }

        // Send to each device token
        for (const token of fcmTokens) {
          try {
            const message = {
              token: token,
              notification: {
                title: title,
                body: body,
              },
              data: {
                type: type,
                ...data,
              },
              android: {
                priority: "high",
                notification: {
                  title: title,
                  body: body,
                  sound: "default",
                  click_action: "FLUTTER_NOTIFICATION_CLICK",
                },
              },
              apns: {
                headers: {
                  "apns-priority": "10",
                },
                payload: {
                  aps: {
                    "sound": "default",
                    "content-available": 1,
                    "alert": {
                      "title": title,
                      "body": body,
                    },
                  },
                },
              },
            };

            const response = await admin.messaging().send(message);
            console.log(`✅ Notification sent to ${userId}:`, response);
            sentCount++;
          } catch (tokenError) {
            console.error(
                `⚠️ Failed to send to token for user ${userId}:`,
                tokenError.message,
            );
            // If token is invalid, remove it from the user's document
            if (
              tokenError.code === "messaging/invalid-registration-token" ||
              tokenError.code === "messaging/registration-token-not-registered"
            ) {
              await db
                  .collection("users")
                  .doc(userId)
                  .update({
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
                  });
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error processing user ${userId}:`, error);
        failedCount++;
        failedUsers.push(userId);
      }
    }

    // --- Save notification to Firestore for record-keeping ---
    try {
      await db.collection("notifications_sent").add({
        title: title,
        body: body,
        type: type,
        recipientIds: recipientIds || [],
        targetTopic: targetTopic || null,
        data: data || {},
        sentCount: sentCount,
        failedCount: failedCount,
        failedUsers: failedUsers,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        sentAt: new Date().toISOString(),
      });
    } catch (logError) {
      console.error("⚠️ Failed to log notification:", logError);
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: "Notifications processed",
      sentCount: sentCount,
      failedCount: failedCount,
      failedUsers: failedUsers.length > 0 ? failedUsers : undefined,
    });
  } catch (error) {
    console.error("❌ Unexpected error in sendNotification:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send notifications",
      details: error.message,
    });
  }
});

/**
 * Scheduled Cloud Function to clean up invalid FCM tokens
 * Runs daily at 2:00 AM UTC
 *
 * Removes tokens that have been marked as invalid by Firebase
 */
exports.cleanupInvalidTokens = functions.pubsub
    .schedule("0 2 * * *") // Every day at 2 AM UTC
    .timeZone("UTC")
    .onRun(async (context) => {
      try {
        console.log("🧹 Starting FCM token cleanup...");

        const usersSnapshot = await db.collection("users").get();
        const cleanedCount = 0;

        for (const userDoc of usersSnapshot.docs) {
          const userData = userDoc.data();
          const fcmTokens = userData.fcmTokens || [];

          if (fcmTokens.length === 0) continue;

          // Note: We can't directly test tokens without sending messages
          // This function is a placeholder for future token validation logic
          // In production, implement token validation via messaging API

          console.log(
              `✓ Checked user ${userDoc.id} with ${fcmTokens.length} tokens`,
          );
        }

        console.log(`✅ FCM token cleanup completed. Cleaned: ${cleanedCount}`);
        return null;
      } catch (error) {
        console.error("❌ Error during token cleanup:", error);
        return null;
      }
    });

/**
 * HTTP function to register/update FCM token for a user
 * Called by mobile app when it initializes
 *
 * POST /registerFCMToken
 * Body: {
 *   userId: string,    // User ID
 *   token: string,     // FCM token from mobile app
 *   platform: string   // 'ios' or 'android'
 * }
 */
exports.registerFCMToken = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({error: "Method not allowed. Use POST."});
  }

  try {
    const {userId, token, platform} = req.body;

    if (!userId || !token) {
      return res.status(400).json({
        error: "Missing required fields: userId, token",
      });
    }

    // Update or create user document with FCM token
    const userRef = db.collection("users").doc(userId);
    await userRef.set(
        {
          fcmTokens: admin.firestore.FieldValue.arrayUnion(token),
          platform: platform || "unknown",
          lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );

    console.log(`✅ FCM token registered for user ${userId}`);

    res.status(200).json({
      success: true,
      message: "FCM token registered successfully",
      userId: userId,
    });
  } catch (error) {
    console.error("❌ Error registering FCM token:", error);
    res.status(500).json({
      success: false,
      error: "Failed to register FCM token",
      details: error.message,
    });
  }
});

/**
 * HTTP function to unregister FCM token for a user
 * Called by mobile app when user logs out
 *
 * POST /unregisterFCMToken
 * Body: {
 *   userId: string,    // User ID
 *   token: string      // FCM token to remove
 * }
 */
exports.unregisterFCMToken = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({error: "Method not allowed. Use POST."});
  }

  try {
    const {userId, token} = req.body;

    if (!userId || !token) {
      return res.status(400).json({
        error: "Missing required fields: userId, token",
      });
    }

    // Remove FCM token from user document
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
    });

    console.log(`✅ FCM token unregistered for user ${userId}`);

    res.status(200).json({
      success: true,
      message: "FCM token unregistered successfully",
      userId: userId,
    });
  } catch (error) {
    console.error("❌ Error unregistering FCM token:", error);
    res.status(500).json({
      success: false,
      error: "Failed to unregister FCM token",
      details: error.message,
    });
  }
});
