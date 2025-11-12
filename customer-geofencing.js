/**
 * Customer-Side Geofencing Module
 * Tracks user location and sends to Firebase for geofence checking
 * Works for both web and mobile apps
 */

class CustomerGeofencing {
  constructor() {
    this.isTracking = false;
    this.watchId = null;
    this.userId = null;
    this.db = null;
    this.updateInterval = 30000; // Update location every 30 seconds
    this.lastUpdateTime = 0;
    this.fcmToken = null;

    console.log('🌍 Customer Geofencing Module Initialized');
  }

  /**
   * Initialize geofencing with Firebase and current user
   * @param {string} userId - Current logged-in user ID
   */
  async init(userId) {
    try {
      console.log('🔄 Initializing Customer Geofencing...');
      
      // Wait for Firebase to be initialized
      await window.firebaseInitPromise;
      
      this.userId = userId;
      this.db = window.firebase.firestore();

      // Check if user has enabled geofencing
      const geofencingEnabled = await this.isGeofencingEnabled();
      
      if (geofencingEnabled) {
        console.log('✅ Geofencing enabled for user');
        this.startTracking();
        await this.requestNotificationPermission();
      } else {
        console.log('⏸️ Geofencing disabled');
      }
    } catch (error) {
      console.error('❌ Error initializing geofencing:', error);
    }
  }

  /**
   * Check if geofencing is enabled in admin settings
   */
  async isGeofencingEnabled() {
    try {
      const settingsDoc = await this.db
        .collection('admin_settings')
        .doc('geofencing')
        .get();

      return settingsDoc.exists && settingsDoc.data().isEnabled;
    } catch (error) {
      console.error('❌ Error checking geofencing status:', error);
      return false;
    }
  }

  /**
   * Request browser notification permission for FCM
   */
  async requestNotificationPermission() {
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          console.log('✅ Notification permission already granted');
          await this.getFCMToken();
        } else if (Notification.permission !== 'denied') {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            console.log('✅ Notification permission granted');
            await this.getFCMToken();
          } else {
            console.log('❌ Notification permission denied');
          }
        }
      }
    } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
    }
  }

  /**
   * Get FCM token and store in user document
   */
  async getFCMToken() {
    try {
      if (!window.firebase.messaging) {
        console.log('⚠️ Firebase Messaging not available');
        return;
      }

      const messaging = window.firebase.messaging();
      const token = await messaging.getToken({
        vapidKey: 'YOUR_VAPID_KEY_HERE' // Replace with your VAPID key from Firebase Console
      });

      if (token) {
        console.log('🔑 FCM Token obtained:', token.slice(0, 20) + '...');
        
        // Store token in user document
        await this.db
          .collection('users')
          .doc(this.userId)
          .set(
            {
              fcmTokens: window.firebase.firestore.FieldValue.arrayUnion(token),
              lastTokenUpdate: new Date().toISOString()
            },
            { merge: true }
          );

        console.log('💾 FCM Token stored in Firebase');
        this.fcmToken = token;

        // Handle incoming messages
        this.handleIncomingNotifications();
      }
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
    }
  }

  /**
   * Handle incoming push notifications
   */
  handleIncomingNotifications() {
    try {
      if (!window.firebase.messaging) return;

      const messaging = window.firebase.messaging();

      // Handle message when app is in foreground
      messaging.onMessage((payload) => {
        console.log('📬 Message received in foreground:', payload);

        // Show in-app notification
        if (payload.notification) {
          this.showInAppNotification(
            payload.notification.title,
            payload.notification.body
          );
        }
      });
    } catch (error) {
      console.error('❌ Error setting up message handler:', error);
    }
  }

  /**
   * Display in-app notification
   */
  showInAppNotification(title, body) {
    const notificationEl = document.createElement('div');
    notificationEl.className = 'geofence-notification';
    notificationEl.innerHTML = `
      <div class="notification-content">
        <h4>${title}</h4>
        <p>${body}</p>
      </div>
      <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    // Add styles if not already present
    if (!document.getElementById('geofence-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'geofence-notification-styles';
      style.textContent = `
        .geofence-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 24px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          justify-content: space-between;
          align-items: center;
          min-width: 300px;
          z-index: 10000;
          animation: slideIn 0.3s ease-out;
        }
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
        .notification-content h4 {
          margin: 0 0 4px 0;
          font-size: 16px;
        }
        .notification-content p {
          margin: 0;
          font-size: 14px;
          opacity: 0.9;
        }
        .notification-close {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          margin-left: 16px;
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notificationEl);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notificationEl.parentElement) {
        notificationEl.remove();
      }
    }, 5000);
  }

  /**
   * Start tracking user location
   */
  startTracking() {
    if (this.isTracking) {
      console.log('ℹ️ Location tracking already started');
      return;
    }

    if (!('geolocation' in navigator)) {
      console.error('❌ Geolocation is not supported by this browser');
      return;
    }

    console.log('🚀 Starting location tracking...');
    this.isTracking = true;

    // Request initial location
    navigator.geolocation.getCurrentPosition(
      (position) => this.onLocationUpdate(position),
      (error) => this.onLocationError(error),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );

    // Watch location continuously
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.onLocationUpdate(position),
      (error) => this.onLocationError(error),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );
  }

  /**
   * Stop tracking user location
   */
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isTracking = false;
      console.log('⏹️ Location tracking stopped');
    }
  }

  /**
   * Handle location update
   */
  async onLocationUpdate(position) {
    const now = Date.now();
    
    // Throttle updates to prevent excessive Firestore writes
    if (now - this.lastUpdateTime < this.updateInterval) {
      return;
    }

    this.lastUpdateTime = now;

    const { latitude, longitude, accuracy } = position.coords;

    console.log(
      `📍 Location update: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (±${accuracy.toFixed(0)}m)`
    );

    try {
      // Update user location in Firestore
      await this.db
        .collection('user_locations')
        .doc(this.userId)
        .set(
          {
            latitude,
            longitude,
            accuracy,
            timestamp: new Date().toISOString()
          },
          { merge: true }
        );

      console.log('✅ Location sent to Firebase');
    } catch (error) {
      console.error('❌ Error updating location:', error);
    }
  }

  /**
   * Handle geolocation error
   */
  onLocationError(error) {
    let errorMessage = 'Unknown error';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Permission denied. Please enable location access.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timeout.';
        break;
    }

    console.error(`❌ Geolocation error: ${errorMessage}`);
  }

  /**
   * Request user to enable location on next action
   */
  async requestLocationPermission() {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      
      if (result.state === 'prompt') {
        console.log('📍 Requesting location permission...');
        this.startTracking();
      } else if (result.state === 'denied') {
        console.log('⚠️ Location permission is denied');
        alert(
          'Location access is required for geofencing notifications. Please enable it in your browser settings.'
        );
      } else if (result.state === 'granted') {
        console.log('✅ Location permission granted');
        this.startTracking();
      }
    } catch (error) {
      console.error('❌ Error checking location permission:', error);
      // Fallback: just try to get location
      this.startTracking();
    }
  }

  /**
   * Get current tracking status
   */
  getStatus() {
    return {
      isTracking: this.isTracking,
      userId: this.userId,
      hasNotificationPermission:
        'Notification' in window && Notification.permission === 'granted',
      hasFCMToken: !!this.fcmToken
    };
  }
}

// Export for use
window.CustomerGeofencing = CustomerGeofencing;

// Auto-initialize if Firebase is ready and user is logged in
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Firebase and auth
  await window.firebaseInitPromise;
  
  const auth = window.firebase.auth();
  const user = auth.currentUser;

  if (user) {
    console.log('👤 User logged in:', user.uid);
    const geofencing = new CustomerGeofencing();
    await geofencing.init(user.uid);
    
    // Make available globally for debugging
    window.geofencing = geofencing;
  } else {
    console.log('👤 No user logged in');
  }
});
