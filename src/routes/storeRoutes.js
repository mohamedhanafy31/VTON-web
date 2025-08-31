import { Router } from 'express';
import { 
  getStoreProfile, 
  getStoreGarments, 
  getStoreOrders, 
  createStore, 
  updateStore, 
  deleteStore, 
  getAllStores,
  getActiveStores,
  updateStoreLogo
} from '../controllers/storeController.js';
import { authenticateSession, restrictTo } from '../middleware/auth.js';

const router = Router();

// Public store routes
router.get('/active-stores', getActiveStores);

// Store profile routes (requires authentication)
router.get('/store/profile', authenticateSession, getStoreProfile);
router.get('/store/garments/:storeName', authenticateSession, getStoreGarments);
router.get('/store/orders/:storeName', authenticateSession, getStoreOrders);
router.put('/store/logo/:storeName', authenticateSession, updateStoreLogo);

// Admin store management routes
router.get('/stores', authenticateSession, restrictTo('admin'), getAllStores);
router.post('/stores', authenticateSession, restrictTo('admin'), createStore);
router.put('/stores/:storeName', authenticateSession, restrictTo('admin'), updateStore);
router.delete('/stores/:storeName', authenticateSession, restrictTo('admin'), deleteStore);

// Development mock endpoint for store profile (doesn't require authentication)
router.get('/dev/store/profile', (req, res) => {
  console.log('GET /dev/store/profile - Development mock endpoint');
  res.json({
    store_id: 'dev_store',
    store_name: 'Development Store',
    logo_link: '/MetaVrLogo.jpg',
    specialization: 'Development Testing'
  });
});

export default router;