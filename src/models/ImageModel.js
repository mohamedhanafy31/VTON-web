import db from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * ImageModel - Manages image metadata entities in the database
 */
export class ImageModel {
  constructor(data) {
    this.id = data.id || null;
    this.public_id = data.public_id;
    this.url = data.url;
    this.secure_url = data.secure_url;
    this.folder = data.folder || 'general';
    this.filename = data.filename;
    this.format = data.format;
    this.width = data.width;
    this.height = data.height;
    this.bytes = data.bytes;
    this.resource_type = data.resource_type || 'image';
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
    this.tags = data.tags || [];
    this.metadata = data.metadata || {};
  }

  /**
   * Validate image data
   */
  validate() {
    const errors = [];
    
    if (!this.public_id) errors.push('Public ID is required');
    if (!this.url) errors.push('URL is required');
    if (!this.filename) errors.push('Filename is required');
    if (!this.format) errors.push('Format is required');
    
    return errors;
  }

  /**
   * Create a new image record
   */
  static async create(imageData) {
    try {
      const image = new ImageModel(imageData);
      const errors = image.validate();
      
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }

      if (!db) {
        throw new Error('Database connection not available');
      }

      const imageRef = db.collection('images').doc();
      const imageDoc = {
        ...image,
        id: imageRef.id,
        created_at: new Date(),
        updated_at: new Date()
      };

      await imageRef.set(imageDoc);
      logger.info('Image record created successfully', { imageId: imageRef.id });
      
      return { ...imageDoc, id: imageRef.id };
    } catch (error) {
      logger.error('Failed to create image record:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find image by ID
   */
  static async findById(imageId) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const imageDoc = await db.collection('images').doc(imageId).get();
      
      if (!imageDoc.exists) {
        return null;
      }

      return { id: imageDoc.id, ...imageDoc.data() };
    } catch (error) {
      logger.error('Failed to find image by ID:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find image by public ID
   */
  static async findByPublicId(publicId) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const imagesSnapshot = await db.collection('images')
        .where('public_id', '==', publicId)
        .limit(1)
        .get();

      if (imagesSnapshot.empty) {
        return null;
      }

      const imageDoc = imagesSnapshot.docs[0];
      return { id: imageDoc.id, ...imageDoc.data() };
    } catch (error) {
      logger.error('Failed to find image by public ID:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find images by folder
   */
  static async findByFolder(folder, limit = 50, offset = 0) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const imagesSnapshot = await db.collection('images')
        .where('folder', '==', folder)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      return imagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Failed to find images by folder:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find images by format
   */
  static async findByFormat(format, limit = 50, offset = 0) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const imagesSnapshot = await db.collection('images')
        .where('format', '==', format)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      return imagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Failed to find images by format:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Search images by tags
   */
  static async findByTags(tags, limit = 50, offset = 0) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      // Firestore doesn't support array-contains-all with multiple arrays
      // So we'll search for images that contain any of the specified tags
      const imagesSnapshot = await db.collection('images')
        .where('tags', 'array-contains-any', tags)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      return imagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Failed to find images by tags:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Update image record
   */
  static async update(imageId, updateData) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const imageRef = db.collection('images').doc(imageId);
      const imageDoc = await imageRef.get();
      
      if (!imageDoc.exists) {
        throw new Error('Image record not found');
      }

      const updatedData = {
        ...updateData,
        updated_at: new Date()
      };

      await imageRef.update(updatedData);
      logger.info('Image record updated successfully', { imageId });
      
      return { id: imageId, ...imageDoc.data(), ...updatedData };
    } catch (error) {
      logger.error('Failed to update image record:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Delete image record
   */
  static async delete(imageId) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const imageRef = db.collection('images').doc(imageId);
      const imageDoc = await imageRef.get();
      
      if (!imageDoc.exists) {
        throw new Error('Image record not found');
      }

      await imageRef.delete();
      logger.info('Image record deleted successfully', { imageId });
      
      return true;
    } catch (error) {
      logger.error('Failed to delete image record:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Get image statistics
   */
  static async getStats() {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const imagesSnapshot = await db.collection('images').get();
      const images = imagesSnapshot.docs.map(doc => doc.data());

      const stats = {
        total: images.length,
        byFormat: {},
        byFolder: {},
        byMonth: {},
        totalSize: 0
      };

      images.forEach(image => {
        // Count by format
        stats.byFormat[image.format] = (stats.byFormat[image.format] || 0) + 1;
        
        // Count by folder
        stats.byFolder[image.folder] = (stats.byFolder[image.folder] || 0) + 1;
        
        // Count by month
        const month = new Date(image.created_at).toISOString().substring(0, 7);
        stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
        
        // Sum total size
        if (image.bytes) {
          stats.totalSize += image.bytes;
        }
      });

      // Convert bytes to MB
      stats.totalSizeMB = Math.round((stats.totalSize / (1024 * 1024)) * 100) / 100;

      logger.info('Image statistics retrieved successfully');
      return stats;
    } catch (error) {
      logger.error('Failed to get image statistics:', { error: error.message, stack: error.stack });
      throw error;
    }
  }
}


