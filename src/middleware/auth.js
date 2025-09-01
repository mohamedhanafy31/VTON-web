// Authentication middleware for different session types
export const authenticateSession = (sessionType = 'user') => {
  return (req, res, next) => {
    console.log(`${sessionType.toUpperCase()} Authentication check for:`, req.originalUrl);
    console.log('Session data:', req.session);
    console.log('User in session:', req.session.user);

    // Check for Authorization header (Bearer token) for session recovery
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && !req.session.user) {
      console.log('Session not found but Authorization header present, attempting recovery');
      if (authHeader.includes(`${sessionType}-session`)) {
        req.session.user = { 
          role: sessionType, 
          email: req.headers['x-user-email'] || `${sessionType}@metavrai.shop` 
        };
        console.log(`Recovered ${sessionType} session from token`);
      }
    }

    if (!req.session.user && !req.session.userAddress) {
      console.log(`${sessionType.toUpperCase()} Authentication failed: No user in session`);
      
      // TEMPORARY AUTHENTICATION BYPASS FOR TESTING
      const testUserHeader = req.headers['x-test-user'];
      if (testUserHeader === 'test-acc' && sessionType === 'user') {
        console.log('Temporary authentication bypass for test user');
        req.session.user = {
          role: 'user',
          userId: 'pcPHP9qkchydd5GnVgt4',
          username: 'test acc',
          email: 'test3@name.com',
          name: 'test acc'
        };
        req.user = req.session.user;
        return next();
      }
      
      // Return specific error messages based on session type
      const errorMessages = {
        store: {
          error: 'Unauthorized: Store session expired',
          message: 'Your store session has expired. Please log in again.'
        },
        admin: {
          error: 'Unauthorized: Admin session expired',
          message: 'Your admin session has expired. Please log in again.'
        },
        user: {
          error: 'Unauthorized: User session expired',
          message: 'Your user session has expired. Please log in again.'
        }
      };

      return res.status(401).json(errorMessages[sessionType] || errorMessages.user);
    }

    // Validate that session type matches the expected role
    const user = req.session.user || { role: sessionType, userAddress: req.session.userAddress };
    
    if (sessionType !== 'user' && user.role !== sessionType) {
      console.log(`Session type mismatch. Expected: ${sessionType}, Got: ${user.role}`);
      return res.status(403).json({ 
        error: 'Forbidden: Invalid session type',
        message: `This endpoint requires ${sessionType} access.`
      });
    }

    req.user = user;
    console.log(`User authenticated as: ${req.user.role} for ${sessionType} session`);
    next();
  };
};

// Convenience middleware functions for different session types
export const authenticateUser = authenticateSession('user');
export const authenticateAdmin = authenticateSession('admin');
export const authenticateStore = authenticateSession('store');

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