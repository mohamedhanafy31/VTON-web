import db from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * OrderModel - Manages order entities in the database
 */
export class OrderModel {
  constructor(data) {
    this.id = data.id || null;
    this.user_id = data.user_id;
    this.store_id = data.store_id;
    this.garment_id = data.garment_id;
    this.status = data.status || 'pending';
    this.quantity = data.quantity || 0;
    this.notes = data.notes || '';
    this.customer_name = data.customer_name || '';
    this.customer_phone = data.customer_phone || '';
    this.tryon_result_url = data.tryon_result_url || '';
    this.tryon_job_id = data.tryon_job_id || '';
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  /**
   * Validate order data
   */
  validate() {
    const errors = [];
    
    if (!this.user_id) errors.push('User ID is required');
    if (!this.garment_id) errors.push('Garment ID is required');
    if (!this.status) errors.push('Status is required');
    if (!this.customer_name) errors.push('Customer name is required');
    if (!this.customer_phone) errors.push('Customer phone is required');
    
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'approved'];
    if (!validStatuses.includes(this.status)) {
      errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    if (this.quantity < 0) errors.push('Quantity must be at least 0');
    
    // Phone number validation
    if (this.customer_phone && !/^\+?[\d\s\-\(\)]+$/.test(this.customer_phone)) {
      errors.push('Invalid phone number format');
    }
    
    return errors;
  }

  /**
   * Create a new order
   */
  static async create(orderData) {
    try {
      const order = new OrderModel(orderData);
      const errors = order.validate();
      
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }

      if (!db) {
        throw new Error('Database connection not available');
      }

      const orderRef = db.collection('orders').doc();
      
      // Filter out undefined values for Firestore
      const cleanOrderData = {};
      Object.keys(order).forEach(key => {
        if (order[key] !== undefined) {
          cleanOrderData[key] = order[key];
        }
      });
      
      const orderDoc = {
        ...cleanOrderData,
        id: orderRef.id,
        created_at: new Date(),
        updated_at: new Date()
      };

      await orderRef.set(orderDoc);
      logger.info('Order created successfully', { orderId: orderRef.id });
      
      return { ...orderDoc, id: orderRef.id };
    } catch (error) {
      logger.error('Failed to create order:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find order by ID
   */
  static async findById(orderId) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const orderDoc = await db.collection('orders').doc(orderId).get();
      
      if (!orderDoc.exists) {
        return null;
      }

      return { id: orderDoc.id, ...orderDoc.data() };
    } catch (error) {
      logger.error('Failed to find order by ID:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find orders by user ID
   */
  static async findByUserId(userId, limit = 50, offset = 0) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const ordersSnapshot = await db.collection('orders')
        .where('user_id', '==', userId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      return ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Failed to find orders by user ID:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find orders by store ID
   */
  static async findByStoreId(storeId, limit = 50, offset = 0) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const ordersSnapshot = await db.collection('orders')
        .where('store_id', '==', storeId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      return ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Failed to find orders by store ID:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Update order
   */
  static async update(orderId, updateData) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const orderRef = db.collection('orders').doc(orderId);
      const orderDoc = await orderRef.get();
      
      if (!orderDoc.exists) {
        throw new Error('Order not found');
      }

      const updatedData = {
        ...updateData,
        updated_at: new Date()
      };

      await orderRef.update(updatedData);
      logger.info('Order updated successfully', { orderId });
      
      return { id: orderId, ...orderDoc.data(), ...updatedData };
    } catch (error) {
      logger.error('Failed to update order:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Delete order
   */
  static async delete(orderId) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const orderRef = db.collection('orders').doc(orderId);
      const orderDoc = await orderRef.get();
      
      if (!orderDoc.exists) {
        throw new Error('Order not found');
      }

      await orderRef.delete();
      logger.info('Order deleted successfully', { orderId });
      
      return true;
    } catch (error) {
      logger.error('Failed to delete order:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Get order statistics
   */
  static async getStats() {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const ordersSnapshot = await db.collection('orders').get();
      const orders = ordersSnapshot.docs.map(doc => doc.data());

      const stats = {
        total: orders.length,
        byStatus: {},
        byMonth: {},
        totalValue: 0
      };

      orders.forEach(order => {
        // Count by status
        stats.byStatus[order.status] = (stats.byStatus[order.status] || 0) + 1;
        
        // Count by month
        const month = new Date(order.created_at).toISOString().substring(0, 7);
        stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
      });

      logger.info('Order statistics retrieved successfully');
      return stats;
    } catch (error) {
      logger.error('Failed to get order statistics:', { error: error.message, stack: error.stack });
      throw error;
    }
  }
}


