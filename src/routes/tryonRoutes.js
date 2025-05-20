import { Router } from 'express';
import { 
  processTryon, 
  handleWebhook, 
  processManualWebhook, 
  getJobResult, 
  getTrials, 
  updateTrials 
} from '../controllers/tryonController.js';
import { authenticateSession, restrictTo } from '../middleware/auth.js';

const router = Router();

// TryOn processing
router.post('/tryon', processTryon);

// Webhook processing - no auth required for webhooks
router.post('/api/webhook', handleWebhook);
router.get('/api/webhook', handleWebhook);
router.post('/api/manual-webhook', processManualWebhook);

// Job result and trials management
router.get('/get-result/:jobId', getJobResult);
router.get('/trials', getTrials);
router.post('/update-trials', updateTrials);

export default router; 