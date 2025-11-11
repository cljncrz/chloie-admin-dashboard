// auth.js - Authentication script for login/registration page
// Depends on firebase-config.js being loaded first

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Firebase to initialize
  await window.firebaseInitPromise;
  
  initializeAuthHandlers();

  function initializeAuthHandlers() {
    // --- DOM Elements ---
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');

    const auth = window.firebase.auth();
    const db = window.firebase.firestore();

    // --- Login Handler ---
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        loginError.textContent = '';

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
            if (error.code === 'auth/wrong-password') {
              errorMessage = 'Incorrect password. Please try again.';
            } else if (error.code === 'auth/user-not-found') {
              errorMessage = 'No account found with this email address.';
            } else if (error.code === 'auth/invalid-email') {
              errorMessage = 'The email address is not valid.';
            } else if (error.code === 'auth/too-many-requests') {
              errorMessage = 'Access to this account has been temporarily disabled due to too many failed login attempts. Please try again later.';
            }
            loginError.textContent = errorMessage;
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

        registerError.textContent = '';

        auth.createUserWithEmailAndPassword(email, password)
          .then((userCredential) => {
            const user = userCredential.user;
            console.log('User registered:', user);
            return db.collection('users').doc(user.uid).set({
              fullName: name,
              email: user.email,
              role: 'admin',
              createdAt: db.FieldValue.serverTimestamp(),
            });
          })
          .then(() => {
            console.log('User document created in Firestore with admin role.');
            window.location.href = 'index.html';
          })
          .catch((error) => {
            console.error('Registration Error:', error);
            registerError.textContent = error.message;
          });
      });
    }
  }
});
