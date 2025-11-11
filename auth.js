document.addEventListener("DOMContentLoaded", () => {
  // Firebase is initialized in firebase-config.js
  // The 'auth' and 'db' constants are also globally available from that file.

  // --- DOM Elements ---
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const loginError = document.getElementById("login-error");
  const registerError = document.getElementById("register-error");

  // --- Login Handler ---
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;

      loginError.textContent = ""; // Clear previous errors

      auth
        .signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
          // Login successful, now check the user's role in Firestore.
          const user = userCredential.user;
          return db.collection("users").doc(user.uid).get();
        })
        .then((doc) => {
          if (doc.exists && doc.data().role === "admin") {
            // User is an admin, redirect to the dashboard.
            console.log("Admin user logged in:", doc.data());
            window.location.href = "index.html";
          } else {
            // User is not an admin or doesn't have a role document.
            console.log("Non-admin user tried to log in.");
            loginError.textContent =
              "You do not have permission to access the admin panel.";
            // Sign them out to prevent confusion.
            auth.signOut();
          }
        })
        .catch((error) => {
          // Handle login errors
          console.error("Login Error:", error);
          // Provide more user-friendly error messages based on the error code
          let errorMessage = "An unexpected error occurred. Please try again.";
          switch (error.code) {
            case "auth/wrong-password":
              errorMessage = "Incorrect password. Please try again.";
              break;
            case "auth/user-not-found":
              errorMessage = "No account found with this email address.";
              break;
            case "auth/invalid-email":
              errorMessage = "The email address is not valid.";
              break;
            case "auth/too-many-requests":
              errorMessage = "Access to this account has been temporarily disabled due to too many failed login attempts. Please try again later.";
              break;
          }
          loginError.textContent = errorMessage;
        });
    });
  }

  // --- Registration Handler ---
  if (registerForm) {
    registerForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("register-name").value;
      const email = document.getElementById("register-email").value;
      const password = document.getElementById("register-password").value;

      registerError.textContent = ""; // Clear previous errors

      auth
        .createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
          const user = userCredential.user;
          console.log("User registered:", user);

          // Now, create a document for this user in the 'users' collection with the 'admin' role.
          return db.collection("users").doc(user.uid).set({
            fullName: name,
            email: user.email,
            role: "admin", // Assign the 'admin' role upon registration from this form
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        })
        .then(() => {
          console.log("User document created in Firestore with admin role.");
          // Redirect to the dashboard after successful registration and role assignment.
          window.location.href = "index.html";
        })
        .catch((error) => {
          // Handle registration errors
          console.error("Registration Error:", error);
          registerError.textContent = error.message;
        });
    });
  }
});