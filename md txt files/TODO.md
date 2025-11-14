# TODO: Fix db undefined error in send-notification.js

- [x] Add `const db = window.firebase.firestore();` to loadUsers function
- [x] Add `const db = window.firebase.firestore();` to sendNotificationToFirestore function
- [x] Add `const db = window.firebase.firestore();` to loadRecentNotifications function
- [ ] Test the send-notification page to ensure users load and notifications can be sent without errors
- [ ] If issues persist, check Firebase initialization in firebase-init.js
