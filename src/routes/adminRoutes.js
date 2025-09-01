// Enhanced Admin Routes with Comprehensive Error Handling
import { Router } from 'express';
import { authenticateAdmin, restrictTo } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import adminController from '../controllers/adminController.js';

const router = Router();

// Apply admin authentication middleware to all routes
router.use(authenticateAdmin);

// Admin authentication routes
router.post('/login', asyncHandler(adminController.adminLogin));
router.post('/logout', asyncHandler(adminController.adminLogout));
router.get('/session', asyncHandler(adminController.adminSessionCheck));
router.get('/auth-test', asyncHandler(adminController.adminAuthTest));

// Admin dashboard routes (require admin role)
router.get('/dashboard/stats', restrictTo('admin'), asyncHandler(adminController.adminDashboardStats));
router.get('/system/health', restrictTo('admin'), asyncHandler(adminController.adminSystemHealth));
router.get('/activity/logs', restrictTo('admin'), asyncHandler(adminController.adminActivityLog));

// Admin profile management routes
router.put('/profile', restrictTo('admin'), asyncHandler(adminController.adminUpdateProfile));
router.put('/password', restrictTo('admin'), asyncHandler(adminController.adminChangePassword));

// Admin system monitoring routes
router.get('/system/status', restrictTo('admin'), async (req, res) => {
  try {
    const systemStatus = {
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    };
    
    res.json({
      success: true,
      data: systemStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get system status',
      message: error.message
    });
  }
});

// Admin backup and maintenance routes
router.post('/system/backup', restrictTo('admin'), async (req, res) => {
  try {
    // This would implement actual backup functionality
    res.json({
      success: true,
      message: 'Backup initiated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Backup failed',
      message: error.message
    });
  }
});

// Admin user management routes
router.get('/users', restrictTo('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    
    // Validate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid page number'
      });
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit (must be between 1 and 100)'
      });
    }
    
    // Mock user data for now
    const users = [
      {
        id: '1',
        email: 'user1@example.com',
        name: 'User One',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        email: 'user2@example.com',
        name: 'User Two',
        status: 'inactive',
        createdAt: new Date().toISOString()
      }
    ];
    
    res.json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: users.length,
        pages: Math.ceil(users.length / limitNum)
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve users',
      message: error.message
    });
  }
});

// Admin store management routes
router.get('/stores', restrictTo('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    
    // Validate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid page number'
      });
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit (must be between 1 and 100)'
      });
    }
    
    // Mock store data for now
    const stores = [
      {
        id: '1',
        name: 'Store One',
        email: 'store1@example.com',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        name: 'Store Two',
        email: 'store2@example.com',
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    ];
    
    res.json({
      success: true,
      data: stores,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: stores.length,
        pages: Math.ceil(stores.length / limitNum)
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve stores',
      message: error.message
    });
  }
});

// Admin analytics routes
router.get('/analytics/overview', restrictTo('admin'), async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    // Mock analytics data
    const analytics = {
      period,
      totalUsers: 1250,
      activeUsers: 890,
      totalGarments: 567,
      totalStores: 45,
      totalViews: 12500,
      growth: {
        users: 12.5,
        garments: 8.3,
        views: 15.7
      },
      topCategories: [
        { name: 'Upper Body', count: 234, percentage: 41.3 },
        { name: 'Lower Body', count: 189, percentage: 33.3 },
        { name: 'Dresses', count: 144, percentage: 25.4 }
      ],
      topStores: [
        { name: 'Fashion Store A', garments: 45, views: 1200 },
        { name: 'Style Boutique B', garments: 38, views: 980 },
        { name: 'Trend Shop C', garments: 32, views: 850 }
      ]
    };
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics',
      message: error.message
    });
  }
});

// Admin settings routes
router.get('/settings', restrictTo('admin'), async (req, res) => {
  try {
    const settings = {
      system: {
        maintenanceMode: false,
        debugMode: process.env.NODE_ENV === 'development',
        logLevel: 'info',
        sessionTimeout: 8 * 60 * 60 * 1000 // 8 hours
      },
      security: {
        passwordMinLength: 8,
        requireStrongPasswords: true,
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000 // 15 minutes
      },
      notifications: {
        emailNotifications: true,
        slackNotifications: false,
        adminAlerts: true
      },
      limits: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxGarmentsPerStore: 100,
        maxImagesPerGarment: 5
      }
    };
    
    res.json({
      success: true,
      data: settings
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve settings',
      message: error.message
    });
  }
});

router.put('/settings', restrictTo('admin'), async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid settings data'
      });
    }
    
    // Here you would save the settings to database
    // For now, just return success
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
      message: error.message
    });
  }
});

// Admin notification routes
router.get('/notifications', restrictTo('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    // Mock notifications
    const notifications = [
      {
        id: '1',
        type: 'system',
        title: 'System Maintenance',
        message: 'Scheduled maintenance will occur tonight at 2 AM',
        read: false,
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        type: 'user',
        title: 'New User Registration',
        message: 'New user registered: john.doe@example.com',
        read: true,
        createdAt: new Date(Date.now() - 3600000).toISOString()
      }
    ];
    
    const filteredNotifications = unreadOnly === 'true' 
      ? notifications.filter(n => !n.read)
      : notifications;
    
    res.json({
      success: true,
      data: filteredNotifications,
      unreadCount: notifications.filter(n => !n.read).length
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications',
      message: error.message
    });
  }
});

// Admin help and support routes
router.get('/help', restrictTo('admin'), async (req, res) => {
  try {
    const helpTopics = [
      {
        id: '1',
        title: 'Getting Started',
        description: 'Learn the basics of the admin dashboard',
        category: 'basics',
        content: 'This is the getting started guide...'
      },
      {
        id: '2',
        title: 'User Management',
        description: 'How to manage users and their permissions',
        category: 'management',
        content: 'User management guide...'
      },
      {
        id: '3',
        title: 'System Configuration',
        description: 'Configure system settings and preferences',
        category: 'configuration',
        content: 'System configuration guide...'
      }
    ];
    
    res.json({
      success: true,
      data: helpTopics
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve help topics',
      message: error.message
    });
  }
});

// Admin audit log routes
router.get('/audit', restrictTo('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, action, adminId, startDate, endDate } = req.query;
    
    // Mock audit log
    const auditLog = [
      {
        id: '1',
        action: 'login',
        adminId: 'admin_001',
        email: 'admin@metavrai.shop',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        timestamp: new Date().toISOString(),
        details: 'Successful login'
      },
      {
        id: '2',
        action: 'garment_create',
        adminId: 'admin_001',
        email: 'admin@metavrai.shop',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        details: 'Created garment: Blue T-shirt'
      }
    ];
    
    res.json({
      success: true,
      data: auditLog,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: auditLog.length,
        pages: Math.ceil(auditLog.length / parseInt(limit))
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit log',
      message: error.message
    });
  }
});

// Health check route for admin
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'admin-api'
  });
});

// 404 handler for admin routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Admin route not found',
    message: `The requested admin route ${req.method} ${req.originalUrl} was not found.`,
    timestamp: new Date().toISOString()
  });
});

export default router;
