// damage-review-details.js
// Loads a damage report from sessionStorage and displays the details
document.addEventListener('DOMContentLoaded', async () => {
  console.log('damage-reports-details.js loaded');

  // Wait for Firebase to be initialized
  await window.firebaseInitPromise;
  const db = window.firebase.firestore();
  const auth = window.firebase.auth();

  // Retrieve the damage report from sessionStorage
  const damageReportJSON = sessionStorage.getItem('selectedDamageReport');
  
  if (!damageReportJSON) {
    console.warn('No damage report data found in sessionStorage');
    document.getElementById('damage-customer-name').textContent = 'No Data';
    document.getElementById('damage-full-report').textContent = 'Report not loaded';
    return;
  }

  let report;
  try {
    report = JSON.parse(damageReportJSON);
    console.log('Loaded damage report:', report);

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

    // Set up the admin notes/response functionality
    const showResponseFormBtn = document.getElementById('show-response-form-btn');
    const adminResponseForm = document.getElementById('admin-response-form');
    const cancelResponseBtn = document.getElementById('cancel-response-btn');
    const existingResponseContainer = document.getElementById('existing-response-container');
    const responseFormTitle = document.getElementById('response-form-title');
    const editResponseBtn = document.getElementById('edit-response-btn');
    const adminResponseText = document.getElementById('admin-response-text');

    // Check if admin notes exist
    if (report.adminNotes) {
      // Show existing response
      existingResponseContainer.style.display = 'block';
      adminResponseText.textContent = report.adminNotes;
      showResponseFormBtn.style.display = 'none';
    } else {
      // Show "Respond" button
      showResponseFormBtn.style.display = 'block';
      existingResponseContainer.style.display = 'none';
    }

    // Show form to add new note
    showResponseFormBtn.addEventListener('click', () => {
      responseFormTitle.textContent = 'Add Admin Notes';
      document.getElementById('response-textarea').value = '';
      showResponseFormBtn.style.display = 'none';
      adminResponseForm.style.display = 'block';
    });

    // Show form to edit existing note
    if (editResponseBtn) {
      editResponseBtn.addEventListener('click', () => {
        responseFormTitle.textContent = 'Edit Admin Notes';
        document.getElementById('response-textarea').value = report.adminNotes || '';
        existingResponseContainer.style.display = 'none';
        adminResponseForm.style.display = 'block';
      });
    }

    // Cancel editing
    cancelResponseBtn.addEventListener('click', () => {
      adminResponseForm.style.display = 'none';
      if (report.adminNotes) {
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
        alert('Please enter admin notes before submitting.');
        return;
      }

      // Disable submit button
      const submitBtn = adminResponseForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      try {
        // Save to Firestore
        await db.collection('damage_reports').doc(report.reportId).update({
          adminNotes: responseText,
          adminNotesUpdatedAt: new Date().toISOString(),
          adminNotesUpdatedBy: auth.currentUser?.email || 'admin'
        });

        report.adminNotes = responseText;
        console.log('✅ Admin notes saved successfully');

        // Update display
        adminResponseText.textContent = responseText;
        existingResponseContainer.style.display = 'block';
        adminResponseForm.style.display = 'none';
        adminResponseForm.reset();

        // Show success message
        showNotesUpdateToast();

      } catch (error) {
        console.error('❌ Error saving admin notes:', error);
        alert('Failed to save admin notes: ' + error.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });

    // Add image lightbox functionality
    const mediaContainer = document.querySelector('.media-container');
    if (mediaContainer) {
      mediaContainer.addEventListener('click', (e) => {
        const img = e.target.closest('.damage-media-image');
        if (img) {
          showImageLightbox(img.src);
        }
      });
    }

    // Setup notification sending
    setupNotificationSending(report);

    // Load notification history
    loadNotificationHistory(report.reportId);

  } catch (error) {
    console.error('Error parsing damage report data:', error);
    document.getElementById('damage-customer-name').textContent = 'Error';
    document.getElementById('damage-full-report').textContent = 'Failed to load report';
  }

  // --- Helper Functions ---

  // Setup notification sending
  function setupNotificationSending(report) {
    const form = document.getElementById('send-notification-form');
    if (!form) return;

    const messageInput = document.getElementById('notification-message');
    const charCount = document.getElementById('char-count');

    // Character counter and preview
    const messagePreview = document.getElementById('message-preview');
    const previewText = document.getElementById('preview-text');
    let previewTimeout = null;
    
    if (messageInput && charCount) {
      messageInput.addEventListener('input', () => {
        const length = messageInput.value.length;
        const message = messageInput.value.trim();
        charCount.textContent = `${length}/500`;
        
        // Update color based on length
        if (length > 450) {
          charCount.style.background = '#fef3c7';
          charCount.style.color = '#92400e';
        } else if (length > 0) {
          charCount.style.background = '#dbeafe';
          charCount.style.color = '#1e40af';
        } else {
          charCount.style.background = 'var(--color-white)';
          charCount.style.color = 'var(--color-info-dark)';
        }

        // Show/hide preview with debounce
        clearTimeout(previewTimeout);
        
        if (message.length > 15 && messagePreview && previewText) {
          // Debounce preview update for better performance
          previewTimeout = setTimeout(() => {
            previewText.textContent = message;
            
            if (messagePreview.style.display === 'none') {
              messagePreview.style.display = 'block';
              messagePreview.style.animation = 'slideDown 0.3s ease-out';
            }
          }, 300);
        } else if (messagePreview) {
          messagePreview.style.display = 'none';
        }
      });

      // Focus effect
      messageInput.addEventListener('focus', () => {
        messageInput.style.borderColor = 'var(--color-primary)';
        messageInput.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.1)';
      });
      messageInput.addEventListener('blur', () => {
        messageInput.style.borderColor = 'var(--color-info-light)';
        messageInput.style.boxShadow = 'none';
      });
    }

    // Template buttons
    const templateBtns = document.querySelectorAll('.template-btn');
    templateBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const template = btn.getAttribute('data-template');
        messageInput.value = template;
        messageInput.dispatchEvent(new Event('input'));
        messageInput.focus();
        
        // Animate button
        btn.style.transform = 'scale(0.95)';
        btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        setTimeout(() => {
          btn.style.transform = 'scale(1)';
          btn.style.boxShadow = 'none';
        }, 150);
      });

      // Hover effect
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-3px) scale(1.02)';
        btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0) scale(1)';
        btn.style.boxShadow = 'none';
      });
    });

    // Refresh history button
    const refreshBtn = document.getElementById('refresh-history-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.style.transform = 'rotate(360deg)';
        refreshBtn.style.transition = 'transform 0.6s ease';
        await loadNotificationHistory(report.reportId);
        setTimeout(() => {
          refreshBtn.style.transform = 'rotate(0deg)';
        }, 600);
      });

      refreshBtn.addEventListener('mouseenter', () => {
        refreshBtn.style.background = 'var(--color-light)';
      });
      refreshBtn.addEventListener('mouseleave', () => {
        refreshBtn.style.background = 'transparent';
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const messageInput = document.getElementById('notification-message');
      const message = messageInput.value.trim();

      if (!message) {
        alert('Please enter a message');
        return;
      }

      if (!report.userId) {
        alert('Cannot send notification: User ID not found for this report');
        return;
      }

      // Disable form
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnHTML = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Sending...';
      messageInput.disabled = true;

      try {
        const currentUser = auth.currentUser;
        const notificationData = {
          userId: report.userId,
          title: 'Damage Report Update',
          message: message,
          category: 'damage_report',
          imageUrl: report.imageUrls && report.imageUrls.length > 0 ? report.imageUrls[0] : null,
          data: {
            type: 'damage_report',
            reportId: report.reportId,
            status: report.status
          },
          createdAt: new Date().toISOString(),
          sentBy: currentUser?.email || 'admin',
          read: false
        };

        console.log('📤 Sending notification to user:', report.userId);

        // Create batch for atomic write
        const batch = db.batch();

        // Add to user's notifications subcollection
        const userNotificationRef = db.collection('users').doc(report.userId).collection('notifications').doc();
        batch.set(userNotificationRef, notificationData);

        // Add to admin_notifications collection for tracking
        const adminNotificationRef = db.collection('admin_notifications').doc(userNotificationRef.id);
        batch.set(adminNotificationRef, {
          ...notificationData,
          notificationId: userNotificationRef.id
        });

        // Commit batch
        await batch.commit();

        console.log('✅ Notification saved to Firestore');

        // Try to send push notification
        try {
          // Check if user has FCM token
          const userDoc = await db.collection('users').doc(report.userId).get();
          const fcmToken = userDoc.exists ? userDoc.data().fcmToken : null;

          if (fcmToken) {
            console.log('📱 Sending push notification via Cloud Function...');
            
            const cloudFunctionUrl = 'https://us-central1-kingsleycarwashapp.cloudfunctions.net/sendNotificationToUser';
            const response = await fetch(cloudFunctionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: report.userId,
                title: notificationData.title,
                body: notificationData.message,
                imageUrl: notificationData.imageUrl,
                data: notificationData.data
              })
            });

            if (response.ok) {
              console.log('✅ Push notification sent successfully');
            } else {
              console.warn('⚠️ Push notification failed, but notification saved in database');
            }
          } else {
            console.log('ℹ️ User has no FCM token, notification saved in database only');
          }
        } catch (pushError) {
          console.warn('⚠️ Push notification error:', pushError.message);
        }

        // Show success message
        showNotificationSuccessToast();

        // Clear form
        messageInput.value = '';

        // Reload notification history
        await loadNotificationHistory(report.reportId);

      } catch (error) {
        console.error('❌ Error sending notification:', error);
        alert('Failed to send notification: ' + error.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
        messageInput.disabled = false;
      }
    });
  }

  // Load notification history
  async function loadNotificationHistory(reportId) {
    const historyList = document.getElementById('notification-history-list');
    if (!historyList) return;

    try {
      // Query admin_notifications for this report
      const snapshot = await db.collection('admin_notifications')
        .where('data.reportId', '==', reportId)
        .orderBy('createdAt', 'desc')
        .limit(15)
        .get();

      if (snapshot.empty) {
        historyList.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem; color: var(--color-info-dark);">
            <span class="material-symbols-outlined" style="font-size: 3rem; opacity: 0.3; display: block; margin-bottom: 0.5rem;">notifications_off</span>
            <p style="margin: 0; font-size: 0.875rem;">No notifications sent yet</p>
            <small style="opacity: 0.7;">Send your first notification above</small>
          </div>
        `;
        return;
      }

      historyList.innerHTML = '';
      
      snapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        const date = new Date(data.createdAt);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let timeAgo;
        if (diffMins < 1) timeAgo = 'Just now';
        else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
        else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
        else if (diffDays < 7) timeAgo = `${diffDays}d ago`;
        else timeAgo = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const item = document.createElement('div');
        item.style.cssText = `
          padding: 1rem;
          background: ${index === 0 ? 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' : 'var(--color-white)'};
          border: 1px solid ${index === 0 ? 'var(--color-primary)' : 'var(--color-info-light)'};
          border-left: 4px solid var(--color-primary);
          margin-bottom: 0.75rem;
          border-radius: 8px;
          transition: all 0.2s;
          cursor: pointer;
          position: relative;
        `;
        
        if (index === 0) {
          item.innerHTML = `
            <div style="position: absolute; top: 0.5rem; right: 0.5rem; background: var(--color-primary); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.65rem; font-weight: 600;">
              LATEST
            </div>
          `;
        }

        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="material-symbols-outlined" style="font-size: 1.25rem; color: var(--color-primary);">notifications</span>
              <strong style="font-size: 0.9rem; color: var(--color-dark);">${data.title}</strong>
            </div>
            <span style="font-size: 0.75rem; color: var(--color-info-dark); font-weight: 500;">${timeAgo}</span>
          </div>
          <p style="margin: 0.5rem 0 0.5rem 2rem; font-size: 0.875rem; color: var(--color-dark); line-height: 1.5;">${data.message}</p>
          <div style="display: flex; align-items: center; gap: 1rem; margin-left: 2rem; margin-top: 0.5rem;">
            <small style="font-size: 0.75rem; color: var(--color-info-dark); display: flex; align-items: center; gap: 0.25rem;">
              <span class="material-symbols-outlined" style="font-size: 0.875rem;">person</span>
              ${data.sentBy}
            </small>
            <small style="font-size: 0.75rem; color: var(--color-success); display: flex; align-items: center; gap: 0.25rem;">
              <span class="material-symbols-outlined" style="font-size: 0.875rem;">check_circle</span>
              Delivered
            </small>
          </div>
        `;
        
        item.appendChild(contentDiv);

        // Hover effect
        item.addEventListener('mouseenter', () => {
          item.style.transform = 'translateX(4px)';
          item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.transform = 'translateX(0)';
          item.style.boxShadow = 'none';
        });

        historyList.appendChild(item);
      });

    } catch (error) {
      console.error('❌ Error loading notification history:', error);
      historyList.innerHTML = `
        <p class="text-muted" style="text-align: center; padding: 1rem; color: #e74c3c;">
          Error loading history
        </p>
      `;
    }
  }

  // Show notification success toast
  function showNotificationSuccessToast() {
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
          <strong>Notification Sent!</strong>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem;">Customer will receive your message</p>
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

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
