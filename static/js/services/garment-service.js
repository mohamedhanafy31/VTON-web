/**
 * Garment Service
 * Handles garment data loading and processing
 */
const GarmentService = (() => {
  // Private variables
  const config = window.AppConfig;
  
  /**
   * Initializes the garment service
   */
  function init() {
    console.log('Garment Service initialized');
  }

  /**
   * Uploads a garment image
   * @param {File} file - The image file to upload
   * @param {string} storeName - The store name
   * @returns {Promise<Object>} The upload result
   */
  async function uploadGarment(file, storeName) {
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('storeName', storeName);
      
      const response = await fetch(`${config.API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Upload garment error:', error);
      throw error;
    }
  }

  /**
   * Deletes a garment image
   * @param {string} publicId - The Cloudinary public ID of the image
   * @returns {Promise<Object>} The deletion result
   */
  async function deleteGarment(publicId) {
    try {
      const response = await fetch(`${config.API_BASE_URL}/delete/${publicId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Delete failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Delete garment error:', error);
      throw error;
    }
  }

  /**
   * Gets all garment images for the logged-in store
   * @returns {Promise<Array>} List of garment images
   */
  async function getGarments() {
    try {
      const response = await fetch(`${config.API_BASE_URL}/images`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to load garment images');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get garments error:', error);
      throw error;
    }
  }

  /**
   * Gets garment descriptions
   * @returns {Promise<Object>} The garment descriptions
   */
  async function getDescriptions() {
    try {
      const response = await fetch(`${config.API_BASE_URL}/descriptions`);
      
      if (!response.ok) {
        throw new Error('Failed to load garment descriptions');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get descriptions error:', error);
      throw error;
    }
  }

  // Public API
  return {
    init,
    uploadGarment,
    deleteGarment,
    getGarments,
    getDescriptions
  };
})();

export default GarmentService; 