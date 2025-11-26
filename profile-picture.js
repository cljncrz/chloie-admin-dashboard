// profile-picture.js
// Handles profile picture upload and display for the admin profile page

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.firebase || !window.firebase.auth || !window.firebase.firestore || !window.firebase.storage) return;
  await (window.firebaseInitPromise || Promise.resolve());

  const auth = window.firebase.auth();
  const db = window.firebase.firestore();
  const storage = window.firebase.storage();

  const imgEl = document.getElementById('profile-page-picture');
  const fileInput = document.getElementById('profile-picture-upload');

  // Load current user's profile picture from Firestore (photoURL field)
  auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        const photoURL = userDoc.data().photoURL;
        if (photoURL && imgEl) {
          imgEl.src = photoURL;
        }
      }
    } catch (e) {
      // fallback: do nothing
    }
  });

  // Handle file upload
  if (fileInput && imgEl) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const user = auth.currentUser;
      if (!user) return;
      try {
        // Upload to Firebase Storage under 'profile-pictures/{uid}.ext'
        const ext = file.name.split('.').pop();
        const ref = storage.ref().child(`profile-pictures/${user.uid}.${ext}`);
        await ref.put(file);
        const url = await ref.getDownloadURL();
        // Update Firestore user document
        await db.collection('users').doc(user.uid).update({ photoURL: url });
        imgEl.src = url;
        // Optionally show a success toast
        const toast = document.getElementById('success-toast');
        if (toast) {
          toast.querySelector('p').textContent = 'Profile picture updated!';
          toast.classList.add('show');
          setTimeout(() => toast.classList.remove('show'), 2000);
        }
      } catch (err) {
        alert('Failed to upload profile picture.');
      }
    });
  }
});
