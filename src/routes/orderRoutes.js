import { Router } from 'express';
import { saveOrder, updateOrderWanted } from '../controllers/orderController.js';

const router = Router();

// Order management
router.post('/save-order', saveOrder);
router.post('/update-order-wanted', updateOrderWanted);

export default router; 