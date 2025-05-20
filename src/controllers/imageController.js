import cloudinary from '../config/cloudinary.js';
import db from '../config/db.js';
import admin from 'firebase-admin';
import fs from 'fs/promises';
import busboy from 'busboy';

// Upload image
export const uploadImage = async (req, res) => {
  if (!req.headers['content-type'] || !req.headers['content-type'].includes('multipart/form-data')) {
    return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
  }

  const busboyInstance = busboy({ headers: req.headers });
  const fields = {};
  const files = [];

  busboyInstance.on('field', (fieldname, val) => {
    fields[fieldname] = val;
  });

  busboyInstance.on('file', (fieldname, file, filename, encoding, mimetype) => {
    // Buffer the file in memory
    const fileData = [];
    file.on('data', (data) => fileData.push(data));
    file.on('end', () => {
      files.push({
        fieldname,
        filename,
        encoding,
        mimetype,
        buffer: Buffer.concat(fileData)
      });
    });
  });

  busboyInstance.on('finish', async () => {
    if (files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }
    const storeId = fields.storeName || null;
    const color = fields.color || 'Unknown';
    const garmentType = fields.garmentType || 'Unknown';
    const garmentCategory = fields.garmentCategory || 'upper_body';
    const garmentName = fields.garmentName;
    const isUserPhoto = fields.isUserPhoto === 'true';
    let uploadFolder = 'VirtualTryOn_Images';
    const folder = fields.folder;
    if (folder) {
      uploadFolder = folder;
    } else if (storeId) {
      const sanitizedStoreName = storeId.replace(/\s+/g, '_').toLowerCase();
      uploadFolder = `garment/${sanitizedStoreName}`;
    }
    const uploadedImages = [];
    for (const file of files) {
      const finalGarmentName = garmentName || `${color} ${garmentType}`;
      const sanitizedStoreName = storeId ? storeId.toLowerCase().replace(/\s+/g, '_') : 'unknown';
      const sanitizedGarmentName = finalGarmentName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const garmentId = `${sanitizedStoreName}_${sanitizedGarmentName}`;
      const cloudinaryOpts = {
        folder: uploadFolder,
        resource_type: 'image',
        public_id: undefined // Let Cloudinary auto-generate
      };
      try {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(cloudinaryOpts, (err, result) => {
            if (err) return reject(err);
            resolve(result);
          });
          stream.end(file.buffer);
        });
        // Save to Firestore if needed
        if (db && storeId) {
          try {
            const garmentData = {
              color,
              name: finalGarmentName,
              store: storeId,
              type: garmentType,
              category: garmentCategory,
              url: result.secure_url,
              public_id: result.public_id,
              uploadedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            await db.collection('garments').doc('information').set({
              [garmentId]: garmentData
            }, { merge: true });
            await db.collection(garmentId).doc('information').set(garmentData);
            const safeDocId = result.public_id.replace(/\//g, '_');
            await db.collection('image_descriptions').doc(safeDocId).set({
              color,
              garmentType,
              garmentCategory,
              folder: uploadFolder,
              storeId: storeId,
              garmentName: finalGarmentName
            });
          } catch (dbError) {
            console.error('Error saving garment information to Firestore:', dbError);
          }
        }
        uploadedImages.push({
          url: result.secure_url,
          public_id: result.public_id,
          garmentId,
          name: finalGarmentName,
          category: garmentCategory
        });
      } catch (err) {
        console.error('Cloudinary upload error:', err);
        return res.status(500).json({ error: 'Cloudinary upload failed', details: err.message });
      }
    }
    if (isUserPhoto && uploadedImages.length > 0) {
      // For user photo uploads, return the first image in the expected format
      return res.json({ success: true, image: uploadedImages[0] });
    }
    res.json({ success: true, images: uploadedImages });
  });

  req.pipe(busboyInstance);
};

// Upload store logo
export const uploadLogo = async (req, res) => {
  try {
    const storeName = req.body.storeName;
    if (!req.file) {
      return res.status(400).json({ error: 'No logo file uploaded' });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: `store_${storeName}_logos`,
      public_id: `logo_${storeName}_${Date.now()}`
    });

    try {
      await fs.unlink(req.file.path);
      console.log(`Cleaned up local file: ${req.file.path}`);
    } catch (cleanupError) {
      console.error('Error cleaning up local file:', cleanupError);
    }

    res.status(200).json({ success: true, logoUrl: result.secure_url });
  } catch (error) {
    console.error('Error uploading logo:', error);
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up local file after failed upload:', cleanupError);
      }
    }
    res.status(500).json({ error: 'Failed to upload logo', details: error.message });
  }
};

// Get images
export const getImages = async (req, res) => {
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
};

// Get image descriptions
export const getImageDescriptions = async (req, res) => {
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
};

// Delete image
export const deleteImage = async (req, res) => {
  console.log('DELETE /delete/:publicId called with publicId:', req.params.publicId);
  try {
    const encodedPublicId = req.params.publicId;
    const publicId = decodeURIComponent(encodedPublicId);

    console.log('Decoded publicId for deletion:', publicId);

    const isUserPhoto = publicId.includes('user_photos/') || publicId.includes('user_photo_');

    let fullPublicId = publicId;

    if (!publicId.includes('/')) {
      if (isUserPhoto) {
        fullPublicId = `user_photos/${publicId}`;
      } else {
        // Try to match the new garment folder structure
        const garmentMatch = publicId.match(/^([a-z0-9_]+)_(.+)$/i);
        if (garmentMatch) {
          const storeName = garmentMatch[1];
          fullPublicId = `garment/${storeName}/${publicId}`;
        } else {
          fullPublicId = `VirtualTryOn_Images/${publicId}`;
        }
      }
    }

    console.log('Attempting to delete image with full public_id:', fullPublicId);

    try {
      const destroyResult = await cloudinary.uploader.destroy(fullPublicId, { resource_type: 'image' });
      console.log('Cloudinary destroy result:', destroyResult);

      if (destroyResult.result !== 'ok') {
        console.warn('Cloudinary deletion returned non-ok result:', destroyResult);
      }
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
    }

    if (db && !isUserPhoto) {
      try {
        const deletePromises = [];

        const descriptionsRef = db.collection('descriptions').doc('garments');
        const descriptionsDoc = await descriptionsRef.get();

        if (descriptionsDoc.exists) {
          const descriptions = descriptionsDoc.data() || {};
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

        deletePromises.push(
          db.collection('garments').doc('information').update({
            [publicId]: admin.firestore.FieldValue.delete()
          }).catch(err => console.warn('Could not delete from garments/information:', err))
        );

        // Also delete the per-garment collection if it exists
        deletePromises.push(
          db.collection(publicId).doc('information').delete()
            .catch(err => console.warn(`Could not delete from collection ${publicId}:`, err))
        );

        const safeDocId = publicId.replace(/\//g, '_');
        deletePromises.push(
          db.collection('image_descriptions').doc(safeDocId).delete()
            .catch(err => console.warn('Could not delete from image_descriptions:', err))
        );

        await Promise.allSettled(deletePromises);
      } catch (dbError) {
        console.error('Error cleaning up Firestore references:', dbError);
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
};

// Test image
export const testImage = async (req, res) => {
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
}; 