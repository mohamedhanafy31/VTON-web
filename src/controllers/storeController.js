import bcrypt from 'bcrypt';
import db, { isDatabaseAvailable, getMockData } from '../config/db.js';
import admin from 'firebase-admin';
import logger from '../utils/logger.js';

// Get store profile
export const getStoreProfile = async (req, res) => {
  logger.info('GET /store/profile called for user:', req.session.user);
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!isDatabaseAvailable()) {
      logger.warn('Database unavailable, using mock data for store profile');
      // Use mock data if database is unavailable
      const mockStores = getMockData('information');
      return res.json({
        store_id: 'mock_store',
        store_name: 'Mock Store (Database Unavailable)',
        logo_link: '/MetaVrLogo.jpg',
        specialization: 'Development'
      });
    }

    // Handle admin users differently - they don't have a storeId in their session
    const storeId = req.session.user.role === 'admin' 
      ? (req.query.storeId || req.params.storeId || 'admin') 
      : req.session.user.storeId;
    
    // Validate storeId to avoid Firestore errors
    if (!storeId || storeId.trim() === '') {
      if (req.session.user.role === 'admin') {
        // For admins without a specific store, return admin profile
        return res.json({
          store_id: 'admin',
          store_name: 'Admin Dashboard',
          logo_link: '/MetaVrLogo.jpg',
          specialization: 'Administration',
          role: 'admin'
        });
      }
      return res.status(400).json({ error: 'Invalid store ID' });
    }

    const storeRef = db.collection('information').doc(storeId);
    const storeDoc = await storeRef.get();
    if (!storeDoc.exists) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const storeData = storeDoc.data();
    res.json({
      store_id: storeDoc.id,
      store_name: storeData.store_name,
      logo_link: storeData.logo_link || '/MetaVrLogo.jpg',
      specialization: storeData.specialization,
      // Include role information for the frontend
      role: req.session.user.role
    });
  } catch (error) {
    logger.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
};

// Get store garments
export const getStoreGarments = async (req, res) => {
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
    logger.error('Get store garments error', { storeName: req.params.storeName, error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch garments. Please try again later.' });
  }
};

// Get store orders
export const getStoreOrders = async (req, res) => {
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
    logger.error('Get store orders error', { storeName: req.params.storeName, error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch orders. Please try again later.' });
  }
};

// Create store
export const createStore = async (req, res) => {
  const { store_name, email, password, specialization, country, logo_link, user_name, access, garment_limit, tryon_limit } = req.body;
  const operationId = logger.startOperation('create-store', { store_name, email });

  logger.info('POST /stores called', { body: req.body });

  if (!store_name || !email || !password) {
    logger.warn('Missing required fields for store creation', { store_name, email, hasPassword: !!password });
    logger.failOperation(operationId, 'create-store', new Error('Missing required fields'), { statusCode: 400 });
    return res.status(400).json({ error: 'Store name, email, and password are required' });
  }

  try {
    const storeRef = db.collection('information').doc(store_name);
    const storeDoc = await storeRef.get();

    if (storeDoc.exists) {
      logger.warn('Attempt to create already existing store', { store_name });
      logger.failOperation(operationId, 'create-store', new Error('Store already exists'), { statusCode: 409 });
      return res.status(409).json({ error: 'Store already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const effectiveLogoLink = logo_link && logo_link.trim() !== '' ? logo_link : '/Media/MetaVrLogo.jpg';

    const newStoreData = {
      email,
      password: hashedPassword,
      role: 'store',
      storeId: store_name,
      store_name, // for consistency if storeId is ever different
      specialization: specialization || '',
      country: country || '',
      logo_link: effectiveLogoLink,
      user_name: user_name || email, // Default to email if not provided
      access: typeof access === 'boolean' ? access : false, // Ensure boolean, default to false
      garment_limit: parseInt(garment_limit, 10) || 0, // Ensure integer, default to 0
      tryon_limit: parseInt(tryon_limit, 10) || 0, // Ensure integer, default to 0
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await storeRef.set(newStoreData);
    logger.info('Store created successfully', { storeName: store_name, email });
    logger.succeedOperation(operationId, 'create-store');
    res.status(201).json({ message: 'Store created successfully', storeId: store_name, data: newStoreData });
  } catch (error) {
    logger.error('Create store error', { storeName: store_name, error: error.message, stack: error.stack });
    logger.failOperation(operationId, 'create-store', error, { statusCode: 500 });
    res.status(500).json({ error: 'Failed to create store. Please try again later.' });
  }
};

// Update store
export const updateStore = async (req, res) => {
  const { storeName } = req.params;
  const updates = req.body; // { store_name, email, password, specialization, country, logo_link, user_name, access, garment_limit, tryon_limit }
  const operationId = logger.startOperation('update-store', { targetStoreName: storeName });

  logger.info('PUT /stores/:storeName called', { body: updates });

  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, 10);
  }

  // Ensure logo_link is handled: if empty, set to default; if not present in updates, it's unchanged.
  if (updates.hasOwnProperty('logo_link')) {
    updates.logo_link = updates.logo_link && updates.logo_link.trim() !== '' ? updates.logo_link : '/Media/MetaVrLogo.jpg';
  }

  try {
    if (!isDatabaseAvailable()) {
      throw new Error('Firestore is unavailable');
    }

    const storeRef = db.collection('information').doc(storeName);
    const storeDoc = await storeRef.get();
    if (!storeDoc.exists) {
      return res.status(404).json({ error: 'Store not found' });
    }

    if (store_name !== storeName) {
      const newNameDoc = await db.collection('information').doc(store_name).get();
      if (newNameDoc.exists) {
        return res.status(400).json({ error: 'Store with that name already exists' });
      }
    }

    if (email !== storeDoc.data().email) {
      const existingStoreByEmail = await db.collection('information')
        .where('email', '==', email)
        .get();

      if (!existingStoreByEmail.empty) {
        return res.status(400).json({ error: 'Email already in use by another store' });
      }
    }

    const updateData = {
      country: updates.country || '',
      email: updates.email,
      logo_link: updates.logo_link || storeDoc.data().logo_link || '',
      specialization: updates.specialization,
      store_name: updates.store_name,
      user_name: updates.user_name || updates.email,
      access: updates.access !== undefined ? Boolean(updates.access) : true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (updates.garment_limit !== undefined) {
      updateData.garment_limit = parseInt(updates.garment_limit) || 6;
    }

    if (updates.tryon_limit !== undefined) {
      updateData.tryon_limit = parseInt(updates.tryon_limit) || 10;
    }
    
    if (updates.password) {
      logger.info('Password updated for store', { storeName: updates.store_name });
    }

    if (store_name !== storeName) {
      const storeData = {
        ...storeDoc.data(),
        ...updateData
      };
      
      // Start a Firestore transaction to handle name change and update all references
      await db.runTransaction(async (transaction) => {
        // Create the new store document
        transaction.set(db.collection('information').doc(updates.store_name), storeData);
        
        // Delete the old store document
        transaction.delete(storeRef);
        
        // Update all garment references to point to the new store name
        try {
          // 1. Update the 'garments' collection to point to the new store name
          const garmentInfoRef = db.collection('garments').doc('information');
          const garmentInfoDoc = await transaction.get(garmentInfoRef);
          
          if (garmentInfoDoc.exists) {
            const garmentData = garmentInfoDoc.data();
            const updates = {};
            let garmentCount = 0;
            
            // Find all garments associated with the old store name
            Object.entries(garmentData).forEach(([id, data]) => {
              if (data.store === storeName) {
                // Update the store reference
                updates[id] = {
                  ...data,
                  store: updates.store_name // Set to new store name
                };
                garmentCount++;
              }
            });
            
            // Apply updates if there are any garments to update
            if (garmentCount > 0) {
              logger.info(`Found ${garmentCount} garments to update from store ${storeName} to ${updates.store_name}`);
              Object.entries(updates).forEach(([id, data]) => {
                transaction.set(garmentInfoRef, { [id]: data }, { merge: true });
              });
            }
          }
          
          // 2. Update any collection-specific garment documents
          const oldSanitizedName = storeName.toLowerCase().replace(/\s+/g, '_');
          const newSanitizedName = updates.store_name.toLowerCase().replace(/\s+/g, '_');
          
          // Find collections that start with the old store name pattern
          const collections = await db.listCollections();
          const storeCollections = collections.filter(col => 
            col.id.startsWith(`${oldSanitizedName}_`) || 
            col.id.startsWith(`store_${oldSanitizedName}_`)
          );
          
          // For each collection, update or migrate as needed
          for (const collection of storeCollections) {
            const docs = await db.collection(collection.id).get();
            if (!docs.empty) {
              docs.forEach(doc => {
                const docData = doc.data();
                if (docData.store === storeName) {
                  // Update the store name in the document
                  transaction.update(
                    db.collection(collection.id).doc(doc.id),
                    { store: updates.store_name }
                  );
                }
              });
            }
          }
          
          // 3. Update image descriptions collection
          const imageDescriptionsSnapshot = await db.collection('image_descriptions')
            .where('storeId', '==', storeName)
            .get();
          
          if (!imageDescriptionsSnapshot.empty) {
            imageDescriptionsSnapshot.forEach(doc => {
              transaction.update(
                db.collection('image_descriptions').doc(doc.id),
                { storeId: updates.store_name }
              );
            });
          }
          
          logger.info(`Successfully updated store from ${storeName} to ${updates.store_name} with all garment references`);
        } catch (garmentUpdateError) {
          logger.error('Error updating garment references:', { error: garmentUpdateError.message, stack: garmentUpdateError.stack });
          // Continue with the transaction even if there was an error updating garments
          // to ensure the store information is still updated
          // REVISED: Throw the error to cause transaction rollback for consistency
          throw garmentUpdateError;
        }
      });
      
      res.json({ success: true, newStoreId: updates.store_name });
    } else {
      await storeRef.update(updateData);
      logger.info('Store updated successfully', { storeName });
      res.json({ success: true });
    }
  } catch (error) {
    logger.error('Update store error:', { storeName: req.params.storeName, message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to update store. Please try again later.' });
  }
};

// Delete store
export const deleteStore = async (req, res) => {
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

    // Delete associated garments and orders
    try {
      const garmentsRef = db.collection('garments').doc('information');
      const garmentsDoc = await garmentsRef.get();
      if (garmentsDoc.exists) {
        const garments = garmentsDoc.data();
        const updates = {};
        Object.entries(garments).forEach(([id, data]) => {
          if (data.store === storeName) {
            updates[id] = admin.firestore.FieldValue.delete();
          }
        });
        if (Object.keys(updates).length > 0) {
          await garmentsRef.update(updates);
        }
      }

      const ordersRef = db.collection('stores').doc('orders');
      const ordersDoc = await ordersRef.get();
      if (ordersDoc.exists) {
        const orders = ordersDoc.data();
        const orderUpdates = {};
        Object.entries(orders).forEach(([id, order]) => {
          if (order.storeName === storeName) {
            orderUpdates[id] = admin.firestore.FieldValue.delete();
          }
        });
        if (Object.keys(orderUpdates).length > 0) {
          await ordersRef.update(orderUpdates);
        }
      }
    } catch (cleanupError) {
      // console.warn('Error cleaning up associated data:', cleanupError);
      logger.error('Critical error during cleanup of associated store data (garments/orders). Store was NOT deleted.', { storeName, error: cleanupError.message, stack: cleanupError.stack });
      return res.status(500).json({ error: 'Failed to delete store due to error cleaning up associated data. Please try again or contact support.' });
    }

    await storeRef.delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete store error:', error);
    logger.error('Delete store error', { storeName: req.params.storeName, error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to delete store. Please try again later.' });
  }
};

// Get all stores
export const getAllStores = async (req, res) => {
  console.log('GET /stores called');
  try {
    if (!db) {
      throw new Error('Firestore is unavailable');
    }
    const snapshot = await db.collection('information').get();
    const stores = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        store_name: data.store_name,
        email: data.email,
        specialization: data.specialization,
        country: data.country,
        user_name: data.user_name,
        logo_link: data.logo_link,
        access: data.access,
        garment_limit: data.garment_limit,
        tryon_limit: data.tryon_limit
      };
    });
    res.json({ stores });
  } catch (error) {
    console.error('Get stores error:', error);
    logger.error('Get all stores error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch stores. Please try again later.' });
  }
};

// Get active stores (public endpoint)
export const getActiveStores = async (req, res) => {
  console.log('GET /active-stores called');
  try {
    if (!db) {
      throw new Error('Firestore is unavailable');
    }

    const snapshot = await db.collection('information').get();

    if (snapshot.empty) {
      console.log('No stores found in the information collection');
      return res.json({ stores: [] });
    }

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
    logger.error('Get active stores error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch active stores. Please try again later.' });
  }
};

// Update store logo
export const updateStoreLogo = async (req, res) => {
  const operationId = logger.startOperation('updateStoreLogo');
  const storeName = req.params.storeName;
  
  logger.info(`Processing logo upload for store: ${storeName}`, { storeName, operationId });
  
  try {
    // Validate database connection
    if (!isDatabaseAvailable()) {
      logger.error('Database unavailable during logo upload', { storeName, operationId });
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    
    // Validate file presence
    if (!req.file) {
      logger.warn('No logo file provided in request', { storeName, operationId });
      return res.status(400).json({ error: 'No logo file provided' });
    }
    
    // Check if store exists
    const storeRef = db.collection('information').doc(storeName);
    const storeDoc = await storeRef.get();
    
    if (!storeDoc.exists) {
      logger.warn('Store not found for logo upload', { storeName, operationId });
      return res.status(404).json({ error: 'Store not found' });
    }
    
    // Get cloudinary instance
    const cloudinary = req.app.get('cloudinary');
    if (!cloudinary) {
      logger.error('Cloudinary not configured', { storeName, operationId });
      return res.status(500).json({ error: 'Internal server configuration error' });
    }
    
    // Prepare upload parameters
    const uploadFolder = 'store_logos';
    const sanitizedStoreName = storeName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const timestamp = Date.now();
    const publicId = `${sanitizedStoreName}_logo_${timestamp}`;
    
    logger.info('Uploading logo to Cloudinary', { 
      storeName, 
      folder: uploadFolder,
      publicId,
      operationId
    });
    
    // Upload to Cloudinary
    const result = await uploadToCloudinary(cloudinary, req.file, uploadFolder, publicId);
    
    // Update store record with new logo URL
    await storeRef.update({
      logo_link: result.secure_url,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Clean up temp file if exists
    cleanupTempFile(req.file);
    
    logger.succeedOperation(operationId, 'Store logo updated successfully');
    
    // Return success with logo URL
    return res.json({ 
      success: true, 
      logo_link: result.secure_url 
    });
  } catch (error) {
    logger.failOperation(operationId, 'Update store logo error', error);
    
    // Clean up temp file if exists on error
    cleanupTempFile(req.file);
    
    return res.status(500).json({ 
      error: 'Failed to update store logo',
      message: error.message 
    });
  }
};

/**
 * Helper function to upload file to Cloudinary
 */
const uploadToCloudinary = (cloudinary, file, folder, publicId) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      public_id: publicId,
      overwrite: true,
      resource_type: 'image',
      transformation: [
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    };
    
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    
    // Upload the file - handle both buffer and file path cases
    if (file.buffer) {
      uploadStream.end(file.buffer);
    } else {
      const fs = require('fs');
      const readStream = fs.createReadStream(file.path);
      readStream.pipe(uploadStream);
    }
  });
};

/**
 * Helper function to clean up temporary files
 */
const cleanupTempFile = (file) => {
  if (file && file.path) {
    const fs = require('fs');
    fs.unlink(file.path, (err) => {
      if (err) {
        console.error('Error cleaning up temporary file:', err);
      }
    });
  }
}; 