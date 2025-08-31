import logger from '../utils/logger.js';

/**
 * Global error handling middleware
 * Handles all errors in the application and provides consistent error responses
 */
export const globalErrorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Global error handler caught error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Default error response
  let status = 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_ERROR';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation Error';
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError' || err.message === 'Unauthorized') {
    status = 401;
    message = 'Unauthorized';
    code = 'UNAUTHORIZED';
  } else if (err.name === 'ForbiddenError' || err.message === 'Forbidden') {
    status = 403;
    message = 'Forbidden';
    code = 'FORBIDDEN';
  } else if (err.name === 'NotFoundError' || err.status === 404) {
    status = 404;
    message = 'Not Found';
    code = 'NOT_FOUND';
  } else if (err.name === 'ConflictError') {
    status = 409;
    message = 'Conflict';
    code = 'CONFLICT';
  } else if (err.name === 'TooManyRequestsError') {
    status = 429;
    message = 'Too Many Requests';
    code = 'RATE_LIMIT_EXCEEDED';
  }

  // Firebase errors
  if (err.code && err.code.startsWith('firebase/')) {
    status = 500;
    message = 'Database Error';
    code = 'DATABASE_ERROR';
  }

  // Cloudinary errors
  if (err.http_code) {
    status = err.http_code;
    message = 'Image Service Error';
    code = 'IMAGE_SERVICE_ERROR';
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 400;
    message = 'File too large';
    code = 'FILE_TOO_LARGE';
  } else if (err.code === 'LIMIT_FILE_COUNT') {
    status = 400;
    message = 'Too many files';
    code = 'TOO_MANY_FILES';
  }

  // Build error response
  const errorResponse = {
    error: true,
    code,
    message: process.env.NODE_ENV === 'production' ? message : err.message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  };

  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details || null;
  }

  res.status(status).json(errorResponse);
};

/**
 * 404 handler for routes that don't exist
 */
export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.status = 404;
  error.name = 'NotFoundError';
  next(error);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors and pass them to error middleware
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom error classes
 */
export class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export default {
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError
};
