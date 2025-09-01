// Enhanced Admin Controller with Comprehensive Error Handling
import db from '../config/db.js';
import bcrypt from 'bcrypt';
import logger from '../utils/logger.js';
import { 
  AdminError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  ResourceNotFoundError 
} from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Admin authentication controller
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Validate input
  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }
  
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new ValidationError('Email and password must be strings');
  }
  
  if (email.length > 100) {
    throw new ValidationError('Email is too long', 'email');
  }
  
  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters long', 'password');
  }
  
  try {
    // Handle database unavailable case with mock admin
    if (!db) {
      logger.warn('Database unavailable, using mock admin authentication');
      
      const mockAdminEmail = 'admin@metavrai.shop';
      const mockAdminPassword = 'admin123';
      
      if (email !== mockAdminEmail || password !== mockAdminPassword) {
        throw new AuthenticationError('Invalid credentials');
      }
      
      req.session.user = {
        role: 'admin',
        adminId: 'mock_admin_account',
        email: mockAdminEmail,
        loginTime: new Date().toISOString()
      };
      
      logger.info('Mock admin login successful', { email: mockAdminEmail });
      
      return res.json({
        success: true,
        message: 'Admin login successful',
        user: {
          role: 'admin',
          email: mockAdminEmail
        }
      });
    }
    
    // Database authentication
    const adminSnapshot = await db.collection('admin').doc('admin_account').get();
    
    if (!adminSnapshot.exists) {
      logger.warn('Admin account not found in database');
      throw new ResourceNotFoundError('Admin account not found');
    }
    
    const adminData = adminSnapshot.data();
    
    if (!adminData.password) {
      logger.error('Admin account has no password hash');
      throw new AdminError('Admin account configuration error', 500, 'ADMIN_CONFIG_ERROR');
    }
    
    const isMatch = await bcrypt.compare(password, adminData.password);
    
    if (!isMatch) {
      logger.warn('Admin login failed: invalid password', { email });
      throw new AuthenticationError('Invalid credentials');
    }
    
    // Set session
    req.session.user = {
      role: 'admin',
      adminId: 'admin_account',
      email: adminData.email || email,
      loginTime: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };
    
    await req.session.save();
    
    logger.info('Admin login successful', { email: adminData.email || email });
    
    res.json({
      success: true,
      message: 'Admin login successful',
      user: {
        role: 'admin',
        email: adminData.email || email
      }
    });
    
  } catch (error) {
    // Re-throw operational errors
    if (error.isOperational) {
      throw error;
    }
    
    // Handle database errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      logger.error('Database connection error during admin login', { error: error.message });
      throw new AdminError('Service temporarily unavailable', 503, 'SERVICE_UNAVAILABLE');
    }
    
    // Handle bcrypt errors
    if (error.message.includes('bcrypt')) {
      logger.error('Bcrypt error during admin login', { error: error.message });
      throw new AdminError('Authentication service error', 500, 'AUTH_SERVICE_ERROR');
    }
    
    // Log unexpected errors
    logger.error('Unexpected error during admin login', { 
      error: error.message, 
      stack: error.stack,
      email 
    });
    
    throw new AdminError('Login failed', 500, 'LOGIN_ERROR');
  }
});

// Admin logout controller
export const adminLogout = asyncHandler(async (req, res) => {
  try {
    // Clear session
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          logger.error('Error destroying admin session', { error: err.message });
        }
      });
    }
    
    // Clear cookie
    res.clearCookie('admin.sid');
    
    logger.info('Admin logout successful', { 
      adminId: req.user?.adminId || 'unknown',
      email: req.user?.email || 'unknown'
    });
    
    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
    
  } catch (error) {
    logger.error('Error during admin logout', { error: error.message });
    throw new AdminError('Logout failed', 500, 'LOGOUT_ERROR');
  }
});

// Admin session check controller
export const adminSessionCheck = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin session not found');
    }
    
    // Update last activity
    req.session.user.lastActivity = new Date().toISOString();
    await req.session.save();
    
    logger.debug('Admin session check successful', { 
      adminId: req.session.user.adminId,
      email: req.session.user.email 
    });
    
    res.json({
      success: true,
      authenticated: true,
      user: {
        role: req.session.user.role,
        email: req.session.user.email,
        adminId: req.session.user.adminId,
        loginTime: req.session.user.loginTime,
        lastActivity: req.session.user.lastActivity
      }
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Unexpected error during admin session check', { error: error.message });
    throw new AdminError('Session check failed', 500, 'SESSION_CHECK_ERROR');
  }
});

// Admin auth test controller
export const adminAuthTest = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    logger.debug('Admin auth test successful', { 
      adminId: req.session.user.adminId,
      email: req.session.user.email 
    });
    
    res.json({
      success: true,
      message: 'Admin authentication successful',
      user: {
        role: req.session.user.role,
        email: req.session.user.email,
        adminId: req.session.user.adminId
      }
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Unexpected error during admin auth test', { error: error.message });
    throw new AdminError('Auth test failed', 500, 'AUTH_TEST_ERROR');
  }
});

// Admin dashboard statistics controller
export const adminDashboardStats = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    if (!db) {
      throw new AdminError('Database unavailable', 503, 'SERVICE_UNAVAILABLE');
    }
    
    // Get garment statistics
    const garmentsSnapshot = await db.collection('garments').get();
    const garments = garmentsSnapshot.docs.map(doc => doc.data());
    
    const stats = {
      totalGarments: garments.length,
      approvedGarments: garments.filter(g => g.status === 'approved').length,
      pendingGarments: garments.filter(g => g.status === 'pending').length,
      rejectedGarments: garments.filter(g => g.status === 'rejected').length,
      totalViews: garments.reduce((sum, g) => sum + (g.views || 0), 0),
      categories: {},
      types: {}
    };
    
    // Calculate category and type distributions
    garments.forEach(garment => {
      if (garment.category) {
        stats.categories[garment.category] = (stats.categories[garment.category] || 0) + 1;
      }
      if (garment.type) {
        stats.types[garment.type] = (stats.types[garment.type] || 0) + 1;
      }
    });
    
    // Get store statistics
    const storesSnapshot = await db.collection('stores').get();
    const stores = storesSnapshot.docs.map(doc => doc.data());
    
    stats.totalStores = stores.length;
    stats.activeStores = stores.filter(s => s.access === true).length;
    
    // Get user statistics
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => doc.data());
    
    stats.totalUsers = users.length;
    stats.activeUsers = users.filter(u => u.status === 'active').length;
    
    logger.info('Admin dashboard stats retrieved successfully', { 
      adminId: req.session.user.adminId 
    });
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error retrieving admin dashboard stats', { 
      error: error.message,
      adminId: req.session.user?.adminId || 'unknown'
    });
    
    throw new AdminError('Failed to retrieve dashboard statistics', 500, 'STATS_RETRIEVAL_ERROR');
  }
});

// Admin system health check controller
export const adminSystemHealth = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      database: 'unknown',
      services: {}
    };
    
    // Check database health
    if (db) {
      try {
        await db.collection('admin').doc('health_check').get();
        health.database = 'connected';
      } catch (dbError) {
        health.database = 'disconnected';
        health.status = 'degraded';
      }
    } else {
      health.database = 'unavailable';
      health.status = 'degraded';
    }
    
    // Check environment variables
    const requiredEnvVars = ['SESSION_SECRET', 'NODE_ENV'];
    health.environmentVariables = {};
    
    requiredEnvVars.forEach(envVar => {
      health.environmentVariables[envVar] = !!process.env[envVar];
    });
    
    // Check if all required env vars are set
    const allEnvVarsSet = Object.values(health.environmentVariables).every(Boolean);
    if (!allEnvVarsSet) {
      health.status = 'degraded';
    }
    
    logger.info('Admin system health check completed', { 
      adminId: req.session.user.adminId,
      status: health.status 
    });
    
    res.json(health);
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error during admin system health check', { error: error.message });
    throw new AdminError('Health check failed', 500, 'HEALTH_CHECK_ERROR');
  }
});

// Admin activity log controller
export const adminActivityLog = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    const { page = 1, limit = 50, level, action, startDate, endDate } = req.query;
    
    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (isNaN(pageNum) || pageNum < 1) {
      throw new ValidationError('Invalid page number', 'page');
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new ValidationError('Invalid limit (must be between 1 and 100)', 'limit');
    }
    
    if (!db) {
      throw new AdminError('Database unavailable', 503, 'SERVICE_UNAVAILABLE');
    }
    
    // Build query
    let query = db.collection('admin_activity_logs');
    
    if (level) {
      query = query.where('level', '==', level);
    }
    
    if (action) {
      query = query.where('action', '==', action);
    }
    
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        throw new ValidationError('Invalid start date format', 'startDate');
      }
      query = query.where('timestamp', '>=', start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new ValidationError('Invalid end date format', 'endDate');
      }
      query = query.where('timestamp', '<=', end);
    }
    
    // Get total count
    const totalSnapshot = await query.count().get();
    const total = totalSnapshot.data().count;
    
    // Get paginated results
    const offset = (pageNum - 1) * limitNum;
    const logsSnapshot = await query
      .orderBy('timestamp', 'desc')
      .offset(offset)
      .limit(limitNum)
      .get();
    
    const logs = logsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
    }));
    
    logger.info('Admin activity log retrieved successfully', { 
      adminId: req.session.user.adminId,
      page: pageNum,
      limit: limitNum,
      total
    });
    
    res.json({
      success: true,
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error retrieving admin activity log', { 
      error: error.message,
      adminId: req.session.user?.adminId || 'unknown'
    });
    
    throw new AdminError('Failed to retrieve activity log', 500, 'ACTIVITY_LOG_ERROR');
  }
});

// Admin password change controller
export const adminChangePassword = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new ValidationError('All password fields are required');
    }
    
    if (newPassword !== confirmPassword) {
      throw new ValidationError('New passwords do not match', 'confirmPassword');
    }
    
    if (newPassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters long', 'newPassword');
    }
    
    if (newPassword === currentPassword) {
      throw new ValidationError('New password must be different from current password', 'newPassword');
    }
    
    if (!db) {
      throw new AdminError('Database unavailable', 503, 'SERVICE_UNAVAILABLE');
    }
    
    // Get current admin data
    const adminSnapshot = await db.collection('admin').doc('admin_account').get();
    
    if (!adminSnapshot.exists) {
      throw new ResourceNotFoundError('Admin account not found');
    }
    
    const adminData = adminSnapshot.data();
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, adminData.password);
    
    if (!isCurrentPasswordValid) {
      throw new AuthenticationError('Current password is incorrect');
    }
    
    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    await db.collection('admin').doc('admin_account').update({
      password: newPasswordHash,
      updatedAt: new Date()
    });
    
    // Log password change
    await db.collection('admin_activity_logs').add({
      action: 'password_change',
      level: 'info',
      adminId: req.session.user.adminId,
      email: req.session.user.email,
      timestamp: new Date(),
      details: 'Admin password changed successfully'
    });
    
    logger.info('Admin password changed successfully', { 
      adminId: req.session.user.adminId,
      email: req.session.user.email 
    });
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error changing admin password', { 
      error: error.message,
      adminId: req.session.user?.adminId || 'unknown'
    });
    
    throw new AdminError('Failed to change password', 500, 'PASSWORD_CHANGE_ERROR');
  }
});

// Admin profile update controller
export const adminUpdateProfile = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    const { email, name, preferences } = req.body;
    
    // Validate input
    if (email && (typeof email !== 'string' || email.length > 100)) {
      throw new ValidationError('Invalid email format or length', 'email');
    }
    
    if (name && (typeof name !== 'string' || name.length > 100)) {
      throw new ValidationError('Invalid name format or length', 'name');
    }
    
    if (!db) {
      throw new AdminError('Database unavailable', 503, 'SERVICE_UNAVAILABLE');
    }
    
    // Update admin profile
    const updateData = {
      updatedAt: new Date()
    };
    
    if (email) updateData.email = email;
    if (name) updateData.name = name;
    if (preferences) updateData.preferences = preferences;
    
    await db.collection('admin').doc('admin_account').update(updateData);
    
    // Update session if email changed
    if (email && email !== req.session.user.email) {
      req.session.user.email = email;
      await req.session.save();
    }
    
    // Log profile update
    await db.collection('admin_activity_logs').add({
      action: 'profile_update',
      level: 'info',
      adminId: req.session.user.adminId,
      email: req.session.user.email,
      timestamp: new Date(),
      details: 'Admin profile updated'
    });
    
    logger.info('Admin profile updated successfully', { 
      adminId: req.session.user.adminId,
      email: req.session.user.email 
    });
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        role: req.session.user.role,
        email: req.session.user.email,
        name: name || req.session.user.name,
        preferences: preferences || req.session.user.preferences
      }
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error updating admin profile', { 
      error: error.message,
      adminId: req.session.user?.adminId || 'unknown'
    });
    
    throw new AdminError('Failed to update profile', 500, 'PROFILE_UPDATE_ERROR');
  }
});

export default {
  adminLogin,
  adminLogout,
  adminSessionCheck,
  adminAuthTest,
  adminDashboardStats,
  adminSystemHealth,
  adminActivityLog,
  adminChangePassword,
  adminUpdateProfile
};
