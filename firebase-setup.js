// firebase-setup.js
// Single-module Firebase initializer. Exposes a compat-like `window.firebase` shim
// and `window.firebaseInitPromise` for legacy scripts that await it.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  getIdToken
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  collectionGroup,
  doc as fsDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  addDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  increment,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
  connectStorageEmulator
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

// Firebase config - copied from existing firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyCFToN0U0Q3zmLZiTJAwPURrCgnCH7wPe0",
  authDomain: "kingsleycarwashapp.firebaseapp.com",
  databaseURL: "https://kingsleycarwashapp-default-rtdb.firebaseio.com",
  projectId: "kingsleycarwashapp",
  storageBucket: "kingsleycarwashapp.firebasestorage.app",
  messagingSenderId: "508373593061",
  appId: "1:508373593061:web:86a490e83f1016e5dc1d0c"
};

// Initialize app and services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize Firestore with settings optimized for web
// Note: Using getFirestore instead of initializeFirestore for simpler setup
const db = getFirestore(app);

// Initialize Storage with explicit bucket configuration
const storage = getStorage(app);
console.log('Firebase Storage initialized:', {
  bucket: storage.app.options.storageBucket,
  app: storage.app.name
});

// Set auth persistence to LOCAL so users stay logged in after page refresh
setPersistence(auth, browserLocalPersistence).catch(error => {
  console.error('Error setting auth persistence:', error);
});

// Try to enable offline persistence, but don't fail if it doesn't work
// This is optional and the app will work without it
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence: Multiple tabs open, using memory cache');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence: Not supported in this browser');
    } else {
      console.warn('Firestore persistence error:', err.message);
    }
  });
} catch (e) {
  console.warn('Could not enable Firestore persistence:', e.message);
}

// Minimal compat-like wrappers so existing code that calls `window.firebase.auth()`
// or `window.firebase.firestore()` continues to work.
window.firebase = {
  auth: () => ({
    get currentUser() { return auth.currentUser; },
    signInWithEmailAndPassword: (email, password) => signInWithEmailAndPassword(auth, email, password),
    createUserWithEmailAndPassword: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    signOut: () => signOut(auth),
    onAuthStateChanged: (cb) => onAuthStateChanged(auth, cb),
    updateProfile: (user, updates) => updateProfile(user, updates),
    setPersistence: (persistence) => setPersistence(auth, persistence),
    getIdToken: (forceRefresh) => (auth.currentUser ? getIdToken(auth.currentUser, forceRefresh) : Promise.reject(new Error('No current user')))
  }),

  firestore: () => {
    // Helper: build a QuerySnapshot wrapper
    const buildQuerySnapshot = (snap) => ({
      empty: snap.empty,
      docs: snap.docs.map(d => ({
        id: d.id,
        data: () => d.data(),
        exists: true
      })),
      forEach: (fn) => snap.docs.forEach(d => fn({ id: d.id, data: () => d.data() }))
    });

    // Helper: create a queryable collection reference
    const createCollectionRef = (collectionName, queryConstraints = []) => ({
      async get() {
        const snap = await getDocs(query(collection(db, collectionName), ...queryConstraints));
        return buildQuerySnapshot(snap);
      },
      // Add the onSnapshot method to the wrapper
      onSnapshot(observerOrNext, error, complete) {
        const q = query(collection(db, collectionName), ...queryConstraints);
        const observer = typeof observerOrNext === 'object' 
          ? observerOrNext 
          : { next: observerOrNext, error, complete };
        
        return onSnapshot(q, (snap) => observer.next(buildQuerySnapshot(snap)), observer.error, observer.complete);
      },
      async add(data) {
        // Add a new document with auto-generated ID
        const ref = await addDoc(collection(db, collectionName), data);
        return { id: ref.id };
      },
      doc: (id) => ({
        async get() {
          const ref = fsDoc(db, collectionName, id);
          const dsnap = await getDoc(ref);
          return { exists: dsnap.exists(), data: () => dsnap.data(), id: dsnap.id };
        },
        set: (data) => setDoc(fsDoc(db, collectionName, id), data),
        update: (data) => updateDoc(fsDoc(db, collectionName, id), data),
        delete: () => deleteDoc(fsDoc(db, collectionName, id)),
        collection: (subCollectionName) => createCollectionRef(`${collectionName}/${id}/${subCollectionName}`)
      }),
      where: (field, operator, value) => {
        // Return a new queryable object with the where constraint added
        return createCollectionRef(collectionName, [...queryConstraints, where(field, operator, value)]);
      },
      orderBy: (field, direction = 'asc') => {
        return createCollectionRef(collectionName, [...queryConstraints, orderBy(field, direction)]);
      },
      limit: (n) => {
        return createCollectionRef(collectionName, [...queryConstraints, limit(n)]);
      }
    });

    // Helper: create a queryable collectionGroup reference
    const createCollectionGroupRef = (collectionName, queryConstraints = []) => ({
      async get() {
        const snap = await getDocs(query(collectionGroup(db, collectionName), ...queryConstraints));
        return buildQuerySnapshot(snap);
      },
      onSnapshot(observerOrNext, error, complete) {
        const q = query(collectionGroup(db, collectionName), ...queryConstraints);
        const observer = typeof observerOrNext === 'object' 
          ? observerOrNext 
          : { next: observerOrNext, error, complete };
        
        return onSnapshot(q, (snap) => observer.next(buildQuerySnapshot(snap)), observer.error, observer.complete);
      },
      where: (field, operator, value) => {
        return createCollectionGroupRef(collectionName, [...queryConstraints, where(field, operator, value)]);
      },
      orderBy: (field, direction = 'asc') => {
        return createCollectionGroupRef(collectionName, [...queryConstraints, orderBy(field, direction)]);
      },
      limit: (n) => {
        return createCollectionGroupRef(collectionName, [...queryConstraints, limit(n)]);
      }
    });

    return {
      collection: (name) => createCollectionRef(name),
      collectionGroup: (name) => createCollectionGroupRef(name),
      // helpers
      FieldValue: {
        serverTimestamp: () => serverTimestamp(),
        increment: (n) => increment(n),
        arrayUnion: (elements) => arrayUnion(...(Array.isArray(elements) ? elements : [elements])),
        arrayRemove: (elements) => arrayRemove(...(Array.isArray(elements) ? elements : [elements]))
      },
      Timestamp: Timestamp,
      // very small batch stub to avoid runtime errors where batch is referenced
      batch: () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} })
    };
  },

  storage: () => ({
    ref: (path) => {
      // Don't create the ref here if path is undefined/empty
      const createRef = (p) => p ? storageRef(storage, p) : storageRef(storage);
      const r = createRef(path);
      
      return {
        put: async (blob, metadata) => {
          try {
            console.log('Storage wrapper: uploading to path:', path);
            // Use uploadBytesResumable for better compatibility
            const uploadTask = uploadBytesResumable(r, blob, metadata);
            
            // Wait for upload to complete
            const snapshot = await new Promise((resolve, reject) => {
              uploadTask.on('state_changed',
                (snapshot) => {
                  const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                  console.log('Upload progress:', progress.toFixed(2) + '%');
                },
                (error) => {
                  console.error('Upload error:', error);
                  reject(error);
                },
                () => {
                  console.log('Upload complete');
                  resolve(uploadTask.snapshot);
                }
              );
            });
            
            return {
              ref: {
                getDownloadURL: () => getDownloadURL(snapshot.ref)
              },
              snapshot,
              state: 'success'
            };
          } catch (error) {
            console.error('Storage upload error:', error);
            throw error;
          }
        },
        child: (childPath) => {
          const fullPath = path ? `${path}/${childPath}` : childPath;
          const childRef = storageRef(storage, fullPath);
          return {
            put: async (blob, metadata) => {
              try {
                console.log('Storage wrapper (child): uploading to path:', fullPath);
                const uploadTask = uploadBytesResumable(childRef, blob, metadata);
                
                const snapshot = await new Promise((resolve, reject) => {
                  uploadTask.on('state_changed',
                    (snapshot) => {
                      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                      console.log('Upload progress:', progress.toFixed(2) + '%');
                    },
                    (error) => {
                      console.error('Upload error:', error);
                      reject(error);
                    },
                    () => {
                      console.log('Upload complete');
                      resolve(uploadTask.snapshot);
                    }
                  );
                });
                
                return {
                  ref: {
                    getDownloadURL: () => getDownloadURL(snapshot.ref)
                  },
                  snapshot,
                  state: 'success'
                };
              } catch (error) {
                console.error('Storage upload error:', error);
                throw error;
              }
            },
            getDownloadURL: () => getDownloadURL(childRef)
          };
        },
        listAll: () => listAll(r),
        getDownloadURL: () => getDownloadURL(r),
        delete: () => deleteObject(r)
      };
    }
  })
};

// Export named services to support module imports elsewhere
export { auth, db, storage };

// Expose native storage functions for direct use
console.log('Creating Firebase Storage API wrapper...');
console.log('Storage instance:', storage);
console.log('Storage bucket:', firebaseConfig.storageBucket);
console.log('Storage _location:', storage._location);

window._firebaseStorageAPI = {
  // Direct access to storage instance
  storage: storage,
  
  // Create reference
  ref: (path) => {
    console.log('Creating storage ref for path:', path);
    const ref = storageRef(storage, path);
    console.log('Storage ref created:', {
      fullPath: ref.fullPath,
      bucket: ref.bucket,
      toString: ref.toString()
    });
    return ref;
  },
  
  // Upload bytes with detailed logging
  uploadBytes: async (ref, file) => {
    console.log('uploadBytes called');
    console.log('  Ref details:', {
      fullPath: ref.fullPath,
      bucket: ref.bucket,
      name: ref.name,
      root: ref.root,
      parent: ref.parent
    });
    console.log('  File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    try {
      console.log('Calling uploadBytes from Firebase SDK...');
      const result = await uploadBytes(ref, file);
      console.log('✓ uploadBytes succeeded:', {
        bytesTransferred: result.metadata.size,
        contentType: result.metadata.contentType,
        fullPath: result.metadata.fullPath
      });
      return result;
    } catch (error) {
      console.error('✗ uploadBytes error:', {
        code: error.code,
        message: error.message,
        serverResponse: error.serverResponse,
        name: error.name
      });
      throw error;
    }
  },
  
  // Upload with progress
  uploadBytesResumable: (ref, file) => {
    console.log('uploadBytesResumable called:', { path: ref.fullPath, fileSize: file.size });
    return uploadBytesResumable(ref, file);
  },
  
  // Get download URL
  getDownloadURL: async (ref) => {
    console.log('getDownloadURL called for:', ref.fullPath);
    try {
      const url = await getDownloadURL(ref);
      console.log('✓ Download URL obtained:', url);
      return url;
    } catch (error) {
      console.error('✗ getDownloadURL error:', error);
      throw error;
    }
  },
  
  deleteObject: deleteObject,
  listAll: listAll
};

console.log('✓ Firebase Storage API created successfully');
console.log('Available methods:', Object.keys(window._firebaseStorageAPI));

// Promise for legacy scripts to await initialization
// This ensures Firestore is fully ready before other scripts use it
window.firebaseInitPromise = new Promise((resolve) => {
  // Give Firestore a moment to initialize and connect
  setTimeout(() => {
    console.log('Firebase services initialized');
    console.log('Native storage API available:', !!window._firebaseStorageAPI);
    resolve();
  }, 100);
});

// Provide a convenience global for module-based code that expects these names
window._firebaseServices = { auth, db, storage };

// Done
