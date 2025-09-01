/**
 * TryOn Service
 * Handles try-on requests and result management
 */
const TryOnService = (() => {
  // Private variables
  const config = window.AppConfig;
  
  /**
   * Initializes the try-on service
   */
  function init() {
    console.log('TryOn Service initialized');
  }

  /**
   * Processes a try-on request
   * @param {string} userImageUrl - URL to the user image
   * @param {string} garmentImageUrl - URL to the garment image
   * @returns {Promise<Object>} The job information
   */
  async function processTryOn(userImageUrl, garmentImageUrl) {
    try {
      const response = await fetch(`${config.API_BASE_URL}/tryon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          userImageUrl,
          garmentImageUrl
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Try-on request failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Process try-on error:', error);
      throw error;
    }
  }

  /**
   * Polls for job result
   * @param {string} jobId - The job ID to check
   * @returns {Promise<Object>} The job result
   */
  async function getJobResult(jobId) {
    try {
      const response = await fetch(`${config.API_BASE_URL}/get-result/${jobId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get job result');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get job result error:', error);
      throw error;
    }
  }

  /**
   * Gets the remaining trial count
   * @returns {Promise<Object>} The trials information
   */
  async function getTrials() {
    try {
      const response = await fetch(`${config.API_BASE_URL}/auth/trials`);
      
      if (!response.ok) {
        throw new Error('Failed to get trials count');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get trials error:', error);
      throw error;
    }
  }

  /**
   * Updates the trial count
   * @param {number} count - The new trial count
   * @returns {Promise<Object>} The update result
   */
  async function updateTrials(count) {
    try {
      const response = await fetch(`${config.API_BASE_URL}/update-trials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ count }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update trials');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Update trials error:', error);
      throw error;
    }
  }

  /**
   * Saves an order
   * @param {Object} orderData - The order data
   * @returns {Promise<Object>} The save result
   */
  async function saveOrder(orderData) {
    try {
      const response = await fetch(`${config.API_BASE_URL}/save-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save order');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Save order error:', error);
      throw error;
    }
  }

  // Public API
  return {
    init,
    processTryOn,
    getJobResult,
    getTrials,
    updateTrials,
    saveOrder
  };
})();

export default TryOnService; 