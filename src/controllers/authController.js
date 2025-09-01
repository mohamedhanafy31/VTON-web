import bcrypt from 'bcrypt';
import { UserModel } from '../models/UserModel.js';
import logger from '../utils/logger.js';
import db from '../config/db.js';
import admin from 'firebase-admin';

// Rate limiting for registration attempts
const registrationAttempts = new Map();
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

// Check rate limit for registration
function checkRateLimit(ip) {
  const now = Date.now();
  const attempts = registrationAttempts.get(ip) || [];
  
  // Remove old attempts outside the window
  const recentAttempts = attempts.filter(timestamp => now - timestamp < ATTEMPT_WINDOW);
  
  if (recentAttempts.length >= MAX_ATTEMPTS) {
    return false; // Rate limit exceeded
  }
  
  // Add current attempt
  recentAttempts.push(now);
  registrationAttempts.set(ip, recentAttempts);
  
  return true; // Within rate limit
}

// Store login controller
export const storeLogin = async (req, res) => {
  logger.info('POST /store/login called', { email: req.body.email });
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!db) {
      throw new Error('Firestore is unavailable');
    }

    const storeSnapshot = await db.collection('information').where('email', '==', email).get();
    if (storeSnapshot.empty) {
      logger.warn('Login attempt failed: Store not found', { email });
      return res.status(404).json({ error: 'Store not found' });
    }

    const storeDoc = storeSnapshot.docs[0];
    const storeData = storeDoc.data();
    
    // Check if password exists
    if (!storeData.password) {
      logger.warn('Login attempt failed: No password set for store', { storeId: storeDoc.id });
      return res.status(401).json({ error: 'Password not set. Please contact admin to set a password.' });
    }
    
    const isMatch = await bcrypt.compare(password, storeData.password);

    if (!isMatch) {
      logger.warn('Login attempt failed: Invalid credentials', { storeId: storeDoc.id });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = {
      role: 'store',
      storeId: storeDoc.id,
      storeName: storeData.store_name
    };
    
    // Set session expiry to the configured value from session.js
    // Session duration is defined in config/session.js
    
    req.session.save();
    
    logger.info('Login successful', { storeId: storeDoc.id, storeName: storeData.store_name });

    res.json({ 
      success: true, 
      token: 'session-auth', 
      store: { 
        store_id: storeDoc.id, 
        store_name: storeData.store_name,
        logo_link: storeData.logo_link || null
      }
    });
  } catch (error) {
    logger.error('Login error:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
};

// Store logout controller
export const storeLogout = (req, res) => {
  console.log('POST /store/logout called');
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to log out' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
};

// Admin login controller
export const adminLogin = async (req, res) => {
  console.log('POST /admin/login called with body:', req.body);
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Handle database unavailable case with mock admin
    if (!db) {
      console.log('Database unavailable, using mock admin authentication');
      // Mock admin credentials for testing
      const mockAdminEmail = 'admin@metavrai.shop';
      const mockAdminPassword = 'admin123'; // In production, this should be hashed
      
      if (email !== mockAdminEmail || password !== mockAdminPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      req.session.user = {
        role: 'admin',
        adminId: 'mock_admin_account',
        email: mockAdminEmail
      };
      
      console.log('Mock admin login successful');
      return res.json({
        success: true,
        message: 'Admin login successful',
        user: req.session.user
      });
    }

    const adminSnapshot = await db.collection('admin').doc('admin_account').get();
    if (!adminSnapshot.exists) {
      return res.status(404).json({ error: 'Admin account not found' });
    }

    const adminData = adminSnapshot.data();
    const isMatch = await bcrypt.compare(password, adminData.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = {
      role: 'admin',
      adminId: 'admin_account'
    };
    
    req.session.save();
    
    console.log('Admin login successful');
    res.json({ 
      success: true, 
      token: 'session-auth', 
      admin: { 
        role: 'admin',
        email: adminData.email || 'admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Admin login failed', details: error.message });
  }
};

// Admin logout controller
export const adminLogout = (req, res) => {
  console.log('POST /admin/logout called');
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to log out' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
};

// Admin login test controller
export const adminLoginTest = async (req, res) => {
  console.log('POST /admin/login-test called with body:', req.body);
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!db) {
      throw new Error('Firestore is unavailable');
    }

    const adminSnapshot = await db.collection('admin').doc('admin_account').get();
    if (!adminSnapshot.exists) {
      return res.status(404).json({ error: 'Admin account not found' });
    }

    const adminData = adminSnapshot.data();
    const isMatch = await bcrypt.compare(password, adminData.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = {
      role: 'admin',
      adminId: 'admin_account'
    };
    
    req.session.save();
    
    console.log('Admin login test successful');
    res.json({ 
      success: true, 
      token: 'session-auth', 
      admin: { 
        role: 'admin',
        email: adminData.email || 'admin'
      }
    });
  } catch (error) {
    console.error('Admin login test error:', error);
    res.status(500).json({ error: 'Admin login test failed', details: error.message });
  }
};

// Admin auth test controller
export const adminAuthTest = (req, res) => {
  console.log('GET /admin/auth-test called');
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    res.json({ 
      success: true, 
      message: 'Admin authentication successful',
      user: req.session.user
    });
  } else {
    res.status(401).json({ error: 'Admin authentication required' });
  }
};

// Reset store password controller
export const resetStorePassword = async (req, res) => {
  console.log('POST /admin/reset-store-password called with params:', req.params);
  try {
    const { storeName } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    if (!db) {
      throw new Error('Firestore is unavailable');
    }

    const storeSnapshot = await db.collection('information').where('store_name', '==', storeName).get();
    if (storeSnapshot.empty) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const storeDoc = storeSnapshot.docs[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await storeDoc.ref.update({ password: hashedPassword });
    
    console.log('Store password reset successful', { storeName });
    res.json({ 
      success: true, 
      message: 'Store password reset successfully',
      store: { store_name: storeName }
    });
  } catch (error) {
    console.error('Reset store password error:', error);
    res.status(500).json({ error: 'Failed to reset store password', details: error.message });
  }
};

// User Registration Controller
export const userRegister = async (req, res) => {
  logger.info('POST /auth/register called', { username: req.body.username });
  
  try {
    // Check rate limit
    const clientIP = req.ip || req.connection.remoteAddress;
    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({ 
        error: 'Too many registration attempts', 
        message: 'Please wait 15 minutes before trying again' 
      });
    }

    const { username, name, email, phone, password } = req.body;
    
    // Basic field validation
    if (!username || !name || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Trim whitespace from all fields
    const trimmedUsername = username.trim();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    // Enhanced username validation
    if (trimmedUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }
    if (trimmedUsername.length > 30) {
      return res.status(400).json({ error: 'Username must be less than 30 characters long' });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
    }
    if (/^[0-9_-]/.test(trimmedUsername)) {
      return res.status(400).json({ error: 'Username cannot start with numbers, underscores, or hyphens' });
    }

    // Enhanced name validation
    if (trimmedName.length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters long' });
    }
    if (trimmedName.length > 100) {
      return res.status(400).json({ error: 'Name must be less than 100 characters long' });
    }
    if (!/^[a-zA-Z\s'-]+$/.test(trimmedName)) {
      return res.status(400).json({ error: 'Name can only contain letters, spaces, hyphens, and apostrophes' });
    }

    // Enhanced email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (trimmedEmail.length > 254) {
      return res.status(400).json({ error: 'Email address is too long' });
    }
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Email format is invalid' });
    }

    // Enhanced password validation
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    if (password.length > 128) {
      return res.status(400).json({ error: 'Password must be less than 128 characters long' });
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one lowercase letter' });
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
    }
    if (!/(?=.*\d)/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one number' });
    }
    if (!/(?=.*[@$!%*?&])/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one special character (@$!%*?&)' });
    }

    // Enhanced phone validation
    const cleanPhone = trimmedPhone.replace(/[\s\-\(\)]/g, '');
    if (!/^[\+]?[1-9][\d]{0,15}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Please enter a valid phone number' });
    }
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Phone number must be at least 10 digits long' });
    }
    if (cleanPhone.length > 15) {
      return res.status(400).json({ error: 'Phone number must be less than 15 digits long' });
    }

    // Check if user already exists by email
    const existingUser = await UserModel.findByEmail(trimmedEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Check if username is already taken
    const existingUsername = await UserModel.findByUsername(trimmedUsername);
    if (existingUsername) {
      return res.status(409).json({ error: 'Username is already taken' });
    }

    // Create new user with trimmed data
    const userData = {
      username: trimmedUsername,
      name: trimmedName,
      email: trimmedEmail, 
      phone: trimmedPhone,
      password: await bcrypt.hash(password, 10)
    };

    const newUser = await UserModel.create(userData);
    
    logger.info('User registration successful', { userId: newUser.id, username: trimmedUsername });
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        trials_remaining: newUser.trials_remaining
      }
    });
    
  } catch (error) {
    logger.error('User registration error:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
};

// Validate user session
export const validateUserSession = async (req, res) => {
  logger.info('GET /auth/validate-session called');
  try {
    // Check if user is authenticated via session
    if (req.session.user && req.session.user.userId) {
      // Verify user still exists in database
      const user = await UserModel.findById(req.session.user.userId);
      if (user) {
            return res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            phone: user.phone,
            trials_remaining: user.trials_remaining
          }
        });
      }
    }
    
    // Session is invalid or user doesn't exist
  res.status(401).json({
    success: false,
      error: 'Invalid session' 
    });
    
  } catch (error) {
    logger.error('Session validation error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Session validation failed', details: error.message });
  }
};

// Create backend session from frontend localStorage data
export const createSession = async (req, res) => {
  logger.info('POST /auth/create-session called');
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Verify user exists
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create backend session
    req.session.user = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: 'user'
    };
    
    logger.info('Backend session created for user:', { userId: user.id, username: user.username });
    
    res.json({
      success: true,
      message: 'Session created successfully',
      user: { 
        id: user.id, 
        username: user.username, 
        name: user.name, 
        email: user.email, 
        phone: user.phone,
        trials_remaining: user.trials_remaining
      }
    });
    
  } catch (error) {
    logger.error('Session creation error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Session creation failed', details: error.message });
  }
};

// User Login Controller
export const userLogin = async (req, res) => {
  logger.info('POST /auth/login called', { username: req.body.username });
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username
    const user = await UserModel.findByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user has access granted
    if (!user.access) {
      logger.warn('Login attempt failed: User access not granted', { userId: user.id, username });
      return res.status(403).json({ 
        error: 'Account access not granted', 
        message: 'Your account is pending approval. Please contact management to activate your account.' 
      });
    }

    // Update last login time
    await user.updateLastLogin();

    // Set user session
    req.session.user = {
      role: 'user',
      userId: user.id,
      username: user.username,
      email: user.email,
      name: user.name
    };
    
    req.session.save();
    
    logger.info('User login successful', { userId: user.id, username });
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        trials_remaining: user.trials_remaining
      }
    });
    
  } catch (error) {
    logger.error('User login error:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
};

// User Logout Controller
export const userLogout = (req, res) => {
  logger.info('POST /auth/logout called');
  req.session.destroy(err => {
    if (err) {
      logger.error('Error destroying user session:', err);
      return res.status(500).json({ error: 'Failed to log out' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
};

// User Profile Controller
export const userProfile = (req, res) => {
  logger.info('GET /auth/profile called');
  try {
    if (req.session && req.session.user && req.session.user.role === 'user') {
      res.json({
        success: true,
        user: {
          id: req.session.user.userId,
          username: req.session.user.username,
          name: req.session.user.name,
          email: req.session.user.email,
          role: req.session.user.role
        }
      });
    } else {
      res.status(401).json({ error: 'User authentication required' });
    }
  } catch (error) {
    logger.error('User profile error:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get user profile', details: error.message });
  }
};

// Get User Trials Remaining Controller (public demo)
export const getUserTrials = async (req, res) => {
  logger.info('GET /auth/trials called');
  try {
    // For demo purposes, return demo trials if no authenticated user
    if (req.session && req.session.user && req.session.user.role === 'user') {
      const user = await UserModel.findById(req.session.user.userId);
      if (user) {
        const trialsRemaining = await user.getTrialsRemaining();
        res.json({
          success: true,
          trials_remaining: trialsRemaining
        });
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } else {
      // Demo user - return unlimited trials
      res.json({
        success: true,
        trials_remaining: 999,
        message: 'Demo mode - unlimited trials'
      });
    }
  } catch (error) {
    logger.error('Get user trials error:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get user trials', details: error.message });
  }
};

// Decrease User Trials Controller
export const decreaseUserTrials = async (req, res) => {
  logger.info('POST /auth/decrease-trials called');
  try {
    if (req.session && req.session.user && req.session.user.role === 'user') {
      const user = await UserModel.findById(req.session.user.userId);
      if (user) {
        const trialsRemaining = await user.decreaseTrials();
        res.json({
          success: true,
          trials_remaining: trialsRemaining,
          message: 'Trial used successfully'
        });
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } else {
      res.status(401).json({ error: 'User authentication required' });
    }
  } catch (error) {
    logger.error('Decrease user trials error:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to decrease user trials', details: error.message });
  }
};

// Check and invalidate session for users without access
export const checkUserAccess = async (req, res, next) => {
  try {
    // Only check if user is authenticated
    if (req.session && req.session.user && req.session.user.role === 'user') {
      const user = await UserModel.findById(req.session.user.userId);
      
      // If user doesn't exist or doesn't have access, destroy session
      if (!user || !user.access) {
        logger.warn('User access revoked or user not found, destroying session', { 
          userId: req.session.user.userId,
          hasAccess: user ? user.access : false
        });
        
        // Destroy the session
        req.session.destroy(err => {
          if (err) {
            logger.error('Error destroying session for user without access:', err);
          }
        });
        
        // Return unauthorized response
        return res.status(401).json({ 
          error: 'Access revoked', 
          message: 'Your account access has been revoked. Please contact management.' 
        });
      }
    }
    
    // User has access or no session, continue
    next();
  } catch (error) {
    logger.error('Error checking user access:', { message: error.message, stack: error.stack });
    // On error, continue to allow the request to proceed
    next();
  }
};

// Check email availability
export const checkEmailAvailability = async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if email already exists
    const existingUser = await UserModel.findByEmail(email);
    
    if (existingUser) {
      return res.json({ 
        available: false, 
        message: 'Email is already registered' 
      });
    }

    return res.json({ 
      available: true, 
      message: 'Email is available' 
    });

  } catch (error) {
    logger.error('Email availability check error:', { message: error.message, email: req.params.email });
    res.status(500).json({ error: 'Failed to check email availability', details: error.message });
  }
};

// Check username availability
export const checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ error: 'Username parameter is required' });
    }

    // Basic username format validation
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }

    if (username.length > 30) {
      return res.status(400).json({ error: 'Username must be less than 30 characters long' });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
    }

    if (/^[0-9_-]/.test(username)) {
      return res.status(400).json({ error: 'Username cannot start with numbers, underscores, or hyphens' });
    }

    // Check if username already exists
    const existingUser = await UserModel.findByUsername(username);
    
    if (existingUser) {
      return res.json({ 
        available: false, 
        message: 'Username is already taken' 
      });
    }

    return res.json({ 
      available: true, 
      message: 'Username is available' 
    });

  } catch (error) {
    logger.error('Username availability check error:', { message: error.message, username: req.params.username });
    res.status(500).json({ error: 'Failed to check username availability', details: error.message });
  }
}; 