# Comprehensive Logging System

This document explains the logging system implemented in the Virtual Try-On application.

## Overview

The application uses a robust logging system built with Winston to track all operations, requests, and errors. The logs are organized into different categories and stored in separate files with automatic rotation to prevent files from becoming too large.

## Log Directory Structure

```
/logs
├── api/                   # API-specific logs (requests/responses)
│   ├── api-2023-05-01.log
│   └── api-2023-05-02.log
├── access/                # HTTP access logs (like Nginx/Apache)
│   ├── access-2023-05-01.log
│   └── access-2023-05-02.log
├── errors/                # Error-only logs
│   ├── error-2023-05-01.log
│   └── error-2023-05-02.log
├── server/                # Combined server logs
│   ├── combined-2023-05-01.log
│   └── combined-2023-05-02.log
└── .audit.json            # Tracks log file rotation
```

## Log Levels

The system uses the following log levels (from highest to lowest priority):

1. `error` - Critical errors that need immediate attention
2. `warn` - Warnings that don't prevent the application from working
3. `info` - General information about system operation
4. `http` - HTTP request/response details
5. `verbose` - Detailed information for debugging
6. `debug` - Even more detailed debugging information
7. `silly` - The most detailed level

## Configuration

Logging behavior is controlled through environment variables:

- `LOG_LEVEL` - Sets the minimum log level to capture (default: 'info')
- `LOG_FILE_MAX_SIZE` - Maximum size of log files before rotation (default: 10MB)
- `LOG_MAX_FILES` - Number of rotated files to keep (default: 5)
- `LOG_CONSOLE` - Whether to output logs to console (default: true in development)
- `LOG_FORMAT` - Format for log entries ('json' or 'simple')

## Special Logging Features

### Operation Tracking

The system provides special methods for tracking operations throughout their lifecycle:

```javascript
// Start an operation
const operationId = logger.startOperation('image-upload', { 
  userId: 'user123', 
  filename: 'photo.jpg' 
});

try {
  // Perform operation...
  
  // End operation successfully
  logger.endOperation(operationId, 'image-upload', { 
    result: 'success', 
    imageId: 'img123' 
  });
} catch (error) {
  // Log operation failure
  logger.failOperation(operationId, 'image-upload', error, { 
    additionalContext: 'something' 
  });
}
```

### Request Logging

All HTTP requests are automatically logged with:
- Request method, URL, and headers
- Response status code and time
- Error details (if any)
- Request body (with sensitive data redacted)

### Error Handling

The system captures:
- Unhandled exceptions
- Unhandled promise rejections
- Application errors
- API errors

All errors include:
- Error message
- Stack trace
- Request context (when available)
- Timestamp

## Log Format

Logs are stored in JSON format with consistent fields:

```json
{
  "timestamp": "2023-05-01T12:34:56.789Z",
  "level": "info",
  "message": "Operation completed: image-upload",
  "operationId": "ldf8s0fj3",
  "operation": "image-upload",
  "user": "user123",
  "status": "completed",
  "duration": 123,
  "metadata": { "imageId": "img123" }
}
```

## Security Considerations

- Sensitive data (passwords, tokens, credit card information) is automatically redacted
- Log files use proper permissions
- Old log files are compressed to save space

## Usage Examples

### Logging Basic Information

```javascript
import logger from '../utils/logger.js';

// Log simple message
logger.info('User logged in');

// Log with context
logger.info('Payment processed', { 
  userId: 'user123', 
  amount: 99.99, 
  currency: 'USD' 
});
```

### Tracking Complex Operations

```javascript
import logger from '../utils/logger.js';

async function processOrder(order) {
  const opId = logger.startOperation('order-processing', { orderId: order.id });
  
  try {
    // Process payment
    await processPayment(order);
    logger.info('Payment processed', { orderId: order.id });
    
    // Update inventory
    await updateInventory(order.items);
    logger.info('Inventory updated', { orderId: order.id });
    
    // Send confirmation
    await sendConfirmation(order);
    
    // Complete operation
    logger.endOperation(opId, 'order-processing', { 
      result: 'success',
      processingTime: new Date() - order.createdAt
    });
    
    return { success: true };
  } catch (error) {
    logger.failOperation(opId, 'order-processing', error, { 
      orderId: order.id,
      stage: 'payment-processing'
    });
    
    return { success: false, error: error.message };
  }
}
```

## Viewing and Analyzing Logs

For development, logs are displayed in the console with color-coding.

For production environments, the JSON format makes it easy to:
- Parse logs with standard tools
- Import into log analysis services
- Filter and search for specific events 