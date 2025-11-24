// auth.js - Authentication script for login/registration page
// Depends on firebase-config.js being loaded first

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Firebase to initialize. Some pages use the compat SDK and a
  // small shim in `firebase-config.js` exposes `window.firebaseInitPromise`.
  // Fallback to polling `window.firebase && firebase.apps` to avoid races.
  async function waitForFirebaseInit(timeoutMs = 5000) {
    // If the shim provided a promise, prefer that
    if (window.firebaseInitPromise && typeof window.firebaseInitPromise.then === 'function') {
      try {
        await window.firebaseInitPromise;
        return;
      } catch (e) {
        // fall through to polling so we surface a clearer error
        console.warn('firebaseInitPromise rejected, will poll for firebase.apps', e);
      }
    }

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.firebase && window.firebase.app) {
        // compat SDK exposes firebase.app and firebase.apps
        if (Array.isArray(window.firebase.apps) ? window.firebase.apps.length > 0 : true) return;
      }
      // also check global `firebase` (CDN script may set this)
      if (window.firebase && window.firebase.initializeApp && (window.firebase.apps && window.firebase.apps.length > 0)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('Firebase did not initialize within timeout. Ensure firebase-config.js runs before auth.js and the compat SDK is loaded.');
  }

  try {
    await waitForFirebaseInit(7000);
  } catch (err) {
    console.error(err);
    // Show user-facing error if desired, then abort further initialization to avoid unhandled rejections
    const loginError = document.getElementById('login-error');
    if (loginError) loginError.textContent = 'Unable to initialize authentication. Please reload the page.';
    return;
  }

  initializeAuthHandlers();

  function initializeAuthHandlers() {
    // --- DOM Elements ---
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');

    const auth = window.firebase.auth();
    const db = window.firebase.firestore();

    // Disabled automatic login redirect. Login will only occur on form submit.
    // auth.onAuthStateChanged((user) => {
    //   if (user) {
    //     // User is logged in, check if they're an admin
    //     db.collection('users').doc(user.uid).get()
    //       .then((docSnapshot) => {
    //         if (docSnapshot.exists && docSnapshot.data().role === 'admin') {
    //           // Redirect to dashboard
    //           console.log('User already logged in as admin, redirecting...');
    //           window.location.href = 'index.html';
    //         } else {
    //           // Not an admin, sign them out
    //           auth.signOut();
    //         }
    //       })
    //       .catch((error) => {
    //         console.error('Error checking user role:', error);
    //       });
    //   }
    // });

    // --- Login Handler ---
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const loginBtn = loginForm.querySelector('button[type="submit"]');

        loginError.textContent = '';
        
        // Disable button and show loading state
        loginBtn.disabled = true;
        const originalText = loginBtn.textContent;
        loginBtn.textContent = 'Logging in...';

        auth.signInWithEmailAndPassword(email, password)
          .then((userCredential) => {
            const user = userCredential.user;
            return db.collection('users').doc(user.uid).get();
          })
          .then((docSnapshot) => {
            if (docSnapshot.exists && docSnapshot.data().role === 'admin') {
              console.log('Admin user logged in:', docSnapshot.data());
              window.location.href = 'index.html';
            } else {
              console.log('Non-admin user tried to log in.');
              loginError.textContent = 'You do not have permission to access the admin panel.';
              auth.signOut();
            }
          })
          .catch((error) => {
            console.error('Login Error:', error);
            let errorMessage = 'An unexpected error occurred. Please try again.';
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
              errorMessage = 'Incorrect email or password. Please try again.';
            } else if (error.code === 'auth/user-not-found') {
              errorMessage = 'No account found with this email address.';
            } else if (error.code === 'auth/invalid-email') {
              errorMessage = 'The email address is not valid.';
            } else if (error.code === 'auth/too-many-requests') {
              errorMessage = 'Access to this account has been temporarily disabled due to too many failed login attempts. Please try again later.';
            }
            loginError.textContent = errorMessage;
            
            // Re-enable button
            loginBtn.disabled = false;
            loginBtn.textContent = originalText;
          });
      });
    }

    // --- Registration Handler ---
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const registerBtn = registerForm.querySelector('button[type="submit"]');

        registerError.textContent = '';
        
        // Validation
        if (name.trim().length < 2) {
          registerError.textContent = 'Please enter a valid name.';
          return;
        }
        
        if (password.length < 6) {
          registerError.textContent = 'Password must be at least 6 characters long.';
          return;
        }
        
        // Disable button and show loading state
        registerBtn.disabled = true;
        const originalText = registerBtn.textContent;
        registerBtn.textContent = 'Creating account...';

        auth.createUserWithEmailAndPassword(email, password)
          .then((userCredential) => {
            const user = userCredential.user;
            console.log('User registered:', user);
            return db.collection('users').doc(user.uid).set({
              fullName: name,
              email: user.email,
              role: 'admin',
              createdAt: window.firebase.firestore().FieldValue.serverTimestamp(),
            });
          })
          .then(() => {
            console.log('User document created in Firestore with admin role.');
            window.location.href = 'index.html';
          })
          .catch((error) => {
            console.error('Registration Error:', error);
            let errorMessage = 'An unexpected error occurred. Please try again.';
            if (error.code === 'auth/email-already-in-use') {
              errorMessage = 'This email is already registered.';
            } else if (error.code === 'auth/weak-password') {
              errorMessage = 'Password should be at least 6 characters.';
            } else if (error.code === 'auth/invalid-email') {
              errorMessage = 'The email address is not valid.';
            } else {
              errorMessage = error.message;
            }
            registerError.textContent = errorMessage;
            
            // Re-enable button
            registerBtn.disabled = false;
            registerBtn.textContent = originalText;
          });
      });
    }
  }
});
