// --- Centralized Firebase Configuration & Initialization ---
// This file should be included before any other script that uses Firebase.

const firebaseConfig = {
  apiKey: "AIzaSyCFToN0U0Q3zmLZiTJAwPURrCgnCH7wPe0",
  authDomain: "kingsleycarwashapp.firebaseapp.com",
  databaseURL: "https://kingsleycarwashapp-default-rtdb.firebaseio.com",
  projectId: "kingsleycarwashapp",
  storageBucket: "kingsleycarwashapp.appspot.com",
  messagingSenderId: "508373593061",
  appId: "1:508373593061:web:86a490e83f1016e5dc1d0c"
};

// Initialize Firebase only once
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Make services globally available for other scripts
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();