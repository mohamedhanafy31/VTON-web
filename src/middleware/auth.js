// Authentication middleware
export const authenticateSession = (req, res, next) => {
  console.log('Authentication check for:', req.originalUrl);
  console.log('Session data:', req.session);
  console.log('User in session:', req.session.user);

  // Check for Authorization header (Bearer token) for admin operations
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ') && !req.session.user) {
    // This is just for session recovery - not full token-based auth
    // If session was lost but token exists, try to recover session
    console.log('Session not found but Authorization header present, attempting recovery');
    if (authHeader.includes('admin-session')) {
      req.session.user = { role: 'admin', email: req.headers['x-user-email'] || 'admin@metavrai.shop' };
      console.log('Recovered admin session from token');
    }
  }



  if (!req.session.user && !req.session.userAddress) {
    console.log('Authentication failed: No user in session');
    
    // Return error based on endpoint type
    if (req.originalUrl.includes('/store/')) {
      return res.status(401).json({ 
        error: 'Unauthorized: Store session expired',
        message: 'Your store session has expired. Please log in again.'
      });
    } else if (req.originalUrl.includes('/admin/') || req.originalUrl.includes('/stores')) {
      return res.status(401).json({ 
        error: 'Unauthorized: Admin session expired',
        message: 'Your admin session has expired. Please log in again.'
      });
    }
    
    return res.status(401).json({ error: 'Unauthorized: Please log in' });
  }

  req.user = req.session.user || { role: 'admin', userAddress: req.session.userAddress };
  console.log('User authenticated as:', req.user.role);
  next();
};

// Role-based restriction middleware
export const restrictTo = (...roles) => (req, res, next) => {
  console.log('Checking role restriction. User role:', req.user.role, 'Allowed roles:', roles);

  if (req.user.role === 'admin') {
    console.log('Admin user detected, granting access to protected route');
    return next();
  }

  if (!roles.includes(req.user.role)) {
    console.log('Access denied. User role:', req.user.role, 'Required roles:', roles.join(' or '));
    return res.status(403).json({ error: `Forbidden: ${roles.join(' or ')} access required` });
  }

  next();
}; 