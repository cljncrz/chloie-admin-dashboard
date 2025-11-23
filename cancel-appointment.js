document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('cancel-appointment-form');
  const summaryEl = document.getElementById('cancel-appointment-summary');
  const reasonSelect = document.getElementById('cancel-reason');
  const notesInput = document.getElementById('cancel-notes');

  // Read appointmentToCancel from sessionStorage
  let stored = null;
  try {
    stored = sessionStorage.getItem('appointmentToCancel');
  } catch (e) {
    console.error('Could not read sessionStorage:', e);
  }

  if (!stored) {
    summaryEl.textContent = 'No appointment selected. Go back to Appointments.';
    return;
  }

  let payload = null;
  try {
    payload = JSON.parse(stored);
  } catch (e) {
    console.error('Invalid appointmentToCancel payload', e);
    summaryEl.textContent = 'Invalid appointment data. Go back to Appointments.';
    return;
  }

  const appointment = payload.appointment || null;
  const originalStatus = payload.originalStatus || null;

  if (!appointment) {
    summaryEl.textContent = 'No appointment selected. Go back to Appointments.';
    return;
  }

  // Show a short summary
  const apptSummary = [];
  if (appointment.customer) apptSummary.push(appointment.customer);
  if (appointment.serviceNames || appointment.service) apptSummary.push(appointment.serviceNames || appointment.service);
  if (appointment.datetime) apptSummary.push(appointment.datetime);
  summaryEl.textContent = apptSummary.join(' — ');

  // Handle submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const reason = reasonSelect.value || '';
    const notes = notesInput.value || '';

    if (!reason) {
      if (typeof showSuccessToast === 'function') showSuccessToast('Please select a cancellation reason', 'error');
      else alert('Please select a cancellation reason');
      return;
    }

    try {
      const db = window.firebase.firestore();
      // Determine document id: for bookings it's appointment.serviceId
      const docId = appointment.serviceId || appointment.id || appointment.bookingId;
      if (!docId) {
        throw new Error('Could not determine booking id for appointment');
      }

      await db.collection('bookings').doc(docId).update({
        status: 'Cancelled',
        cancelledAt: window.firebase.firestore().FieldValue.serverTimestamp(),
        cancellationReason: reason,
        cancellationNotes: notes,
        cancelledBy: (window.currentUserFullName || null)
      });

      // Update local data if present
      if (window.appData && Array.isArray(window.appData.appointments)) {
        window.appData.appointments = window.appData.appointments.map(a => a.serviceId === docId ? ({ ...a, status: 'Cancelled', cancelledAt: new Date().toISOString(), cancellationReason: reason, cancellationNotes: notes, cancelledBy: (window.currentUserFullName || null) }) : a);
      }

      // If technician tasks need decrementing, do it locally
      if (appointment.technician && (originalStatus === 'Pending' || originalStatus === 'In Progress')) {
        if (window.appData && Array.isArray(window.appData.technicians)) {
          const tech = window.appData.technicians.find(t => t.name === appointment.technician);
          if (tech && typeof tech.tasks === 'number' && tech.tasks > 0) tech.tasks--;
        }
      }

      // Try to send notification if NotificationService exists
      try {
        if (typeof NotificationService !== 'undefined' && typeof NotificationService.notifyAppointmentCancelled === 'function') {
          // Try to resolve customer id similar to appointments.js
          const customerName = appointment.customer || appointment.customerName || appointment.fullName;
          if (customerName) {
            try {
              const usersSnapshot = await db.collection('users').where('fullName', '==', customerName.trim()).where('role', '!=', 'admin').limit(1).get();
              if (!usersSnapshot.empty) {
                const customerId = usersSnapshot.docs[0].id;
                await NotificationService.notifyAppointmentCancelled(customerId, {
                  id: docId,
                  serviceName: appointment.serviceNames || appointment.service,
                  reason: reason
                });
              }
            } catch (nerr) {
              console.warn('Could not send notification to mobile user:', nerr);
            }
          }
        }
      } catch (nerr) {
        console.warn('Notification attempt failed:', nerr);
      }

      // Clear session storage and go back to appointments page
      try { sessionStorage.removeItem('appointmentToCancel'); } catch (e) {}
      if (typeof showSuccessToast === 'function') showSuccessToast('Appointment cancelled.');
      // Redirect back to appointments page
      setTimeout(() => { window.location.href = 'appointment.html'; }, 700);
    } catch (err) {
      console.error('Error cancelling appointment on cancel page:', err);
      if (typeof showSuccessToast === 'function') showSuccessToast('Failed to cancel appointment (database error).', 'error');
    }
  });

});