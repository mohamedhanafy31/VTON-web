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
  decreaseUserTrials,
  checkUserAccess
} from '../controllers/authController.js';
import { authenticateSession, authenticateUser, authenticateAdmin, authenticateStore, restrictTo } from '../middleware/auth.js';

const router = Router();

// Store authentication routes
router.post('/store/login', storeLogin);
router.post('/store/logout', storeLogout);

// Admin authentication routes
router.post('/admin/login', adminLogin);
router.post('/admin/logout', adminLogout);
router.post('/admin/login-test', adminLoginTest);
router.get('/admin/auth-test', adminAuthTest);
router.get('/admin/session', authenticateAdmin, restrictTo('admin'), (req, res) => {
  res.json({ 
    authenticated: true, 
    user: req.session.user,
    role: 'admin'
  });
});

// Admin management routes
router.post('/admin/reset-store-password/:storeName', 
  authenticateAdmin, 
  restrictTo('admin'), 
  resetStorePassword
);

// User authentication routes (for TryOn system)
router.post('/register', userRegister);
router.post('/login', userLogin);
router.post('/logout', userLogout);
router.get('/profile', checkUserAccess, authenticateUser, userProfile);
router.get('/validate-session', checkUserAccess, validateUserSession);
router.post('/create-session', createSession);

// User trials management routes
// For demo purposes, make trials public
router.get('/trials', checkUserAccess, getUserTrials);
router.post('/decrease-trials', checkUserAccess, authenticateUser, decreaseUserTrials);

export default router; 