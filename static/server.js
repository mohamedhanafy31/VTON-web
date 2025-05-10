import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import ngrok from 'ngrok';
import cors from 'cors';
import admin from 'firebase-admin';
import bcrypt from 'bcrypt';
import path from 'path';
import session from 'express-session';
import memoryStore from 'memorystore';
import { FirestoreStore } from '@google-cloud/connect-firestore';

// Initialize Firebase Admin SDK
let db;
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json')
    });
    console.log('Firebase Admin SDK initialized successfully');
  } else {
    console.log('Firebase Admin SDK already initialized, skipping initialization');
  }
  db = admin.firestore();
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', {
    message: error.message,
    code: error.code,
    details: error.details,
    stack: error.stack
  });
  console.warn('Firestore will be unavailable; using fallback for Firestore-dependent routes');
  db = null;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

// In-memory storage for job results
const jobResults = {};

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dj3ewvbqm',
  api_key: process.env.CLOUDINARY_API_KEY || '182963992493551',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'Jw9FTSGXX2VxuEaxKA-l8E2Kqag'
});

// Configure Multer
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image file'), false);
    }
  }
});

// Configure session middleware
const MemoryStore = memoryStore(session);
const sessionOptions = {
  store: db ? new FirestoreStore({
    dataset: db,
    kind: 'express-sessions'
  }) : new MemoryStore({ checkPeriod: 86400000 }),
  secret: process.env.SESSION_SECRET || 'your_session_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 1000 // 1 hour
  }
};
app.use(session(sessionOptions));

// Middleware
app.use(express.json());
app.use(express.static(__dirname));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8000', 'https://your-ngrok-id.ngrok.io'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Authentication middleware
const authenticateSession = (req, res, next) => {
  console.log('Authentication check for:', req.originalUrl);
  console.log('Session data:', req.session);
  console.log('User in session:', req.session.user);
  
  if (!req.session.user && !req.session.userAddress) {
    console.log('Authentication failed: No user in session');
    return res.status(401).json({ error: 'Unauthorized: Please log in' });
  }
  
  req.user = req.session.user || { role: 'admin', userAddress: req.session.userAddress };
  console.log('User authenticated as:', req.user.role);
  next();
};

// Role-based restriction middleware
const restrictTo = (...roles) => (req, res, next) => {
  console.log('Checking role restriction. User role:', req.user.role, 'Allowed roles:', roles);
  
  // Special case: If the user is an admin, allow access to all protected routes
  if (req.user.role === 'admin') {
    console.log('Admin user detected, granting access to protected route');
    return next();
  }
  
  if (!roles.includes(req.user.role)) {
    console.log('Access denied. User role:', req.user.role, 'Required roles:', roles.join(' or '));
    return res.status(403).json({ error: `Forbidden: ${roles.join(' or ')} access required` });
  }
  
  next();
};

// Routes for HTML files
app.get('/Admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'AdminDashBoard.html'));
});

app.get('/Store', (req, res) => {
  res.sendFile(path.join(__dirname, 'SoreDashBoard.html'));
});

app.get('/TryOn', (req, res) => {
  res.sendFile(path.join(__dirname, 'tryon.html'));
});

app.get('/Debug', (req, res) => {
  res.sendFile(path.join(__dirname, 'debug.html'));
});

app.get('/Test', (req, res) => {
  res.sendFile(path.join(__dirname, 'test.html'));
});

// Redirects
app.get('/AdminDashBoard.html', (req, res) => res.redirect('/Admin'));
app.get('/SoreDashBoard.html', (req, res) => res.redirect('/Store'));
app.get('/tryon.html', (req, res) => res.redirect('/TryOn'));
app.get('/debug.html', (req, res) => res.redirect('/Debug'));
app.get('/test.html', (req, res) => res.redirect('/Test'));

// Start ngrok
let ngrokUrl;
async function startNgrok() {
  try {
    ngrokUrl = await ngrok.connect({
      addr: port,
      authtoken: process.env.NGROK_AUTHTOKEN || undefined
    });
    console.log('Ngrok URL:', ngrokUrl);
  } catch (error) {
    console.error('Error starting ngrok:', error);
    ngrokUrl = 'https://metavrai.shop';
    console.log('Falling back to public URL:', ngrokUrl);
  }
}

// Start server
app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);
  await startNgrok();
});

// In server.js, after existing routes
app.post('/store/login', async (req, res) => {
  console.log('POST /store/login called with body:', req.body);
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!db) {
      throw new Error('Firestore is unavailable');
    }

    const storeSnapshot = await db.collection('information').where('email', '==', email).get();
    if (storeSnapshot.empty) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const storeDoc = storeSnapshot.docs[0];
    const storeData = storeDoc.data();
    const isMatch = await bcrypt.compare(password, storeData.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Set session data
    req.session.user = {
      role: 'store',
      storeId: storeDoc.id,
      storeName: storeData.store_name
    };
    req.session.save();

    res.json({ success: true, token: 'session-auth', store: { store_id: storeDoc.id, store_name: storeData.store_name } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});


// In server.js, after the login route
app.get('/store/profile', authenticateSession, async (req, res) => {
  console.log('GET /store/profile called for user:', req.session.user);
  try {
    if (!db || !req.session.user) {
      return res.status(401).json({ error: 'Unauthorized or Firestore unavailable' });
    }

    const storeRef = db.collection('information').doc(req.session.user.storeId);
    const storeDoc = await storeRef.get();
    if (!storeDoc.exists) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const storeData = storeDoc.data();
    res.json({
      store_id: storeDoc.id,
      store_name: storeData.store_name,
      logo_link: storeData.logo_link,
      specialization: storeData.specialization
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to load profile', details: error.message });
  }
});

// In server.js, after existing routes
app.get('/store/garments/:storeName', authenticateSession, async (req, res) => {
  try {
      if (!db) throw new Error('Firestore unavailable');
      const storeName = req.params.storeName;
      const garmentInfo = await db.collection('garments').doc('information').get();
      const garments = garmentInfo.exists ? Object.entries(garmentInfo.data())
          .filter(([_, data]) => data.store === storeName)
          .map(([id, data]) => ({ id, url: data.url, public_id: data.public_id, color: data.color, garmentType: data.type, name: data.name })) : [];
      res.json({ garments });
  } catch (error) {
      console.error('Get garments error:', error);
      res.status(500).json({ error: 'Failed to fetch garments', details: error.message });
  }
});

app.get('/store/orders/:storeName', authenticateSession, async (req, res) => {
  try {
      if (!db) throw new Error('Firestore unavailable');
      const storeName = req.params.storeName;
      const ordersDoc = await db.collection('stores').doc('orders').get();
      const orders = ordersDoc.exists ? Object.entries(ordersDoc.data())
          .filter(([_, order]) => order.storeName === storeName && order.wanted)
          .map(([id, order]) => ({ id, name: order.name, phone: order.phone, garmentName: order.garmentName })) : [];
      res.json({ orders });
  } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
  }
});

// Create Store (Admin Only)
app.post('/stores', authenticateSession, restrictTo('admin'), async (req, res) => {
  console.log('POST /stores called with body:', req.body);
  try {
    if (!db) {
      throw new Error('Firestore is unavailable');
    }
    const { country, email, logo_link, password, specialization, store_name, user_name, access, garment_limit, tryon_limit } = req.body;
    if (!store_name || !email || !password || !specialization) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Check if the information document already exists
    const infoDoc = await db.collection('information').doc(store_name).get();
    if (infoDoc.exists) {
      return res.status(400).json({ error: 'Store with this name already exists' });
    }

    // Check if email already exists in any store
    const existingStoreByEmail = await db.collection('information')
      .where('email', '==', email)
      .get();
      
    if (!existingStoreByEmail.empty) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const storeData = {
      country: country || '',
      email,
      logo_link: logo_link || '',
      password: hashedPassword,
      specialization,
      store_name,
      user_name: user_name || '',
      access: access !== undefined ? Boolean(access) : true,
      garment_limit: parseInt(garment_limit) || 6,
      tryon_limit: parseInt(tryon_limit) || 10
    };

    // Use store_name as the document ID
    await db.collection('information').doc(store_name).set(storeData);
    res.json({ success: true, storeId: store_name });
  } catch (error) {
    console.error('Create store error:', error);
    res.status(500).json({ error: 'Failed to create store', details: error.message });
  }
});

// Update Store (Admin Only)
app.put('/stores/:storeName', authenticateSession, restrictTo('admin'), async (req, res) => {
  console.log('PUT /stores/:storeName called with storeName:', req.params.storeName, 'body:', req.body);
  try {
    if (!db) {
      throw new Error('Firestore is unavailable');
    }
    const storeName = req.params.storeName;
    const { country, email, logo_link, password, specialization, store_name, user_name, access, garment_limit, tryon_limit } = req.body;
    if (!store_name || !email || !specialization) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const storeRef = db.collection('information').doc(storeName);
    const storeDoc = await storeRef.get();
    if (!storeDoc.exists) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // If the store name is being changed, we need to create a new document and delete the old one
    if (store_name !== storeName) {
      // Check if the new name already exists
      const newNameDoc = await db.collection('information').doc(store_name).get();
      if (newNameDoc.exists) {
        return res.status(400).json({ error: 'Store with that name already exists' });
      }
    }

    // Check if the email is already used by another store
    if (email !== storeDoc.data().email) {
      const existingStoreByEmail = await db.collection('information')
        .where('email', '==', email)
        .get();
        
      if (!existingStoreByEmail.empty) {
        return res.status(400).json({ error: 'Email already in use by another store' });
      }
    }

    const updateData = {
      country: country || '',
      email: email,
      logo_link: logo_link || '',
      specialization: specialization,
      store_name: store_name,
      user_name: user_name || '',
      access: access !== undefined ? Boolean(access) : true
    };

    // Only update numeric fields if they are provided
    if (garment_limit !== undefined) {
      updateData.garment_limit = parseInt(garment_limit) || 6;
    }
    
    if (tryon_limit !== undefined) {
      updateData.tryon_limit = parseInt(tryon_limit) || 10;
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    if (store_name !== storeName) {
      // Create a new document with the new name
      const storeData = {
        ...storeDoc.data(),
        ...updateData
      };
      await db.collection('information').doc(store_name).set(storeData);
      
      // Delete the old document
      await storeRef.delete();
      
      res.json({ success: true, newStoreId: store_name });
    } else {
      // Just update the existing document
      await storeRef.update(updateData);
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Update store error:', error);
    res.status(500).json({ error: 'Failed to update store', details: error.message });
  }
});

// Delete Store (Admin Only)
app.delete('/stores/:storeName', authenticateSession, restrictTo('admin'), async (req, res) => {
  console.log('DELETE /stores/:storeName called with storeName:', req.params.storeName);
  try {
    if (!db) {
      throw new Error('Firestore is unavailable');
    }
    const storeName = req.params.storeName;
    const storeRef = db.collection('information').doc(storeName);
    const storeDoc = await storeRef.get();
    if (!storeDoc.exists) {
      return res.status(404).json({ error: 'Store not found' });
    }

    await storeRef.delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete store error:', error);
    res.status(500).json({ error: 'Failed to delete store', details: error.message });
  }
});

// Get All Stores (Admin Only)
app.get('/stores', authenticateSession, restrictTo('admin'), async (req, res) => {
  console.log('GET /stores called');
  try {
    if (!db) {
      throw new Error('Firestore is unavailable');
    }
    const snapshot = await db.collection('information').get();
    const stores = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json({ stores });
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ error: 'Failed to fetch stores', details: error.message });
  }
});

// Get Trial Count
app.get('/trials', authenticateSession, async (req, res) => {
  console.log('GET /trials called');
  try {
    if (!db) {
      console.warn('Firestore unavailable, returning default trial count');
      return res.json({ num_trials: 10 });
    }
    const trialDoc = await db.collection('trails').doc('info').get();
    const defaultDbValue = 10;

    if (!trialDoc.exists) {
      await db.collection('trails').doc('info').set({ num_trails: defaultDbValue });
      console.log('Initialized trials in Firestore with num_trails:', defaultDbValue);
      return res.json({ num_trials: defaultDbValue });
    }

    const dataFromDb = trialDoc.data();
    if (typeof dataFromDb.num_trails !== 'number') {
      console.warn('num_trails in Firestore is invalid, re-initializing.');
      await db.collection('trails').doc('info').set({ num_trails: defaultDbValue });
      return res.json({ num_trials: defaultDbValue });
    }

    console.log('Trials data read from Firestore (num_trails):', dataFromDb.num_trails);
    res.json({ num_trials: dataFromDb.num_trails });
  } catch (error) {
    console.error('Error reading trials from Firestore:', error);
    console.warn('Returning default trial count due to Firestore error');
    res.json({ num_trials: 10 });
  }
});

// Update Trial Count
app.post('/update-trials', async (req, res) => {
  console.log('POST /update-trials called with body:', req.body);
  try {
    if (!db) {
      console.warn('Firestore unavailable, accepting trial count update without persistence');
      return res.json({ success: true });
    }
    
    const { num_trials, storeName } = req.body;
    
    if (typeof num_trials !== 'number' || num_trials < 0) {
      console.warn('Invalid trial count received:', num_trials);
      return res.status(400).json({ error: 'Invalid trial count' });
    }
    
    if (storeName) {
      // Update store-specific trials using document name
      const storeRef = db.collection('information').doc(storeName);
      const storeDoc = await storeRef.get();
      
      if (storeDoc.exists) {
        await storeRef.update({ 
          tryon_limit: num_trials 
        });
        console.log(`Updated trial count for store ${storeName} to ${num_trials}`);
      } else {
        console.warn(`Store ${storeName} not found, couldn't update trial count`);
        return res.status(404).json({ error: 'Store not found' });
      }
    } else {
      // Update global trials
      await db.collection('trails').doc('info').set({ num_trails: num_trials });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating trials:', error);
    res.json({ success: true });
  }
});

// Upload Image Route
app.post('/upload', upload.array('images', 6), async (req, res) => {
  console.log('POST /upload called with files:', req.files?.length, 'folder:', req.body?.folder, 'color:', req.body?.color, 'garmentType:', req.body?.garmentType);
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    const color = req.body.color || 'Unknown';
    const garmentType = req.body.garmentType || 'Unknown';
    const garmentName = req.body.garmentName;
    const storeId = req.body.storeName || null;
    const isUserPhoto = req.body.isUserPhoto === 'true';
    
    // Determine the upload folder
    let uploadFolder = 'VirtualTryOn_Images';
    const folder = req.body.folder;
    
    if (folder) {
      // Use the specified folder
      uploadFolder = folder;
    } else if (storeId) {
      // Fallback: Use the store ID if provided
      const sanitizedStoreName = storeId.replace(/\s+/g, '_').toLowerCase();
      uploadFolder = `store_${sanitizedStoreName}_garments`;
    }
    
    console.log(`Uploading to folder: ${uploadFolder}, isUserPhoto: ${isUserPhoto}`);

    // Upload each image
    const uploadPromises = req.files.map(async (file) => {
      const base64Data = file.buffer.toString('base64');
      const dataURI = `data:${file.mimetype};base64,${base64Data}`;
      
      // Generate a unique ID for the image
      const uniqueId = isUserPhoto 
        ? `user_photo_${Date.now()}`
        : `vton_image_${Date.now()}`;
    
      const result = await cloudinary.uploader.upload(dataURI, {
        resource_type: 'image',
        folder: uploadFolder,
        public_id: uniqueId,
        overwrite: true
      });
      
      // If this is a user photo, don't process it as a garment in Firestore
      if (isUserPhoto) {
        return {
          url: result.secure_url,
          public_id: result.public_id,
          isUserPhoto: true
        };
      }
      
      // Continue with garment processing for store uploads
      // Get or create the garment name
      const finalGarmentName = garmentName || `${color} ${garmentType}`;
      
      // Create a sanitized document ID using the store name and garment name
      const sanitizedStoreName = storeId.toLowerCase().replace(/\s+/g, '_');
      const sanitizedGarmentName = finalGarmentName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const garmentId = `${sanitizedStoreName}_${sanitizedGarmentName}`;
      
      console.log(`Using garment ID: ${garmentId}`);
      
      // Save garment information to Firestore in the requested structure
      if (db && storeId) {
        try {
          // 1. Save garment information to "information" document in "garments" collection
          const garmentData = {
            color,
            name: finalGarmentName,
            store: storeId,
            type: garmentType,
            url: result.secure_url,
            public_id: result.public_id,
            uploadedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          // Create/update the "information" document in "garments" collection
          await db.collection('garments').doc('information').set({
            [garmentId]: garmentData
          }, { merge: true });
          
          // 2. Create a new collection with the store name and garment name
          // The collection name should be the same as the document ID
          await db.collection(garmentId).doc('information').set(garmentData);
          
          console.log(`Stored garment data in Firestore: Collection ${garmentId}, Document information`);
          
          // 3. Also save to image_descriptions for backward compatibility
          const safeDocId = result.public_id.replace(/\//g, '_');
          await db.collection('image_descriptions').doc(safeDocId).set({
            color,
            garmentType,
            folder: uploadFolder,
            storeId: storeId,
            garmentName: finalGarmentName
          });
        } catch (dbError) {
          console.error('Error saving garment information to Firestore:', dbError);
          // Continue with upload even if database save fails
        }
      }

      return {
        url: result.secure_url,
        public_id: result.public_id,
        garmentId: garmentId,
        name: finalGarmentName
      };
    });

    const uploadedImages = await Promise.all(uploadPromises);
    console.log('Uploaded images:', uploadedImages);

    // Only update the descriptions if this is a store garment upload
    if (!isUserPhoto && (!folder || folder === 'VirtualTryOn_Images')) {
      if (db) {
        const descriptionsRef = db.collection('descriptions').doc('garments');
        let descriptions = (await descriptionsRef.get()).data() || {};
        uploadedImages.forEach(image => {
          if (!image.isUserPhoto) {
            descriptions[image.public_id] = { color, garmentType, name: image.name };
          }
        });
        await descriptionsRef.set(descriptions);
        console.log('Updated descriptions in Firestore');
      } else {
        console.warn('Firestore unavailable, skipping descriptions update');
      }
    }

    res.json({ images: uploadedImages });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload images', details: error.message });
  }
});

// Get Images
app.get('/images', authenticateSession, restrictTo('user', 'admin', 'store'), async (req, res) => {
  console.log('GET /images called');
  try {
    const result = await cloudinary.api.resources({
      resource_type: 'image',
      type: 'upload',
      prefix: 'VirtualTryOn_Images/',
      max_results: 100
    });

    const images = result.resources.map(resource => ({
      public_id: resource.public_id,
      url: resource.secure_url
    }));
    console.log('Images fetched:', images.length);

    res.json({ images, userAddress: req.session.userAddress });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images', details: error.message });
  }
});

// Get Descriptions
app.get('/descriptions', authenticateSession, restrictTo('user', 'admin', 'store'), async (req, res) => {
  console.log('GET /descriptions called');
  try {
    if (!db) {
      console.warn('Firestore unavailable, returning empty descriptions');
      return res.json({ descriptions: {} });
    }
    const descriptionsRef = db.collection('descriptions').doc('garments');
    console.log('Attempting to fetch Firestore document:', descriptionsRef.path);
    const doc = await descriptionsRef.get();
    if (!doc.exists) {
      console.log('No descriptions document found in Firestore, returning empty object');
      return res.json({ descriptions: {} });
    }
    const descriptions = doc.data();
    console.log('Descriptions read from Firestore:', Object.keys(descriptions).length);
    res.json({ descriptions });
  } catch (error) {
    console.error('Error fetching descriptions from Firestore:', {
      message: error.message,
      code: error.code,
      details: error.details,
      stack: error.stack
    });
    console.warn('Returning empty descriptions as fallback due to Firestore error');
    res.json({ descriptions: {} });
  }
});

// Delete Image
app.delete('/delete/:publicId', async (req, res) => {
  console.log('DELETE /delete/:publicId called with publicId:', req.params.publicId);
  try {
    // Decode the publicId if it's URL encoded
    const encodedPublicId = req.params.publicId;
    const publicId = decodeURIComponent(encodedPublicId);
    
    console.log('Decoded publicId for deletion:', publicId);
    
    // Check if this is a user photo or a garment
    const isUserPhoto = publicId.includes('user_photos/') || publicId.includes('user_photo_');
    
    // For Cloudinary deletion, we need the exact path
    let fullPublicId = publicId;
    
    // If this looks like a relative path (doesn't contain a folder), add the default folder
    if (!publicId.includes('/')) {
      if (isUserPhoto) {
        fullPublicId = `user_photos/${publicId}`;
      } else {
        // Assume it's in the default VirtualTryOn_Images folder or check if it's a store garment
        const storeMatch = publicId.match(/^store_([^_]+)_/);
        if (storeMatch) {
          fullPublicId = publicId; // Already has store prefix
        } else {
          fullPublicId = `VirtualTryOn_Images/${publicId}`;
        }
      }
    }
    
    console.log('Attempting to delete image with full public_id:', fullPublicId);
    
    // Try to delete from Cloudinary
    try {
      const destroyResult = await cloudinary.uploader.destroy(fullPublicId, { resource_type: 'image' });
      console.log('Cloudinary destroy result:', destroyResult);
      
      if (destroyResult.result !== 'ok') {
        console.warn('Cloudinary deletion returned non-ok result:', destroyResult);
        // Continue anyway to clean up database references
      }
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
      // Continue to delete database references even if Cloudinary delete fails
    }

    // Only process database updates if Firestore is available and this isn't a user photo
    if (db && !isUserPhoto) {
      try {
        // Delete from various collections based on the ID format
        const deletePromises = [];
        
        // 1. Delete from descriptions collection (legacy)
        const descriptionsRef = db.collection('descriptions').doc('garments');
        const descriptionsDoc = await descriptionsRef.get();
        
        if (descriptionsDoc.exists) {
          const descriptions = descriptionsDoc.data() || {};
          // Check both with and without the folder prefix
          const possibleKeys = [
            fullPublicId,
            publicId,
            `VirtualTryOn_Images/${publicId}`
          ];
          
          let updated = false;
          for (const key of possibleKeys) {
            if (descriptions[key]) {
              delete descriptions[key];
              updated = true;
            }
          }
          
          if (updated) {
            deletePromises.push(descriptionsRef.set(descriptions));
          }
        }
        
        // 2. Delete from garments/information
        deletePromises.push(
          db.collection('garments').doc('information').update({
            [publicId]: admin.firestore.FieldValue.delete()
          }).catch(err => console.warn('Could not delete from garments/information:', err))
        );
        
        // 3. Delete the collection if this is a store_garment format ID
        if (publicId.startsWith('store_') && publicId.includes('_')) {
          deletePromises.push(
            db.collection(publicId).doc('information').delete()
              .catch(err => console.warn(`Could not delete from collection ${publicId}:`, err))
          );
        }
        
        // 4. For image_descriptions, use the sanitized ID
        const safeDocId = publicId.replace(/\//g, '_');
        deletePromises.push(
          db.collection('image_descriptions').doc(safeDocId).delete()
            .catch(err => console.warn('Could not delete from image_descriptions:', err))
        );
        
        // Execute all delete operations
        await Promise.allSettled(deletePromises);
      } catch (dbError) {
        console.error('Error cleaning up Firestore references:', dbError);
        // Continue with the response even if database cleanup fails
      }
    }

    res.json({ 
      success: true, 
      message: `Successfully processed deletion request for ${publicId}`
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete image', 
      details: error.message 
    });
  }
});

// Try-On Endpoint
app.post('/tryon', async (req, res) => {
  console.log('POST /tryon called with body:', req.body);
  try {
    const { human, garment, garment_description, category, storeName } = req.body;
    
    // Validate required fields
    if (!human || !garment || !category) {
      console.warn('Missing required fields in tryon request:', { human, garment, category });
      return res.status(400).json({ error: 'Missing required fields: human, garment, and category are required' });
    }

    // Validate URLs (basic check for URL format)
    const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/;
    if (!urlPattern.test(human) || !urlPattern.test(garment)) {
      console.warn('Invalid URLs provided:', { human, garment });
      return res.status(400).json({ error: 'Invalid human or garment URL' });
    }

    // Validate category (optional, adjust based on API requirements)
    const validCategories = ["upper_body", "lower_body"]; // Example categories
    if (!validCategories.includes(category.toLowerCase())) {
      console.warn('Invalid category provided:', category);
      return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    const api_key = process.env.TRYON_API_KEY || 'dd240ad8f2e64de35e0b25ecddf1b42c2a7e637d';

    // Check store-specific or global try-on limit
    let tryonLimit = 10; // Default limit
    if (storeName && db) {
      try {
        const storeRef = db.collection('information').doc(storeName);
        const storeDoc = await storeRef.get();
        if (storeDoc.exists) {
          const storeData = storeDoc.data();
          tryonLimit = storeData.tryon_limit || 10;
          console.log(`Using store-specific TryOn limit: ${tryonLimit}`);
        } else {
          console.warn(`Store ${storeName} not found, using default limit`);
        }
      } catch (error) {
        console.error('Error getting store TryOn limit:', error);
      }
    } else if (db) {
      try {
        const trialDoc = db.collection('trails').doc('info').get();
        if (trialDoc.exists) {
          const dataFromDb = trialDoc.data();
          if (typeof dataFromDb.num_trails === 'number') {
            tryonLimit = dataFromDb.num_trails;
            console.log(`Using global TryOn limit: ${tryonLimit}`);
          }
        }
      } catch (error) {
        console.error('Error getting global TryOn limit:', error);
      }
    }

    // Check if limit is reached
    if (tryonLimit <= 0) {
      console.warn('No trials remaining, limit is:', tryonLimit);
      return res.status(400).json({ error: 'No trials remaining' });
    }

    const jobId = uuidv4();
    console.log('Generated jobId:', jobId);
    jobResults[jobId] = { status: 'pending', api_job_id: null, api_key };

    if (!ngrokUrl) {
      console.warn('Ngrok URL not available');
      return res.status(500).json({ error: 'Public URL not available' });
    }
    const webhookUrl = `${ngrokUrl}/webhook?job_id=${jobId}`;
    jobResults[jobId].webhook_url = webhookUrl;

    // Simplified payload for try-clothes model
    const payload = {
      model: 'try-clothes',
      input: {
        human: human,
        garment: garment,
        category: category.toLowerCase(),
        garment_description: garment_description || ''
      },
      webhook: webhookUrl
    };

    console.log('Sending request to Artificial Studio API with payload:', JSON.stringify(payload, null, 2));
    const response = await fetch('https://api.artificialstudio.ai/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': api_key
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API request failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    console.log('Received response from Artificial Studio:', responseData);

    const apiJobId = responseData.id || responseData._id;
    if (!apiJobId) {
      console.error('No job ID returned in API response:', responseData);
      throw new Error('Invalid API response: No job ID returned');
    }

    jobResults[jobId] = {
      status: 'submitted',
      api_response: responseData,
      api_job_id: apiJobId,
      api_key,
      webhook_url: webhookUrl
    };

    // Update try-on limit
    if (storeName && db) {
      try {
        const newLimit = tryonLimit - 1;
        await db.collection('information').doc(storeName).update({
          tryon_limit: newLimit
        });
        console.log(`Updated store TryOn limit to ${newLimit}`);
      } catch (error) {
        console.error('Error updating store TryOn limit:', error);
      }
    } else if (db) {
      try {
        const newLimit = tryonLimit - 1;
        await db.collection('trails').doc('info').update({
          num_trails: newLimit
        });
        console.log(`Updated global TryOn limit to ${newLimit}`);
      } catch (error) {
        console.error('Error updating global TryOn limit:', error);
      }
    }

    startPollingForResults(jobId, apiJobId, api_key);
    res.json({
      success: true,
      job_id: jobId,
      message: 'Job submitted successfully',
      api_job_id: apiJobId
    });
  } catch (error) {
    console.error('Try-on error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to process try-on request', details: error.message });
  }
});


// Polling for Results
async function startPollingForResults(jobId, apiJobId, apiKey) {
  const checkInterval = 10000;
  const maxAttempts = 30;
  let attempts = 0;

  const pollJob = async () => {
    if (attempts >= maxAttempts) {
      console.log(`Polling timeout for job ${jobId} after ${maxAttempts} attempts`);
      jobResults[jobId].status = 'failed';
      jobResults[jobId].error = 'Job timed out';
      return;
    }

    if (jobResults[jobId]?.status === 'completed') {
      console.log(`Job ${jobId} already completed, stopping polling`);
      return;
    }

    attempts++;
    console.log(`Polling attempt ${attempts} for job ${jobId}`);

    try {
      const response = await fetch(`https://api.artificialstudio.ai/api/generations/${apiJobId}`, {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`Failed to poll job status: ${response.status}`);
        setTimeout(pollJob, checkInterval);
        return;
      }

      const data = await response.json();
      console.log(`Polled status for job ${jobId}:`, data);

      if (data.status === 'success' || data.status === 'succeeded') {
        const outputUrl = data.output;
        let outputId = data.id;
        if (!outputId && data.output) {
          const match = data.output.match(/files\.artificialstudio.ai\/([0-9a-f-]+)/);
          if (match) outputId = match[1];
        }

        jobResults[jobId] = {
          status: 'completed',
          result: data,
          api_job_id: apiJobId,
          api_key: apiKey,
          output_id: outputId,
          output: outputUrl,
          timestamp: new Date().toISOString()
        };
        console.log(`Job ${jobId} completed via polling, output URL: ${outputUrl}`);
      } else if (data.status === 'failed') {
        jobResults[jobId] = {
          status: 'failed',
          result: {
            id: data.id,
            status: 'failed',
            error: data.error || 'Unknown error'
          },
          api_job_id: apiJobId,
          api_key: apiKey,
          timestamp: new Date().toISOString()
        };
        console.log(`Job ${jobId} failed: ${data.error || 'Unknown error'}`);
      } else {
        setTimeout(pollJob, checkInterval);
      }
    } catch (error) {
      console.error(`Error polling job status: ${error.message}`);
      setTimeout(pollJob, checkInterval);
    }
  };

  setTimeout(pollJob, checkInterval);
}

// Webhook Endpoint
app.post('/webhook', async (req, res) => {
  console.log('POST /webhook called with query:', req.query);
  const jobId = req.query.job_id;

  if (!jobId) {
    console.error('Webhook request missing job_id');
    return res.status(400).json({ error: 'Missing job_id in webhook request' });
  }

  try {
    const webhookData = req.body;
    let outputUrl = webhookData.output || null;
    let outputId = webhookData.id;

    if (!outputId && outputUrl) {
      const match = outputUrl.match(/files\.artificialstudio.ai\/([0-9a-f-]+)/);
      if (match) outputId = match[1];
    }

    if (jobResults[jobId]) {
      const apiKey = jobResults[jobId].api_key;
      const apiJobId = webhookData.id || jobResults[jobId].api_job_id;

      jobResults[jobId] = {
        status: webhookData.status === 'success' || webhookData.status === 'succeeded' ? 'completed' : webhookData.status,
        result: webhookData,
        api_job_id: apiJobId,
        api_key: apiKey,
        output_id: outputId,
        output: outputUrl,
        timestamp: new Date().toISOString()
      };
      console.log(`Updated job ${jobId} status to ${jobResults[jobId].status}`);
    } else {
      console.warn(`Received webhook for unknown job_id: ${jobId}`);
      jobResults[jobId] = {
        status: webhookData.status === 'success' || webhookData.status === 'succeeded' ? 'completed' : webhookData.status,
        result: webhookData,
        api_job_id: webhookData.id,
        output_id: outputId,
        output: outputUrl,
        timestamp: new Date().toISOString()
      };
    }

    res.json({ success: true, message: 'Webhook received and processed' });
  } catch (error) {
    console.error(`Error processing webhook for job ${jobId}:`, error);
    res.status(500).json({ error: 'Webhook processing error', details: error.message });
  }
});

// Manual Webhook Processing
app.post('/manual-webhook', async (req, res) => {
  console.log('POST /manual-webhook called with body:', req.body);
  try {
    const { job_id, webhook_payload } = req.body;
    if (!job_id || !webhook_payload) {
      console.warn('Missing job_id or webhook_payload');
      return res.status(400).json({ error: 'Missing job_id or webhook_payload' });
    }

    let outputUrl = webhook_payload.output || null;
    let outputId = webhook_payload.id;
    if (!outputId && outputUrl) {
      const match = outputUrl.match(/files\.artificialstudio.ai\/([0-9a-f-]+)/);
      if (match) outputId = match[1];
    }

    if (jobResults[job_id]) {
      const apiKey = jobResults[job_id].api_key;
      const apiJobId = webhook_payload.id || jobResults[job_id].api_job_id;

      jobResults[job_id] = {
        status: webhook_payload.status === 'success' || webhook_payload.status === 'succeeded' ? 'completed' : webhook_payload.status,
        result: webhook_payload,
        api_job_id: apiJobId,
        api_key: apiKey,
        output_id: outputId,
        output: outputUrl,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        message: 'Manual webhook processed',
        job_status: jobResults[job_id].status,
        output_url: outputUrl
      });
    } else {
      const newJobId = uuidv4();
      jobResults[newJobId] = {
        status: webhook_payload.status === 'success' || webhook_payload.status === 'succeeded' ? 'completed' : webhook_payload.status,
        result: webhook_payload,
        api_job_id: webhook_payload.id,
        output_id: outputId,
        output: outputUrl,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        message: 'New job created with webhook data',
        job_id: newJobId,
        output_url: outputUrl
      });
    }
  } catch (error) {
    console.error('Error processing manual webhook:', error);
    res.status(500).json({ error: 'Manual webhook processing error', details: error.message });
  }
});

// Get Result (Public Access)
app.get('/get-result/:jobId', (req, res) => {
  console.log('GET /get-result/:jobId called with jobId:', req.params.jobId);
  const jobId = req.params.jobId;

  if (!jobResults[jobId]) {
    console.warn(`Job not found: ${jobId}`);
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(jobResults[jobId]);
});

// Get Public URL
app.get('/public-url', (req, res) => {
  console.log('GET /public-url called');
  if (ngrokUrl) {
    console.log('Returning ngrok URL:', ngrokUrl);
    res.json({ publicUrl: ngrokUrl });
  } else {
    console.warn('Ngrok URL not available, falling back to default');
    res.json({ publicUrl: 'https://metavrai.shop', message: 'Using server public URL' });
  }
});

// Test Image Accessibility
app.post('/test-image', authenticateSession, async (req, res) => {
  console.log('POST /test-image called with body:', req.body);
  const { imageUrl } = req.body;

  if (!imageUrl) {
    console.warn('Image URL missing');
    return res.status(400).json({ error: 'Image URL is required' });
  }

  try {
    const startTime = Date.now();
    const response = await fetch(imageUrl, { method: 'HEAD' });
    const endTime = Date.now();

    const result = {
      url: imageUrl,
      accessible: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      responseTime: `${endTime - startTime}ms`
    };
    console.log('Image test result:', result);

    res.json(result);
  } catch (error) {
    console.error('Error testing image URL:', error);
    res.status(500).json({
      error: 'Failed to test image',
      details: error.message,
      url: imageUrl,
      accessible: false
    });
  }
});

// Client Logs
app.post('/client-logs', (req, res) => {
  console.log('POST /client-logs called');
  try {
    const { logs } = req.body;
    if (logs && Array.isArray(logs)) {
      logs.forEach(log => {
        const level = log.level || 'info';
        const action = log.action || 'unknown';
        const details = log.details ? JSON.stringify(log.details) : '';
        console.log(`[CLIENT-LOG][${level.toUpperCase()}][${log.page || 'unknown'}] ${action} ${details}`);
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error processing client logs:', error);
    res.status(500).json({ error: 'Failed to process client logs', details: error.message });
  }
});


// Get Active Stores for Public Display
app.get('/active-stores', async (req, res) => {
  console.log('GET /active-stores called');
  try {
    if (!db) {
      throw new Error('Firestore is unavailable');
    }
    
    // Get all documents from the 'information' collection
    const snapshot = await db.collection('information').get();
    
    if (snapshot.empty) {
      console.log('No stores found in the information collection');
      return res.json({ stores: [] });
    }
    
    // Filter stores that have access set to true
    const stores = snapshot.docs
      .filter(doc => doc.data().access === true)
      .map(doc => ({
        id: doc.id,
        store_name: doc.data().store_name,
        logo_link: doc.data().logo_link || null,
        specialization: doc.data().specialization || '',
        tryon_limit: doc.data().tryon_limit || 10,
        garment_limit: doc.data().garment_limit || 6
      }));
    
    res.json({ stores });
  } catch (error) {
    console.error('Get active stores error:', error);
    res.status(500).json({ error: 'Failed to fetch stores', details: error.message });
  }
});




// CORS and body parsing middleware (assumed to be already set up)
app.use(express.json());

// Save Order Endpoint
app.post('/save-order', async (req, res) => {
  console.log('POST /save-order called with body:', req.body);
  try {
    if (!db) {
      throw new Error('Firestore is unavailable');
    }
    const { name, phone, garmentName, storeName } = req.body;
    if (!name || !phone || !garmentName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const ordersRef = db.collection('stores').doc('orders');
    const orderDoc = await ordersRef.get();
    let orders = orderDoc.exists ? orderDoc.data() : {};
    let orderId = Object.keys(orders).length + 1;

    // Check for duplicate order within the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingOrder = Object.entries(orders).find(([id, order]) => {
      const timestamp = order.timestamp?.toDate();
      return (
        order.name === name &&
        order.phone === phone &&
        order.garmentName === garmentName &&
        order.storeName === (storeName || 'Unknown') &&
        timestamp && timestamp > fiveMinutesAgo
      );
    });

    if (existingOrder) {
      const [existingId] = existingOrder;
      console.log(`Duplicate order detected, returning existing orderId: ${existingId}`);
      return res.json({ success: true, orderId: existingId });
    }

    await ordersRef.set({
      [orderId]: {
        name,
        phone,
        garmentName,
        storeName: storeName || 'Unknown',
        wanted: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });

    console.log(`Order saved with ID: ${orderId}, wanted: false, Garment: ${garmentName}, Store: ${storeName}`);
    res.json({ success: true, orderId });
  } catch (error) {
    console.error('Error saving order:', error);
    res.status(500).json({ error: 'Failed to save order', details: error.message });
  }
});

// Update Order Wanted Status Endpoint
app.post('/update-order-wanted', async (req, res) => {
  console.log('POST /update-order-wanted called with body:', req.body);
  try {
    if (!db) {
      throw new Error('Firestore is unavailable');
    }
    const { orderId } = req.body;
    if (!orderId || isNaN(parseInt(orderId))) {
      return res.status(400).json({ error: 'Invalid or missing orderId' });
    }

    const ordersRef = db.collection('stores').doc('orders');
    const orderDoc = await ordersRef.get();
    if (!orderDoc.exists || !orderDoc.data()[orderId]) {
      return res.status(404).json({ error: `Order with ID ${orderId} not found` });
    }

    const order = orderDoc.data()[orderId];
    if (order.wanted === true) {
      console.log(`Order ${orderId} already has wanted: true, no update needed`);
      return res.json({ success: true, message: 'Order already marked as wanted' });
    }

    await ordersRef.update({
      [`${orderId}.wanted`]: true
    });

    console.log(`Order ${orderId} updated with wanted: true, Garment: ${order.garmentName}, Store: ${order.storeName}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating order wanted status:', error);
    res.status(500).json({ error: 'Failed to update order wanted status', details: error.message });
  }
});

// Admin Login
app.post('/admin/login', async (req, res) => {
  console.log('POST /admin/login called with body:', req.body);
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!db) {
      throw new Error('Firestore is unavailable');
    }

    // Assuming admin credentials are stored in a specific document or collection
    const adminSnapshot = await db.collection('admin').doc('admin_account').get();
    if (!adminSnapshot.exists) {
      return res.status(404).json({ error: 'Admin account not found' });
    }

    const adminData = adminSnapshot.data();
    const isMatch = await bcrypt.compare(password, adminData.password);

    if (adminData.email !== email || !isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Set session data for admin
    req.session.user = {
      role: 'admin',
      email: adminData.email
    };
    req.session.save();

    res.json({ success: true, token: 'admin-session-auth' });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});
