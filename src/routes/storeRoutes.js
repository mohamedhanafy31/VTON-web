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
import { authenticateSession, authenticateAdmin, authenticateStore, restrictTo } from '../middleware/auth.js';

const router = Router();

// Public store routes
router.get('/active-stores', getActiveStores);

// Store profile routes (requires store authentication)
router.get('/store/profile', authenticateStore, getStoreProfile);
router.get('/store/garments/:storeName', authenticateStore, getStoreGarments);
router.get('/store/orders/:storeName', authenticateStore, getStoreOrders);
router.put('/store/logo/:storeName', authenticateStore, updateStoreLogo);

// Admin store management routes
router.get('/stores', authenticateAdmin, restrictTo('admin'), getAllStores);
router.post('/stores', authenticateAdmin, restrictTo('admin'), createStore);
router.put('/stores/:storeName', authenticateAdmin, restrictTo('admin'), updateStore);
router.delete('/stores/:storeName', authenticateAdmin, restrictTo('admin'), deleteStore);

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