import db from '../config/db.js';
import { COLLECTIONS } from './index.js';
import logger from '../utils/logger.js';

/**
 * Garment Model - Manages garment data and operations
 */
export class GarmentModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.store_id = data.store_id || null;
    this.user_id = data.user_id || null;
    this.type = data.type || 'Unknown';
    this.category = data.category || 'upperbody';
    this.color = data.color || 'Unknown';
    this.url = data.url || '';
    this.public_id = data.public_id || '';
    this.description = data.description || '';
    this.price = data.price || 0;
    this.size = data.size || null;
    this.tags = data.tags || [];
    this.status = data.status || 'pending';
    this.views = data.views || 0;
    
    // Ensure all date fields are valid Date objects
    this.uploaded_at = this.sanitizeDate(data.uploaded_at) || new Date();
    this.updated_at = this.sanitizeDate(data.updated_at) || new Date();
    this.created_at = this.sanitizeDate(data.created_at) || new Date();
  }
  
  /**
   * Sanitize date values to ensure they are valid Date objects
   */
  sanitizeDate(dateValue) {
    if (!dateValue) return null;
    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? null : dateValue;
    }
    try {
      const parsedDate = new Date(dateValue);
      return isNaN(parsedDate.getTime()) ? null : parsedDate;
    } catch (error) {
      console.warn('Failed to parse date value:', dateValue, error);
      return null;
    }
  }

  /**
   * Validate garment data
   */
  validate() {
    const errors = [];
    
    if (!this.name || this.name.trim().length < 2) {
      errors.push('Garment name must be at least 2 characters long');
    }
    
    // Admin garments can have both store_id and user_id as null
    // This validation is removed to allow admin-created garments
    
    if (!this.type || this.type.trim().length < 2) {
      errors.push('Garment type is required');
    }
    
    if (!this.category || !['upperbody', 'lowerbody', 'dresses'].includes(this.category)) {
      errors.push('Valid category is required (upperbody, lowerbody, dresses)');
    }
    
    if (!this.url) {
      errors.push('Image URL is required');
    }
    
    if (!this.public_id) {
      errors.push('Public ID is required');
    }
    
    if (this.price < 0) {
      errors.push('Price cannot be negative');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate garment data for updates (more flexible)
   */
  validateForUpdate() {
    const errors = [];
    
    // Only validate fields that are being updated
    if (this.name !== undefined && (!this.name || this.name.trim().length < 2)) {
      errors.push('Garment name must be at least 2 characters long');
    }
    
    if (this.type !== undefined && (!this.type || this.type.trim().length < 2)) {
      errors.push('Garment type is required');
    }
    
    if (this.category !== undefined && (!this.category || !['upperbody', 'lowerbody', 'dresses'].includes(this.category))) {
      errors.push('Valid category is required (upperbody, lowerbody, dresses)');
    }
    
    if (this.url !== undefined && !this.url) {
      errors.push('Image URL is required');
    }
    
    if (this.public_id !== undefined && !this.public_id) {
      errors.push('Public ID is required');
    }
    
    if (this.price !== undefined && this.price < 0) {
      errors.push('Price cannot be negative');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a new garment
   */
  static async create(garmentData) {
    try {
      const garment = new GarmentModel(garmentData);
      const validation = garment.validate();
      
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      // For user uploads, check if user exists
      if (garment.user_id) {
        const user = await db.collection(COLLECTIONS.USERS).doc(garment.user_id).get();
        if (!user.exists) {
          throw new Error('User not found');
        }
      }
      
      // For store uploads, check if store exists and limits
      if (garment.store_id) {
        const store = await db.collection(COLLECTIONS.STORES).doc(garment.store_id).get();
        if (!store.exists) {
          throw new Error('Store not found');
        }
        
        // Check store garment limit
        const storeData = store.data();
        const garmentSnapshot = await db.collection(COLLECTIONS.GARMENTS)
          .where('store_id', '==', garment.store_id)
          .get();
        
        if (garmentSnapshot.size >= storeData.garment_limit) {
          throw new Error('Store has reached garment limit');
        }
      }
      
      const garmentRef = db.collection(COLLECTIONS.GARMENTS).doc();
      garment.id = garmentRef.id;
      garment.uploaded_at = new Date();
      garment.updated_at = new Date();
      garment.created_at = new Date();
      
      await garmentRef.set(garment.toFirestore());
      
      logger.info('Garment created successfully', { 
        garmentId: garment.id, 
        storeId: garment.store_id,
        userId: garment.user_id,
        name: garment.name 
      });
      return garment;
    } catch (error) {
      logger.error('Failed to create garment', { error: error.message, garmentData });
      throw error;
    }
  }

  /**
   * Find garment by ID
   */
  static async findById(garmentId) {
    try {
      if (!garmentId) throw new Error('Garment ID is required');
      
      const garmentDoc = await db.collection(COLLECTIONS.GARMENTS).doc(garmentId).get();
      
      if (!garmentDoc.exists) {
        return null;
      }
      
      const garmentData = garmentDoc.data();
      return new GarmentModel({ id: garmentDoc.id, ...garmentData });
    } catch (error) {
      logger.error('Failed to find garment by ID', { garmentId, error: error.message });
      throw error;
    }
  }

  /**
   * Find garments by store ID
   */
  static async findByStoreId(storeId, limit = 50, offset = 0) {
    try {
      if (!storeId) throw new Error('Store ID is required');
      
      const garmentsSnapshot = await db.collection(COLLECTIONS.GARMENTS)
        .where('store_id', '==', storeId)
        .limit(limit)
        .get();
      
      const garments = [];
      garmentsSnapshot.forEach(doc => {
        const garmentData = doc.data();
        garments.push(new GarmentModel({ id: doc.id, ...garmentData }));
      });
      
      // Sort in memory instead of in Firestore query
      garments.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
      
      return garments;
    } catch (error) {
      logger.error('Failed to find garments by store ID', { storeId, error: error.message });
      throw error;
    }
  }

  /**
   * Find garments by category
   */
  static async findByCategory(category, limit = 50, offset = 0) {
    try {
      if (!category) throw new Error('Category is required');
      
      const garmentsSnapshot = await db.collection(COLLECTIONS.GARMENTS)
        .where('category', '==', category)
        .limit(limit)
        .get();
      
      const garments = [];
      garmentsSnapshot.forEach(doc => {
        const garmentData = doc.data();
        garments.push(new GarmentModel({ id: doc.id, ...garmentData }));
      });
      
      // Sort in memory instead of in Firestore query
      garments.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
      
      return garments;
    } catch (error) {
      logger.error('Failed to find garments by category', { category, error: error.message });
      throw error;
    }
  }

  /**
   * Find garments by user ID
   */
  static async findByUserId(userId, limit = 50, offset = 0) {
    try {
      if (!userId) throw new Error('User ID is required');
      
      // For now, ignore offset as it might not be supported in all Firestore versions
      // Temporarily removed orderBy to avoid index requirement
      const garmentsSnapshot = await db.collection(COLLECTIONS.GARMENTS)
        .where('user_id', '==', userId)
        .limit(limit)
        .get();
      
      const garments = [];
      garmentsSnapshot.forEach(doc => {
        const garmentData = doc.data();
        garments.push(new GarmentModel({ id: doc.id, ...garmentData }));
      });
      
      // Sort in memory instead of in Firestore query
      garments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      return garments;
    } catch (error) {
      logger.error('Failed to find garments by user ID', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Search garments by name or tags
   */
  static async search(query, limit = 50, offset = 0) {
    try {
      if (!query || query.trim().length < 2) {
        throw new Error('Search query must be at least 2 characters long');
      }
      
      const searchTerm = query.toLowerCase().trim();
      
      // Search in name and tags
      const garmentsSnapshot = await db.collection(COLLECTIONS.GARMENTS)
        .orderBy('name')
        .startAt(searchTerm)
        .endAt(searchTerm + '\uf8ff')
        .limit(limit)
        .get();
      
      const garments = [];
      garmentsSnapshot.forEach(doc => {
        const garmentData = doc.data();
        const garment = new GarmentModel({ id: doc.id, ...garmentData });
        
        // Also check tags for matches
        if (garment.tags.some(tag => tag.toLowerCase().includes(searchTerm))) {
          garments.push(garment);
        } else if (garment.name.toLowerCase().includes(searchTerm)) {
          garments.push(garment);
        }
      });
      
      return garments;
    } catch (error) {
      logger.error('Failed to search garments', { query, error: error.message });
      throw error;
    }
  }

  /**
   * Update garment data
   */
  async update(updateData) {
    try {
      // Ensure we have a valid date for updated_at
      const now = new Date();
      const updatedGarment = { ...this, ...updateData, updated_at: now };
      
      // Create a temporary GarmentModel instance for validation
      const tempGarment = new GarmentModel(updatedGarment);
      const validation = tempGarment.validateForUpdate();
      
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Prepare the update data without the id field
      const { id, ...updateDataForFirestore } = tempGarment.toFirestore();
      
      // Debug logging to see what's being sent to Firestore
      logger.debug('Update data for Firestore:', {
        garmentId: this.id,
        updateData: updateDataForFirestore,
        dateFields: {
          uploaded_at: updateDataForFirestore.uploaded_at,
          updated_at: updateDataForFirestore.updated_at,
          created_at: updateDataForFirestore.created_at
        }
      });
      
      await db.collection(COLLECTIONS.GARMENTS).doc(this.id).update(updateDataForFirestore);
      
      Object.assign(this, updatedGarment);
      
      logger.info('Garment updated successfully', { 
        garmentId: this.id, 
        storeId: this.store_id,
        name: this.name 
      });
      return this;
    } catch (error) {
      logger.error('Failed to update garment', { garmentId: this.id, error: error.message });
      throw error;
    }
  }

  /**
   * Delete garment
   */
  async delete() {
    try {
      await db.collection(COLLECTIONS.GARMENTS).doc(this.id).delete();
      
      logger.info('Garment deleted successfully', { 
        garmentId: this.id, 
        storeId: this.store_id,
        name: this.name 
      });
      return true;
    } catch (error) {
      logger.error('Failed to delete garment', { garmentId: this.id, error: error.message });
      throw error;
    }
  }

  /**
   * Static delete method
   */
  static async delete(garmentId) {
    try {
      if (!garmentId) throw new Error('Garment ID is required');
      
      await db.collection(COLLECTIONS.GARMENTS).doc(garmentId).delete();
      
      logger.info('Garment deleted successfully', { garmentId });
      return true;
    } catch (error) {
      logger.error('Failed to delete garment', { garmentId, error: error.message });
      throw error;
    }
  }

  /**
   * Get all garments (with pagination)
   */
  static async findAll(limit = 50, offset = 0) {
    try {
      const garmentsSnapshot = await db.collection(COLLECTIONS.GARMENTS)
        .limit(limit)
        .get();
      
      const garments = [];
      garmentsSnapshot.forEach(doc => {
        const garmentData = doc.data();
        garments.push(new GarmentModel({ id: doc.id, ...garmentData }));
      });
      
      // Sort in memory instead of in Firestore query
      garments.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
      
      return garments;
    } catch (error) {
      logger.error('Failed to fetch garments', { error: error.message });
      throw error;
    }
  }

  /**
   * Get garment statistics
   */
  static async getStats() {
    try {
      const stats = {
        total: 0,
        byCategory: {},
        byStore: {}
      };
      
      const garmentsSnapshot = await db.collection(COLLECTIONS.GARMENTS).get();
      
      garmentsSnapshot.forEach(doc => {
        const garmentData = doc.data();
        stats.total++;
        
        // Count by category
        stats.byCategory[garmentData.category] = (stats.byCategory[garmentData.category] || 0) + 1;
        
        // Count by store
        stats.byStore[garmentData.store_id] = (stats.byStore[garmentData.store_id] || 0) + 1;
      });
      
      return stats;
    } catch (error) {
      logger.error('Failed to get garment statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Convert to Firestore document
   */
  toFirestore() {
    const { id, ...data } = this;
    
    // Helper function to safely convert to Date and ensure it's valid
    const safeDate = (dateValue) => {
      if (!dateValue) return new Date(); // Always return a valid date
      if (dateValue instanceof Date) {
        // Check if the Date is valid
        if (isNaN(dateValue.getTime())) {
          console.warn('Invalid Date object detected, using current date');
          return new Date();
        }
        return dateValue;
      }
      if (typeof dateValue === 'string') {
        const parsedDate = new Date(dateValue);
        if (isNaN(parsedDate.getTime())) {
          console.warn('Invalid date string detected:', dateValue, 'using current date');
          return new Date();
        }
        return parsedDate;
      }
      if (typeof dateValue === 'number') {
        const parsedDate = new Date(dateValue);
        if (isNaN(parsedDate.getTime())) {
          console.warn('Invalid date number detected:', dateValue, 'using current date');
          return new Date();
        }
        return parsedDate;
      }
      try {
        const parsedDate = new Date(dateValue);
        if (isNaN(parsedDate.getTime())) {
          console.warn('Invalid date value detected:', dateValue, 'using current date');
          return new Date();
        }
        return parsedDate;
      } catch (error) {
        console.warn('Failed to convert date value:', dateValue, error, 'using current date');
        return new Date(); // fallback to current date
      }
    };
    
    // Ensure all date fields are valid Date objects
    const firestoreData = {
      ...data,
      uploaded_at: safeDate(this.uploaded_at),
      updated_at: safeDate(this.updated_at),
      created_at: safeDate(this.created_at)
    };
    
    // Double-check that all dates are valid before returning
    Object.keys(firestoreData).forEach(key => {
      if (key.includes('_at') && firestoreData[key]) {
        if (!(firestoreData[key] instanceof Date) || isNaN(firestoreData[key].getTime())) {
          console.error('Invalid date detected in toFirestore:', key, firestoreData[key]);
          firestoreData[key] = new Date();
        }
      }
    });
    
    return firestoreData;
  }

  /**
   * Convert to plain object (for API responses)
   */
  toJSON() {
    return {
      ...this,
      uploaded_at: this.uploaded_at instanceof Date ? this.uploaded_at.toISOString() : this.uploaded_at,
      updated_at: this.updated_at instanceof Date ? this.updated_at.toISOString() : this.updated_at
    };
  }
}

