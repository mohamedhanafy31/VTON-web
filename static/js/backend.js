// backend.js - Handling backend operations for Virtual Try-On Experience

// Cloudinary configuration
const CLOUDINARY_UPLOAD_PRESET = 'virtual_tryon'; // Replace with your Cloudinary preset
const CLOUDINARY_CLOUD_NAME = 'your_cloud_name'; // Replace with your Cloudinary cloud name
const CLOUDINARY_API_KEY = 'your_api_key'; // Replace with your Cloudinary API key

// Firebase function to check store limits and permissions
async function checkStorePermissions(storeId) {
  try {
    const db = firebase.firestore();
    const storeDoc = await db.collection('information').doc(storeId).get();
    
    if (!storeDoc.exists) {
      return {
        success: false,
        error: 'Store not found'
      };
    }
    
    const storeData = storeDoc.data();
    
    // Check if store has access
    if (!storeData.access) {
      return {
        success: false,
        error: 'Store access is disabled',
        message: 'This store is currently unavailable for try-ons.'
      };
    }
    
    return {
      success: true,
      store_data: storeData
    };
  } catch (error) {
    console.error('Error checking store permissions:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload an image to Cloudinary
 * @param {string} imageDataUrl - Base64 encoded image data URL
 * @returns {Promise<Object>} Cloudinary response
 */
async function uploadImageToCloudinary(imageDataUrl) {
  // Extract base64 data from data URL
  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  
  // Create form data for upload
  const formData = new FormData();
  formData.append('file', `data:image/jpeg;base64,${base64Data}`);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'user_photos'); // Upload to the user_photos folder
  
  try {
    // Upload to Cloudinary
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Image uploaded to Cloudinary:', data);
    
    return {
      success: true,
      public_id: data.public_id,
      url: data.secure_url,
      asset_id: data.asset_id
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process the virtual try-on request
 * @param {Object} params - Parameters for try-on
 * @param {string} params.userImageUrl - URL of the user's image
 * @param {string} params.garmentId - ID of the selected garment
 * @param {string} params.storeId - ID of the selected store
 * @param {string} params.userName - User's name
 * @param {string} params.userPhone - User's phone number
 * @returns {Promise<Object>} Try-on result
 */
async function processTryOn(params) {
  const { userImageUrl, garmentId, storeId, userName, userPhone } = params;
  
  try {
    // Get Firebase instance (this would normally be passed from the main script)
    const db = firebase.firestore();
    
    // Get garment details
    const garmentDoc = await db.collection('garments').doc('information').collection(storeId).doc(garmentId).get();
    
    if (!garmentDoc.exists) {
      throw new Error('Garment not found');
    }
    
    const garmentData = garmentDoc.data();
    
    // Get store details
    const storeDoc = await db.collection('information').doc(storeId).get();
    
    if (!storeDoc.exists) {
      throw new Error('Store not found');
    }
    
    const storeData = storeDoc.data();
    
    // Check if user has exceeded try-on limit
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Query for user's activity today
    const userActivityQuery = await db.collection('user_activity')
      .where('phone', '==', userPhone)
      .where('store_id', '==', storeId)
      .where('date', '==', today)
      .get();
    
    const tryonCount = userActivityQuery.size;
    const tryonLimit = storeData.tryon_limit || 5; // Default to 5 if not specified
    
    if (tryonCount >= tryonLimit) {
      return {
        success: false,
        error: 'Daily try-on limit reached',
        message: `You have reached your daily limit of ${tryonLimit} try-ons for this store.`,
        remaining_tryons: 0
      };
    }
    
    // Here, you would typically call an AI service to process the try-on
    // For this example, we'll simulate a response with a delay
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Log the try-on activity
    await db.collection('user_activity').add({
      user_name: userName,
      phone: userPhone,
      store_id: storeId,
      garment_id: garmentId,
      date: today,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Calculate remaining try-ons
    const remainingTryons = tryonLimit - (tryonCount + 1);
    
    // Return simulated try-on result
    return {
      success: true,
      result_url: userImageUrl, // In a real application, this would be the processed image URL
      output_id: `TRY-${Date.now()}`,
      message: 'Try-on successful',
      remaining_tryons: remainingTryons
    };
  } catch (error) {
    console.error('Error processing try-on:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Log user activity
 * @param {Object} params - Activity parameters
 * @param {string} params.userName - User's name
 * @param {string} params.userPhone - User's phone number
 * @param {string} params.storeId - ID of the selected store
 * @param {string} params.garmentId - ID of the selected garment
 * @param {string} params.actionType - Type of activity (view, try-on, purchase)
 * @returns {Promise<Object>} Activity logging result
 */
/**
 * Check user's daily try-on count
 * @param {string} userPhone - User's phone number
 * @param {string} storeId - Store ID
 * @returns {Promise<Object>} Count information
 */
async function checkUserDailyTryonCount(userPhone, storeId) {
  try {
    const db = firebase.firestore();
    const today = new Date().toISOString().split('T')[0];
    
    // Query for user's try-on activities today
    const userActivityQuery = await db.collection('user_activity')
      .where('phone', '==', userPhone)
      .where('store_id', '==', storeId)
      .where('date', '==', today)
      .where('action_type', '==', 'try-on')
      .get();
    
    return {
      success: true,
      count: userActivityQuery.size
    };
  } catch (error) {
    console.error('Error checking user try-on count:', error);
    return {
      success: false,
      error: error.message,
      count: 0
    };
  }
}

async function logUserActivity(params) {
  const { userName, userPhone, storeId, garmentId, actionType } = params;
  
  try {
    // Get Firebase instance
    const db = firebase.firestore();
    
    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Add activity log to the database
    await db.collection('user_activity').add({
      user_name: userName,
      phone: userPhone,
      store_id: storeId,
      garment_id: garmentId,
      action_type: actionType,
      date: today,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      success: true,
      message: 'Activity logged successfully'
    };
  } catch (error) {
    console.error('Error logging user activity:', error);
    return {
      success: false,
      error: error.message
    };
  }
}