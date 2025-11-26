#!/usr/bin/env node
// Usage: node scripts/make-media-public.js
// This script will iterate all documents in the `media` collection and make
// their referenced storage files public, updating the Firestore `url` field
// to the public REST URL. Requires `firebase-service-account.json` in project root.

const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: `${serviceAccount.project_id}.appspot.com`,
  });
} catch (e) {
  console.error('Could not load service account from', serviceAccountPath, e.message);
  process.exit(1);
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

(async () => {
  try {
    const snapshot = await db.collection('media').get();
    console.log(`Found ${snapshot.size} media documents`);
    let count = 0;
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const storagePath = data.storagePath;
      if (!storagePath) {
        console.warn(`Skipping doc ${doc.id} - no storagePath`);
        continue;
      }
      try {
        const file = bucket.file(storagePath);
        await file.makePublic();
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
        await db.collection('media').doc(doc.id).update({ url: publicUrl });
        console.log(`Updated ${doc.id} -> ${publicUrl}`);
        count++;
      } catch (err) {
        console.error(`Failed to publicize ${storagePath} for doc ${doc.id}:`, err.message);
      }
    }
    console.log(`Done. Publicized ${count} files.`);
    process.exit(0);
  } catch (err) {
    console.error('Script failed:', err.message);
    process.exit(1);
  }
})();
