/**
 * Notification Service for Admin Dashboard
 * Provides utilities to send push notifications to mobile app users
 * 
 * Usage:
 *   import { NotificationService } from './notificationService.js';
 *   
 *   await NotificationService.sendNotification({
 *     recipientIds: ['user123', 'user456'],
 *     title: 'New Appointment',
 *     body: 'You have a new booking from John Doe',
 *     type: 'appointment',
 *     data: { appointmentId: '123', customerId: '456' }
 *   });
 */

class NotificationService {
  /**
   * Send push notification to mobile app users
   * 
   * @param {Object} config - Notification configuration
   * @param {string[]} config.recipientIds - Array of user IDs to notify
   * @param {string} config.title - Notification title
   * @param {string} config.body - Notification body/message
   * @param {string} config.type - Notification type (appointment, payment, review, promotion, etc.)
   * @param {Object} config.data - Additional data to include in notification
   * @param {string} config.serverUrl - Backend server URL (defaults to http://localhost:5000)
   * 
   * @returns {Promise<Object>} - Response from server
   */
  static async sendNotification(config) {
    const {
      recipientIds,
      title,
      body,
      type,
      data = {},
      serverUrl = 'http://localhost:5000',
    } = config;

    // Validate required fields
    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      throw new Error('recipientIds must be a non-empty array');
    }
    if (!title || typeof title !== 'string') {
      throw new Error('title must be a non-empty string');
    }
    if (!body || typeof body !== 'string') {
      throw new Error('body must be a non-empty string');
    }
    if (!type || typeof type !== 'string') {
      throw new Error('type must be a non-empty string');
    }

    try {
      const response = await fetch(`${serverUrl}/api/notifications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientIds,
          title,
          body,
          type,
          data,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Notification sent successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send notification on new appointment
   * 
   * @param {Object} appointmentData - Appointment information
   * @param {string[]} appointmentData.customerIds - Customer IDs to notify
   * @param {string} appointmentData.customerName - Customer name
   * @param {string} appointmentData.serviceName - Service name
   * @param {string} appointmentData.date - Appointment date
   * @param {string} appointmentData.time - Appointment time
   * @param {string} appointmentData.serverUrl - Backend server URL
   */
  static async notifyNewAppointment(appointmentData) {
    const {
      customerIds,
      customerName,
      serviceName,
      date,
      time,
      serverUrl,
    } = appointmentData;

    await this.sendNotification({
      recipientIds: customerIds,
      title: 'New Appointment',
      body: `You have a new booking: ${serviceName} on ${date} at ${time}`,
      type: 'appointment',
      data: {
        customerName,
        serviceName,
        date,
        time,
      },
      serverUrl,
    });
  }

  /**
   * Send notification on appointment status change
   * 
   * @param {Object} appointmentData - Appointment information
   * @param {string[]} appointmentData.customerIds - Customer IDs to notify
   * @param {string} appointmentData.status - New status (completed, cancelled, rescheduled)
   * @param {string} appointmentData.appointmentId - Appointment ID
   * @param {string} appointmentData.reason - Reason for cancellation/reschedule
   * @param {string} appointmentData.serverUrl - Backend server URL
   */
  static async notifyAppointmentStatusChange(appointmentData) {
    const {
      customerIds,
      status,
      appointmentId,
      reason,
      serverUrl,
    } = appointmentData;

    let title = 'Appointment Updated';
    let body = 'Your appointment has been updated';

    switch (status.toLowerCase()) {
      case 'completed':
        title = 'Service Completed';
        body = 'Your service has been completed. Thank you for choosing us!';
        break;
      case 'cancelled':
        title = 'Appointment Cancelled';
        body = reason || 'Your appointment has been cancelled.';
        break;
      case 'rescheduled':
        title = 'Appointment Rescheduled';
        body = reason || 'Your appointment has been rescheduled.';
        break;
    }

    await this.sendNotification({
      recipientIds: customerIds,
      title,
      body,
      type: 'appointment',
      data: {
        appointmentId,
        status,
        reason,
      },
      serverUrl,
    });
  }

  /**
   * Send notification on payment received
   * 
   * @param {Object} paymentData - Payment information
   * @param {string[]} paymentData.customerIds - Customer IDs to notify
   * @param {number} paymentData.amount - Payment amount
   * @param {string} paymentData.method - Payment method (card, cash, online)
   * @param {string} paymentData.transactionId - Transaction ID
   * @param {string} paymentData.serverUrl - Backend server URL
   */
  static async notifyPaymentReceived(paymentData) {
    const {
      customerIds,
      amount,
      method,
      transactionId,
      serverUrl,
    } = paymentData;

    await this.sendNotification({
      recipientIds: customerIds,
      title: 'Payment Confirmed',
      body: `Payment of ₱${amount} has been received. Transaction ID: ${transactionId}`,
      type: 'payment',
      data: {
        amount,
        method,
        transactionId,
      },
      serverUrl,
    });
  }

  /**
   * Send notification on new review/feedback
   * 
   * @param {Object} reviewData - Review information
   * @param {string[]} reviewData.adminIds - Admin IDs to notify
   * @param {string} reviewData.customerName - Customer name
   * @param {number} reviewData.rating - Rating (1-5)
   * @param {string} reviewData.comment - Review comment
   * @param {string} reviewData.reviewId - Review ID
   * @param {string} reviewData.serverUrl - Backend server URL
   */
  static async notifyNewReview(reviewData) {
    const {
      adminIds,
      customerName,
      rating,
      comment,
      reviewId,
      serverUrl,
    } = reviewData;

    await this.sendNotification({
      recipientIds: adminIds,
      title: 'New Review',
      body: `${customerName} left a ${rating}⭐ review: "${comment.substring(0, 50)}..."`,
      type: 'review',
      data: {
        customerName,
        rating,
        comment,
        reviewId,
      },
      serverUrl,
    });
  }

  /**
   * Send promotion notification
   * 
   * @param {Object} promotionData - Promotion information
   * @param {string[]} promotionData.customerIds - Customer IDs to notify
   * @param {string} promotionData.title - Promotion title
   * @param {string} promotionData.description - Promotion description
   * @param {string} promotionData.discount - Discount percentage
   * @param {string} promotionData.promoCode - Promo code
   * @param {string} promotionData.promotionId - Promotion ID
   * @param {string} promotionData.serverUrl - Backend server URL
   */
  static async notifyPromotion(promotionData) {
    const {
      customerIds,
      title,
      description,
      discount,
      promoCode,
      promotionId,
      serverUrl,
    } = promotionData;

    await this.sendNotification({
      recipientIds: customerIds,
      title: `${discount}% OFF - ${title}`,
      body: `${description}. Use code: ${promoCode}`,
      type: 'promotion',
      data: {
        title,
        description,
        discount,
        promoCode,
        promotionId,
      },
      serverUrl,
    });
  }

  /**
   * Send custom notification
   * 
   * @param {Object} config - Custom notification config
   * @param {string[]} config.recipientIds - User IDs to notify
   * @param {string} config.title - Title
   * @param {string} config.body - Body
   * @param {string} config.customType - Custom type
   * @param {Object} config.customData - Custom data
   * @param {string} config.serverUrl - Backend server URL
   */
  static async sendCustom(config) {
    const {
      recipientIds,
      title,
      body,
      customType = 'custom',
      customData = {},
      serverUrl,
    } = config;

    await this.sendNotification({
      recipientIds,
      title,
      body,
      type: customType,
      data: customData,
      serverUrl,
    });
  }

  /**
   * Get notification sending history
   * 
   * @param {Object} config - Query configuration
   * @param {number} config.limit - Number of notifications to fetch (default: 20, max: 100)
   * @param {string} config.startAfter - Doc ID to start after (for pagination)
   * @param {string} config.serverUrl - Backend server URL
   * 
   * @returns {Promise<Object>} - Array of notifications and pagination cursor
   */
  static async getHistory(config = {}) {
    const {
      limit = 20,
      startAfter,
      serverUrl = 'http://localhost:5000',
    } = config;

    try {
      let url = `${serverUrl}/api/notifications/history?limit=${Math.min(limit, 100)}`;
      if (startAfter) {
        url += `&startAfter=${startAfter}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Notification history fetched:', result);
      return result;
    } catch (error) {
      console.error('❌ Error fetching notification history:', error);
      throw error;
    }
  }
}

// Export for use in both ESM and CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NotificationService };
}
