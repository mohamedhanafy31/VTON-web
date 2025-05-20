import { Router } from 'express';
import { getPublicUrl, processClientLogs, getDescriptions, updateTrials, getTrials, updateTrialCounts, resetTrialCounts } from '../controllers/miscController.js';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import logger from '../utils/logger.js';
import { authenticateSession, restrictTo } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// Misc utility routes
router.get('/public-url', getPublicUrl);
router.post('/client-logs', processClientLogs);

// HTML Routes
router.get('/Admin', (req, res) => {
  res.redirect('/VTON/Admin');
});

router.get('/VTON/Admin', (req, res) => {
  const dashboardPath = path.join(__dirname, '../../static/pages/admin/AdminDashBoard.html');
  
  fs.access(dashboardPath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.warn('AdminDashBoard.html file not found', { path: dashboardPath, error: err.message });
      return res.status(404).json({ error: 'AdminDashBoard.html file not found' });
    }
    res.sendFile(dashboardPath);
  });
});

router.get('/Store', (req, res) => {
  res.redirect('/VTON/Store');
});

router.get('/VTON/Store', (req, res) => {
  const dashboardPath = path.join(__dirname, '../../static/pages/admin/StoreDashBoard.html');
  
  fs.access(dashboardPath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.warn('StoreDashBoard.html file not found', { path: dashboardPath, error: err.message });
      return res.status(404).json({ error: 'StoreDashBoard.html file not found' });
    }
    res.sendFile(dashboardPath);
  });
});

router.get('/TryOn', (req, res) => {
  res.redirect('/VTON/TryOn');
});

router.get('/VTON/TryOn', (req, res) => {
  const filePath = path.join(__dirname, '../../static/pages/main/tryon.html');
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.warn('tryon.html file not found', { path: filePath, error: err.message });
      return res.status(404).json({ error: 'tryon.html file not found' });
    }
    res.sendFile(filePath);
  });
});

router.get('/VTON.html', (req, res) => {
  res.redirect('/VTON');
});

router.get('/VTON', (req, res) => {
  const filePath = path.join(__dirname, '../../static/pages/main/VTON.html');
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.warn('VTON.html file not found', { path: filePath, error: err.message });
      return res.status(404).json({ error: 'VTON.html file not found' });
    }
    res.sendFile(filePath);
  });
});

router.get('/Debug', (req, res) => {
  const filePath = path.join(__dirname, '../../static/debug.html');
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.warn('debug.html file not found', { path: filePath, error: err.message });
      return res.status(404).json({ error: 'debug.html file not found' });
    }
    res.sendFile(filePath);
  });
});

router.get('/Test', (req, res) => {
  const filePath = path.join(__dirname, '../../static/test.html');
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.warn('test.html file not found', { path: filePath, error: err.message });
      return res.status(404).json({ error: 'test.html file not found' });
    }
    res.sendFile(filePath);
  });
});

// Redirects
router.get('/AdminDashBoard.html', (req, res) => res.redirect('/Admin'));
router.get('/StoreDashBoard.html', (req, res) => res.redirect('/Store'));
router.get('/tryon.html', (req, res) => res.redirect('/TryOn'));
router.get('/debug.html', (req, res) => res.redirect('/Debug'));
router.get('/test.html', (req, res) => res.redirect('/Test'));

// Explicit routes for common static files to ensure correct MIME types
router.get('/css/:file', (req, res) => {
  res.sendFile(path.join(__dirname, '../../static/css', req.params.file));
});

router.get('/VTON/css/:file', (req, res) => {
  res.sendFile(path.join(__dirname, '../../static/css', req.params.file));
});

// Add a direct route for the logo at the root path
router.get('/MetaVrLogo.jpg', (req, res) => {
  const logoPath = path.join(__dirname, '../../static/Media/MetaVrLogo.jpg');
  
  fs.access(logoPath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.warn('Logo file not found', { path: logoPath, error: err.message });
      return res.status(404).json({ error: 'Logo file not found' });
    }
    res.sendFile(logoPath);
  });
});

router.get('/VTON/MetaVrLogo.jpg', (req, res) => {
  const logoPath = path.join(__dirname, '../../static/Media/MetaVrLogo.jpg');
  
  fs.access(logoPath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.warn('Logo file not found', { path: logoPath, error: err.message });
      // Send a 404 with a JSON message instead of failing with 500
      return res.status(404).json({ error: 'Logo file not found' });
    }
    res.sendFile(logoPath);
  });
});

// Add general Media file handling
router.get('/Media/:file', (req, res) => {
  const filePath = path.join(__dirname, '../../static/Media', req.params.file);
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.warn('Media file not found', { path: filePath, file: req.params.file, error: err.message });
      return res.status(404).json({ error: 'Media file not found' });
    }
    res.sendFile(filePath);
  });
});

router.get('/VTON/Media/:file', (req, res) => {
  const filePath = path.join(__dirname, '../../static/Media', req.params.file);
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.warn('Media file not found', { path: filePath, file: req.params.file, error: err.message });
      return res.status(404).json({ error: 'Media file not found' });
    }
    res.sendFile(filePath);
  });
});

router.get('/descriptions', getDescriptions);
router.get('/trials', getTrials);
router.post('/update-trial', updateTrials);
router.post('/update-trials', authenticateSession, updateTrialCounts);
router.post('/reset-trials', authenticateSession, restrictTo('admin'), resetTrialCounts);

// Add a route to serve Firebase configuration
router.get('/api/config/firebase', (req, res) => {
  // Only provide public Firebase config keys (not secrets)
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
  };
  
  res.json(firebaseConfig);
});

export default router; 