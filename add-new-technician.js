document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Firebase to be initialized
  await window.firebaseInitPromise;

  const db = window.firebase.firestore();
  const storage = window.firebase.storage();

  // --- DOM Elements ---
  const form = document.getElementById('add-technician-form');
  const nameInput = document.getElementById('technician-name');
  const descriptionInput = document.getElementById('technician-description');
  const avatarInput = document.getElementById('technician-avatar-input');
  const avatarPreview = document.getElementById('avatar-preview-img');
  const successToast = document.getElementById('success-toast');

  let selectedFile = null;

  // --- Avatar Upload Handler ---
  avatarInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = (event) => {
        avatarPreview.src = event.target.result;
      };
      reader.readAsDataURL(file);
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
      let avatarUrl = './images/redicon.png'; // Default avatar

      // Upload avatar if selected
      if (selectedFile) {
        const fileName = `technician-pictures/${Date.now()}_${selectedFile.name}`;
        const storageRef = storage.ref(fileName);
        await storageRef.put(selectedFile);
        avatarUrl = await storageRef.getDownloadURL();
      }

      // Create technician document
      const technicianData = {
        name,
        description,
        avatar: avatarUrl,
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
