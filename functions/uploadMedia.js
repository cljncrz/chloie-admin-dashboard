/**
 * Cloud Function to handle file uploads to Firebase Storage
 * Deploy with: firebase deploy --only functions
 * 
 * This function handles uploads server-side, bypassing CORS restrictions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin SDK
admin.initializeApp();

exports.uploadMedia = functions.https.onRequest((req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return cors(req, res, async () => {
    try {
      const { fileName, fileData, fileType } = req.body;

      if (!fileName || !fileData || !fileType) {
        return res.status(400).json({ error: 'Missing required fields: fileName, fileData, fileType' });
      }

      // Decode base64 file data
      const buffer = Buffer.from(fileData, 'base64');
      
      // Create storage path
      const filePath = `media/${Date.now()}-${fileName}`;
      const bucket = admin.storage().bucket();
      const file = bucket.file(filePath);

      // Upload file
      await file.save(buffer, {
        metadata: {
          contentType: fileType,
        },
        public: true,
      });

      // Get download URL
      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media`;

      // Store metadata in Firestore
      const mediaDoc = {
        name: fileName,
        url: downloadURL,
        storagePath: filePath,
        type: fileType.startsWith('image') ? 'image' : 'video',
        size: Math.round(buffer.length / 1024) + ' KB',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await admin.firestore().collection('media').add(mediaDoc);

      res.status(200).json({
        success: true,
        id: docRef.id,
        ...mediaDoc,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: error.message });
    }
  });
});
