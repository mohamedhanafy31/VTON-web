/**
 * Main Application
 * Manages app initialization and state coordination
 */

// Global application state
const AppState = (() => {
  // State variables
  let selectedGarment = null;
  let userPhotoUrl = null;
  let garments = [];
  let stores = [];
  let selectedStore = null;
  let currentUserAddress = null;
  let numTrials = 0;
  let formCompleted = false;
  let resultData = null;
  let resultInterval = null;
  
  // Getters
  const getSelectedGarment = () => selectedGarment;
  const getUserPhotoUrl = () => userPhotoUrl;
  const getGarments = () => garments;
  const getStores = () => stores;
  const getSelectedStore = () => selectedStore;
  const getCurrentUserAddress = () => currentUserAddress;
  const getNumTrials = () => numTrials;
  const isFormCompleted = () => formCompleted;
  const getResultData = () => resultData;
  
  // Setters
  const setSelectedGarment = (garment) => { selectedGarment = garment; };
  const setUserPhotoUrl = (url) => { userPhotoUrl = url; };
  const setGarments = (garmentsArray) => { garments = garmentsArray; };
  const setStores = (storesArray) => { stores = storesArray; };
  const setSelectedStore = (store) => { selectedStore = store; };
  const setCurrentUserAddress = (address) => { currentUserAddress = address; };
  const setNumTrials = (trials) => { numTrials = trials; };
  const setFormCompleted = (completed) => { formCompleted = completed; };
  const setResultData = (data) => { resultData = data; };
  const setResultInterval = (interval) => {
    if (resultInterval) {
      clearInterval(resultInterval);
    }
    resultInterval = interval;
  };
  
  // Reset app state
  const resetState = () => {
    selectedGarment = null;
    userPhotoUrl = null;
    selectedStore = null;
    formCompleted = false;
    resultData = null;
    if (resultInterval) {
      clearInterval(resultInterval);
      resultInterval = null;
    }
  };
  
  // Helper functions
  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
  
  // Public API
  return {
    // Properties (with getters/setters)
    get selectedGarment() { return selectedGarment; },
    set selectedGarment(value) { selectedGarment = value; },
    
    get userPhotoUrl() { return userPhotoUrl; },
    set userPhotoUrl(value) { userPhotoUrl = value; },
    
    get garments() { return garments; },
    set garments(value) { garments = value; },
    
    get stores() { return stores; },
    set stores(value) { stores = value; },
    
    get selectedStore() { return selectedStore; },
    set selectedStore(value) { selectedStore = value; },
    
    get currentUserAddress() { return currentUserAddress; },
    set currentUserAddress(value) { currentUserAddress = value; },
    
    get numTrials() { return numTrials; },
    set numTrials(value) { numTrials = value; },
    
    get formCompleted() { return formCompleted; },
    set formCompleted(value) { formCompleted = value; },
    
    get resultData() { return resultData; },
    set resultData(value) { resultData = value; },
    
    // Methods
    getSelectedGarment,
    getUserPhotoUrl,
    getGarments,
    getStores,
    getSelectedStore,
    getCurrentUserAddress,
    getNumTrials,
    isFormCompleted,
    getResultData,
    
    setSelectedGarment,
    setUserPhotoUrl,
    setGarments,
    setStores,
    setSelectedStore,
    setCurrentUserAddress,
    setNumTrials,
    setFormCompleted,
    setResultData,
    setResultInterval,
    
    resetState,
    truncateAddress
  };
})();

// Main application initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing application...');
    
    // Check browser compatibility
    const supportsRequiredFeatures = 'mediaDevices' in navigator && 
                                     typeof HTMLCanvasElement !== 'undefined' &&
                                     'toBlob' in HTMLCanvasElement.prototype;
    
    if (!supportsRequiredFeatures) {
      UIController.showToast('Your browser may not support all features. For the best experience, use Chrome, Firefox, or Safari.', 'warning', 8000);
    }
    
    // Initialize controllers and services
    UIController.initialize();
    FormController.initialize();
    await FirebaseService.initialize();
    
    // Attempt auto-login
    const isLoggedIn = await AuthService.checkSession();
    if (isLoggedIn) {
      UIController.showToast(`Connected as ${AppState.truncateAddress(AppState.currentUserAddress)}`, 'success');
    } else {
      await AuthService.autoLoginWithNikeCredentials();
    }
    
    // Load initial data
    StoreService.loadStores();
    
    // Set up visibility change handler to sync localStorage data to Firebase
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        FirebaseService.syncLocalDataToFirebase().then(success => {
          if (success) {
            console.log('Successfully synced local data to Firebase on page visibility');
          }
        });
      }
    });
    
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Error initializing application:', error);
    UIController.showToast('An error occurred during initialization. Some features may not work properly.', 'error');
  }
}); 