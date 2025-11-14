/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if geofencing is enabled and location is within operating hours
 * @param {object} settings - Geofencing settings from Firestore
 * @returns {boolean} True if geofencing is active and currently open
 */
function isGeofencingActive(settings) {
  if (!settings || !settings.isEnabled) return false;
  
  const now = new Date();
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const dayHours = settings.operatingHours?.[dayOfWeek];
  if (!dayHours || !dayHours.isOpen) return false;
  
  return currentTime >= dayHours.start && currentTime <= dayHours.end;
}

/**
 * Check if enough time has passed since last notification for this location
 * @param {object} userDoc - User document from Firestore
 * @param {string} locationId - ID of the geofencing location
 * @returns {boolean} True if we should send notification
 */
function shouldSendNotification(userDoc, locationId) {
  const userData = userDoc.data();
  if (!userData) return true;
  
  const lastNotifications = userData.lastGeofenceNotifications || {};
  const lastNotifyTime = lastNotifications[locationId];
  
  if (!lastNotifyTime) return true;
  
  const lastNotifyDate = new Date(lastNotifyTime);
  const now = new Date();
  const hoursDiff = (now - lastNotifyDate) / (1000 * 60 * 60);
  
  // Send notification only once per hour per location
  return hoursDiff >= 1;
}

// ============================================================
// CLOUD FUNCTION: GEOFENCE CHECK
// ============================================================

/**
 * Cloud Function: checkGeofence
 * Triggers when a customer's location is updated
 * Checks if they're within any geofencing radius and sends notification
 */
exports.checkGeofence = onDocumentWritten(
  "user_locations/{userId}",
  async (event) => {
    try {
      const userId = event.params.userId;
      const newLocationData = event.data.after.data();
      
      if (!newLocationData) {
        logger.log(`❌ No location data for user ${userId}`);
        return;
      }

      const { latitude, longitude } = newLocationData;
      
      if (latitude === undefined || longitude === undefined) {
        logger.log(`❌ Invalid location data for user ${userId}`);
        return;
      }

      logger.log(`📍 Checking geofence for user ${userId} at ${latitude}, ${longitude}`);

      // Get geofencing settings
      const settingsDoc = await admin.firestore()
        .collection('admin_settings')
        .doc('geofencing')
        .get();

      if (!isGeofencingActive(settingsDoc.data())) {
        logger.log(`⏰ Geofencing is disabled or outside operating hours`);
        return;
      }

      // Get all geofencing locations
      const locationsSnapshot = await admin.firestore()
        .collection('geofencing_locations')
        .get();

      if (locationsSnapshot.empty) {
        logger.log(`⚠️ No geofencing locations configured`);
        return;
      }

      // Get user document to check notification history
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(userId)
        .get();

      const settings = settingsDoc.data();
      let notificationsToSend = [];

      // Check distance to each location
      for (const locationDoc of locationsSnapshot.docs) {
        const location = locationDoc.data();
        const distance = calculateDistance(
          latitude,
          longitude,
          location.latitude,
          location.longitude
        );

        logger.log(
          `📏 User ${userId} is ${distance.toFixed(0)}m from ${location.name} (radius: ${location.radius}m)`
        );

        // If within geofence and enough time has passed since last notification
        if (distance < location.radius && shouldSendNotification(userDoc, locationDoc.id)) {
          notificationsToSend.push({
            locationId: locationDoc.id,
            locationName: location.name,
            message: settings.notificationMessage || 'Kingsley Carwash is nearby!'
          });
        }
      }

      // Send notifications
      if (notificationsToSend.length > 0) {
        await sendNotifications(userId, notificationsToSend);
      } else {
        logger.log(`ℹ️ No notifications to send for user ${userId}`);
      }

    } catch (error) {
      logger.error(`❌ Error in checkGeofence: ${error.message}`, error);
    }
  }
);

/**
 * Send notifications to user via FCM
 */
async function sendNotifications(userId, notifications) {
  try {
    // Get user's FCM tokens
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();

    const userData = userDoc.data();
    const fcmTokens = userData?.fcmTokens || [];

    if (fcmTokens.length === 0) {
      logger.log(`⚠️ No FCM tokens for user ${userId}`);
      return;
    }

    // Send notification to each FCM token
    for (const notification of notifications) {
      const message = {
        notification: {
          title: `🚗 Kingsley Carwash Nearby!`,
          body: notification.message
        },
        webpush: {
          fcmOptions: {
            link: '/customer-dashboard.html'
          },
          notification: {
            icon: '/images/minimalkingsley.png',
            badge: '/images/minimalkingsley.png',
            tag: `geofence-${notification.locationId}`,
            renotify: false
          }
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: '🚗 Kingsley Carwash Nearby!',
                body: notification.message
              },
              badge: 1,
              sound: 'default'
            }
          }
        },
        android: {
          priority: 'high',
          notification: {
            title: '🚗 Kingsley Carwash Nearby!',
            body: notification.message,
            icon: 'ic_notification',
            tag: `geofence-${notification.locationId}`
          }
        }
      };

      // Send to all tokens
      for (const token of fcmTokens) {
        try {
          await admin.messaging().send({
            ...message,
            token: token
          });
          logger.log(`✅ Notification sent to ${userId} via ${token.slice(0, 10)}...`);
        } catch (tokenError) {
          if (tokenError.code === 'messaging/invalid-registration-token' ||
              tokenError.code === 'messaging/registration-token-not-registered') {
            // Remove invalid token
            await admin.firestore()
              .collection('users')
              .doc(userId)
              .update({
                fcmTokens: admin.firestore.FieldValue.arrayRemove(token)
              });
            logger.log(`🗑️ Removed invalid FCM token for ${userId}`);
          } else {
            logger.error(`❌ Failed to send notification: ${tokenError.message}`);
          }
        }
      }

      // Update last notification time
      const now = new Date().toISOString();
      const updateData = {
        [`lastGeofenceNotifications.${notification.locationId}`]: now
      };
      await admin.firestore()
        .collection('users')
        .doc(userId)
        .set(updateData, { merge: true });

      // Increment notification count in admin settings
      await admin.firestore()
        .collection('admin_settings')
        .doc('geofencing')
        .update({
          notificationsSent: admin.firestore.FieldValue.increment(1)
        });

      logger.log(`📊 Updated notification count in admin settings`);
    }
  } catch (error) {
    logger.error(`❌ Error sending notifications: ${error.message}`, error);
  }
}

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================

exports.healthCheck = onRequest((request, response) => {
  logger.info("Geofencing Cloud Functions are running!");
  response.json({
    status: "ok",
    message: "Kingsley Carwash Geofencing System Active",
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// ADMIN NOTIFICATIONS FOR PENDING EVENTS
// ============================================================

/**
 * Helper: Create admin notification if one doesn't already exist for this event
 * Avoids duplicate notifications for the same booking/reschedule/cancellation
 */
async function createAdminNotificationIfMissing(action, itemId, title, message, link = 'appointment.html') {
  try {
    const db = admin.firestore();
    
    // Query for existing notification for this action+itemId
    const existing = await db.collection('notifications')
      .where('data.action', '==', action)
      .where('data.itemId', '==', itemId)
      .limit(1)
      .get();

    if (!existing.empty) {
      logger.log(`📌 Admin notification already exists for ${action}:${itemId}`);
      return; // already notified
    }

    // Create new admin notification
    const notifRef = await db.collection('notifications').add({
      title,
      body: message,
      link,
      data: { action, itemId },
      read: false,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      type: 'admin'
    });

    logger.log(`✅ Created admin notification ${notifRef.id} for ${action}:${itemId}`);
  } catch (err) {
    logger.error(`❌ Error creating admin notification: ${err.message}`, err);
  }
}

/**
 * Cloud Function: Trigger when new pending booking is created
 * Creates an admin notification for approval
 */
exports.onNewPendingBooking = onDocumentWritten(
  "bookings/{bookingId}",
  async (event) => {
    try {
      const bookingId = event.params.bookingId;
      const newData = event.data.after.data();
      const oldData = event.data.before.data();

      // Only process new documents or status changes to 'Pending'
      if (!newData || (!oldData && newData.status !== 'Pending') || (oldData && oldData.status !== 'Pending' && newData.status !== 'Pending')) {
        return;
      }

      // Only trigger on new documents or status changes to Pending
      if (oldData && oldData.status === 'Pending') {
        return; // Status was already pending, skip
      }

      logger.log(`📅 New pending booking detected: ${bookingId}`);

      const customer = newData.customer || newData.customerName || 'Customer';
      const service = newData.service || newData.serviceNames || 'Service';
      const title = 'Pending Approval';
      const message = `${customer} has a new pending booking for ${service}.`;

      await createAdminNotificationIfMissing(
        'pending_booking',
        bookingId,
        title,
        message,
        'appointment.html'
      );
    } catch (error) {
      logger.error(`❌ Error in onNewPendingBooking: ${error.message}`, error);
    }
  }
);

/**
 * Cloud Function: Trigger when new reschedule request is created
 * Creates an admin notification for reschedule request
 */
exports.onNewRescheduleRequest = onDocumentWritten(
  "rescheduleRequests/{requestId}",
  async (event) => {
    try {
      const requestId = event.params.requestId;
      const newData = event.data.after.data();
      const oldData = event.data.before.data();

      // Only process new documents or status changes to 'Pending'
      if (!newData || (!oldData && newData.status !== 'Pending') || (oldData && oldData.status !== 'Pending' && newData.status !== 'Pending')) {
        return;
      }

      // Only trigger on new documents or status changes to Pending
      if (oldData && oldData.status === 'Pending') {
        return; // Status was already pending, skip
      }

      logger.log(`🔄 New reschedule request detected: ${requestId}`);

      const customer = newData.customerName || newData.customer || 'Customer';
      const service = newData.serviceName || newData.service || 'Service';
      const title = 'Reschedule Request';
      const message = `${customer} requested to reschedule ${service}.`;

      await createAdminNotificationIfMissing(
        'reschedule_request',
        requestId,
        title,
        message,
        'appointment.html'
      );
    } catch (error) {
      logger.error(`❌ Error in onNewRescheduleRequest: ${error.message}`, error);
    }
  }
);

/**
 * Cloud Function: Trigger when booking is cancelled
 * Creates an admin notification for cancellation
 */
exports.onBookingCancelled = onDocumentWritten(
  "bookings/{bookingId}",
  async (event) => {
    try {
      const bookingId = event.params.bookingId;
      const newData = event.data.after.data();
      const oldData = event.data.before.data();

      // Only process if status changed to 'Cancelled'
      if (!newData || newData.status !== 'Cancelled' || (oldData && oldData.status === 'Cancelled')) {
        return; // Not a new cancellation or already processed
      }

      logger.log(`❌ Booking cancelled detected: ${bookingId}`);

      const customer = newData.customer || newData.customerName || 'Customer';
      const service = newData.service || newData.serviceNames || 'Service';
      const title = 'Appointment Cancelled';
      const message = `${customer}'s appointment for ${service} was cancelled.`;

      await createAdminNotificationIfMissing(
        'appointment_cancelled',
        bookingId,
        title,
        message,
        'appointment.html'
      );
    } catch (error) {
      logger.error(`❌ Error in onBookingCancelled: ${error.message}`, error);
    }
  }
);
