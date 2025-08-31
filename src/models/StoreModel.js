import db from '../config/db.js';
import { COLLECTIONS } from './index.js';
import logger from '../utils/logger.js';

/**
 * Store Model - Manages store data and operations
 */
export class StoreModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.store_name = data.store_name || '';
    this.email = data.email || '';
    this.password = data.password || '';
    this.logo_link = data.logo_link || '/MetaVrLogo.jpg';
    this.specialization = data.specialization || 'General';
    this.access = data.access || false;
    this.garment_limit = data.garment_limit || 10;
    this.tryon_limit = data.tryon_limit || 10;
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  /**
   * Validate store data
   */
  validate() {
    const errors = [];
    
    if (!this.store_name || this.store_name.trim().length < 2) {
      errors.push('Store name must be at least 2 characters long');
    }
    
    if (!this.email || !this.email.includes('@')) {
      errors.push('Valid email is required');
    }
    
    if (!this.password || this.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }
    
    if (this.garment_limit < 1 || this.garment_limit > 1000) {
      errors.push('Garment limit must be between 1 and 1000');
    }
    
    if (this.tryon_limit < 1 || this.tryon_limit > 1000) {
      errors.push('Try-on limit must be between 1 and 1000');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a new store
   */
  static async create(storeData) {
    try {
      const store = new StoreModel(storeData);
      const validation = store.validate();
      
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      const storeRef = db.collection(COLLECTIONS.STORES).doc();
      store.id = storeRef.id;
      store.created_at = new Date();
      store.updated_at = new Date();
      
      await storeRef.set(store.toFirestore());
      
      logger.info('Store created successfully', { storeId: store.id, storeName: store.store_name });
      return store;
    } catch (error) {
      logger.error('Failed to create store', { error: error.message, storeData });
      throw error;
    }
  }

  /**
   * Find store by ID
   */
  static async findById(storeId) {
    try {
      if (!storeId) throw new Error('Store ID is required');
      
      const storeDoc = await db.collection(COLLECTIONS.STORES).doc(storeId).get();
      
      if (!storeDoc.exists) {
        return null;
      }
      
      const storeData = storeDoc.data();
      return new StoreModel({ id: storeDoc.id, ...storeData });
    } catch (error) {
      logger.error('Failed to find store by ID', { storeId, error: error.message });
      throw error;
    }
  }

  /**
   * Find store by email
   */
  static async findByEmail(email) {
    try {
      if (!email) throw new Error('Email is required');
      
      const storeSnapshot = await db.collection(COLLECTIONS.STORES)
        .where('email', '==', email)
        .limit(1)
        .get();
      
      if (storeSnapshot.empty) {
        return null;
      }
      
      const storeDoc = storeSnapshot.docs[0];
      const storeData = storeDoc.data();
      return new StoreModel({ id: storeDoc.id, ...storeData });
    } catch (error) {
      logger.error('Failed to find store by email', { email, error: error.message });
      throw error;
    }
  }

  /**
   * Update store data
   */
  async update(updateData) {
    try {
      const updatedStore = { ...this, ...updateData, updated_at: new Date() };
      const validation = updatedStore.validate();
      
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      await db.collection(COLLECTIONS.STORES).doc(this.id).update(updatedStore.toFirestore());
      
      Object.assign(this, updatedStore);
      
      logger.info('Store updated successfully', { storeId: this.id, storeName: this.store_name });
      return this;
    } catch (error) {
      logger.error('Failed to update store', { storeId: this.id, error: error.message });
      throw error;
    }
  }

  /**
   * Delete store
   */
  async delete() {
    try {
      await db.collection(COLLECTIONS.STORES).doc(this.id).delete();
      
      logger.info('Store deleted successfully', { storeId: this.id, storeName: this.store_name });
      return true;
    } catch (error) {
      logger.error('Failed to delete store', { storeId: this.id, error: error.message });
      throw error;
    }
  }

  /**
   * Get all stores (with pagination)
   */
  static async findAll(limit = 50, offset = 0) {
    try {
      const storesSnapshot = await db.collection(COLLECTIONS.STORES)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
      
      const stores = [];
      storesSnapshot.forEach(doc => {
        const storeData = doc.data();
        stores.push(new StoreModel({ id: doc.id, ...storeData }));
      });
      
      return stores;
    } catch (error) {
      logger.error('Failed to fetch stores', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if store has reached garment limit
   */
  async hasReachedGarmentLimit() {
    try {
      const garmentsSnapshot = await db.collection(COLLECTIONS.GARMENTS)
        .where('store_id', '==', this.id)
        .count()
        .get();
      
      const currentCount = garmentsSnapshot.data().count;
      return currentCount >= this.garment_limit;
    } catch (error) {
      logger.error('Failed to check garment limit', { storeId: this.id, error: error.message });
      return false;
    }
  }

  /**
   * Check if store has reached try-on limit
   */
  async hasReachedTryOnLimit() {
    try {
      const tryOnSnapshot = await db.collection(COLLECTIONS.TRYON_JOBS)
        .where('store_id', '==', this.id)
        .where('created_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
        .count()
        .get();
      
      const currentCount = tryOnSnapshot.data().count;
      return currentCount >= this.tryon_limit;
    } catch (error) {
      logger.error('Failed to check try-on limit', { storeId: this.id, error: error.message });
      return false;
    }
  }

  /**
   * Convert to Firestore document
   */
  toFirestore() {
    const { id, ...data } = this;
    return {
      ...data,
      created_at: this.created_at instanceof Date ? this.created_at : new Date(this.created_at),
      updated_at: this.updated_at instanceof Date ? this.updated_at : new Date(this.updated_at)
    };
  }

  /**
   * Convert to plain object (for API responses)
   */
  toJSON() {
    const { password, ...safeData } = this;
    return safeData;
  }
}



