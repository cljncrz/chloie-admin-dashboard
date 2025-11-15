document.addEventListener('DOMContentLoaded', async () => {
  // Ensure Firebase is initialized before running Firestore code
  await window.firebaseInitPromise;
  const db = firebase.firestore();

  const rescheduleTbody = document.getElementById('reschedule-requests-tbody');
  const rescheduleLoader = document.querySelector(
    '#reschedule-requests-container .table-loader'
  );

  if (!rescheduleTbody) {
    console.error('Reschedule requests table body not found!');
    return;
  }

  function renderRescheduleRequests(requests) {
    rescheduleTbody.innerHTML = ''; // Clear existing rows

    if (requests.length === 0) {
      rescheduleTbody.innerHTML = `
              <tr>
                <td colspan="5" class="text-center text-muted">No reschedule requests found.</td>
              </tr>
            `;
      return;
    }

    requests.forEach((request) => {
      const originalDate = request.originalDate.toDate().toLocaleString();
      const requestedDate = request.requestedDate.toDate().toLocaleString();

      const row = document.createElement('tr');
      row.innerHTML = `
              <td>${request.id}</td>
              <td>${originalDate}</td>
              <td>${requestedDate}</td>
              <td>${request.reason}</td>
              <td class="text-center">
                <button class="btn-primary-outline btn-sm">Approve</button>
                <button class="btn-danger-outline btn-sm">Deny</button>
              </td>
            `;
      rescheduleTbody.appendChild(row);
    });
  }

  async function listenForRescheduleRequests() {
    if (rescheduleLoader) rescheduleLoader.style.display = 'block';

    try {
      // Get all bookings first
      const bookingsSnapshot = await db.collection('bookings').get();
      
      if (bookingsSnapshot.empty) {
        renderRescheduleRequests([]);
        if (rescheduleLoader) rescheduleLoader.style.display = 'none';
        return;
      }

      const allRequests = [];

      // For each booking, get its rescheduleRequests from the top-level collection
      for (const bookingDoc of bookingsSnapshot.docs) {
        const rescheduleSnapshot = await db.collection('rescheduleRequestID').where('bookingId', '==', bookingDoc.id).get();

        rescheduleSnapshot.docs.forEach((doc) => {
          allRequests.push({
            id: doc.id,
            bookingId: bookingDoc.id,
            ...doc.data()
          });
        });
      }

      renderRescheduleRequests(allRequests);
      if (rescheduleLoader) rescheduleLoader.style.display = 'none';
    } catch (error) {
      console.error('Error fetching reschedule requests: ', error);
      rescheduleTbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${error.message}</td></tr>`;
      if (rescheduleLoader) rescheduleLoader.style.display = 'none';
    }
  }

  listenForRescheduleRequests();
});