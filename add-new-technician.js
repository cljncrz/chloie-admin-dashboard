document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Firebase to be initialized
  await window.firebaseInitPromise;

  const db = window.firebase.firestore();
  // const storage = window.firebase.storage(); // No longer needed

  // --- DOM Elements ---
  const form = document.getElementById('add-technician-form');
  const nameInput = document.getElementById('technician-name');
  const descriptionInput = document.getElementById('technician-description');
  const avatarInput = document.getElementById('technician-avatar-input');
  const avatarPreview = document.getElementById('avatar-preview-img');
  const successToast = document.getElementById('success-toast');

  let selectedFile = null;
  let selectedBase64 = null;

  // --- Avatar Upload Handler ---
  avatarInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = (event) => {
        avatarPreview.src = event.target.result;
        selectedBase64 = event.target.result; // Store base64 string
      };
      reader.readAsDataURL(file);
    } else {
      selectedBase64 = null;
    }
  });

  // --- Form Submission ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!name) {
      alert('Please enter a technician name.');
      return;
    }

    try {
      let photoURL = './images/redicon.png'; // Default avatar
      if (selectedBase64) {
        photoURL = selectedBase64;
      }

      // Create technician document
      const technicianData = {
        name,
        description,
        photoURL,
        status: 'Active',
        rating: 0,
        reviews: 0,
        appointments: 0,
        createdAt: new Date(),
      };

      await db.collection('technicians').add(technicianData);

      // Show success message
      showSuccessToast('Technician created successfully!');

      // Clear form
      form.reset();
      avatarPreview.src = './images/redicon.png';
      selectedFile = null;
      selectedBase64 = null;

      // Redirect to technicians page after 1.5 seconds
      setTimeout(() => {
        window.location.href = 'technicians.html';
      }, 1500);
    } catch (error) {
      console.error('Error creating technician:', error);
      alert('Error creating technician. Please try again.');
    }
  });

  // --- Helper Functions ---
  const showSuccessToast = (message) => {
    const toast = document.getElementById('success-toast');
    if (toast) {
      toast.querySelector('p').textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  };
});
