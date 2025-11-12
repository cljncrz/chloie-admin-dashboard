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
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'kingsleycarwashapp.firebasestorage.app',
    });
  } else if (!admin.apps.length) {
    // Try to use default credentials (for development)
    admin.initializeApp({
      projectId: 'kingsleycarwashapp',
      storageBucket: 'kingsleycarwashapp.firebasestorage.app',
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

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: '✅ Server is running' });
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
  console.log(`❤️  Health check: GET http://localhost:${PORT}/health\n`);
});
