// auth-guard.js
// Ensures pages that include this script are only accessible to authenticated admin users.
// Depends on firebase-setup.js being loaded first.

(async () => {
  const onLoginPage = window.location.pathname.endsWith('login.html') || window.location.href.includes('login.html');
  
  // Don't run auth guard on login page
  if (onLoginPage) {
    return;
  }

  // Wait for Firebase to initialize with a longer timeout
  const waitForFirebase = async () => {
    const maxWaitTime = 20000; // 20 seconds max
    const startTime = Date.now();
    while (!window.firebase || !window.firebase.auth) {
      if (Date.now() - startTime > maxWaitTime) {
        console.error('auth-guard: Firebase initialization timeout');
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (window.firebaseInitPromise) {
      await window.firebaseInitPromise;
    }
    return true;
  };

  const firebaseReady = await waitForFirebase();
  
  if (!firebaseReady) {
    console.error('auth-guard: Firebase not initialized. Make sure firebase-setup.js is loaded before auth-guard.js');
    window.location.href = 'login.html';
    return;
  }

  let authCheckComplete = false;

  // Debounce redirect when auth reports null briefly (token refresh/transient state)
  let _nullRedirectTimer = null;
  const scheduleRedirectToLogin = (delay = 3000) => {
    if (_nullRedirectTimer) return;
    _nullRedirectTimer = setTimeout(() => {
      console.log('auth-guard: No user found after debounce, redirecting to login');
      window.location.href = 'login.html';
    }, delay);
  };
  const cancelScheduledRedirect = () => {
    if (_nullRedirectTimer) {
      clearTimeout(_nullRedirectTimer);
      _nullRedirectTimer = null;
    }
  };

  window.firebase.auth().onAuthStateChanged(async (user) => {
    try {
      if (!user) {
        // Avoid immediate redirect — wait a short time for transient nulls to resolve
        console.log('auth-guard: onAuthStateChanged reported null user — deferring redirect');
        scheduleRedirectToLogin(3000);
        return;
      }

      // We have a user now — cancel any pending redirect
      cancelScheduledRedirect();

      // User signed in — verify admin role in Firestore
      const db = window.firebase.firestore();
      const docRef = db.collection('users').doc(user.uid);
      const userDoc = await docRef.get();
      
      if (!userDoc.exists) {
        console.warn('auth-guard: User document does not exist. Signing out.');
        try { await window.firebase.auth().signOut(); } catch(e){ console.error('Error signing out:', e); }
        window.location.href = 'login.html';
        return;
      }
      
      const role = userDoc.data().role;
      
      if (role !== 'admin') {
        console.warn('auth-guard: Signed-in user is not admin. Signing out and redirecting to login.');
        try { await window.firebase.auth().signOut(); } catch(e){ console.error('Error signing out:', e); }
        window.location.href = 'login.html';
        return;
      }
      
      // User is authenticated and is admin
      console.log('auth-guard: Admin user authenticated:', user.email);
      authCheckComplete = true;
      
    } catch (err) {
      console.error('auth-guard error:', err);
      // On error, be conservative and redirect to login to avoid exposing protected pages
      try { await window.firebase.auth().signOut(); } catch (e) { console.error('Error signing out:', e); }
      window.location.href = 'login.html';
    }
  });

  // Removed auto log-off timeout to prevent unnecessary logouts due to slow auth/network
})();
