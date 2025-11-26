// get-admin-name.js
// Utility to fetch the current logged-in admin's name and update the dashboard header

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.firebase || !window.firebase.auth || !window.firebase.firestore) return;
  await (window.firebaseInitPromise || Promise.resolve());

  const auth = window.firebase.auth();
  const db = window.firebase.firestore();

  auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists && userDoc.data().role === 'admin') {
        const name = userDoc.data().fullName || userDoc.data().name || user.email;
        const nameEl = document.getElementById('profile-header-name');
        if (nameEl) nameEl.textContent = name;
      }
    } catch (e) {
      // fallback: do nothing
    }
  });
});
