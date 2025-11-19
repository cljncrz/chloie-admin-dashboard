/**
 * Centralized Configuration Module
 * Retrieves Firebase config from environment variables
 */

// Check if running in Node.js environment
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// Function to get Firebase config
function getFirebaseConfig() {
  if (isNode) {
    // Node.js environment (backend)
    require('dotenv').config();
    return {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
    };
  } else {
    // Browser environment (frontend)
    // Try to get from window object, then fallback to hardcoded for now
    if (window.FIREBASE_CONFIG) {
      return window.FIREBASE_CONFIG;
    }
    return {
      apiKey: "AIzaSyCFToN0U0Q3zmLZiTJAwPURrCgnCH7wPe0",
      authDomain: "kingsleycarwashapp.firebaseapp.com",
      databaseURL: "https://kingsleycarwashapp-default-rtdb.firebaseio.com",
      projectId: "kingsleycarwashapp",
      storageBucket: "kingsleycarwashapp.firebasestorage.app",
      messagingSenderId: "508373593061",
      appId: "1:508373593061:web:86a490e83f1016e5dc1d0c"
    };
  }
}

/**
 * Returns AI configuration for optional AI/LLM features.
 * This is intentionally minimal — it only provides a default model and
 * an "enable for all clients" switch. Frontend or server modules that
 * integrate with AI providers can call this function to determine whether
 * an LLM should be enabled by default.
 */
function getAIConfig() {
  if (isNode) {
    // Node.js server: read from environment variables
    return {
      defaultModel: process.env.AI_DEFAULT_MODEL || 'claude-sonnet-4.5',
      enableForAllClients: (process.env.AI_ENABLE_FOR_ALL_CLIENTS || 'true').toLowerCase() === 'true'
    };
  }

  // Browser: we allow window.AI_CONFIG override and fallback to the same defaults
  if (typeof window !== 'undefined' && window.AI_CONFIG) {
    return window.AI_CONFIG;
  }

  return {
    defaultModel: 'claude-sonnet-4.5',
    enableForAllClients: true
  };
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getFirebaseConfig, getAIConfig };
}
