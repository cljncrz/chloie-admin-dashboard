// auth-guard.js
// Ensures pages that include this script are only accessible to authenticated admin users.
// Depends on firebase-setup.js being loaded first.

(async () => {
  const onLoginPage = window.location.pathname.endsWith('login.html') || window.location.href.includes('login.html');
  
  // Don't run auth guard on login page
  if (onLoginPage) {
    return;
  }

  // Wait for Firebase to initialize with a timeout
  const waitForFirebase = async () => {
    const maxWaitTime = 5000; // 5 seconds max
    const startTime = Date.now();
    
    while (!window.firebase || !window.firebase.auth) {
      if (Date.now() - startTime > maxWaitTime) {
        console.error('auth-guard: Firebase initialization timeout');
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Also wait for the init promise if it exists
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

  window.firebase.auth().onAuthStateChanged(async (user) => {
    try {
      if (!user) {
        // Not signed in — send to the login page
        console.log('auth-guard: No user found, redirecting to login');
        window.location.href = 'login.html';
        return;
      }

      // User signed in — verify admin role in Firestore
      const db = window.firebase.firestore();
      const docRef = db.collection('users').doc(user.uid);
      const userDoc = await docRef.get();
      
      if (!userDoc.exists) {
        console.warn('auth-guard: User document does not exist. Signing out.');
        await window.firebase.auth().signOut();
        window.location.href = 'login.html';
        return;
      }
      
      const role = userDoc.data().role;
      
      if (role !== 'admin') {
        console.warn('auth-guard: Signed-in user is not admin. Signing out and redirecting to login.');
        await window.firebase.auth().signOut();
        window.location.href = 'login.html';
        return;
      }
      
      // User is authenticated and is admin
      console.log('auth-guard: Admin user authenticated:', user.email);
      authCheckComplete = true;
      
    } catch (err) {
      console.error('auth-guard error:', err);
      // On error, be conservative and redirect to login to avoid exposing protected pages
      try { 
        await window.firebase.auth().signOut(); 
      } catch (e) { 
        console.error('Error signing out:', e);
      }
      window.location.href = 'login.html';
    }
  });

  // Add a timeout to prevent indefinite loading if auth state never resolves
  setTimeout(() => {
    if (!authCheckComplete) {
      console.warn('auth-guard: Auth check timed out, redirecting to login');
      window.location.href = 'login.html';
    }
  }, 5000);
})();
