// auth-guard.js
// Ensures pages that include this script are only accessible to authenticated admin users.
// Depends on firebase-config.js being loaded first.

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Firebase to initialize
  await window.firebaseInitPromise;

  window.firebase.auth().onAuthStateChanged(async (user) => {
    try {
      const onLoginPage = window.location.pathname.endsWith('login.html') || window.location.href.includes('login.html');

      if (!user) {
        // Not signed in — send to the login page unless already there
        if (!onLoginPage) {
          window.location.href = 'login.html';
        }
        return;
      }

      // User signed in — verify admin role in Firestore
      const db = window.firebase.firestore();
      const docRef = db.collection('users').doc(user.uid);
      const userDoc = await docRef.get();
      const role = userDoc.exists ? userDoc.data().role : null;
      
      if (role !== 'admin') {
        console.warn('auth-guard: Signed-in user is not admin. Signing out and redirecting to login.');
        await window.firebase.auth().signOut();
        if (!onLoginPage) window.location.href = 'login.html';
      }
    } catch (err) {
      console.error('auth-guard error:', err);
      // On error, be conservative and redirect to login to avoid exposing protected pages
      if (!window.location.href.includes('login.html')) {
        try { await window.firebase.auth().signOut(); } catch (e) { /* ignore */ }
        window.location.href = 'login.html';
      }
    }
  });
});
