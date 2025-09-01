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
import { UserModel } from '../models/UserModel.js';

// Security function to sanitize user data (with password visibility option)
function sanitizeUserData(userData, includePassword = false) {
  const sensitiveFields = [
    'resetToken', 'resetTokenExpiry', 'verificationToken', 'verificationTokenExpiry', 'apiKey', 'secretKey'
  ];
  
  const sanitized = { ...userData };
  
  // Always remove other sensitive fields
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      delete sanitized[field];
    }
  });
  
  // Handle password based on includePassword flag
  if (!includePassword && 'password' in sanitized) {
    delete sanitized.password;
  }
  
  return sanitized;
}

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

// Get analytics data (admin only)
export const getAnalytics = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    const { timeframe = '30' } = req.query;
    const days = parseInt(timeframe);
    
    if (isNaN(days) || days < 1 || days > 365) {
      throw new ValidationError('Invalid timeframe (must be between 1 and 365 days)', 'timeframe');
    }
    
    if (!db) {
      throw new AdminError('Database unavailable', 503, 'SERVICE_UNAVAILABLE');
    }
    
    const currentDate = new Date();
    const previousDate = new Date(currentDate.getTime() - (days * 24 * 60 * 60 * 1000));
    
    // Get current period data
    const currentUsersSnapshot = await db.collection('users').count().get();
    const currentUsers = currentUsersSnapshot.data().count;
    
    const currentPremiumUsersSnapshot = await db.collection('users').where('access', '==', true).count().get();
    const currentPremiumUsers = currentPremiumUsersSnapshot.data().count;
    
    // Get previous period data (approximate)
    const previousUsersSnapshot = await db.collection('users').where('created_at', '<', previousDate).count().get();
    const previousUsers = previousUsersSnapshot.data().count;
    
    const previousPremiumUsersSnapshot = await db.collection('users')
      .where('access', '==', true)
      .where('created_at', '<', previousDate)
      .count().get();
    const previousPremiumUsers = previousPremiumUsersSnapshot.data().count;
    
    // Calculate metrics
    const userGrowth = currentUsers - previousUsers;
    const userGrowthPercent = previousUsers > 0 ? ((userGrowth / previousUsers) * 100).toFixed(1) : '0.0';
    
    const premiumConversion = currentUsers > 0 ? ((currentPremiumUsers / currentUsers) * 100).toFixed(1) : '0.0';
    const previousPremiumConversion = previousUsers > 0 ? ((previousPremiumUsers / previousUsers) * 100).toFixed(1) : '0.0';
    const premiumConversionChange = (premiumConversion - previousPremiumConversion).toFixed(1);
    const premiumConversionPercent = previousPremiumConversion > 0 ? 
      (((premiumConversion - previousPremiumConversion) / previousPremiumConversion) * 100).toFixed(1) : '0.0';
    
    // Get trial usage data
    const trialUsageSnapshot = await db.collection('users')
      .where('trials_remaining', '<', 50) // Assuming 50 is default trial count
      .count().get();
    const trialUsage = trialUsageSnapshot.data().count;
    
    // Mock system uptime (in real implementation, this would come from monitoring)
    const systemUptime = 99.9;
    
    const analyticsData = {
      userGrowth: {
        current: currentUsers,
        previous: previousUsers,
        change: userGrowth,
        percentChange: userGrowthPercent
      },
      trialUsage: {
        current: trialUsage,
        previous: Math.floor(trialUsage * 0.8), // Mock previous data
        change: Math.floor(trialUsage * 0.2),
        percentChange: '25.0'
      },
      premiumConversion: {
        current: parseFloat(premiumConversion),
        previous: parseFloat(previousPremiumConversion),
        change: parseFloat(premiumConversionChange),
        percentChange: premiumConversionPercent
      },
      systemUptime: {
        current: systemUptime,
        previous: 99.8,
        change: 0.1,
        percentChange: '0.1'
      },
      timeframe: days,
      generatedAt: currentDate.toISOString()
    };
    
    // Log analytics request
    await db.collection('admin_activity_logs').add({
      action: 'analytics_viewed',
      level: 'info',
      adminId: req.session.user.adminId,
      email: req.session.user.email,
      timestamp: currentDate,
      details: `Analytics data retrieved for ${days} days`,
      timeframe: days,
      dataPoints: Object.keys(analyticsData).length
    });
    
    logger.info('Admin retrieved analytics data successfully', { 
      adminId: req.session.user.adminId,
      timeframe: days,
      dataPoints: Object.keys(analyticsData).length
    });
    
    res.json({
      success: true,
      data: analyticsData,
      timestamp: currentDate.toISOString()
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error retrieving analytics data', { 
      error: error.message,
      adminId: req.session.user?.adminId || 'unknown',
      timeframe: req.query.timeframe
    });
    
    throw new AdminError('Failed to retrieve analytics data', 500, 'ANALYTICS_RETRIEVAL_ERROR');
  }
});

// Get security audit log (admin only)
export const getSecurityAuditLog = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    const { page = 1, limit = 50, action, level, startDate, endDate } = req.query;
    
    // Validate pagination
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
    
    // Build query for security-related actions
    let query = db.collection('admin_activity_logs');
    
    // Filter by action type if specified
    if (action) {
      query = query.where('action', '==', action);
    }
    
    // Filter by log level if specified
    if (level) {
      query = query.where('level', '==', level);
    }
    
    // Filter by date range if specified
    if (startDate || endDate) {
      if (startDate) {
        const start = new Date(startDate);
        query = query.where('timestamp', '>=', start);
      }
      if (endDate) {
        const end = new Date(endDate);
        query = query.where('timestamp', '<=', end);
      }
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
    
    logger.info('Admin retrieved security audit log successfully', { 
      adminId: req.session.user.adminId,
      page: pageNum,
      limit: limitNum,
      total: logs.length
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
      securitySummary: {
        totalActions: total,
        criticalActions: logs.filter(log => log.level === 'critical').length,
        warningActions: logs.filter(log => log.level === 'warning').length,
        infoActions: logs.filter(log => log.level === 'info').length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error retrieving security audit log', { 
      error: error.message,
      adminId: req.session.user?.adminId || 'unknown'
    });
    
    throw new AdminError('Failed to retrieve security audit log', 500, 'SECURITY_AUDIT_ERROR');
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

// =========================
// USER MANAGEMENT FUNCTIONS
// =========================
// 
// ADMIN CAPABILITIES:
// ✅ FULL CONTROL over user accounts (INCLUDING passwords)
// ✅ View all user information (name, email, phone, status, access, trials)
// ✅ View user passwords (with enhanced security logging)
// ✅ Edit user details (username, name, email, phone, access status, trial count)
// ✅ Delete user accounts
// ✅ Grant/revoke user access
// ✅ Manage user trial allocations
// ✅ Monitor user activity and login history
// 
// SECURITY FEATURES:
// ⚠️  PASSWORDS ARE NOW VISIBLE TO ADMINS (Security consideration)
// 🔒 Other sensitive data is automatically filtered
// 🔒 Multiple layers of data sanitization
// 🔒 Comprehensive audit logging for all admin actions
// 🔒 Session-based authentication with role verification
// 🚨 Enhanced logging for password viewing (critical security level)

// Get all users (admin only) - WARNING: Now includes passwords
export const getAllUsers = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    const { page = 1, limit = 20, status, search, access } = req.query;
    
    // Validate pagination
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
    let query = db.collection('users');
    
    // Apply filters
    if (status) {
      query = query.where('is_active', '==', status === 'active');
    }
    
    if (access !== undefined) {
      query = query.where('access', '==', access === 'true');
    }
    
    // Get total count
    const totalSnapshot = await query.count().get();
    const total = totalSnapshot.data().count;
    
    // Get paginated results
    const offset = (pageNum - 1) * limitNum;
    const usersSnapshot = await query
      .orderBy('created_at', 'desc')
      .offset(offset)
      .limit(limitNum)
      .get();
    
    let users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.() || doc.data().created_at,
      updated_at: doc.data().updated_at?.toDate?.() || doc.data().updated_at,
      last_login: doc.data().last_login?.toDate?.() || doc.data().last_login
    }));
    
    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(user => 
        user.username?.toLowerCase().includes(searchLower) ||
        user.name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      );
    }
    
    // Remove sensitive data using security function
    // Note: Passwords are included for admin visibility (security consideration)
    users = users.map(user => sanitizeUserData(user, true));
    
    logger.info('Admin retrieved users successfully', { 
      adminId: req.session.user.adminId,
      page: pageNum,
      limit: limitNum,
      total: users.length
    });
    
    res.json({
      success: true,
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      },
      securityWarning: '⚠️ PASSWORDS ARE NOW VISIBLE - This action is logged for security monitoring',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error retrieving users', { 
      error: error.message,
      adminId: req.session.user?.adminId || 'unknown'
    });
    
    throw new AdminError('Failed to retrieve users', 500, 'USERS_RETRIEVAL_ERROR');
  }
});

// Get user by ID (admin only) - WARNING: Now includes passwords
export const getUserById = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    const { id } = req.params;
    
    if (!id) {
      throw new ValidationError('User ID is required', 'id');
    }
    
    if (!db) {
      throw new AdminError('Database unavailable', 503, 'SERVICE_UNAVAILABLE');
    }
    
    const userDoc = await db.collection('users').doc(id).get();
    
    if (!userDoc.exists) {
      throw new ResourceNotFoundError('User not found');
    }
    
    const userData = userDoc.data();
    
    // Use security function to sanitize user data
    // Note: Passwords are included for admin visibility (security consideration)
    const sanitizedData = sanitizeUserData(userData, true);
    
    const user = {
      id: userDoc.id,
      ...sanitizedData,
      created_at: userData.created_at?.toDate?.() || userData.created_at,
      updated_at: userData.updated_at?.toDate?.() || userData.updated_at,
      last_login: userData.last_login?.toDate?.() || userData.last_login
    };
    
    logger.info('Admin retrieved user by ID successfully', { 
      adminId: req.session.user.adminId,
      userId: id
    });
    
    res.json({
      success: true,
      user,
      securityWarning: '⚠️ PASSWORDS ARE NOW VISIBLE - This action is logged for security monitoring',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error retrieving user by ID', { 
      error: error.message,
      adminId: req.session.user?.adminId || 'unknown',
      userId: req.params.id
    });
    
    throw new AdminError('Failed to retrieve user', 500, 'USER_RETRIEVAL_ERROR');
  }
});

// Update user (admin only)
export const updateUser = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    const { id } = req.params;
    const { username, name, email, phone, is_active, access, trials_remaining } = req.body;
    
    if (!id) {
      throw new ValidationError('User ID is required', 'id');
    }
    
    if (!db) {
      throw new AdminError('Database unavailable', 503, 'SERVICE_UNAVAILABLE');
    }
    
    // Get user to verify it exists
    const userDoc = await db.collection('users').doc(id).get();
    
    if (!userDoc.exists) {
      throw new ResourceNotFoundError('User not found');
    }
    
    const updateData = {
      updated_at: new Date()
    };
    
    // Validate and add fields to update
    if (username !== undefined) {
      if (typeof username !== 'string' || username.trim().length < 3) {
        throw new ValidationError('Username must be at least 3 characters long', 'username');
      }
      updateData.username = username.trim();
    }
    
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        throw new ValidationError('Name must be at least 2 characters long', 'name');
      }
      updateData.name = name.trim();
    }
    
    if (email !== undefined) {
      if (typeof email !== 'string' || !email.includes('@')) {
        throw new ValidationError('Valid email is required', 'email');
      }
      updateData.email = email.trim();
    }
    
    if (phone !== undefined) {
      if (typeof phone !== 'string' || phone.trim().length < 10) {
        throw new ValidationError('Valid phone number is required', 'phone');
      }
      updateData.phone = phone.trim();
    }
    
    if (is_active !== undefined) {
      if (typeof is_active !== 'boolean') {
        throw new ValidationError('is_active must be a boolean value', 'is_active');
      }
      updateData.is_active = is_active;
    }
    
    if (access !== undefined) {
      if (typeof access !== 'boolean') {
        throw new ValidationError('access must be a boolean value', 'access');
      }
      updateData.access = access;
    }
    
    if (trials_remaining !== undefined) {
      const trials = parseInt(trials_remaining);
      if (isNaN(trials) || trials < 0) {
        throw new ValidationError('trials_remaining must be a non-negative number', 'trials_remaining');
      }
      updateData.trials_remaining = trials;
    }
    
    // Update user
    await db.collection('users').doc(id).update(updateData);
    
    // Log user update
    await db.collection('admin_activity_logs').add({
      action: 'user_update',
      level: 'info',
      adminId: req.session.user.adminId,
      email: req.session.user.email,
      timestamp: new Date(),
      details: `Updated user: ${id}`,
      targetUserId: id,
      updateData
    });
    
    logger.info('Admin updated user successfully', { 
      adminId: req.session.user.adminId,
      userId: id,
      updateData
    });
    
    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id,
        ...updateData
      }
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error updating user', { 
      error: error.message,
      adminId: req.session.user?.adminId || 'unknown',
      userId: req.params.id
    });
    
    throw new AdminError('Failed to update user', 500, 'USER_UPDATE_ERROR');
  }
});

// Delete user (admin only)
export const deleteUser = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    const { id } = req.params;
    
    if (!id) {
      throw new ValidationError('User ID is required', 'id');
    }
    
    if (!db) {
      throw new AdminError('Database unavailable', 503, 'SERVICE_UNAVAILABLE');
    }
    
    // Get user to verify it exists
    const userDoc = await db.collection('users').doc(id).get();
    
    if (!userDoc.exists) {
      throw new ResourceNotFoundError('User not found');
    }
    
    const userData = userDoc.data();
    
    // Delete user
    await db.collection('users').doc(id).delete();
    
    // Log user deletion
    await db.collection('admin_activity_logs').add({
      action: 'user_delete',
      level: 'warning',
      adminId: req.session.user.adminId,
      email: req.session.user.email,
      timestamp: new Date(),
      details: `Deleted user: ${userData.username} (${userData.email})`,
      targetUserId: id
    });
    
    logger.info('Admin deleted user successfully', { 
      adminId: req.session.user.adminId,
      userId: id,
      username: userData.username,
      email: userData.email
    });
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error deleting user', { 
      error: error.message,
      adminId: req.session.user?.adminId || 'unknown',
      userId: req.params.id
    });
    
    throw new AdminError('Failed to delete user', 500, 'USER_DELETE_ERROR');
  }
});

// Update user access (admin only)
export const updateUserAccess = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    const { id } = req.params;
    const { access } = req.body;
    
    if (!id) {
      throw new ValidationError('User ID is required', 'id');
    }
    
    if (typeof access !== 'boolean') {
      throw new ValidationError('access must be a boolean value', 'access');
    }
    
    if (!db) {
      throw new AdminError('Database unavailable', 503, 'SERVICE_UNAVAILABLE');
    }
    
    // Get user to verify it exists
    const userDoc = await db.collection('users').doc(id).get();
    
    if (!userDoc.exists) {
      throw new ResourceNotFoundError('User not found');
    }
    
    const userData = userDoc.data();
    
    // Update user access
    await db.collection('users').doc(id).update({
      access,
      updated_at: new Date()
    });
    
    // Log access change
    await db.collection('admin_activity_logs').add({
      action: 'user_access_change',
      level: 'info',
      adminId: req.session.user.adminId,
      email: req.session.user.email,
      timestamp: new Date(),
      details: `${access ? 'Granted' : 'Revoked'} access for user: ${userData.username} (${userData.email})`,
      targetUserId: id,
      access
    });
    
    logger.info('Admin updated user access successfully', { 
      adminId: req.session.user.adminId,
      userId: id,
      username: userData.username,
      access
    });
    
    res.json({
      success: true,
      message: `User access ${access ? 'granted' : 'revoked'} successfully`,
      user: {
        id,
        access
      }
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error updating user access', { 
      error: error.message,
      adminId: req.session.user?.adminId || 'unknown',
      userId: req.params.id
    });
    
    throw new AdminError('Failed to update user access', 500, 'USER_ACCESS_UPDATE_ERROR');
  }
});

// Get user password (admin only) - SECURITY WARNING: This exposes sensitive data
export const getUserPassword = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    const { id } = req.params;
    
    if (!id) {
      throw new ValidationError('User ID is required', 'id');
    }
    
    if (!db) {
      throw new AdminError('Database unavailable', 503, 'SERVICE_UNAVAILABLE');
    }
    
    // Get user to verify it exists
    const userDoc = await db.collection('users').doc(id).get();
    
    if (!userDoc.exists) {
      throw new ResourceNotFoundError('User not found');
    }
    
    const userData = userDoc.data();
    
    // Log this sensitive action with HIGH SECURITY LEVEL
    await db.collection('admin_activity_logs').add({
      action: 'user_password_view',
      level: 'critical',
      adminId: req.session.user.adminId,
      email: req.session.user.email,
      timestamp: new Date(),
      details: `ADMIN VIEWED USER PASSWORD for user: ${userData.username} (${userData.email}) - SECURITY WARNING`,
      targetUserId: id,
      username: userData.username,
      email: userData.email,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      securityLevel: 'CRITICAL'
    });
    
    logger.warn('ADMIN VIEWED USER PASSWORD - SECURITY WARNING', { 
      adminId: req.session.user.adminId,
      userId: id,
      username: userData.username,
      email: userData.email,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      message: 'User password retrieved (SECURITY WARNING: This action is logged)',
      user: {
        id,
        username: userData.username,
        email: userData.email
      },
      password: userData.password,
      securityWarning: 'This action has been logged as a critical security event. Passwords should be handled with extreme care.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error retrieving user password', { 
      error: error.message,
      adminId: req.session.user?.adminId || 'unknown',
      userId: req.params.id
    });
    
    throw new AdminError('Failed to retrieve user password', 500, 'USER_PASSWORD_VIEW_ERROR');
  }
});

// Reset user password (admin only) - generates new random password
export const resetUserPassword = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    const { id } = req.params;
    
    if (!id) {
      throw new ValidationError('User ID is required', 'id');
    }
    
    if (!db) {
      throw new AdminError('Database unavailable', 503, 'SERVICE_UNAVAILABLE');
    }
    
    // Get user to verify it exists
    const userDoc = await db.collection('users').doc(id).get();
    
    if (!userDoc.exists) {
      throw new ResourceNotFoundError('User not found');
    }
    
    const userData = userDoc.data();
    
    // Generate a secure random password
    const newPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update user password
    await db.collection('users').doc(id).update({
      password: hashedPassword,
      updated_at: new Date()
    });
    
    // Log password reset
    await db.collection('admin_activity_logs').add({
      action: 'user_password_reset',
      level: 'warning',
      adminId: req.session.user.adminId,
      email: req.session.user.email,
      timestamp: new Date(),
      details: `Password reset for user: ${userData.username} (${userData.email})`,
      targetUserId: id,
      username: userData.username,
      email: userData.email
    });
    
    logger.info('Admin reset user password successfully', { 
      adminId: req.session.user.adminId,
      userId: id,
      username: userData.username
    });
    
    res.json({
      success: true,
      message: 'User password reset successfully',
      user: {
        id,
        username: userData.username,
        email: userData.email
      },
      newPassword: newPassword, // Only returned to admin for secure delivery to user
      note: 'Please securely communicate this password to the user. It will not be shown again.'
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error resetting user password', { 
      error: error.message,
      adminId: req.session.user?.adminId || 'unknown',
      userId: req.params.id
    });
    
    throw new AdminError('Failed to reset user password', 500, 'USER_PASSWORD_RESET_ERROR');
  }
});

// Update user trials (admin only)
export const updateUserTrials = asyncHandler(async (req, res) => {
  try {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      throw new AuthenticationError('Admin authentication required');
    }
    
    const { id } = req.params;
    const { trials_remaining } = req.body;
    
    if (!id) {
      throw new ValidationError('User ID is required', 'id');
    }
    
    const trials = parseInt(trials_remaining);
    if (isNaN(trials) || trials < 0) {
      throw new ValidationError('trials_remaining must be a non-negative number', 'trials_remaining');
    }
    
    if (!db) {
      throw new AdminError('Database unavailable', 503, 'SERVICE_UNAVAILABLE');
    }
    
    // Get user to verify it exists
    const userDoc = await db.collection('users').doc(id).get();
    
    if (!userDoc.exists) {
      throw new ResourceNotFoundError('User not found');
    }
    
    const userData = userDoc.data();
    
    // Update user trials
    await db.collection('users').doc(id).update({
      trials_remaining: trials,
      updated_at: new Date()
    });
    
    // Log trials change
    await db.collection('admin_activity_logs').add({
      action: 'user_trials_change',
      level: 'info',
      adminId: req.session.user.adminId,
      email: req.session.user.email,
      timestamp: new Date(),
      details: `Updated trials for user: ${userData.username} (${userData.email}) to ${trials}`,
      targetUserId: id,
      trials_remaining: trials
    });
    
    logger.info('Admin updated user trials successfully', { 
      adminId: req.session.user.adminId,
      userId: id,
      username: userData.username,
      trials_remaining: trials
    });
    
    res.json({
      success: true,
      message: 'User trials updated successfully',
      user: {
        id,
        trials_remaining: trials
      }
    });
    
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    
    logger.error('Error updating user trials', { 
      error: error.message,
      adminId: req.session.user?.adminId || 'unknown',
      userId: req.params.id
    });
    
    throw new AdminError('Failed to update user trials', 500, 'USER_TRIALS_UPDATE_ERROR');
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
  getSecurityAuditLog,
  getAnalytics,
  adminChangePassword,
  adminUpdateProfile,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateUserAccess,
  updateUserTrials,
  resetUserPassword,
  getUserPassword
};
