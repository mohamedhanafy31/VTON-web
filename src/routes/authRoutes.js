import { Router } from 'express';
import { 
  storeLogin, 
  storeLogout, 
  adminLogin, 
  adminLogout, 
  adminLoginTest, 
  adminAuthTest,
  resetStorePassword,
  userRegister,
  userLogin,
  userLogout,
  userProfile,
  validateUserSession,
  createSession,
  getUserTrials,
  decreaseUserTrials
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

// User authentication routes (for TryOn system)
router.post('/register', userRegister);
router.post('/login', userLogin);
router.post('/logout', userLogout);
router.get('/profile', authenticateSession, userProfile);
router.get('/validate-session', validateUserSession);
router.post('/create-session', createSession);

// User trials management routes
// For demo purposes, make trials public
router.get('/trials', getUserTrials);
router.post('/decrease-trials', authenticateSession, decreaseUserTrials);

export default router; 