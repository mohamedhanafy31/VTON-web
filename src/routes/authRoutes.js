import { Router } from 'express';
import { 
  storeLogin, 
  storeLogout, 
  adminLogin, 
  adminLogout, 
  adminLoginTest, 
  adminAuthTest,
  resetStorePassword
} from '../controllers/authController.js';
import { authenticateSession, restrictTo } from '../middleware/auth.js';

const router = Router();

// Store authentication routes
router.post('/store/login', storeLogin);
router.post('/store/logout', storeLogout);

// Admin authentication routes
router.post('/admin/login', adminLogin);
router.post('/admin/logout', adminLogout);
router.post('/admin/login-test', adminLoginTest);
router.get('/admin/auth-test', adminAuthTest);

// Admin management routes
router.post('/admin/reset-store-password/:storeName', 
  authenticateSession, 
  restrictTo('admin'), 
  resetStorePassword
);

export default router; 