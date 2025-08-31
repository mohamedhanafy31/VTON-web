import { Router } from 'express';
import { 
  uploadImage, 
  uploadImageMulter,
  uploadLogo, 
  getImages, 
  getImageDescriptions, 
  deleteImage, 
  testImage 
} from '../controllers/imageController.js';
import { uploadMultiple, handleMulterError } from '../config/multer.js';
import { authenticateSession, restrictTo } from '../middleware/auth.js';

const router = Router();

// Image upload routes
router.post('/upload', uploadImage); // Legacy busboy method
router.post('/upload-v2', uploadMultiple, uploadImageMulter, handleMulterError); // New multer method

router.post('/store/upload-logo', uploadLogo);

// Image retrieval routes
router.get('/images', getImages);
router.get('/image-descriptions', getImageDescriptions);

// Image deletion route
router.delete('/delete/:publicId(*)', deleteImage);

// Image test route
router.get('/test-image', testImage);

export default router;