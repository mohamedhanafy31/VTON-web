import { Router } from 'express';
import { 
  getAvailableGarments,
  getGarmentById,
  getGarmentsByCategory,
  searchGarments,
  uploadGarment,
  getUserGarments,
  getUserGarmentStats,
  deleteGarment,
  getAllGarmentsAdmin,
  createGarmentAdmin,
  updateGarmentAdmin,
  deleteGarmentAdmin
} from '../controllers/garmentController.js';
import { authenticateSession, restrictTo } from '../middleware/auth.js';
import { uploadSingle } from '../config/multer.js';

const router = Router();

// Public garment routes (no authentication required for TryOn)
router.get('/available', getAvailableGarments);
router.get('/:id', getGarmentById);
router.get('/category/:category', getGarmentsByCategory);
router.get('/search/:query', searchGarments);

// User-specific routes (authentication required)
router.post('/upload', authenticateSession, uploadSingle, uploadGarment);
router.get('/user/:userId', authenticateSession, getUserGarments);
router.get('/user/:userId/stats', authenticateSession, getUserGarmentStats);
router.delete('/:id', authenticateSession, deleteGarment);

// Admin-only garment management routes
router.get('/admin/all', authenticateSession, restrictTo('admin'), getAllGarmentsAdmin);
router.post('/admin/create', authenticateSession, restrictTo('admin'), uploadSingle, createGarmentAdmin);
router.put('/admin/:id', authenticateSession, restrictTo('admin'), uploadSingle, updateGarmentAdmin);
router.delete('/admin/:id', authenticateSession, restrictTo('admin'), deleteGarmentAdmin);

export default router;
