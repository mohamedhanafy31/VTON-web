/**
 * Store Service
 * Handles store data loading and processing
 */
const StoreService = (() => {
  // Private variables
  const config = window.AppConfig;
  let storeData = null;
  
  /**
   * Initializes the store service
   */
  function init() {
    console.log('Store Service initialized');
  }

  /**
   * Fetches store profile data
   * @returns {Promise<Object>} The store profile data
   */
  async function getStoreProfile() {
    try {
      const response = await fetch(`${config.API_BASE_URL}/store/profile`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to load store profile');
      }
      
      storeData = await response.json();
      return storeData;
    } catch (error) {
      console.error('Get store profile error:', error);
      throw error;
    }
  }

  /**
   * Fetches all active stores
   * @returns {Promise<Array>} List of active stores
   */
  async function getActiveStores() {
    try {
      const response = await fetch(`${config.API_BASE_URL}/active-stores`);
      
      if (!response.ok) {
        throw new Error('Failed to load active stores');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get active stores error:', error);
      throw error;
    }
  }

  /**
   * Fetches store garments
   * @param {string} storeName - The store name
   * @returns {Promise<Array>} List of store garments
   */
  async function getStoreGarments(storeName) {
    try {
      const response = await fetch(`${config.API_BASE_URL}/store/garments/${storeName}`);
      
      if (!response.ok) {
        throw new Error('Failed to load store garments');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get store garments error:', error);
      throw error;
    }
  }

  /**
   * Updates store information
   * @param {Object} storeData - The updated store data
   * @returns {Promise<Object>} The update result
   */
  async function updateStore(storeData) {
    try {
      const response = await fetch(`${config.API_BASE_URL}/stores/${storeData.storeName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(storeData),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Update failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Update store error:', error);
      throw error;
    }
  }

  // Public API
  return {
    init,
    getStoreProfile,
    getActiveStores,
    getStoreGarments,
    updateStore
  };
})();

export default StoreService; 