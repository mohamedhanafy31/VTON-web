/**
 * Main Application
 * Central entry point and state manager for the Virtual Try-On application
 */
import FirebaseService from './services/firebase-service.js';
import AuthService from './services/auth-service.js';
import StoreService from './services/store-service.js';
import GarmentService from './services/garment-service.js';
import TryOnService from './services/tryon-service.js';
import UIController from './controllers/ui-controller.js';
import CameraController from './controllers/camera-controller.js';
import FormController from './controllers/form-controller.js';

const App = (() => {
  // Private variables
  const config = window.AppConfig;
  let state = {
    initialized: false,
    user: null,
    store: null,
    garments: [],
    selectedGarment: null,
    userImage: null,
    tryOnResult: null,
    isProcessing: false,
    trials: 0,
    maxTrials: config.TRYON.MAX_TRIALS,
    view: 'login' // Possible values: login, gallery, camera, result
  };
  
  // Event listeners
  const eventListeners = {};
  
  /**
   * Initializes the application
   */
  async function init() {
    try {
      console.log('Initializing Virtual Try-On Application');
      
      // Initialize services
      FirebaseService.init();
      AuthService.init();
      StoreService.init();
      GarmentService.init();
      TryOnService.init();
      
      // Initialize controllers
      UIController.init();
      FormController.init();
      
      // Initialize camera if video element exists
      const videoElement = document.getElementById('camera-feed');
      const canvasElement = document.getElementById('photo-canvas');
      if (videoElement && canvasElement) {
        CameraController.init(videoElement, canvasElement);
      }
      
      // Check authentication status
      const isAuthenticated = await AuthService.isAuthenticated();
      if (isAuthenticated) {
        const storeProfile = await StoreService.getStoreProfile();
        state.user = {
          authenticated: true,
          store: storeProfile
        };
        state.store = storeProfile;
        navigateToView('gallery');
      } else {
        navigateToView('login');
      }
      
      // Load trial count
      const trials = await TryOnService.getTrials();
      state.trials = trials.remainingTrials;
      state.maxTrials = trials.maxTrials;
      
      // Mark as initialized
      state.initialized = true;
      notifyStateChange();
      
      console.log('App initialized successfully');
    } catch (error) {
      console.error('Error initializing app:', error);
      UIController.showError('Failed to initialize application. Please try refreshing the page.');
    }
  }

  /**
   * Navigates to a specific view
   * @param {string} viewName - The view to navigate to
   */
  function navigateToView(viewName) {
    state.view = viewName;
    notifyStateChange();
    UIController.showView(viewName);
  }

  /**
   * Updates application state
   * @param {Object} updates - The state updates
   */
  function updateState(updates) {
    state = {
      ...state,
      ...updates
    };
    notifyStateChange();
  }

  /**
   * Gets current application state
   * @returns {Object} The current state
   */
  function getState() {
    return { ...state };
  }

  /**
   * Notifies listeners of state changes
   */
  function notifyStateChange() {
    const currentState = getState();
    
    if (eventListeners.stateChange) {
      eventListeners.stateChange.forEach(callback => callback(currentState));
    }
  }

  /**
   * Adds an event listener
   * @param {string} event - The event type
   * @param {Function} callback - The callback function
   */
  function addEventListener(event, callback) {
    if (!eventListeners[event]) {
      eventListeners[event] = [];
    }
    
    eventListeners[event].push(callback);
  }

  /**
   * Removes an event listener
   * @param {string} event - The event type
   * @param {Function} callback - The callback function to remove
   */
  function removeEventListener(event, callback) {
    if (eventListeners[event]) {
      eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
    }
  }

  // Public API
  return {
    init,
    navigateToView,
    updateState,
    getState,
    addEventListener,
    removeEventListener
  };
})();

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

export default App; 