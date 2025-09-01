import { Router } from 'express';
import { 
  createOrder, 
  getOrder, 
  updateOrder, 
  getUserOrders, 
  deleteOrder, 
  getOrderStats 
} from '../controllers/orderController.js';
import { authenticateUser, restrictTo } from '../middleware/auth.js';

const router = Router();

// All order routes require user authentication
router.use(authenticateUser);

// Order CRUD operations
router.post('/', createOrder);
router.get('/user', getUserOrders);
router.get('/:id', getOrder);
router.put('/:id', updateOrder);
router.delete('/:id', deleteOrder);

// Admin only routes
router.get('/admin/stats', restrictTo('admin'), getOrderStats);

export default router;