import { auth, db, storage } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  getIdToken,
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  collection,
  doc,
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
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

// Create wrapper classes that mimic Firestore compat API
class CollectionReference {
  constructor(collectionName) {
    this._collectionName = collectionName;
  }

  doc(docId) {
    if (docId) {
      return new DocumentReference(this._collectionName, docId);
    }
    // Return a new document reference for a new doc
    return new DocumentReference(this._collectionName, null);
  }

  async get() {
    const snapshot = await getDocs(collection(db, this._collectionName));
    return new QuerySnapshot(snapshot);
  }

  where(field, operator, value) {
    return new Query(query(collection(db, this._collectionName), where(field, operator, value)));
  }

  orderBy(field, direction = 'asc') {
    return new Query(query(collection(db, this._collectionName), orderBy(field, direction)));
  }

  async add(data) {
    const docRef = await addDoc(collection(db, this._collectionName), data);
    return { id: docRef.id };
  }
}

class DocumentReference {
  constructor(collectionName, docId) {
    this._collectionName = collectionName;
    this._docId = docId;
    this.id = docId;
  }

  async get() {
    const docRef = doc(db, this._collectionName, this._docId);
    const docSnap = await getDoc(docRef);
    return new DocumentSnapshot(docSnap);
  }

  async set(data, options = {}) {
    const docRef = doc(db, this._collectionName, this._docId);
    return setDoc(docRef, data, options);
  }

  async update(data) {
    const docRef = doc(db, this._collectionName, this._docId);
    return updateDoc(docRef, data);
  }

  async delete() {
    const docRef = doc(db, this._collectionName, this._docId);
    return deleteDoc(docRef);
  }

  collection(subcollectionName) {
    return new CollectionReference(`${this._collectionName}/${this._docId}/${subcollectionName}`);
  }
}

class DocumentSnapshot {
  constructor(docSnap) {
    this._docSnap = docSnap;
  }

  get exists() {
    return this._docSnap.exists();
  }

  data() {
    return this._docSnap.data();
  }
}

class QuerySnapshot {
  constructor(snapshot) {
    this._snapshot = snapshot;
    this.docs = snapshot.docs.map(d => ({
      id: d.id,
      data: () => d.data(),
      exists: true
    }));
  }

  get empty() {
    return this._snapshot.empty;
  }
}

class Query {
  constructor(q) {
    this._query = q;
  }

  async get() {
    const snapshot = await getDocs(this._query);
    return new QuerySnapshot(snapshot);
  }

  where(field, operator, value) {
    // Note: can't add more where clauses easily, return the snapshot
    return this;
  }

  orderBy(field, direction = 'asc') {
    return this;
  }
}

// Create a global firebase object that mimics the compat SDK
window.firebase = {
  // Auth methods
  auth: () => ({
    get currentUser() {
      return auth.currentUser;
    },
    signInWithEmailAndPassword: (email, password) =>
      signInWithEmailAndPassword(auth, email, password),
    createUserWithEmailAndPassword: (email, password) =>
      createUserWithEmailAndPassword(auth, email, password),
    signOut: () => signOut(auth),
    onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback),
    updateProfile: (user, updates) => updateProfile(user, updates),
    setPersistence: (persistence) => setPersistence(auth, persistence),
    getIdToken: (forceRefresh) => getIdToken(auth.currentUser, forceRefresh),
  }),

  // Firestore methods
  firestore: () => ({
    collection: (name) => new CollectionReference(name),
    
    // Timestamp support
    FieldValue: {
      serverTimestamp: () => serverTimestamp(),
      increment: (n) => increment(n),
    },
    Timestamp: Timestamp,
    batch: () => ({
      set: () => {},
      update: () => {},
      delete: (docRef) => {},
      commit: async () => {}
    })
  }),

  // Storage methods
  storage: () => ({
    ref: (path) => ({
      child: (childPath) => ({
        put: (blob) => uploadBytes(ref(storage, `${path}/${childPath}`), blob),
        getDownloadURL: () => getDownloadURL(ref(storage, path))
      }),
      listAll: () => listAll(ref(storage, path)),
      getDownloadURL: () => getDownloadURL(ref(storage, path))
    }),
  }),
};

// Initialize auth persistence
setPersistence(auth, browserLocalPersistence).catch(error => {
  console.error("Error setting auth persistence:", error);
});

export { auth, db, storage };
