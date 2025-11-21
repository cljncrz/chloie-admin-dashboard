/**
 * Simple Node.js backend server to handle Firebase Storage uploads
 * This bypasses client-side CORS restrictions by proxying uploads through the server
 * 
 * Setup:
 * 1. Install dependencies: npm install
 * 2. Create .env file with Firebase credentials
 * 3. Run: npm start
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Firebase Admin SDK
const admin = require('firebase-admin');

// Try to load service account from environment or file
let serviceAccount = null;

try {
  // First try environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // Try to load from file
    const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
    try {
      serviceAccount = require(serviceAccountPath);
    } catch (e) {
      console.warn('firebase-service-account.json not found');
      // We'll initialize Firebase with default credentials
    }
  }
} catch (error) {
  console.error('Error loading Firebase service account:', error.message);
}

// Initialize Firebase Admin SDK
try {
  if (serviceAccount && !admin.apps.length) {
    console.log('🔑 Using service account credentials...');
    console.log(`📧 Service account email: ${serviceAccount.client_email}`);
    console.log(`🆔 Project ID: ${serviceAccount.project_id}`);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'kingsleycarwashapp.firebasestorage.app',
      databaseURL: 'https://kingsleycarwashapp-default-rtdb.firebaseio.com'
    });
  } else if (!admin.apps.length) {
    // Try to use default credentials (for development)
    console.log('⚠️  No service account found, using default credentials');
    admin.initializeApp({
      projectId: 'kingsleycarwashapp',
      storageBucket: 'kingsleycarwashapp.firebasestorage.app',
      databaseURL: 'https://kingsleycarwashapp-default-rtdb.firebaseio.com'
    });
  }
  console.log('✅ Firebase Admin SDK initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error.message);
  console.log('\n📝 To fix this, either:');
  console.log('   1. Download firebase-service-account.json from Firebase Console');
  console.log('   2. Place it in the project root directory');
  console.log('   3. Or set FIREBASE_SERVICE_ACCOUNT environment variable');
  process.exit(1);
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Load central config (includes the AI feature flag we added to config.js)
let aiConfig = null;
try {
  const { getAIConfig } = require('./config');
  aiConfig = getAIConfig();
  console.log('🔎 AI config loaded:', aiConfig);
} catch (e) {
  console.warn('⚠️ Could not load AI config. Using defaults.');
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: '✅ Server is running' });
});

/**
 * Debug endpoint for AI config — returns whether the default model is enabled
 * and the model id. This is a harmless read-only endpoint useful for verifying
 * the setting has been enabled for "all clients".
 */
app.get('/api/ai-config', (req, res) => {
  res.json({ success: true, aiConfig: aiConfig || { defaultModel: 'claude-sonnet-4.5', enableForAllClients: true } });
});

/**
 * Upload endpoint
 * POST /api/upload
 * Body: { fileName, fileData (base64), fileType }
 */
app.post('/api/upload', async (req, res) => {
  try {
    const { fileName, fileData, fileType } = req.body;

    // Validate input
    if (!fileName || !fileData || !fileType) {
      return res.status(400).json({
        error: 'Missing required fields: fileName, fileData, fileType',
      });
    }

    // Decode base64 file data
    const buffer = Buffer.from(fileData, 'base64');

    // Create unique filename with timestamp
    const uniqueFileName = `${Date.now()}-${fileName}`;
    const filePath = `media/${uniqueFileName}`;
    const file = bucket.file(filePath);

    console.log(`📤 Uploading file: ${filePath} (${buffer.length} bytes)`);

    // Upload file to Firebase Storage
    await file.save(buffer, {
      metadata: {
        contentType: fileType,
        cacheControl: 'public, max-age=86400',
      },
    });

    // Construct download URL
    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media`;

    // Determine file type
    const isImage = fileType.startsWith('image');
    const isVideo = fileType.startsWith('video');

    // Store metadata in Firestore
    const mediaDoc = {
      name: fileName,
      url: downloadURL,
      storagePath: filePath,
      type: isImage ? 'image' : isVideo ? 'video' : 'file',
      size: formatFileSize(buffer.length),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      uploadedAt: new Date().toISOString(),
    };

    const docRef = await db.collection('media').add(mediaDoc);

    console.log(`✅ File uploaded successfully: ${downloadURL}`);

    res.status(200).json({
      success: true,
      id: docRef.id,
      message: `File ${fileName} uploaded successfully`,
      ...mediaDoc,
    });
  } catch (error) {
    console.error('❌ Error uploading file:', error);
    res.status(500).json({
      error: 'Failed to upload file',
      details: error.message,
    });
  }
});

/**
 * Get all media files
 * GET /api/media
 */
app.get('/api/media', async (req, res) => {
  try {
    const snapshot = await db
      .collection('media')
      .orderBy('createdAt', 'desc')
      .get();

    const mediaList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(mediaList);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({
      error: 'Failed to fetch media',
      details: error.message,
    });
  }
});

/**
 * Delete media file
 * DELETE /api/media/:id
 */
app.delete('/api/media/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get document to find storage path
    const doc = await db.collection('media').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const { storagePath } = doc.data();

    // Delete from Firestore
    await db.collection('media').doc(id).delete();

    // Delete from Storage
    if (storagePath) {
      await bucket.file(storagePath).delete().catch((err) => {
        console.error(`Failed to delete ${storagePath}:`, err);
      });
    }

    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({
      error: 'Failed to delete media',
      details: error.message,
    });
  }
});

/**
 * Send push notifications to mobile app users
 * POST /api/notifications/send
 * Body: {
 *   recipientIds: string[],  // User IDs to notify
 *   title: string,           // Notification title
 *   body: string,            // Notification body
 *   type: string,            // 'appointment', 'payment', 'review', 'promotion'
 *   data?: object            // Additional data
 * }
 */
app.post('/api/notifications/send', async (req, res) => {
  try {
    const { recipientIds, title, body, type, data } = req.body;

    // Validate input
    if (!recipientIds || !Array.isArray(recipientIds) || !title || !body || !type) {
      return res.status(400).json({
        error: 'Missing required fields: recipientIds (array), title, body, type',
      });
    }

    let sentCount = 0;
    let failedCount = 0;
    const failedUsers = [];

    // Send notifications to each recipient
    for (const userId of recipientIds) {
      try {
        // Get user's FCM tokens from Firestore
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
          console.warn(`⚠️ User not found: ${userId}`);
          failedCount++;
          failedUsers.push({ userId, reason: 'User not found' });
          continue;
        }

        const userData = userDoc.data();
        const fcmTokens = userData.fcmTokens || [];

        if (!fcmTokens || fcmTokens.length === 0) {
          console.warn(`⚠️ No FCM tokens for user: ${userId}`);
          failedCount++;
          failedUsers.push({ userId, reason: 'No FCM tokens' });
          continue;
        }

        // Send to each device
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
                priority: 'high',
                notification: {
                  title: title,
                  body: body,
                  sound: 'default',
                  click_action: 'FLUTTER_NOTIFICATION_CLICK',
                },
              },
              apns: {
                headers: {
                  'apns-priority': '10',
                },
                payload: {
                  aps: {
                    sound: 'default',
                    'content-available': 1,
                  },
                },
              },
            };

            await admin.messaging().send(message);
            sentCount++;
            console.log(`✅ Notification sent to ${userId}`);
          } catch (tokenError) {
            console.error(
              `⚠️ Failed to send to token for user ${userId}:`,
              tokenError.message
            );
            // Remove invalid token
            if (
              tokenError.code === 'messaging/invalid-registration-token' ||
              tokenError.code === 'messaging/registration-token-not-registered'
            ) {
              await db
                .collection('users')
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
        failedUsers.push({ userId, reason: error.message });
      }
    }

    // Save notification record to Firestore
    try {
      await db.collection('notifications_sent').add({
        title: title,
        body: body,
        type: type,
        recipientIds: recipientIds,
        data: data || {},
        sentCount: sentCount,
        failedCount: failedCount,
        failedUsers: failedUsers,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        sentAt: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('⚠️ Failed to log notification:', logError);
    }

    // Return response
    res.status(200).json({
      success: true,
      message: 'Notifications sent',
      sentCount: sentCount,
      failedCount: failedCount,
      failedUsers: failedUsers.length > 0 ? failedUsers : undefined,
    });
  } catch (error) {
    console.error('❌ Error sending notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notifications',
      details: error.message,
    });
  }
});

/**
 * Get notification history
 * GET /api/notifications/history
 * Query params: limit=20, startAfter=docId
 */
app.get('/api/notifications/history', async (req, res) => {
  try {
    const { limit = 20, startAfter } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);

    let query = db
      .collection('notifications_sent')
      .orderBy('timestamp', 'desc')
      .limit(limitNum);

    if (startAfter) {
      const lastDoc = await db
        .collection('notifications_sent')
        .doc(startAfter)
        .get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      notifications: notifications,
      nextCursor: notifications.length > 0 ? notifications[notifications.length - 1].id : null,
    });
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification history',
      details: error.message,
    });
  }
});

/**
 * Send push notifications to mobile app users via FCM
 * POST /api/notifications/send
 * Body: {
 *   userId: string,          // User ID to notify
 *   title: string,           // Notification title
 *   body: string,            // Notification body
 *   type: string,            // 'appointment', 'payment', 'review', 'promotion', etc.
 *   data?: object,           // Additional data to include
 *   imageUrl?: string        // Optional image URL
 * }
 */
app.post('/api/notifications/send', async (req, res) => {
  try {
    const { userId, title, body, type, data = {}, imageUrl } = req.body;

    // Validate required fields
    if (!userId || !title || !body || !type) {
      return res.status(400).json({
        error: 'Missing required fields: userId, title, body, type',
      });
    }

    // Get user's FCM tokens from Firestore
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        notificationsSent: 0
      });
    }

    const userData = userDoc.data();
    const fcmTokens = userData.fcmTokens || [];

    if (fcmTokens.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'User has no FCM tokens registered',
        notificationsSent: 0
      });
    }

    // Build notification payload
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        notificationType: type,
        sentAt: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: type || 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        payload: {
          aps: {
            'mutable-content': true,
            'sound': 'default',
            'badge': 1
          }
        }
      }
    };

    if (imageUrl) {
      message.notification.imageUrl = imageUrl;
      message.data.image = imageUrl;
    }

    // Send to all user's devices
    const results = await Promise.allSettled(
      fcmTokens.map(token => admin.messaging().send({
        ...message,
        token
      }))
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;

    // Clean up invalid tokens
    const invalidTokens = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const error = result.reason;
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(fcmTokens[index]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await db.collection('users').doc(userId).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens)
      });
    }

    // Log notification in Firestore
    await db.collection('notifications').add({
      userId,
      type,
      title,
      body,
      data: {
        ...data,
        notificationType: type
      },
      imageUrl: imageUrl || null,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
      successCount,
      failureCount
    });

    res.status(200).json({
      success: true,
      message: 'Notification sent successfully',
      notificationsSent: successCount,
      failedSends: failureCount,
      invalidTokensRemoved: invalidTokens.length
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      error: 'Failed to send notification',
      details: error.message
    });
  }
});

/**
 * Register FCM token for a user
 * POST /api/notifications/register-token
 * Body: {
 *   userId: string,
 *   fcmToken: string
 * }
 */
app.post('/api/notifications/register-token', async (req, res) => {
  try {
    const { userId, fcmToken } = req.body;

    if (!userId || !fcmToken) {
      return res.status(400).json({
        error: 'Missing required fields: userId, fcmToken'
      });
    }

    // Check if token already exists
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    const existingTokens = userData.fcmTokens || [];

    // Add token if not already present
    if (!existingTokens.includes(fcmToken)) {
      await db.collection('users').doc(userId).set({
        ...userData,
        fcmTokens: admin.firestore.FieldValue.arrayUnion(fcmToken),
        lastTokenRegistered: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    res.status(200).json({
      success: true,
      message: 'FCM token registered successfully'
    });

  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({
      error: 'Failed to register FCM token',
      details: error.message
    });
  }
});

/**
 * Unregister FCM token
 * POST /api/notifications/unregister-token
 * Body: {
 *   userId: string,
 *   fcmToken: string
 * }
 */
app.post('/api/notifications/unregister-token', async (req, res) => {
  try {
    const { userId, fcmToken } = req.body;

    if (!userId || !fcmToken) {
      return res.status(400).json({
        error: 'Missing required fields: userId, fcmToken'
      });
    }

    await db.collection('users').doc(userId).update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(fcmToken)
    });

    res.status(200).json({
      success: true,
      message: 'FCM token unregistered successfully'
    });

  } catch (error) {
    console.error('Error unregistering FCM token:', error);
    res.status(500).json({
      error: 'Failed to unregister FCM token',
      details: error.message
    });
  }
});

/**
 * Helper function to format file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📤 Upload endpoint: POST http://localhost:${PORT}/api/upload`);
  console.log(`📋 Get media: GET http://localhost:${PORT}/api/media`);
  console.log(`🗑️  Delete media: DELETE http://localhost:${PORT}/api/media/:id`);
  console.log(`📢 Send notifications: POST http://localhost:${PORT}/api/notifications/send`);
  console.log(`📋 Notification history: GET http://localhost:${PORT}/api/notifications/history`);
  console.log(`❤️  Health check: GET http://localhost:${PORT}/health\n`);
});
