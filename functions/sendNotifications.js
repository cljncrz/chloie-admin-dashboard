/**
 * Firebase Cloud Functions for sending push notifications to mobile app users
 * Deploy with: firebase deploy --only functions
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {onDocumentUpdated, onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onRequest} = require("firebase-functions/v2/https");

// Initialize Firebase Admin SDK (automatically done by Firebase Functions)
admin.initializeApp();

const db = admin.firestore();

/**
 * Send notification to a specific user
 * Called via: POST /api/send-notification
 * Body: { userId, title, body, data, imageUrl }
 */
exports.sendNotificationToUser = onRequest(async (req, res) => {
  // Enable CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({error: "Method not allowed"});
  }

  try {
    const {userId, title, body, data = {}, imageUrl} = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({
        error: "Missing required fields: userId, title, body",
      });
    }

    // Get user's FCM tokens from Firestore
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({error: "User not found"});
    }

    const userData = userDoc.data();
    const fcmTokens = userData.fcmTokens || [];

    if (fcmTokens.length === 0) {
      return res.status(200).json({
        message: "User has no FCM tokens registered",
        notificationsSent: 0,
      });
    }

    // Build notification payload
    const message = {
      notification: {
        title,
        body,
      },
      webpush: {
        data,
        fcmOptions: {
          link: "/", // Link to open when notification is clicked
        },
      },
      apns: {
        payload: {
          aps: {
            "mutable-content": true,
            "sound": "default",
            "badge": 1,
          },
        },
        fcmOptions: {
          image: imageUrl,
        },
      },
      android: {
        priority: "high",
        notification: {
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
          sound: "default",
          channelId: "default",
        },
      },
    };

    // If imageUrl provided, add to notification
    if (imageUrl) {
      message.notification.imageUrl = imageUrl;
      message.webpush.data.image = imageUrl;
    }

    // Send to all user's devices
    const results = await Promise.allSettled(
        fcmTokens.map((token) => admin.messaging().send({
          ...message,
          token,
        })),
    );

    // Count successful sends
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failureCount = results.filter((r) => r.status === "rejected").length;

    // Remove invalid tokens
    const invalidTokens = [];
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const error = result.reason;
        if (error.code === "messaging/invalid-registration-token" ||
            error.code === "messaging/registration-token-not-registered") {
          invalidTokens.push(fcmTokens[index]);
        }
      }
    });

    // Update user document to remove invalid tokens
    if (invalidTokens.length > 0) {
      await db.collection("users").doc(userId).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
      });
    }

    // Store notification in Firestore under user's notifications collection
    const notificationRef = await db
        .collection("users")
        .doc(userId)
        .collection("notifications")
        .add({
          userId,
          title,
          body,
          type: data.notificationType || "general",
          data,
          imageUrl: imageUrl || null,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          isRead: false,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });

    res.status(200).json({
      success: true,
      message: "Notifications sent successfully",
      notificationsSent: successCount,
      failedSends: failureCount,
      invalidTokensRemoved: invalidTokens.length,
      notificationDocId: notificationRef.id,
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({
      error: "Failed to send notification",
      details: error.message,
    });
  }
});

/**
 * Send bulk notification to multiple users
 * Called via: POST /api/send-bulk-notification
 * Body: { userIds, title, body, data, imageUrl }
 */
exports.sendBulkNotification = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({error: "Method not allowed"});
  }

  try {
    const {userIds = [], title, body, data = {}, imageUrl} = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0 || !title || !body) {
      return res.status(400).json({
        error: "Missing required fields: userIds (array), title, body",
      });
    }

    let totalSent = 0;
    let totalFailed = 0;

    // Send to each user
    for (const userId of userIds) {
      try {
        const userDoc = await db.collection("users").doc(userId).get();

        if (!userDoc.exists) continue;

        const userData = userDoc.data();
        const fcmTokens = userData.fcmTokens || [];

        if (fcmTokens.length === 0) continue;

        // Build message
        const message = {
          notification: {
            title,
            body,
          },
          webpush: {
            data,
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
            },
          },
        };

        if (imageUrl) {
          message.notification.imageUrl = imageUrl;
        }

        // Send to all tokens
        const results = await Promise.allSettled(
            fcmTokens.map((token) => admin.messaging().send({
              ...message,
              token,
            })),
        );

        totalSent += results.filter((r) => r.status === "fulfilled").length;
        totalFailed += results.filter((r) => r.status === "rejected").length;
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        totalFailed++;
      }
    }

    res.status(200).json({
      success: true,
      message: "Bulk notifications completed",
      totalSent,
      totalFailed,
    });
  } catch (error) {
    console.error("Error in bulk notification:", error);
    res.status(500).json({
      error: "Failed to send bulk notifications",
      details: error.message,
    });
  }
});

/**
 * Listen to appointment changes and auto-send notifications
 * Triggered when appointment document is updated
 */
exports.onAppointmentUpdated = onDocumentUpdated("appointments/{appointmentId}", async (event) => {
  const change = event.data;
  const context = event.params;
      const before = change.before.data();
      const after = change.after.data();

      // Check if status changed
      if (before.status === after.status) {
        return null; // No status change
      }

      try {
        const customerId = after.customerId;
        const serviceName = after.service || "Your Service";
        const customerName = after.customerName || "Valued Customer";

        let title = "";
        let body = "";
        let notificationType = "";

        // Determine notification based on status change
        if (after.status === "Approved") {
          title = "Appointment Confirmed";
          body = `Your ${serviceName} appointment has been confirmed!`;
          notificationType = "appointment_confirmed";
        } else if (after.status === "Completed") {
          title = "Service Completed";
          body = `Your ${serviceName} service is now complete. Thank you for choosing us!`;
          notificationType = "service_completed";
        } else if (after.status === "Cancelled") {
          title = "Appointment Cancelled";
          body = `Your ${serviceName} appointment has been cancelled.`;
          notificationType = "appointment_cancelled";
        } else if (after.status === "In Progress") {
          title = "Service In Progress";
          body = `Your ${serviceName} service has started.`;
          notificationType = "service_started";
        }

        if (title && customerId) {
        // Send notification
          await admin.messaging().send({
            notification: {
              title,
              body,
            },
            data: {
              notificationType,
              appointmentId: context.params.appointmentId,
              status: after.status,
              customerName,
            },
            android: {
              priority: "high",
              notification: {
                sound: "default",
                channelId: "appointments",
              },
            },
          }).catch((error) => {
          // Log but don't fail - token might be invalid
            console.warn(`Could not send notification to customer: ${error.message}`);
          });
        }

        // Log notification in Firestore
        await db.collection("notifications").add({
          type: "appointment_status",
          userId: customerId,
          appointmentId: context.params.appointmentId,
          title,
          body,
          data: {
            status: after.status,
            serviceName,
          },
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
        });
      } catch (error) {
        console.error("Error in onAppointmentUpdated:", error);
      }

      return null;
    });

/**
 * Listen to new payments and auto-send notifications
 * Triggered when payment document is created
 */
exports.onPaymentReceived = onDocumentCreated("payments/{paymentId}", async (event) => {
  const snap = event.data;
  const context = event.params;
      const payment = snap.data();

      try {
        const customerId = payment.customerId;
        const amount = payment.amount || 0;
        const serviceName = payment.service || "Service";

        if (customerId) {
        // Send notification
          await admin.messaging().send({
            notification: {
              title: "Payment Received",
              body: `Payment of $${amount.toFixed(2)} for ${serviceName} has been received. Thank you!`,
            },
            data: {
              notificationType: "payment_received",
              paymentId: context.params.paymentId,
              amount: amount.toString(),
              status: payment.status || "completed",
            },
            android: {
              priority: "high",
              notification: {
                sound: "default",
                channelId: "payments",
              },
            },
          }).catch((error) => {
            console.warn(`Could not send payment notification: ${error.message}`);
          });
        }

        // Log notification
        await db.collection("notifications").add({
          type: "payment_received",
          userId: customerId,
          paymentId: context.params.paymentId,
          title: "Payment Received",
          body: `Payment of $${amount.toFixed(2)} received for ${serviceName}`,
          data: {
            amount,
            status: payment.status,
          },
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
        });
      } catch (error) {
        console.error("Error in onPaymentReceived:", error);
      }

      return null;
    });

/**
 * Listen to new reviews and notify admin
 * Triggered when review document is created
 */
exports.onNewReview = onDocumentCreated("reviews/{reviewId}", async (event) => {
  const snap = event.data;
  const context = event.params;
      const review = snap.data();

      try {
      // Send to admin (you can store admin user IDs)
        const adminId = process.env.ADMIN_USER_ID || "admin"; // Set in Firebase config

        await admin.messaging().send({
          notification: {
            title: "New Review Received",
            body: `${review.customerName} left a ${review.rating}-star review`,
          },
          data: {
            notificationType: "new_review",
            reviewId: context.params.reviewId,
            rating: review.rating.toString(),
            customerName: review.customerName,
          },
          android: {
            priority: "high",
          },
        }).catch((error) => {
          console.warn(`Could not send review notification: ${error.message}`);
        });
      } catch (error) {
        console.error("Error in onNewReview:", error);
      }

      return null;
    });
