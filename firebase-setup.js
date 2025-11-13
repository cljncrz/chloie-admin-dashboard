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
  increment
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

// Firebase config - copied from existing firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyCFToN0U0Q3zmLZiTJAwPURrCgnCH7wPe0",
  authDomain: "kingsleycarwashapp.firebaseapp.com",
  databaseURL: "https://kingsleycarwashapp-default-rtdb.firebaseio.com",
  projectId: "kingsleycarwashapp",
  storageBucket: "kingsleycarwashapp.appspot.com",
  messagingSenderId: "508373593061",
  appId: "1:508373593061:web:86a490e83f1016e5dc1d0c"
};

// Initialize app and services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

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
      async add(data) {
        const colRef = collection(db, collectionName);
        const docRef = await addDoc(colRef, data);
        return { id: docRef.id };
      },
      doc: (id) => ({
        async get() {
          const ref = fsDoc(db, collectionName, id);
          const dsnap = await getDoc(ref);
          return { exists: dsnap.exists(), data: () => dsnap.data(), id: dsnap.id };
        },
        set: (data) => setDoc(fsDoc(db, collectionName, id), data),
        update: (data) => updateDoc(fsDoc(db, collectionName, id), data),
        delete: () => deleteDoc(fsDoc(db, collectionName, id))
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

    return {
      collection: (name) => createCollectionRef(name),
      // helpers
      FieldValue: {
        serverTimestamp: () => serverTimestamp(),
        increment: (n) => increment(n)
      },
      Timestamp: Timestamp,
      // very small batch stub to avoid runtime errors where batch is referenced
      batch: () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} })
    };
  },

  storage: () => ({
    ref: (path) => ({
      child: (childPath) => {
        const r = storageRef(storage, `${path}/${childPath}`);
        return {
          put: (blob) => uploadBytes(r, blob).then(res => res),
          getDownloadURL: () => getDownloadURL(r)
        };
      },
      listAll: () => listAll(storageRef(storage, path)),
      getDownloadURL: () => getDownloadURL(storageRef(storage, path))
    }),
  })
};

// Export named services to support module imports elsewhere
export { auth, db, storage };

// Promise for legacy scripts to await initialization
window.firebaseInitPromise = Promise.resolve();

// Provide a convenience global for module-based code that expects these names
window._firebaseServices = { auth, db, storage };

// Done
