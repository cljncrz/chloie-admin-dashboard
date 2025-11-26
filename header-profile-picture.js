// header-profile-picture.js
// Updates the top-right header profile picture to the user's photoURL from Firestore

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.firebase || !window.firebase.auth || !window.firebase.firestore) return;
  await (window.firebaseInitPromise || Promise.resolve());

  const auth = window.firebase.auth();
  const db = window.firebase.firestore();
  const headerImg = document.querySelector('.profile-photo img');

  auth.onAuthStateChanged(async (user) => {
    if (!user || !headerImg) return;
    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        const photoURL = userDoc.data().photoURL;
        if (photoURL) {
          headerImg.src = photoURL;
        }
      }
    } catch (e) {
      // fallback: do nothing
    }
  });
});
