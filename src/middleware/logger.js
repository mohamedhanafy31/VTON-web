import { requestLogger } from '../utils/logger.js';

// Request logging middleware for debugging
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  
  // Log request headers for CORS debugging
  console.log('Request Headers:', {
    origin: req.headers.origin,
    referer: req.headers.referer,
    'content-type': req.headers['content-type'],
    'access-control-request-method': req.headers['access-control-request-method'],
    'access-control-request-headers': req.headers['access-control-request-headers'],
    cookie: req.headers.cookie ? 'Present' : 'None',
    authorization: req.headers.authorization ? 'Present' : 'None'
  });
  
  // Log request body for POST/PUT requests (but sanitize passwords)
  if (['POST', 'PUT'].includes(req.method) && req.body) {
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
    console.log('Request Body:', sanitizedBody);
  }
  
  // Capture response data
  const originalSend = res.send;
  res.send = function(body) {
    res._body = body;
    return originalSend.call(this, body);
  };
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Response ${res.statusCode} sent for ${req.method} ${req.originalUrl} (${duration}ms)`);
    
    // For error responses, log more details
    if (res.statusCode >= 400) {
      try {
        const bodyText = typeof res._body === 'string' ? res._body : JSON.stringify(res._body);
        console.log(`Error response body: ${bodyText.substring(0, 200)}${bodyText.length > 200 ? '...' : ''}`);
      } catch (e) {
        console.log('Unable to log response body');
      }
    }
  });
  
  next();
};

export { requestLogger }; 