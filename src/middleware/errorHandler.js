// Enhanced Error Handler Middleware with Admin-Specific Handling
import logger from '../utils/logger.js';

// Custom error classes for better error handling
export class AdminError extends Error {
  constructor(message, statusCode = 500, code = 'ADMIN_ERROR') {
    super(message);
    this.name = 'AdminError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = 'VALIDATION_ERROR';
    this.field = field;
    this.isOperational = true;
  }
}

export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
    this.code = 'AUTHENTICATION_ERROR';
    this.isOperational = true;
  }
}

export class AuthorizationError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
    this.code = 'AUTHORIZATION_ERROR';
    this.isOperational = true;
  }
}

export class ResourceNotFoundError extends Error {
  constructor(resource = 'Resource') {
    super(`${resource} not found`);
    this.name = 'ResourceNotFoundError';
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
    this.isOperational = true;
  }
}

// Error handler middleware
export const errorHandler = (err, req, res, next) => {
  // Log the error with context
  const errorContext = {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id || req.user?.adminId || 'anonymous',
    userRole: req.user?.role || 'anonymous',
    timestamp: new Date().toISOString()
  };

  // Log based on error type
  if (err.isOperational) {
    logger.warn('Operational error occurred', errorContext);
  } else {
    logger.error('Unexpected error occurred', errorContext);
  }

  // Handle specific error types
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      field: err.field,
      timestamp: new Date().toISOString()
    });
  }

  if (err instanceof AuthenticationError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      message: 'Please log in to continue',
      timestamp: new Date().toISOString()
    });
  }

  if (err instanceof AuthorizationError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      message: 'You do not have permission to perform this action',
      timestamp: new Date().toISOString()
    });
  }

  if (err instanceof ResourceNotFoundError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString()
    });
  }

  if (err instanceof AdminError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString()
    });
  }

  // Handle database errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    logger.error('Database connection error', { error: err.message, code: err.code });
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
      message: 'Database connection failed. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }

  // Handle file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File too large',
      code: 'FILE_TOO_LARGE',
      message: 'The uploaded file exceeds the maximum allowed size.',
      timestamp: new Date().toISOString()
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Unexpected file field',
      code: 'UNEXPECTED_FILE_FIELD',
      message: 'An unexpected file field was detected.',
      timestamp: new Date().toISOString()
    });
  }

  // Handle validation errors from external libraries
  if (err.name === 'ValidationError') {
    const validationErrors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: validationErrors,
      timestamp: new Date().toISOString()
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
      message: 'The provided token is invalid or expired.',
      timestamp: new Date().toISOString()
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
      message: 'Your session has expired. Please log in again.',
      timestamp: new Date().toISOString()
    });
  }

  // Handle multer errors
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    let code = 'FILE_UPLOAD_ERROR';
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size too large';
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        code = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        code = 'FIELD_NAME_TOO_LONG';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        code = 'FIELD_VALUE_TOO_LONG';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields';
        code = 'TOO_MANY_FIELDS';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        code = 'UNEXPECTED_FILE_FIELD';
        break;
    }

    return res.status(400).json({
      success: false,
      error: message,
      code: code,
      message: message,
      timestamp: new Date().toISOString()
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  return res.status(statusCode).json({
    success: false,
    error: errorMessage,
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
};

// Async error wrapper for route handlers
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler for undefined routes
export const notFoundHandler = (req, res) => {
  logger.warn('Route not found', {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    message: `The requested route ${req.method} ${req.url} was not found.`,
    timestamp: new Date().toISOString()
  });
};

// Global error handler for uncaught exceptions
export const globalErrorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Uncaught error in global handler', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Send error response
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again later.',
    timestamp: new Date().toISOString()
  });
};

// Process error handler for unhandled rejections
export const processErrorHandler = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : 'No stack trace available',
      promise: promise.toString(),
      timestamp: new Date().toISOString()
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Gracefully shutdown the process
    process.exit(1);
  });
};

// Admin-specific error handler
export const adminErrorHandler = (err, req, res, next) => {
  // Log admin-specific errors with additional context
  const adminContext = {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    adminId: req.user?.adminId || 'unknown',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    isAdminRoute: true
  };

  logger.error('Admin error occurred', adminContext);

  // Handle admin-specific errors
  if (err.code === 'ADMIN_PERMISSION_DENIED') {
    return res.status(403).json({
      success: false,
      error: 'Permission denied',
      code: 'ADMIN_PERMISSION_DENIED',
      message: 'You do not have the required permissions to perform this action.',
      timestamp: new Date().toISOString()
    });
  }

  if (err.code === 'ADMIN_SESSION_EXPIRED') {
    return res.status(401).json({
      success: false,
      error: 'Session expired',
      code: 'ADMIN_SESSION_EXPIRED',
      message: 'Your admin session has expired. Please log in again.',
      timestamp: new Date().toISOString()
    });
  }

  // Pass to general error handler
  next(err);
};

// Validation error handler
export const validationErrorHandler = (err, req, res, next) => {
  if (err.name === 'ValidationError' || err.code === 'VALIDATION_ERROR') {
    logger.warn('Validation error', {
      error: err.message,
      url: req.url,
      method: req.method,
      body: req.body,
      timestamp: new Date().toISOString()
    });

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      message: 'Please check your input and try again.',
      details: err.details || err.message,
      timestamp: new Date().toISOString()
    });
  }

  next(err);
};

export default errorHandler;
