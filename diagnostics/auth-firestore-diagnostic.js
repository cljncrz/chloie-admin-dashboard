(async function(){
  try{
    console.log('🔍 Running auth + Firestore diagnostic...');
    await window.firebaseInitPromise;
    const authShim = window.firebase.auth();
    console.log('Auth shim present:', !!authShim);
    const currentUser = authShim && authShim.getIdToken ? authShim.currentUser : authShim.currentUser;
    console.log('Current user object:', currentUser);
    if (currentUser) {
      console.log('User UID:', currentUser.uid);
      console.log('User email:', currentUser.email);
      try {
        const token = await window.firebase.auth().getIdToken();
        console.log('ID Token (truncated):', token ? token.slice(0,40) + '...' : 'none');
      } catch(e){ console.warn('Could not get id token:', e.message); }
    } else {
      console.warn('No user signed in. Sign in with an admin account to proceed.');
    }

    const db = window.firebase.firestore();
    console.log('Firestore shim methods available:', {
      collection: typeof db.collection,
      FieldValue: typeof db.FieldValue
    });

    console.log('\n✅ Diagnostic complete.');
  }catch(err){
    console.error('Diagnostic error:', err);
  }
})();