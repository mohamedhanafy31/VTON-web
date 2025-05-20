/**
 * Application Configuration
 * Centralized configuration for the Virtual Try-On application
 */
window.AppConfig = {
  // API Configuration
  API_BASE_URL: '/api',
  API_TIMEOUT: 30000, // 30 seconds

  // Firebase Configuration - these should be set from environment variables
  FIREBASE_CONFIG: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: ""
  },

  // Cloudinary Configuration
  CLOUDINARY: {
    cloud_name: 'mediaflows',
    api_key: '168548754285954',
    upload_preset: 'ml_default',
    secure: true
  },

  // UI Configuration
  UI: {
    DEFAULT_THEME: 'light',
    TOAST_DURATION: 3000,
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    DEFAULT_AVATAR: '/img/default-avatar.png'
  },

  // Try-On Configuration
  TRYON: {
    MAX_TRIALS: 3,
    POLLING_INTERVAL: 2000, // 2 seconds
    MAX_POLLING_ATTEMPTS: 30, // 1 minute
    DEFAULT_GARMENT_COUNT: 6
  },

  // Customer Information
  CUSTOMER: {
    REQUIRED_FIELDS: ['name', 'email', 'address'],
    DEFAULT_COUNTRY: 'US'
  },

  // Paths
  PATHS: {
    UPLOAD_FOLDER: '/uploads',
    TEMP_FOLDER: '/temp',
    RESULT_FOLDER: '/results'
  }
};

// Environment-specific overrides
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.AppConfig.API_BASE_URL = 'http://localhost:3000/api';
  window.AppConfig.IS_DEVELOPMENT = true;
} else if (window.location.hostname.includes('ngrok')) {
  // Extract ngrok base URL from current hostname
  const ngrokBase = window.location.origin;
  window.AppConfig.API_BASE_URL = `${ngrokBase}/api`;
  window.AppConfig.IS_DEVELOPMENT = true;
} else {
  window.AppConfig.IS_DEVELOPMENT = false;
}

// Load Firebase config from server-provided environment
fetch('/api/config/firebase')
  .then(response => response.json())
  .then(config => {
    window.AppConfig.FIREBASE_CONFIG = config;
  })
  .catch(error => {
    console.error('Failed to load Firebase config:', error);
  }); 