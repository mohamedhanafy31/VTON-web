import db from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * AdminModel - Manages admin entities in the database
 */
export class AdminModel {
  constructor(data) {
    this.id = data.id || null;
    this.email = data.email;
    this.password = data.password;
    this.role = data.role || 'admin';
    this.name = data.name || 'Administrator';
    this.permissions = data.permissions || ['read', 'write', 'delete'];
    this.is_active = data.is_active !== undefined ? data.is_active : true;
    this.last_login = data.last_login || null;
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  /**
   * Validate admin data
   */
  validate() {
    const errors = [];
    
    if (!this.email) errors.push('Email is required');
    if (!this.password) errors.push('Password is required');
    if (!this.role) errors.push('Role is required');
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      errors.push('Invalid email format');
    }
    
    // Validate password strength
    if (this.password && this.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }
    
    // Validate role
    const validRoles = ['admin', 'super_admin', 'moderator'];
    if (!validRoles.includes(this.role)) {
      errors.push(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }
    
    return errors;
  }

  /**
   * Create a new admin
   */
  static async create(adminData) {
    try {
      const admin = new AdminModel(adminData);
      const errors = admin.validate();
      
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }

      if (!db) {
        throw new Error('Database connection not available');
      }

      // Check if admin with this email already exists
      const existingAdmin = await AdminModel.findByEmail(admin.email);
      if (existingAdmin) {
        throw new Error('Admin with this email already exists');
      }

      const adminRef = db.collection('admins').doc();
      const adminDoc = {
        ...admin,
        id: adminRef.id,
        created_at: new Date(),
        updated_at: new Date()
      };

      await adminRef.set(adminDoc);
      logger.info('Admin created successfully', { adminId: adminRef.id });
      
      return { ...adminDoc, id: adminRef.id };
    } catch (error) {
      logger.error('Failed to create admin:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find admin by ID
   */
  static async findById(adminId) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const adminDoc = await db.collection('admins').doc(adminId).get();
      
      if (!adminDoc.exists) {
        return null;
      }

      return { id: adminDoc.id, ...adminDoc.data() };
    } catch (error) {
      logger.error('Failed to find admin by ID:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find admin by email
   */
  static async findByEmail(email) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const adminsSnapshot = await db.collection('admins')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (adminsSnapshot.empty) {
        return null;
      }

      const adminDoc = adminsSnapshot.docs[0];
      return { id: adminDoc.id, ...adminDoc.data() };
    } catch (error) {
      logger.error('Failed to find admin by email:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find admins by role
   */
  static async findByRole(role, limit = 50, offset = 0) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const adminsSnapshot = await db.collection('admins')
        .where('role', '==', role)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      return adminsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Failed to find admins by role:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find all active admins
   */
  static async findActive(limit = 50, offset = 0) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const adminsSnapshot = await db.collection('admins')
        .where('is_active', '==', true)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      return adminsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Failed to find active admins:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Update admin
   */
  static async update(adminId, updateData) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const adminRef = db.collection('admins').doc(adminId);
      const adminDoc = await adminRef.get();
      
      if (!adminDoc.exists) {
        throw new Error('Admin not found');
      }

      const updatedData = {
        ...updateData,
        updated_at: new Date()
      };

      await adminRef.update(updatedData);
      logger.info('Admin updated successfully', { adminId });
      
      return { id: adminId, ...adminDoc.data(), ...updatedData };
    } catch (error) {
      logger.error('Failed to update admin:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Delete admin
   */
  static async delete(adminId) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const adminRef = db.collection('admins').doc(adminId);
      const adminDoc = await adminRef.get();
      
      if (!adminDoc.exists) {
        throw new Error('Admin not found');
      }

      await adminRef.delete();
      logger.info('Admin deleted successfully', { adminId });
      
      return true;
    } catch (error) {
      logger.error('Failed to delete admin:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Update last login time
   */
  static async updateLastLogin(adminId) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const adminRef = db.collection('admins').doc(adminId);
      await adminRef.update({
        last_login: new Date(),
        updated_at: new Date()
      });

      logger.info('Admin last login updated', { adminId });
      return true;
    } catch (error) {
      logger.error('Failed to update admin last login:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Get admin statistics
   */
  static async getStats() {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const adminsSnapshot = await db.collection('admins').get();
      const admins = adminsSnapshot.docs.map(doc => doc.data());

      const stats = {
        total: admins.length,
        byRole: {},
        byStatus: {},
        byMonth: {},
        activeCount: 0,
        inactiveCount: 0
      };

      admins.forEach(admin => {
        // Count by role
        stats.byRole[admin.role] = (stats.byRole[admin.role] || 0) + 1;
        
        // Count by status
        if (admin.is_active) {
          stats.activeCount++;
        } else {
          stats.inactiveCount++;
        }
        
        // Count by month
        const month = new Date(admin.created_at).toISOString().substring(0, 7);
        stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
      });

      logger.info('Admin statistics retrieved successfully');
      return stats;
    } catch (error) {
      logger.error('Failed to get admin statistics:', { error: error.message, stack: error.stack });
      throw error;
    }
  }
}


