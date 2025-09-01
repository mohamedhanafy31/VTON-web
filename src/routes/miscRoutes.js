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

// Configuration endpoints
router.get('/config/cloudinary', (req, res) => {
  res.json({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    secure: true
  });
});

// Session check endpoint
router.get('/check-session', (req, res) => {
  // Check if user has an active session
  if (req.session.user || req.session.userAddress) {
    res.json({
      authenticated: true,
      user: req.session.user || { role: 'user', userAddress: req.session.userAddress }
    });
  } else {
    res.json({
      authenticated: false,
      message: 'No active session found'
    });
  }
});

// Get garments from database
router.get('/cloudinary/garments', async (req, res) => {
  try {
    // Check if user has access and trials remaining before showing garments
    if (req.session && req.session.user && req.session.user.userId) {
      // Import UserModel to check access and trials
      const { UserModel } = await import('../models/UserModel.js');
      const user = await UserModel.findById(req.session.user.userId);
      
      // First check if user has access
      if (!user || !user.access) {
        console.log('User access not granted, blocking garment access', { 
          userId: req.session.user.userId,
          hasAccess: user ? user.access : false
        });
        return res.status(403).json({
          success: false,
          error: 'Access not granted',
          message: 'Your account access has not been granted. Please contact management to activate your account.',
          access_granted: false
        });
      }
      
      // Then check if user has trials remaining
      if (user.trials_remaining <= 0) {
        console.log('User has no trials remaining, blocking garment access', { 
          userId: req.session.user.userId,
          trialsRemaining: user.trials_remaining 
        });
        return res.status(403).json({
          success: false,
          error: 'No trials remaining',
          message: 'You have no trials remaining. Please contact management to get more trials.',
          trials_remaining: 0
        });
      }
      
      console.log('User access and trials validation passed', { 
        userId: req.session.user.userId,
        hasAccess: user.access,
        trialsRemaining: user.trials_remaining 
      });
    } else {
      console.log('No authenticated user session found, allowing garment access for demo');
    }

    // Import Firebase admin
    const admin = await import('firebase-admin');
    const db = admin.default.firestore();
    
    console.log('Firebase admin imported successfully');
    console.log('Firestore database instance created');
    console.log('Fetching garments from Firestore database...');
    
    // Try to get approved garments first, fallback to all garments if needed
    let garmentsSnapshot;
    try {
      // First try: get approved garments
      garmentsSnapshot = await db.collection('garments')
        .where('status', '==', 'approved')
        .limit(100)
        .get();
      console.log('Successfully fetched approved garments');
    } catch (indexError) {
      if (indexError.code === 9) {
        console.log('Index not available, fetching all garments instead...');
        // Fallback: get all garments without complex queries
        garmentsSnapshot = await db.collection('garments')
          .limit(100)
          .get();
      } else {
        throw indexError; // Re-throw if it's not an index error
      }
    }
    
    if (garmentsSnapshot.empty) {
      console.log('No garments found in database');
      return res.json({
        success: true,
        garments: [],
        count: 0
      });
    }
    
    const garments = [];
    garmentsSnapshot.forEach(doc => {
      const garmentData = doc.data();
      garments.push({
        id: doc.id,
        public_id: garmentData.public_id || doc.id,
        secure_url: garmentData.url || '',
        original_filename: garmentData.name || 'Unknown Garment',
        category: garmentData.category || 'General',
        type: garmentData.type || 'Unknown',
        price: garmentData.price || 0,
        size: garmentData.size || '',
        description: garmentData.description || '',
        format: 'image', // Default format since we're not getting this from Cloudinary
        bytes: 0, // Default size since we're not getting this from Cloudinary
        created_at: garmentData.created_at ? garmentData.created_at.toDate().toISOString() : new Date().toISOString(),
        status: garmentData.status || 'unknown'
      });
    });
    
    // Sort garments by creation date (newest first) on the client side
    garments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    console.log(`Found ${garments.length} approved garments in database`);
    
    // Log each garment for debugging
    garments.forEach((garment, index) => {
      console.log(`Garment ${index + 1}:`, {
        id: garment.id,
        name: garment.original_filename,
        category: garment.category,
        type: garment.type,
        url: garment.secure_url,
        status: garment.status
      });
    });
    
    res.json({
      success: true,
      garments: garments,
      count: garments.length
    });
    
  } catch (error) {
    console.error('Error fetching garments from database:', error);
    
    // Log more details about the error
    if (error.code === 9) {
      console.error('Firestore index error - this query requires a composite index');
      console.error('Error details:', error.details);
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch garments from database',
      details: error.code === 9 ? 'Index required - please create the required Firestore index' : error.message
    });
  }
});

router.get('/config/firebase', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
  });
});

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
  // Check if user has an active session
  if (req.session.user || req.session.userAddress) {
    // User is authenticated, redirect to the VTON TryOn page
    res.redirect('/VTON/TryOn');
  } else {
    // User is not authenticated, redirect to login page
    logger.info('Unauthenticated user accessing /TryOn, redirecting to /login');
    res.redirect('/login');
  }
});

router.get('/VTON/TryOn', (req, res) => {
  // Check if user has an active session
  if (req.session.user || req.session.userAddress) {
    // User is authenticated, serve the try-on page
    const filePath = path.join(__dirname, '../../static/pages/main/tryon.html');
    
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        logger.warn('tryon.html file not found', { path: filePath, error: err.message });
        return res.status(404).json({ error: 'tryon.html file not found' });
      }
      res.sendFile(filePath);
    });
  } else {
    // User is not authenticated, redirect to login page
    logger.info('Unauthenticated user accessing /VTON/TryOn, redirecting to /login');
    res.redirect('/login');
  }
});

router.get('/VTON.html', (req, res) => {
  res.redirect('/VTON');
});

router.get('/VTON', (req, res) => {
  // Check if user has an active session
  if (req.session.user || req.session.userAddress) {
    // User is authenticated, redirect to try-on page
    logger.info('Authenticated user accessing /VTON, redirecting to /TryOn', { 
      user: req.session.user || { userAddress: req.session.userAddress } 
    });
    res.redirect('/TryOn');
  } else {
    // User is not authenticated, redirect to login page
    logger.info('Unauthenticated user accessing /VTON, redirecting to /login');
    res.redirect('/login');
  }
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

export default router; 