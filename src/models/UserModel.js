import db from '../config/db.js';
import { COLLECTIONS } from './index.js';
import logger from '../utils/logger.js';

/**
 * User Model - Manages customer/end-user data and operations
 */
export class UserModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.username = data.username || '';
    this.email = data.email || '';
    this.password = data.password || '';
    this.name = data.name || '';
    this.phone = data.phone || '';
    this.avatar = data.avatar || '';
    this.is_active = data.is_active !== undefined ? data.is_active : true;
    this.last_login = data.last_login || null;
    this.trials_remaining = data.trials_remaining !== undefined ? data.trials_remaining : 50;
    this.preferences = data.preferences || {
      favoriteCategories: [],
      sizePreferences: {},
      stylePreferences: []
    };
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  /**
   * Validate user data
   */
  validate() {
    const errors = [];
    
    if (!this.username || this.username.trim().length < 3) {
      errors.push('Username must be at least 3 characters long');
    }
    
    if (!this.name || this.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }
    
    if (!this.email || !this.email.includes('@')) {
      errors.push('Valid email is required');
    }
    
    if (!this.password || this.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }
    
    if (!this.phone || this.phone.trim().length < 10) {
      errors.push('Valid phone number is required');
    }
    
    if (this.trials_remaining < 0) {
      errors.push('Trials remaining cannot be negative');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a new user
   */
  static async create(userData) {
    try {
      const user = new UserModel(userData);
      const validation = user.validate();
      
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Check if email already exists
      const existingUser = await UserModel.findByEmail(user.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }
      
      // Check if username already exists
      const existingUsername = await UserModel.findByUsername(user.username);
      if (existingUsername) {
        throw new Error('Username is already taken');
      }
      
      const userRef = db.collection(COLLECTIONS.USERS).doc();
      user.id = userRef.id;
      user.created_at = new Date();
      user.updated_at = new Date();
      
      await userRef.set(user.toFirestore());
      
      logger.info('User created successfully', { userId: user.id, email: user.email });
      return user;
    } catch (error) {
      logger.error('Failed to create user', { error: error.message, userData });
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  static async findById(userId) {
    try {
      if (!userId) throw new Error('User ID is required');
      
      const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
      
      if (!userDoc.exists) {
        return null;
      }
      
      const userData = userDoc.data();
      return new UserModel({ id: userDoc.id, ...userData });
    } catch (error) {
      logger.error('Failed to find user by ID', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    try {
      if (!email) throw new Error('Email is required');
      
      const userSnapshot = await db.collection(COLLECTIONS.USERS)
        .where('email', '==', email)
        .limit(1)
        .get();
      
      if (userSnapshot.empty) {
        return null;
      }
      
      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      return new UserModel({ id: userDoc.id, ...userData });
    } catch (error) {
      logger.error('Failed to find user by email', { email, error: error.message });
      throw error;
    }
  }

  /**
   * Find user by username
   */
  static async findByUsername(username) {
    try {
      if (!username) throw new Error('Username is required');
      
      const userSnapshot = await db.collection(COLLECTIONS.USERS)
        .where('username', '==', username)
        .limit(1)
        .get();
      
      if (userSnapshot.empty) {
        return null;
      }
      
      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      return new UserModel({ id: userDoc.id, ...userData });
    } catch (error) {
      logger.error('Failed to find user by username', { username, error: error.message });
      throw error;
    }
  }

  /**
   * Update user data
   */
  async update(updateData) {
    try {
      const updatedUser = { ...this, ...updateData, updated_at: new Date() };
      const validation = updatedUser.validate();
      
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      await db.collection(COLLECTIONS.USERS).doc(this.id).update(updatedUser.toFirestore());
      
      Object.assign(this, updatedUser);
      
      logger.info('User updated successfully', { userId: this.id, email: this.email });
      return this;
    } catch (error) {
      logger.error('Failed to update user', { userId: this.id, error: error.message });
      throw error;
    }
  }

  /**
   * Delete user
   */
  async delete() {
    try {
      await db.collection(COLLECTIONS.USERS).doc(this.id).delete();
      
      logger.info('User deleted successfully', { userId: this.id, email: this.email });
      return true;
    } catch (error) {
      logger.error('Failed to delete user', { userId: this.id, error: error.message });
      throw error;
    }
  }

  /**
   * Get user's try-on history
   */
  async getTryOnHistory(limit = 20, offset = 0) {
    try {
      const tryOnSnapshot = await db.collection(COLLECTIONS.TRYON_JOBS)
        .where('user_id', '==', this.id)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
      
      const history = [];
      tryOnSnapshot.forEach(doc => {
        const tryOnData = doc.data();
        history.push({
          id: doc.id,
          ...tryOnData,
          created_at: tryOnData.created_at?.toDate?.() || tryOnData.created_at
        });
      });
      
      return history;
    } catch (error) {
      logger.error('Failed to get user try-on history', { userId: this.id, error: error.message });
      throw error;
    }
  }

  /**
   * Get user's orders
   */
  async getOrders(limit = 20, offset = 0) {
    try {
      const ordersSnapshot = await db.collection(COLLECTIONS.ORDERS)
        .where('user_id', '==', this.id)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
      
      const orders = [];
      ordersSnapshot.forEach(doc => {
        const orderData = doc.data();
        orders.push({
          id: doc.id,
          ...orderData,
          created_at: orderData.created_at?.toDate?.() || orderData.created_at
        });
      });
      
      return orders;
    } catch (error) {
      logger.error('Failed to get user orders', { userId: this.id, error: error.message });
      throw error;
    }
  }

  /**
   * Update last login time
   */
  async updateLastLogin() {
    try {
      this.last_login = new Date();
      this.updated_at = new Date();
      
      await db.collection(COLLECTIONS.USERS).doc(this.id).update({
        last_login: this.last_login,
        updated_at: this.updated_at
      });
      
      logger.info('User last login updated', { userId: this.id, username: this.username });
      return true;
    } catch (error) {
      logger.error('Failed to update user last login', { userId: this.id, error: error.message });
      throw error;
    }
  }

  /**
   * Decrease trials remaining
   */
  async decreaseTrials() {
    try {
      if (this.trials_remaining <= 0) {
        throw new Error('No trials remaining');
      }
      
      this.trials_remaining -= 1;
      this.updated_at = new Date();
      
      await db.collection(COLLECTIONS.USERS).doc(this.id).update({
        trials_remaining: this.trials_remaining,
        updated_at: this.updated_at
      });
      
      logger.info('User trials decreased', { userId: this.id, username: this.username, trialsRemaining: this.trials_remaining });
      return this.trials_remaining;
    } catch (error) {
      logger.error('Failed to decrease user trials', { userId: this.id, error: error.message });
      throw error;
    }
  }

  /**
   * Get trials remaining
   */
  async getTrialsRemaining() {
    try {
      const userDoc = await db.collection(COLLECTIONS.USERS).doc(this.id).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        this.trials_remaining = userData.trials_remaining || 0;
        return this.trials_remaining;
      }
      return 0;
    } catch (error) {
      logger.error('Failed to get user trials remaining', { userId: this.id, error: error.message });
      throw error;
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
    return {
      ...this,
      created_at: this.created_at instanceof Date ? this.created_at.toISOString() : this.created_at,
      updated_at: this.updated_at instanceof Date ? this.updated_at.toISOString() : this.updated_at
    };
  }
}

