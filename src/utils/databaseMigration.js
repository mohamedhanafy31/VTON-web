import db from '../config/db.js';
import { StoreModel, GarmentModel, UserModel } from '../models/index.js';
import { COLLECTIONS } from '../models/index.js';
import logger from './logger.js';

/**
 * Database Migration Utility
 * Migrates existing unstructured data to new structured models
 */
export class DatabaseMigration {
  
  /**
   * Migrate all existing data to new structure
   */
  static async migrateAll() {
    try {
      logger.info('Starting database migration...');
      
      // Create new collections if they don't exist
      await this.createCollections();
      
      // Migrate stores from 'information' collection
      await this.migrateStores();
      
      // Migrate garments from nested structure
      await this.migrateGarments();
      
      // Migrate users and orders
      await this.migrateUsersAndOrders();
      
      logger.info('Database migration completed successfully');
      return { success: true, message: 'Migration completed' };
    } catch (error) {
      logger.error('Database migration failed', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Create new collections with proper structure
   */
  static async createCollections() {
    try {
      const collections = [
        COLLECTIONS.STORES,
        COLLECTIONS.GARMENTS,
        COLLECTIONS.USERS,
        COLLECTIONS.ORDERS,
        COLLECTIONS.TRYON_JOBS,
        COLLECTIONS.IMAGES,
        COLLECTIONS.ADMINS
      ];

      for (const collectionName of collections) {
        // Create a dummy document to ensure collection exists
        const collectionRef = db.collection(collectionName);
        await collectionRef.doc('_migration_check').set({
          created_at: new Date(),
          migration_version: '1.0.0'
        });
        
        // Delete the dummy document
        await collectionRef.doc('_migration_check').delete();
        
        logger.info(`Collection '${collectionName}' created/verified`);
      }
    } catch (error) {
      logger.error('Failed to create collections', { error: error.message });
      throw error;
    }
  }

  /**
   * Migrate stores from old 'information' collection
   */
  static async migrateStores() {
    try {
      logger.info('Migrating stores...');
      
      const oldStoresSnapshot = await db.collection('information').get();
      let migratedCount = 0;
      
      for (const doc of oldStoresSnapshot.docs) {
        const oldData = doc.data();
        
        // Check if this is a store document (has store_name and email)
        if (oldData.store_name && oldData.email) {
          try {
            // Check if store already exists in new structure
            const existingStore = await StoreModel.findByEmail(oldData.email);
            
            if (!existingStore) {
              // Create new store with structured data
              const storeData = {
                store_name: oldData.store_name,
                email: oldData.email,
                password: oldData.password || 'migrated_password', // Will need to be reset
                logo_link: oldData.logo_link || '/MetaVrLogo.jpg',
                specialization: oldData.specialization || 'General',
                access: oldData.access || false,
                garment_limit: oldData.garment_limit || 10,
                tryon_limit: oldData.num_trails || 10
              };
              
              await StoreModel.create(storeData);
              migratedCount++;
              
              logger.info(`Store migrated: ${oldData.store_name}`);
            } else {
              logger.info(`Store already exists: ${oldData.store_name}`);
            }
          } catch (error) {
            logger.error(`Failed to migrate store: ${oldData.store_name}`, { error: error.message });
          }
        }
      }
      
      logger.info(`Stores migration completed. Migrated: ${migratedCount}`);
    } catch (error) {
      logger.error('Failed to migrate stores', { error: error.message });
      throw error;
    }
  }

  /**
   * Migrate garments from old nested structure
   */
  static async migrateGarments() {
    try {
      logger.info('Migrating garments...');
      
      const oldGarmentsSnapshot = await db.collection('garments').doc('information').get();
      let migratedCount = 0;
      
      if (oldGarmentsSnapshot.exists) {
        const oldGarmentsData = oldGarmentsSnapshot.data();
        
        for (const [oldId, oldData] of Object.entries(oldGarmentsData)) {
          try {
            // Find the store by name
            const storeSnapshot = await db.collection(COLLECTIONS.STORES)
              .where('store_name', '==', oldData.store)
              .limit(1)
              .get();
            
            if (!storeSnapshot.empty) {
              const storeDoc = storeSnapshot.docs[0];
              const storeData = storeDoc.data();
              
              // Create new garment with structured data
              const garmentData = {
                name: oldData.name || `${oldData.color} ${oldData.type}`,
                store_id: storeDoc.id,
                type: oldData.type || 'Unknown',
                category: this.determineCategory(oldData.type),
                color: oldData.color || 'Unknown',
                url: oldData.url || '',
                public_id: oldData.public_id || oldId,
                description: oldData.description || '',
                price: oldData.price || 0,
                tags: oldData.tags || []
              };
              
              await GarmentModel.create(garmentData);
              migratedCount++;
              
              logger.info(`Garment migrated: ${garmentData.name}`);
            } else {
              logger.warn(`Store not found for garment: ${oldData.store}`);
            }
          } catch (error) {
            logger.error(`Failed to migrate garment: ${oldId}`, { error: error.message });
          }
        }
      }
      
      logger.info(`Garments migration completed. Migrated: ${migratedCount}`);
    } catch (error) {
      logger.error('Failed to migrate garments', { error: error.message });
      throw error;
    }
  }

  /**
   * Migrate users and orders from old structure
   */
  static async migrateUsersAndOrders() {
    try {
      logger.info('Migrating users and orders...');
      
      // Migrate orders from old 'stores' collection
      const oldOrdersSnapshot = await db.collection('stores').doc('orders').get();
      let migratedCount = 0;
      
      if (oldOrdersSnapshot.exists) {
        const oldOrdersData = oldOrdersSnapshot.data();
        
        for (const [oldId, oldData] of Object.entries(oldOrdersData)) {
          try {
            if (oldData.wanted && oldData.name && oldData.phone) {
              // Create or find user
              let user = await UserModel.findByEmail(oldData.email || `${oldData.phone}@migrated.com`);
              
              if (!user) {
                user = await UserModel.create({
                  email: oldData.email || `${oldData.phone}@migrated.com`,
                  name: oldData.name,
                  phone: oldData.phone
                });
              }
              
              // Find store
              const storeSnapshot = await db.collection(COLLECTIONS.STORES)
                .where('store_name', '==', oldData.storeName)
                .limit(1)
                .get();
              
              if (!storeSnapshot.empty) {
                const storeDoc = storeSnapshot.docs[0];
                
                // Create order in new structure
                await db.collection(COLLECTIONS.ORDERS).add({
                  user_id: user.id,
                  store_id: storeDoc.id,
                  garment_id: oldData.garmentId || null,
                  status: 'pending',
                  quantity: 1,
                  notes: `Migrated from old system. Original ID: ${oldId}`,
                  created_at: new Date(),
                  updated_at: new Date()
                });
                
                migratedCount++;
                logger.info(`Order migrated for user: ${user.name}`);
              }
            }
          } catch (error) {
            logger.error(`Failed to migrate order: ${oldId}`, { error: error.message });
          }
        }
      }
      
      logger.info(`Users and orders migration completed. Migrated: ${migratedCount}`);
    } catch (error) {
      logger.error('Failed to migrate users and orders', { error: error.message });
      throw error;
    }
  }

  /**
   * Determine garment category based on type
   */
  static determineCategory(type) {
    if (!type) return 'upper_body';
    
    const lowerType = type.toLowerCase();
    
    if (['shirt', 't-shirt', 'jacket', 'sweater', 'top', 'blouse', 'sweatshirt'].includes(lowerType)) {
      return 'upper_body';
    } else if (['pants', 'jeans', 'shorts', 'skirt', 'trousers'].includes(lowerType)) {
      return 'lower_body';
    } else if (['dress', 'gown', 'jumpsuit'].includes(lowerType)) {
      return 'full_body';
    } else {
      return 'accessories';
    }
  }

  /**
   * Rollback migration (restore old structure)
   */
  static async rollback() {
    try {
      logger.warn('Rolling back database migration...');
      
      // This is a destructive operation - use with caution
      const collections = [
        COLLECTIONS.STORES,
        COLLECTIONS.GARMENTS,
        COLLECTIONS.USERS,
        COLLECTIONS.ORDERS,
        COLLECTIONS.TRYON_JOBS,
        COLLECTIONS.IMAGES,
        COLLECTIONS.ADMINS
      ];

      for (const collectionName of collections) {
        const collectionRef = db.collection(collectionName);
        const snapshot = await collectionRef.get();
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        logger.info(`Collection '${collectionName}' cleared`);
      }
      
      logger.warn('Database migration rollback completed');
      return { success: true, message: 'Rollback completed' };
    } catch (error) {
      logger.error('Failed to rollback migration', { error: error.message });
      throw error;
    }
  }

  /**
   * Get migration status
   */
  static async getStatus() {
    try {
      const status = {
        stores: 0,
        garments: 0,
        users: 0,
        orders: 0,
        tryonJobs: 0,
        images: 0,
        admins: 0
      };

      const collections = [
        { key: 'stores', collection: COLLECTIONS.STORES },
        { key: 'garments', collection: COLLECTIONS.GARMENTS },
        { key: 'users', collection: COLLECTIONS.USERS },
        { key: 'orders', collection: COLLECTIONS.ORDERS },
        { key: 'tryonJobs', collection: COLLECTIONS.TRYON_JOBS },
        { key: 'images', collection: COLLECTIONS.IMAGES },
        { key: 'admins', collection: COLLECTIONS.ADMINS }
      ];

      for (const { key, collection } of collections) {
        try {
          const snapshot = await db.collection(collection).count().get();
          status[key] = snapshot.data().count;
        } catch (error) {
          status[key] = 'error';
        }
      }

      return status;
    } catch (error) {
      logger.error('Failed to get migration status', { error: error.message });
      throw error;
    }
  }
}



