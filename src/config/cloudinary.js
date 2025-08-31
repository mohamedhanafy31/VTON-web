import { v2 as cloudinary } from 'cloudinary';

// Cloudinary is now required in development mode
const hasCloudinaryConfig = process.env.CLOUDINARY_CLOUD_NAME && 
                           process.env.CLOUDINARY_API_KEY && 
                           process.env.CLOUDINARY_API_SECRET;

// Debug logging
console.log('🔍 Cloudinary Environment Check:');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET');
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET');
console.log('hasCloudinaryConfig:', hasCloudinaryConfig);

if (!hasCloudinaryConfig) {
  throw new Error('Cloudinary configuration is required. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file');
}

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // Use HTTPS
});

console.log('✅ Cloudinary configuration loaded');

// Test the configuration asynchronously (for logging only)
cloudinary.api.ping()
  .then(() => {
    console.log('✅ Cloudinary connection test successful');
  })
  .catch(error => {
    console.error('❌ Cloudinary connection test failed:', error);
    console.warn('⚠️ Cloudinary may not be accessible');
  });

const cloudinaryInstance = cloudinary;

/**
 * Upload file to Cloudinary with organized folder structure
 * @param {Object} file - Multer file object
 * @param {string} folder - Cloudinary folder name (will be prefixed with 'VTON Web site')
 * @returns {Promise<Object>} Upload result with secure_url and public_id
 */
export const uploadToCloudinary = async (file, folder = 'uploads') => {
  
  try {
    // Convert buffer to base64 string
    const b64 = Buffer.from(file.buffer).toString('base64');
    const dataURI = `data:${file.mimetype};base64,${b64}`;
    
    // Organize folders under "VTON Web site"
    const organizedFolder = `VTON Web site/${folder}`;
    
    // Upload to Cloudinary
    const result = await cloudinaryInstance.uploader.upload(dataURI, {
      folder: organizedFolder,
      resource_type: 'auto',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });
    
    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
      folder: organizedFolder
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

/**
 * Upload user photo to Cloudinary
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} Upload result
 */
export const uploadUserPhoto = async (file) => {
  return await uploadToCloudinary(file, 'captured_user_images');
};

/**
 * Upload garment image to Cloudinary
 * @param {Object} file - Multer file object
 * @param {string} storeName - Store name for organization
 * @returns {Promise<Object>} Upload result
 */
export const uploadGarment = async (file, storeName = 'general') => {
  const folder = `uploaded_garments/${storeName.toLowerCase().replace(/\s+/g, '_')}`;
  return await uploadToCloudinary(file, folder);
};

/**
 * Upload captured user photo to Cloudinary
 * @param {Buffer} imageBuffer - Image buffer from canvas
 * @param {string} mimeType - MIME type of the image
 * @returns {Promise<Object>} Upload result
 */
export const uploadCapturedPhoto = async (imageBuffer, mimeType = 'image/jpeg') => {
  try {
    // Convert buffer to base64 string
    const b64 = imageBuffer.toString('base64');
    const dataURI = `data:${mimeType};base64,${b64}`;
    
    // Upload to specific folder: "VTON Web site/customers_captures"
    const result = await cloudinaryInstance.uploader.upload(dataURI, {
      folder: 'VTON Web site/customers_captures',
      resource_type: 'auto',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });
    
    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
      folder: 'VTON Web site/customers_captures'
    };
  } catch (error) {
    console.error('Cloudinary upload error for captured photo:', error);
    throw new Error(`Failed to upload captured photo: ${error.message}`);
  }
};

/**
 * Upload try-on result to Cloudinary
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} Upload result
 */
export const uploadTryOnResult = async (file) => {
  return await uploadToCloudinary(file, 'try_on_results');
};

/**
 * Upload try-on result QR code to Cloudinary
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} Upload result
 */
export const uploadTryOnResultQR = async (file) => {
  return await uploadToCloudinary(file, 'try_on_results_QR');
};

/**
 * Upload website media to Cloudinary
 * @param {Object} file - Multer file object
 * @param {string} subfolder - Subfolder within website media
 * @returns {Promise<Object>} Upload result
 */
export const uploadWebsiteMedia = async (file, subfolder = 'general') => {
  const folder = `WebSite_media/${subfolder}`;
  return await uploadToCloudinary(file, folder);
};

/**
 * Upload try-on result to Cloudinary from URL
 * @param {string} imageUrl - URL of the result image from Artificial Studio
 * @returns {Promise<Object>} Upload result
 */
export const uploadResultToCloudinary = async (imageUrl) => {
  try {
    console.log('Uploading result to Cloudinary from URL:', imageUrl);
    
    // Upload from URL to Cloudinary in "VTON Web site/VTON Results" folder
    const result = await cloudinaryInstance.uploader.upload(imageUrl, {
      folder: 'VTON Web site/VTON Results',
      resource_type: 'image',
      format: 'jpg',
      quality: 'auto:good',
      public_id: `tryon_result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    console.log('Result uploaded to Cloudinary successfully:', {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      originalUrl: imageUrl
    });

    return result;
  } catch (error) {
    console.error('Error uploading result to Cloudinary:', error);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

export default cloudinaryInstance; 