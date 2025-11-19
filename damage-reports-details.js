// damage-review-details.js
// Loads a damage report from sessionStorage and displays the details
document.addEventListener('DOMContentLoaded', () => {
  console.log('damage-reports-details.js loaded');

  // Retrieve the damage report from sessionStorage
  const damageReportJSON = sessionStorage.getItem('selectedDamageReport');
  
  if (!damageReportJSON) {
    console.warn('No damage report data found in sessionStorage');
    document.getElementById('damage-customer-name').textContent = 'No Data';
    document.getElementById('damage-service-name').textContent = 'Report not loaded';
    return;
  }

  try {
    const report = JSON.parse(damageReportJSON);
    console.log('Loaded damage report:', report);

    // Populate the page with report data
    document.getElementById('damage-customer-name').textContent = report.customer || 'Unknown Customer';
    document.getElementById('damage-full-report').textContent = report.reportText || 'No report details provided.';
    document.getElementById('damage-report-date').textContent = `Reported on: ${report.date || 'Unknown Date'}`;

    // Display images from imageUrls field
    const mediaContainer = document.querySelector('.media-container');
    if (report.imageUrls && Array.isArray(report.imageUrls) && report.imageUrls.length > 0) {
      // Clear the placeholder
      mediaContainer.innerHTML = '';
      
      // Set up grid layout for multiple images
      mediaContainer.style.display = 'grid';
      mediaContainer.style.gridTemplateColumns = report.imageUrls.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))';
      mediaContainer.style.gap = '1rem';
      
      // Create image elements for each URL
      report.imageUrls.forEach((imageUrl, index) => {
        const imgElement = document.createElement('img');
        imgElement.src = imageUrl;
        imgElement.alt = `Damage report image ${index + 1}`;
        imgElement.classList.add('damage-media-image');
        imgElement.style.width = '100%';
        imgElement.style.height = '250px';
        imgElement.style.objectFit = 'cover';
        imgElement.style.borderRadius = '8px';
        imgElement.style.cursor = 'pointer';
        
        // Optional: Add click to open in new tab
        imgElement.addEventListener('click', () => {
          window.open(imageUrl, '_blank');
        });
        
        mediaContainer.appendChild(imgElement);
      });
    } else {
      // Keep the placeholder if no images
      console.log('No images found for this damage report');
    }

    // Set up the "Respond to Customer" button
    const showResponseFormBtn = document.getElementById('show-response-form-btn');
    const adminResponseForm = document.getElementById('admin-response-form');
    const cancelResponseBtn = document.getElementById('cancel-response-btn');
    const existingResponseContainer = document.getElementById('existing-response-container');

    if (showResponseFormBtn && adminResponseForm) {
      // Show the "Respond" button if no response exists yet
      showResponseFormBtn.style.display = 'block';

      showResponseFormBtn.addEventListener('click', () => {
        showResponseFormBtn.style.display = 'none';
        adminResponseForm.style.display = 'block';
      });

      cancelResponseBtn.addEventListener('click', () => {
        adminResponseForm.style.display = 'none';
        showResponseFormBtn.style.display = 'block';
      });

      // Handle form submission (placeholder - can be wired to Firestore later)
      adminResponseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const responseText = document.getElementById('response-textarea').value.trim();
        
        if (!responseText) {
          console.warn('Response text is empty');
          return;
        }

        console.log('Response submitted:', responseText);
        // TODO: Save response to Firestore and display it
        
        // For now, just show success and hide the form
        if (typeof showSuccessToast === 'function') {
          showSuccessToast('Response submitted successfully.');
        }
        
        adminResponseForm.reset();
        adminResponseForm.style.display = 'none';
        showResponseFormBtn.style.display = 'block';
      });
    }

  } catch (error) {
    console.error('Error parsing damage report data:', error);
    document.getElementById('damage-customer-name').textContent = 'Error';
    document.getElementById('damage-service-name').textContent = 'Failed to load report';
  }
});
