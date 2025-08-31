import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGzip } from 'zlib';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper function to format duration
function formatMsDuration(ms) {
  if (typeof ms !== 'number' || ms < 0) {
    return String(ms); // Return original value if not a valid number
  }
  if (ms === 0) return '0ms';

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  let parts = [];
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || (minutes > 0 && milliseconds === 0)) { // Show seconds if minutes are present or if it's non-zero
    parts.push(`${seconds}s`);
  }
  if (milliseconds > 0 && totalSeconds < 1) { // Show ms only if duration is less than a second
    parts.push(`${milliseconds}ms`);
  }
  
  if (parts.length === 0) {
      // This case handles when ms is > 0 but less than 1ms, or exactly 0 and totalSeconds is 0.
      // Or if totalSeconds > 0 but seconds and milliseconds are 0 (e.g. exactly 1 minute).
      // We want to ensure something is always returned.
      if (minutes === 0 && seconds === 0 && milliseconds === 0 && ms !== 0) return `${ms}ms`; // raw ms for very small non-zero
      if (parts.length === 0 && ms === 0) return '0ms'; // Already handled, but as a safeguard
      if (parts.length === 0 && ms > 0) return `${minutes > 0 ? minutes + "m" : ""}${minutes > 0 && seconds > 0 ? " " : ""}${seconds > 0 ? seconds + "s" : ""}${minutes === 0 && seconds === 0 ? ms + "ms" : ""}`.trim(); // reconstruct if empty
      if (parts.length === 0 ) return `${ms}ms`; // Final fallback
  }

  return parts.join(' ');
}

// Ensure log directories exist
const logsDir = process.env.LOGS_FOLDER || path.join(__dirname, '../../logs');
const serverLogsDir = path.join(logsDir, 'server');
const apiLogsDir = path.join(logsDir, 'api');
const errorLogsDir = path.join(logsDir, 'errors');
const accessLogsDir = path.join(logsDir, 'access');

[logsDir, serverLogsDir, apiLogsDir, errorLogsDir, accessLogsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Custom log levels
const logLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'gray'
  }
};

// Custom format for log entries
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for more readable logs
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  })
);

// Default rotation configuration
const defaultRotateConfig = {
  frequency: '24h',
  datePattern: 'YYYY-MM-DD',
  maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
  maxFiles: process.env.LOG_MAX_FILES || 5,
  auditFile: path.join(logsDir, '.audit.json'),
  format: logFormat,
  zippedArchive: true
};

// Create transports
const transports = [];

// Always add console transport in development
if (process.env.NODE_ENV !== 'production' || process.env.LOG_CONSOLE === 'true') {
  transports.push(new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: consoleFormat
  }));
}

// Add file transports
// 1. Combined logs for all levels
const combinedTransport = new winston.transports.DailyRotateFile({
  ...defaultRotateConfig,
  level: process.env.LOG_LEVEL || 'info',
  filename: path.join(serverLogsDir, 'combined-%DATE%.log')
});

// 2. Error logs only
const errorTransport = new winston.transports.DailyRotateFile({
  ...defaultRotateConfig,
  level: 'error',
  filename: path.join(errorLogsDir, 'error-%DATE%.log')
});

// 3. API logs (http requests/responses)
const apiTransport = new winston.transports.DailyRotateFile({
  ...defaultRotateConfig,
  level: 'http',
  filename: path.join(apiLogsDir, 'api-%DATE%.log')
});

// 4. Access logs (similar to nginx/apache)
const accessTransport = new winston.transports.DailyRotateFile({
  ...defaultRotateConfig,
  level: 'http',
  filename: path.join(accessLogsDir, 'access-%DATE%.log')
});

transports.push(combinedTransport, errorTransport, apiTransport, accessTransport);

// Create the logger
const logger = winston.createLogger({
  levels: logLevels.levels,
  format: logFormat,
  transports,
  exitOnError: false
});

// Add colors
winston.addColors(logLevels.colors);

// Utility to compress old log files
const compressFile = async (filePath) => {
  const gzip = createGzip();
  const source = createReadStream(filePath);
  const destination = createWriteStream(`${filePath}.gz`);
  
  await promisify(pipeline)(source, gzip, destination);
  fs.unlinkSync(filePath);
  logger.debug(`Compressed log file: ${filePath}`);
};

// Special logger for tracking system operations
const trackOperation = (operation, details) => {
  const { user, action, target, result, duration, metadata } = details;
  
  logger.info('Operation tracked', {
    operation,
    user: user || 'system',
    action,
    target,
    result: result || 'success',
    duration,
    metadata,
    timestamp: new Date().toISOString()
  });
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  // Get the start time
  const start = Date.now();
  
  // Log the request
  const requestInfo = {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    referrer: req.get('Referrer'),
    query: req.query,
    body: req.method === 'POST' || req.method === 'PUT' ? sanitizeBody(req.body) : undefined
  };
  
  // Log completion when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const responseInfo = {
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      duration: formatMsDuration(duration),
      contentLength: res.get('Content-Length'),
      contentType: res.get('Content-Type')
    };
    
    // Create access log entry like NGINX/Apache
    const accessLog = {
      ip: requestInfo.ip,
      user: req.user ? req.user.username || req.user.id : '-',
      date: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl || req.url,
      httpVersion: `HTTP/${req.httpVersion}`,
      status: res.statusCode,
      contentLength: responseInfo.contentLength || 0,
      userAgent: requestInfo.userAgent || '-',
      referer: requestInfo.referrer || '-',
      duration
    };
    
    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error('Server error', { request: requestInfo, response: responseInfo });
    } else if (res.statusCode >= 400) {
      logger.warn('Client error', { request: requestInfo, response: responseInfo });
    } else {
      logger.http('Request completed', { request: requestInfo, response: responseInfo });
    }
    
    // Log to access transport
    logger.log('http', 'Access', accessLog);
  });
  
  // Log errors
  res.on('error', (error) => {
    logger.error('Response error', { 
      error: error.message,
      stack: error.stack,
      request: requestInfo
    });
  });
  
  next();
};

// Sanitize sensitive data in request bodies
const sanitizeBody = (body) => {
  if (!body) return undefined;
  
  const sensitiveFields = ['password', 'token', 'secret', 'credit', 'card', 'cvv', 'ssn'];
  const sanitized = { ...body };
  
  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeBody(sanitized[key]);
    }
  });
  
  return sanitized;
};

// Add utility methods for common logging patterns
logger.trackOperation = trackOperation;

// Add startOperation and failOperation functions for tracking operations
export function startOperation(operation, details = {}) {
  const operationId = 'mark' + Math.random().toString(36).substring(2, 15);
  const startTime = new Date().toISOString();
  
  console.info(`Operation started: ${operation}`, {
    operationId,
    operation,
    details,
    status: 'started',
    startTime
  });
  
  return operationId;
}

export function failOperation(operationId, operation, error, details = {}) {
  const endTime = new Date().toISOString();
  
  console.error(`Operation failed: ${operation}`, {
    operationId,
    operation,
    error: error.message,
    stack: error.stack,
    ...details,
    status: 'failed',
    endTime
  });
}

export function endOperation(operationId, operation, details = {}) {
  const endTime = new Date().toISOString();
  
  console.info(`Operation completed: ${operation}`, {
    operationId,
    operation,
    ...details,
    status: 'completed',
    endTime
  });
}

export function succeedOperation(operationId, operation, details = {}) {
  const endTime = new Date().toISOString();
  
  console.info(`Operation succeeded: ${operation}`, {
    operationId,
    operation,
    ...details,
    status: 'succeeded',
    endTime
  });
}

// Export the logger
export { logger, requestLogger, trackOperation };
export default { 
  info: (message, meta) => logger.info(message, meta),
  warn: (message, meta) => logger.warn(message, meta),
  error: (message, meta) => logger.error(message, meta),
  debug: (message, meta) => logger.debug(message, meta),
  startOperation,
  failOperation,
  endOperation,
  succeedOperation
}; 