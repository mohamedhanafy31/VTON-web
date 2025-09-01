import multer from 'multer';
import path from 'path';

// Check if Cloudinary is available
let cloudinaryStorage = null;
let cloudinary = null;

try {
  const { CloudinaryStorage } = await import('multer-storage-cloudinary');
  const cloudinaryModule = await import('./cloudinary.js');
  cloudinary = cloudinaryModule.default;
  
  if (cloudinary) {
    // Cloudinary storage configuration with organized folder structure
    cloudinaryStorage = new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: (req, file) => {
          // Determine folder based on request parameters
          let baseFolder = 'VTON Web site';
          
          if (req.body.folder) {
            return `${baseFolder}/${req.body.folder}`;
          }
          
          if (req.body.isUserPhoto === 'true') {
            return `${baseFolder}/captured_user_images`;
          }
          
          if (req.body.isTryOnResult === 'true') {
            return `${baseFolder}/try_on_results`;
          }
          
          if (req.body.isTryOnResultQR === 'true') {
            return `${baseFolder}/try_on_results_QR`;
          }
          
          if (req.body.isWebsiteMedia === 'true') {
            const subfolder = req.body.mediaSubfolder || 'general';
            return `${baseFolder}/WebSite_media/${subfolder}`;
          }
          
          if (req.body.storeName) {
            const sanitizedStoreName = req.body.storeName.replace(/\s+/g, '_').toLowerCase();
            return `${baseFolder}/uploaded_garments/${sanitizedStoreName}`;
          }
          
          return `${baseFolder}/uploaded_garments/general`;
        },
        resource_type: 'image',
        public_id: (req, file) => {
          // Generate unique public ID
          const timestamp = Date.now();
          const random = Math.floor(Math.random() * 1000);
          const filename = file.originalname ? path.parse(file.originalname).name : 'upload';
          return `${timestamp}-${random}-${filename}`;
        },
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        transformation: [
          {
            width: 1024,
            height: 1024,
            crop: 'limit',
            quality: 'auto:good'
          }
        ]
      }
    });
  }
} catch (error) {
  console.warn('Cloudinary storage not available, using local storage only');
}

// Memory storage configuration (for manual Cloudinary upload)
const memoryStorage = multer.memoryStorage();

// Local storage configuration (fallback)
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'static/uploads/VirtualTryOn_Images';
    
    if (req.body.isUserPhoto === 'true') {
      uploadPath = 'static/uploads/VirtualTryOn_UserPhotos';
    } else if (req.body.isTryOnResult === 'true') {
      uploadPath = 'static/uploads/TryOn_Results';
    } else if (req.body.isTryOnResultQR === 'true') {
      uploadPath = 'static/uploads/TryOn_Results_QR';
    } else if (req.body.isWebsiteMedia === 'true') {
      uploadPath = 'static/uploads/WebSite_Media';
    } else if (req.body.folder) {
      uploadPath = `static/uploads/${req.body.folder}`;
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const ext = path.extname(file.originalname);
    const filename = path.parse(file.originalname).name;
    cb(null, `${timestamp}-${random}-${filename}${ext}`);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedMimes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif'
  ];
  
  // Get file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  
  // Check both MIME type and file extension (fallback for WebP files)
  const isMimeValid = allowedMimes.includes(file.mimetype);
  const isExtensionValid = allowedExtensions.includes(ext);
  const isWebPFallback = file.mimetype === 'application/octet-stream' && ext === '.webp';
  
  if (isMimeValid || isWebPFallback || (file.mimetype === 'application/octet-stream' && isExtensionValid)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only JPEG, PNG, WebP, and GIF files are allowed. Received: ${file.mimetype} with extension ${ext}`), false);
  }
};

// Multer configuration - use memory storage for manual Cloudinary upload
const upload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size (increased for large images)
    files: 5 // Maximum 5 files per request
  }
});

// Export different upload types
export const uploadSingle = upload.single('garment_image'); // Updated to match form field name
export const uploadMultiple = upload.array('images', 5);
export const uploadFields = upload.fields([
  { name: 'human', maxCount: 1 },
  { name: 'garment', maxCount: 1 },
  { name: 'garment_image', maxCount: 1 }, // Added garment_image field
  { name: 'logo', maxCount: 1 }
]);

// Error handling middleware
export const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'File size cannot exceed 50MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        message: 'Maximum 5 files allowed per request'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected field',
        message: 'Unexpected file field in request'
      });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: error.message
    });
  }
  
  // Pass other errors to the next error handler
  next(error);
};

export default upload;
