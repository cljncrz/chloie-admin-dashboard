/**
 * Notification Service
 * Utility module for sending notifications from the admin dashboard to mobile app users
 * 
 * Usage:
 *   import { NotificationService } from './notificationService.js';
 *   
 *   // Send single notification
 *   await NotificationService.sendNotification(userId, {
 *     title: 'Appointment Confirmed',
 *     body: 'Your appointment has been confirmed',
 *     type: 'appointment_confirmed'
 *   });
 *   
 *   // Send bulk notification
 *   await NotificationService.sendBulkNotification([userId1, userId2], {
 *     title: 'New Promotion',
 *     body: 'Check out our latest promotion!',
 *     type: 'promotion'
 *   });
 */

class NotificationService {
  /**
   * Base URL for the backend server
   */
  static BASE_URL = 'http://localhost:5000';

  /**
   * Send notification to a single user
   * @param {string} userId - The user ID to notify
   * @param {Object} options - Notification options
   * @param {string} options.title - Notification title
   * @param {string} options.body - Notification body/message
   * @param {string} options.type - Notification type (appointment, payment, review, promotion, etc.)
   * @param {Object} options.data - Additional data to include (optional)
   * @param {string} options.imageUrl - Image URL for notification (optional)
   * @returns {Promise<Object>} Response from server
   */
  static async sendNotification(userId, options = {}) {
    const { title, body, type, data = {}, imageUrl } = options;

    // Validate required fields
    if (!userId || !title || !body || !type) {
      throw new Error('Missing required fields: userId, title, body, type');
    }

    try {
      const response = await fetch(`${this.BASE_URL}/api/notifications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          title,
          body,
          type,
          data,
          imageUrl: imageUrl || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send notification');
      }

      const result = await response.json();
      console.log('✅ Notification sent:', result);
      return result;

    } catch (error) {
      console.error('❌ Error sending notification:', error.message);
      throw error;
    }
  }

  /**
   * Send notification to multiple users
   * @param {string[]} userIds - Array of user IDs
   * @param {Object} options - Notification options
   * @param {string} options.title - Notification title
   * @param {string} options.body - Notification body/message
   * @param {string} options.type - Notification type
   * @param {Object} options.data - Additional data (optional)
   * @param {string} options.imageUrl - Image URL (optional)
   * @returns {Promise<Object>} Response from server
   */
  static async sendBulkNotification(userIds = [], options = {}) {
    const { title, body, type, data = {}, imageUrl } = options;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('userIds must be a non-empty array');
    }

    if (!title || !body || !type) {
      throw new Error('Missing required fields: title, body, type');
    }

    try {
      // Send individual notifications to each user
      const promises = userIds.map(userId =>
        this.sendNotification(userId, { title, body, type, data, imageUrl })
          .catch(err => ({
            userId,
            success: false,
            error: err.message
          }))
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success !== false).length;
      const failureCount = results.filter(r => r.success === false).length;

      console.log(`📢 Bulk notifications sent to ${userIds.length} users (${successCount} success, ${failureCount} failed)`);

      return {
        success: true,
        totalUsers: userIds.length,
        successCount,
        failureCount,
        results
      };

    } catch (error) {
      console.error('❌ Error sending bulk notifications:', error.message);
      throw error;
    }
  }

  /**
   * Notify customer of appointment confirmation
   * @param {string} customerId - Customer ID
   * @param {Object} appointmentData - Appointment details
   * @param {string} appointmentData.id - Appointment ID
   * @param {string} appointmentData.serviceName - Service name
   * @param {string} appointmentData.dateTime - Appointment date/time
   * @param {string} appointmentData.technician - Assigned technician (optional)
   * @returns {Promise<Object>}
   */
  static async notifyAppointmentConfirmed(customerId, appointmentData = {}) {
    const { id, serviceName = 'Service', dateTime = '', technician = '' } = appointmentData;

    let body = `Your ${serviceName} appointment has been confirmed!`;
    if (dateTime) {
      body += ` Scheduled for ${dateTime}.`;
    }
    if (technician) {
      body += ` Your technician: ${technician}.`;
    }

    return this.sendNotification(customerId, {
      title: '✅ Appointment Confirmed',
      body,
      type: 'appointment_confirmed',
      data: {
        appointmentId: id,
        serviceName,
        action: 'view_appointment'
      }
    });
  }

  /**
   * Notify customer of appointment cancellation
   * @param {string} customerId - Customer ID
   * @param {Object} appointmentData - Appointment details
   * @returns {Promise<Object>}
   */
  static async notifyAppointmentCancelled(customerId, appointmentData = {}) {
    const { id, serviceName = 'Service', reason = '' } = appointmentData;

    let body = `Your ${serviceName} appointment has been cancelled.`;
    if (reason) {
      body += ` Reason: ${reason}`;
    }

    return this.sendNotification(customerId, {
      title: '❌ Appointment Cancelled',
      body,
      type: 'appointment_cancelled',
      data: {
        appointmentId: id,
        serviceName,
        action: 'view_appointment'
      }
    });
  }

  /**
   * Notify customer of appointment rescheduling
   * @param {string} customerId - Customer ID
   * @param {Object} appointmentData - Appointment details
   * @returns {Promise<Object>}
   */
  static async notifyAppointmentRescheduled(customerId, appointmentData = {}) {
    const { id, serviceName = 'Service', oldDateTime = '', newDateTime = '' } = appointmentData;

    let body = `Your ${serviceName} appointment has been rescheduled.`;
    if (newDateTime) {
      body += ` New time: ${newDateTime}.`;
    }

    return this.sendNotification(customerId, {
      title: '🔄 Appointment Rescheduled',
      body,
      type: 'appointment_rescheduled',
      data: {
        appointmentId: id,
        serviceName,
        action: 'view_appointment'
      }
    });
  }

  /**
   * Notify customer that service is in progress
   * @param {string} customerId - Customer ID
   * @param {Object} serviceData - Service details
   * @returns {Promise<Object>}
   */
  static async notifyServiceStarted(customerId, serviceData = {}) {
    const { id, serviceName = 'Service', technician = '' } = serviceData;

    let body = `Your ${serviceName} service has started.`;
    if (technician) {
      body += ` Your technician: ${technician}.`;
    }

    return this.sendNotification(customerId, {
      title: '⏳ Service In Progress',
      body,
      type: 'service_started',
      data: {
        appointmentId: id,
        serviceName,
        action: 'track_service'
      }
    });
  }

  /**
   * Notify customer that service is completed
   * @param {string} customerId - Customer ID
   * @param {Object} serviceData - Service details
   * @returns {Promise<Object>}
   */
  static async notifyServiceCompleted(customerId, serviceData = {}) {
    const { id, serviceName = 'Service' } = serviceData;

    return this.sendNotification(customerId, {
      title: '✨ Service Completed',
      body: `Your ${serviceName} service is complete. Thank you for choosing us!`,
      type: 'service_completed',
      data: {
        appointmentId: id,
        serviceName,
        action: 'rate_service'
      }
    });
  }

  /**
   * Notify customer of payment received
   * @param {string} customerId - Customer ID
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>}
   */
  static async notifyPaymentReceived(customerId, paymentData = {}) {
    const { id, amount = 0, serviceName = 'Service', method = 'Credit Card' } = paymentData;

    return this.sendNotification(customerId, {
      title: '💳 Payment Received',
      body: `Payment of $${parseFloat(amount).toFixed(2)} for ${serviceName} has been received. Thank you!`,
      type: 'payment_received',
      data: {
        paymentId: id,
        amount: amount.toString(),
        serviceName,
        method
      }
    });
  }

  /**
   * Notify customer of new review request
   * @param {string} customerId - Customer ID
   * @param {Object} reviewData - Review details
   * @returns {Promise<Object>}
   */
  static async notifyReviewRequest(customerId, reviewData = {}) {
    const { serviceName = 'Service', appointmentId = '' } = reviewData;

    return this.sendNotification(customerId, {
      title: '⭐ Rate Your Experience',
      body: `How was your ${serviceName} service? Please share your feedback!`,
      type: 'review_request',
      data: {
        appointmentId,
        serviceName,
        action: 'submit_review'
      }
    });
  }

  /**
   * Notify customers of new promotion
   * @param {string[]} customerIds - Array of customer IDs
   * @param {Object} promotionData - Promotion details
   * @returns {Promise<Object>}
   */
  static async notifyNewPromotion(customerIds = [], promotionData = {}) {
    const { id, title = 'New Promotion', description = '', discount = '', imageUrl = null } = promotionData;

    return this.sendBulkNotification(customerIds, {
      title: `🎉 ${title}`,
      body: description || 'Check out our latest promotion!',
      type: 'new_promotion',
      data: {
        promotionId: id,
        discount,
        action: 'view_promotion'
      },
      imageUrl
    });
  }

  /**
   * Notify customers of special announcement
   * @param {string[]} customerIds - Array of customer IDs
   * @param {Object} announcementData - Announcement details
   * @returns {Promise<Object>}
   */
  static async notifyAnnouncement(customerIds = [], announcementData = {}) {
    const { title = 'Announcement', message = '', imageUrl = null } = announcementData;

    return this.sendBulkNotification(customerIds, {
      title,
      body: message,
      type: 'announcement',
      data: {
        action: 'view_announcement'
      },
      imageUrl
    });
  }

  /**
   * Register FCM token for a user (should be called from mobile app)
   * @param {string} userId - User ID
   * @param {string} fcmToken - FCM token from mobile app
   * @returns {Promise<Object>}
   */
  static async registerFCMToken(userId, fcmToken) {
    if (!userId || !fcmToken) {
      throw new Error('Missing required fields: userId, fcmToken');
    }

    try {
      const response = await fetch(`${this.BASE_URL}/api/notifications/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, fcmToken })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to register FCM token');
      }

      const result = await response.json();
      console.log('✅ FCM token registered');
      return result;

    } catch (error) {
      console.error('❌ Error registering FCM token:', error.message);
      throw error;
    }
  }

  /**
   * Unregister FCM token (should be called when user logs out)
   * @param {string} userId - User ID
   * @param {string} fcmToken - FCM token
   * @returns {Promise<Object>}
   */
  static async unregisterFCMToken(userId, fcmToken) {
    if (!userId || !fcmToken) {
      throw new Error('Missing required fields: userId, fcmToken');
    }

    try {
      const response = await fetch(`${this.BASE_URL}/api/notifications/unregister-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, fcmToken })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unregister FCM token');
      }

      const result = await response.json();
      console.log('✅ FCM token unregistered');
      return result;

    } catch (error) {
      console.error('❌ Error unregistering FCM token:', error.message);
      throw error;
    }
  }

  /**
   * Change the base URL for notifications (useful for different environments)
   * @param {string} url - New base URL
   */
  static setBaseURL(url) {
    this.BASE_URL = url;
    console.log(`📍 Notification base URL changed to: ${url}`);
  }

  /**
   * Toast notification helper for admin dashboard
   * @param {string} message - Toast message
   * @param {string} type - Toast type (success, error, info, warning)
   * @param {number} duration - Duration in milliseconds
   */
  static showToast(message, type = 'info', duration = 3000) {
    // Create toast element if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        font-family: 'Poppins', sans-serif;
      `;
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    const bgColor = {
      success: '#10b981',
      error: '#ef4444',
      info: '#3b82f6',
      warning: '#f59e0b'
    }[type] || '#3b82f6';

    toast.style.cssText = `
      background-color: ${bgColor};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      margin-bottom: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
      min-width: 300px;
    `;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Add slide-in animation
    if (!document.getElementById('toast-animation-style')) {
      const style = document.createElement('style');
      style.id = 'toast-animation-style';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Auto remove after duration
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// Export for use in modules or scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationService;
}

// Also make available globally
window.NotificationService = NotificationService;
