// damage-review-details.js
// Loads a damage report from sessionStorage and displays the details
document.addEventListener('DOMContentLoaded', async () => {
  console.log('damage-reports-details.js loaded');

  // Wait for Firebase to be initialized
  await window.firebaseInitPromise;
  const db = window.firebase.firestore();
  const auth = window.firebase.auth();

  // Retrieve the damage report from sessionStorage or URL parameter
  const damageReportJSON = sessionStorage.getItem('selectedDamageReport');
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get('reportId');
  
  let report;
  
  // Try to fetch from Firestore if reportId is in URL
  if (reportId) {
    try {
      console.log('Fetching damage report from Firestore:', reportId);
      const reportDoc = await db.collection('damage_reports').doc(reportId).get();
      
      if (!reportDoc.exists) {
        console.warn('Damage report not found in Firestore');
        document.getElementById('damage-customer-name').textContent = 'Report Not Found';
        document.getElementById('damage-full-report').textContent = 'The requested report does not exist.';
        return;
      }
      
      report = {
        reportId: reportDoc.id,
        ...reportDoc.data()
      };
      console.log('Loaded damage report from Firestore:', report);
      
      // Store in sessionStorage for future use
      sessionStorage.setItem('selectedDamageReport', JSON.stringify(report));
      
    } catch (error) {
      console.error('Error fetching damage report from Firestore:', error);
      document.getElementById('damage-customer-name').textContent = 'Error';
      document.getElementById('damage-full-report').textContent = 'Failed to load report from database';
      return;
    }
  } 
  // Fallback to sessionStorage
  else if (damageReportJSON) {
    try {
      report = JSON.parse(damageReportJSON);
      console.log('Loaded damage report from sessionStorage:', report);
    } catch (error) {
      console.error('Error parsing damage report data:', error);
      document.getElementById('damage-customer-name').textContent = 'Error';
      document.getElementById('damage-full-report').textContent = 'Failed to parse report data';
      return;
    }
  } 
  // No data available
  else {
    console.warn('No damage report data found in sessionStorage or URL');
    document.getElementById('damage-customer-name').textContent = 'No Data';
    document.getElementById('damage-full-report').textContent = 'Report not loaded. Please select a report from the damage reports list.';
    return;
  }

  try {
    console.log('Processing damage report:', report);

    // Populate the page with report data
    document.getElementById('damage-customer-name').textContent = report.customer || 'Unknown Customer';
    document.getElementById('damage-full-report').textContent = report.description || 'No report details provided.';
    document.getElementById('damage-report-date').textContent = `Reported on: ${report.date || 'Unknown Date'}`;
    
    // Update notification target information
    const targetCustomerName = document.getElementById('target-customer-name');
    const targetCustomerContact = document.getElementById('target-customer-contact');
    if (targetCustomerName) {
      targetCustomerName.innerHTML = `
        <span>${report.customer || 'Unknown Customer'}</span>
        <span class="material-symbols-outlined" style="font-size: 1rem; color: rgba(255,255,255,0.6);">arrow_forward</span>
      `;
    }
    if (targetCustomerContact) {
      targetCustomerContact.querySelector('span:last-child').textContent = report.contact || 'No contact info';
    }

    // Get status color
    const getStatusColor = (status) => {
      switch(status) {
        case 'Submitted': return '#3498db';
        case 'Under Review': return '#f39c12';
        case 'Resolved': return '#2ecc71';
        case 'Closed': return '#95a5a6';
        default: return '#3498db';
      }
    };

    // Add additional report information with status dropdown
    const reviewHeader = document.querySelector('.review-header');
    if (reviewHeader) {
      const contactInfo = document.createElement('div');
      contactInfo.className = 'text-muted';
      contactInfo.style.marginTop = '0.5rem';
      contactInfo.innerHTML = `
        <p style="margin: 0.25rem 0;"><strong>Contact:</strong> ${report.contact || 'N/A'}</p>
        <p style="margin: 0.25rem 0;"><strong>Location:</strong> ${report.location || 'N/A'}</p>
        <div style="margin: 0.5rem 0; display: flex; align-items: center; gap: 0.5rem;">
          <strong>Status:</strong>
          <select id="status-dropdown" style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--color-info-light); background: var(--color-white); color: ${getStatusColor(report.status)}; font-weight: 600; cursor: pointer;">
            <option value="Submitted" ${report.status === 'Submitted' ? 'selected' : ''}>Submitted</option>
            <option value="Under Review" ${report.status === 'Under Review' ? 'selected' : ''}>Under Review</option>
            <option value="Resolved" ${report.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
            <option value="Closed" ${report.status === 'Closed' ? 'selected' : ''}>Closed</option>
          </select>
        </div>
      `;
      reviewHeader.appendChild(contactInfo);

      // Handle status change
      const statusDropdown = document.getElementById('status-dropdown');
      statusDropdown.addEventListener('change', async (e) => {
        const newStatus = e.target.value;
        const oldStatus = report.status;
        
        try {
          // Update status color
          e.target.style.color = getStatusColor(newStatus);
          
          // Update Firestore
          await db.collection('damage_reports').doc(report.reportId).update({
            status: newStatus,
            statusUpdatedAt: new Date().toISOString(),
            statusUpdatedBy: auth.currentUser?.email || 'admin'
          });

          report.status = newStatus;
          console.log(`✅ Status updated from "${oldStatus}" to "${newStatus}"`);
          
          // Show success message
          showStatusUpdateToast(newStatus);
        } catch (error) {
          console.error('❌ Error updating status:', error);
          // Revert dropdown
          e.target.value = oldStatus;
          e.target.style.color = getStatusColor(oldStatus);
          alert('Failed to update status: ' + error.message);
        }
      });
    }

    // Display images from imageUrls field
    const mediaContainer = document.getElementById('damage-media-gallery');
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

    // Set up the admin notes/response functionality
    const showResponseFormBtn = document.getElementById('show-response-form-btn');
    const adminResponseForm = document.getElementById('admin-response-form');
    const cancelResponseBtn = document.getElementById('cancel-response-btn');
    const existingResponseContainer = document.getElementById('existing-response-container');
    const responseFormTitle = document.getElementById('response-form-title');
    const editResponseBtn = document.getElementById('edit-response-btn');
    const adminResponseText = document.getElementById('admin-response-text');
    // New for responder info
    let adminResponseTimestamp = null;
    if (adminResponseText) {
      adminResponseTimestamp = document.getElementById('admin-response-timestamp');
      if (!adminResponseTimestamp) {
        adminResponseTimestamp = document.createElement('small');
        adminResponseTimestamp.id = 'admin-response-timestamp';
        adminResponseTimestamp.className = 'text-muted';
        adminResponseText.parentNode && adminResponseText.parentNode.appendChild(adminResponseTimestamp);
      }
    }

    // Check if admin notes exist
    if (report.adminResponse) {
      // Show existing response
      existingResponseContainer.style.display = 'block';
      if (adminResponseText) adminResponseText.textContent = report.adminResponse;
      // Show responder info
      let responder = report.adminResponseUpdatedBy || 'admin';
      let respondedAt = report.adminResponseUpdatedAt ? new Date(report.adminResponseUpdatedAt).toLocaleString() : '';
      if (adminResponseTimestamp) adminResponseTimestamp.textContent = respondedAt ? `Responded by ${responder} on ${respondedAt}` : '';
      showResponseFormBtn.style.display = 'none';
    } else {
      // Show "Respond" button
      showResponseFormBtn.style.display = 'block';
      existingResponseContainer.style.display = 'none';
      if (adminResponseTimestamp) adminResponseTimestamp.textContent = '';
    }

    // Show form to add new note
    showResponseFormBtn.addEventListener('click', () => {
      if (responseFormTitle) {
        responseFormTitle.textContent = 'Respond to Customer';
      }
      document.getElementById('response-textarea').value = '';
      showResponseFormBtn.style.display = 'none';
      adminResponseForm.style.display = 'block';
    });

    // Show form to edit existing note
    if (editResponseBtn) {
      editResponseBtn.addEventListener('click', () => {
        if (responseFormTitle) {
          responseFormTitle.textContent = 'Edit Response to Customer';
        }
        document.getElementById('response-textarea').value = report.adminResponse || '';
        existingResponseContainer.style.display = 'none';
        adminResponseForm.style.display = 'block';
      });
    }

    // Cancel editing
    cancelResponseBtn.addEventListener('click', () => {
      adminResponseForm.style.display = 'none';
      if (report.adminResponse) {
        existingResponseContainer.style.display = 'block';
      } else {
        showResponseFormBtn.style.display = 'block';
      }
    });

    // Handle form submission
    adminResponseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const responseText = document.getElementById('response-textarea').value.trim();
      if (!responseText) {
        alert('Please enter a response before submitting.');
        return;
      }
      // Disable submit button
      const submitBtn = adminResponseForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
      try {
        // Save to Firestore
        const now = new Date();
        const responder = auth.currentUser?.email || 'admin';
        await db.collection('damage_reports').doc(report.reportId).update({
          adminResponse: responseText,
          adminResponseUpdatedAt: now.toISOString(),
          adminResponseUpdatedBy: responder
        });
        report.adminResponse = responseText;
        report.adminResponseUpdatedAt = now.toISOString();
        report.adminResponseUpdatedBy = responder;
        console.log('✅ Admin response saved successfully');
        // Update display
        adminResponseText.textContent = responseText;
        adminResponseTimestamp.textContent = `Responded by ${responder} on ${now.toLocaleString()}`;
        existingResponseContainer.style.display = 'block';
        adminResponseForm.style.display = 'none';
        adminResponseForm.reset();
        // Show success message
        showNotesUpdateToast();

        // --- Notify customer ---
        // Helper to get customer ID from name (copied from appointments.js)
        async function getCustomerIdFromName(customerName) {
          try {
            if (!customerName || typeof customerName !== 'string') {
              return null;
            }
            const usersSnapshot = await db.collection('users')
              .where('fullName', '==', customerName.trim())
              .where('role', '!=', 'admin')
              .limit(1)
              .get();
            if (usersSnapshot.empty) {
              console.warn(`⚠️ No customer found with name: ${customerName}`);
              return null;
            }
            return usersSnapshot.docs[0].id;
          } catch (error) {
            console.error(`❌ Error looking up customer ID: ${error.message}`);
            return null;
          }
        }

        // Send notification if possible
        if (window.NotificationService && typeof window.NotificationService.sendNotification === 'function') {
          const customerName = report.customer || report.customerName || report.fullName;
          const customerId = await getCustomerIdFromName(customerName);
          if (customerId) {
            try {
              await window.NotificationService.sendNotification({
                recipientIds: [customerId],
                title: 'Admin Responded to Your Damage Report',
                body: 'An admin has responded to your damage report. Tap to chat with us.',
                type: 'damage_report_response',
                data: {
                  reportId: report.reportId,
                  response: responseText,
                  action: 'open_chat',
                  chatTarget: 'admin',
                  // Optionally, add a deep link or page reference for the app to handle
                  deepLink: '/chats.html'
                }
              });
              console.log('✅ Customer notified of admin response (with chat link)');
            } catch (notifyErr) {
              console.error('❌ Failed to send notification to customer:', notifyErr);
            }
          } else {
            console.warn('⚠️ Could not notify customer: ID not found');
          }
        } else {
          console.warn('NotificationService not available');
        }
      } catch (error) {
        console.error('❌ Error saving admin response:', error);
        alert('Failed to save admin response: ' + error.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });

    // Add image lightbox functionality
    const mediaContainerForLightbox = document.querySelector('.media-container');
    if (mediaContainerForLightbox) {
      mediaContainerForLightbox.addEventListener('click', (e) => {
        const img = e.target.closest('.damage-media-image');
        if (img) {
          showImageLightbox(img.src);
        }
      });
    }

  } catch (error) {
    console.error('Error parsing damage report data:', error);
    document.getElementById('damage-customer-name').textContent = 'Error';
    document.getElementById('damage-full-report').textContent = 'Failed to load report';
  }

  // --- Helper Functions ---

  // Show status update toast
  function showStatusUpdateToast(status) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 0.5rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    `;
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span class="material-symbols-outlined">check_circle</span>
        <div>
          <strong>Status Updated</strong>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem;">Report status changed to: <strong>${status}</strong></p>
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Show notes update toast
  function showNotesUpdateToast() {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 0.5rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    `;
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span class="material-symbols-outlined">check_circle</span>
        <div>
          <strong>Admin Notes Saved</strong>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem;">Your notes have been saved successfully.</p>
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Show image lightbox
  function showImageLightbox(imageSrc) {
    const lightbox = document.createElement('div');
    lightbox.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      cursor: pointer;
      animation: fadeIn 0.3s ease-out;
    `;

    const img = document.createElement('img');
    img.src = imageSrc;
    img.style.cssText = `
      max-width: 90%;
      max-height: 90%;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
    closeBtn.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: white;
      color: black;
      border: none;
      border-radius: 50%;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 24px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: transform 0.2s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.transform = 'scale(1.1)';
    closeBtn.onmouseout = () => closeBtn.style.transform = 'scale(1)';

    lightbox.appendChild(img);
    lightbox.appendChild(closeBtn);
    document.body.appendChild(lightbox);

    const closeLightbox = () => {
      lightbox.style.animation = 'fadeOut 0.3s ease-in';
      setTimeout(() => lightbox.remove(), 300);
    };

    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target === closeBtn || e.target.parentElement === closeBtn) {
        closeLightbox();
      }
    });

    // Add keyboard support
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeLightbox();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }
});
