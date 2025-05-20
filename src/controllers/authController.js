import bcrypt from 'bcrypt';
import db from '../config/db.js';
import logger from '../utils/logger.js';
import admin from 'firebase-admin';

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

    if (!db) {
      throw new Error('Firestore is unavailable');
    }

    const adminSnapshot = await db.collection('admin').doc('admin_account').get();
    if (!adminSnapshot.exists) {
      return res.status(404).json({ error: 'Admin account not found' });
    }

    const adminData = adminSnapshot.data();
    const isMatch = await bcrypt.compare(password, adminData.password);

    if (adminData.email !== email || !isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = {
      role: 'admin',
      email: adminData.email
    };
    
    // Reset session expiry time on login
    req.session.cookie.maxAge = 60 * 60 * 1000; // 1 hour
    
    req.session.save(err => {
      if (err) {
        console.error('Error saving session:', err);
        return res.status(500).json({ error: 'Failed to save session' });
      }
      res.json({ success: true, token: 'admin-session-auth' });
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
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

// Admin login test controller - for debugging login issues
export const adminLoginTest = (req, res) => {
  console.log('POST /admin/login-test - debugging endpoint');
  
  const { email, password } = req.body;
  
  // Log auth attempt but hide password
  console.log('Admin login attempt:', { 
    email, 
    provided_password: password ? 'Yes (hidden)' : 'No' 
  });
  
  // For debugging, always succeed with test credentials
  if (email === 'admin@test.com' && password === 'test123') {
    // Set a debug session
    req.session.user = {
      id: 'admin-test',
      email,
      role: 'admin'
    };
    
    // Log the session we're setting
    console.log('Login test successful, session:', req.session);
    
    return res.json({
      success: true,
      message: 'Test login successful',
      token: 'test-token-12345',
      user: {
        id: 'admin-test',
        email,
        role: 'admin'
      }
    });
  }
  
  // If not test credentials, return debug info
  console.log('Login test failed - invalid credentials');
  
  res.status(401).json({
    success: false,
    error: 'Invalid credentials',
    debug_info: {
      provided_email: email,
      email_length: email?.length || 0,
      password_provided: !!password,
      password_length: password?.length || 0,
      headers: {
        content_type: req.headers['content-type'],
        accept: req.headers.accept,
        origin: req.headers.origin
      }
    }
  });
};

// Admin auth test endpoint - checks if a token/session is valid
export const adminAuthTest = (req, res) => {
  console.log('GET /admin/auth-test');
  
  // Check auth header
  const authHeader = req.headers.authorization;
  const tokenMatch = authHeader ? authHeader.match(/Bearer\s+(.+)/) : null;
  const token = tokenMatch ? tokenMatch[1] : null;
  
  // Check session
  const session = req.session;
  const sessionUser = session?.user;
  
  // Debug response with auth details
  res.json({
    auth_status: {
      has_token: !!token,
      token_value: token ? `${token.substring(0, 5)}...` : null,
      has_session: !!session,
      session_user: sessionUser ? {
        id: sessionUser.id,
        email: sessionUser.email,
        role: sessionUser.role
      } : null
    },
    result: {
      is_authenticated: !!sessionUser || (token === 'test-token-12345'),
      message: sessionUser ? 'Authenticated via session' : 
               (token === 'test-token-12345') ? 'Authenticated via token' : 
               'Not authenticated'
    }
  });
};

// Reset store password
export const resetStorePassword = async (req, res) => {
  logger.info('POST /admin/reset-store-password/:storeName called', { 
    storeName: req.params.storeName 
  });
  
  try {
    if (!db) {
      throw new Error('Firestore is unavailable');
    }
    
    const { storeName } = req.params;
    const { newPassword } = req.body;
    
    // Validate inputs
    if (!storeName) {
      return res.status(400).json({ error: 'Store name is required' });
    }
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    
    // Check if store exists
    const storeRef = db.collection('information').doc(storeName);
    const storeDoc = await storeRef.get();
    
    if (!storeDoc.exists) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the store password
    await storeRef.update({
      password: hashedPassword,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info('Password reset successful for store', { storeName });
    
    res.json({ 
      success: true, 
      message: 'Password reset successful'
    });
  } catch (error) {
    logger.error('Password reset error:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
}; 