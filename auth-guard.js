// auth-guard.js
// Ensures pages that include this script are only accessible to authenticated admin users.
// Depends on firebase being initialized (load firebase SDKs and firebase-config.js first).

document.addEventListener('DOMContentLoaded', () => {
  // If firebase isn't available yet, wait a short while (config should load before this script in HTML)
  if (typeof firebase === 'undefined' || !firebase.auth) {
    console.warn('auth-guard: Firebase not available when auth-guard ran. Ensure firebase-config.js is loaded before auth-guard.js.');
    return;
  }

  firebase.auth().onAuthStateChanged(async (user) => {
    try {
      const onLoginPage = window.location.pathname.endsWith('login.html') || window.location.href.includes('login.html');

      if (!user) {
        // Not signed in — send to the login page unless already there
        if (!onLoginPage) {
          window.location.href = 'login.html';
        }
        return;
      }

      // User signed in — verify admin role in Firestore (defensive: only if Firestore is available)
      if (firebase.firestore) {
        const doc = await firebase.firestore().collection('users').doc(user.uid).get();
        const role = doc.exists ? doc.data().role : null;
        if (role !== 'admin') {
          console.warn('auth-guard: Signed-in user is not admin. Signing out and redirecting to login.');
          await firebase.auth().signOut();
          if (!onLoginPage) window.location.href = 'login.html';
        }
      }
    } catch (err) {
      console.error('auth-guard error:', err);
      // On error, be conservative and redirect to login to avoid exposing protected pages
      if (!window.location.href.includes('login.html')) {
        try { await firebase.auth().signOut(); } catch (e) { /* ignore */ }
        window.location.href = 'login.html';
      }
    }
  });
});
