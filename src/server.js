import dotenv from 'dotenv';
import { validateConfigOrExit } from './utils/validateConfig.js';

const result = dotenv.config();
if (result.error) {
  console.error('Error loading .env file:', result.error);
} else {
  console.log('Environment variables loaded successfully');
}

// Validate configuration before starting server
const config = validateConfigOrExit();
import express from 'express';
import cors from 'cors';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Import configurations
import './config/db.js';
import sessionMiddleware from './config/session.js';
import { startNgrok } from './config/ngrok.js';

// Import middleware
import { requestLogger } from './utils/logger.js';
import logger from './utils/logger.js';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import tryonRoutes from './routes/tryonRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import miscRoutes from './routes/miscRoutes.js';
import garmentRoutes from './routes/garmentRoutes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store io instance in app for use in routes
app.set('io', io);

// Make io globally accessible for enhanced polling
global.io = io;

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Log application startup
logger.info('Application starting', {
  environment: process.env.NODE_ENV,
  port: process.env.PORT,
  version: process.env.npm_package_version
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware should be early in the chain
app.use(requestLogger);

// Import Cloudinary after environment variables are loaded
let cloudinary;
try {
  const cloudinaryModule = await import('./config/cloudinary.js');
  cloudinary = cloudinaryModule.default;
  app.set('cloudinary', cloudinary);
  logger.info('Cloudinary configured successfully');
} catch (error) {
  logger.error('Failed to load Cloudinary configuration:', { error: error.message });
  throw new Error('Cloudinary configuration is required but failed to load');
}

// Trust proxy for secure cookies behind Nginx
app.set('trust proxy', 1);

// Session middleware - must be before any routes that need session access
app.use(sessionMiddleware);



// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8000', 'https://your-ngrok-id.ngrok.io', 'https://metavrai.shop'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Log CORS configuration
logger.debug('CORS configured', {
  origins: ['http://localhost:3000', 'http://localhost:8000', 'https://your-ngrok-id.ngrok.io', 'https://metavrai.shop'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// API Routes - MUST come BEFORE HTML routes to avoid conflicts
app.use(authRoutes);
app.use(storeRoutes);
app.use('/api', imageRoutes);
app.use('/api', miscRoutes); // Mount misc routes under /api
app.use('/garments', garmentRoutes);
app.use('/tryon', tryonRoutes);
app.use('/api/orders', orderRoutes);

// Static files - serve from organized directories (MUST come BEFORE page routes)
const staticPath = path.join(__dirname, '../static');
console.log('Static path:', staticPath);
console.log('__dirname:', __dirname);

// Try different static middleware configurations
app.use('/static', express.static(staticPath));
app.use('/js', express.static(path.join(staticPath, 'js')));
app.use('/css', express.static(path.join(staticPath, 'css')));
app.use('/Media', express.static(path.join(staticPath, 'Media')));
app.use(express.static(staticPath));

// Test static file serving
app.get('/test-static', (req, res) => {
  res.send('Static middleware is working');
});

// Test static file serving with explicit route
app.get('/test-css', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/css/index.css'));
});

// Log static file configuration
logger.debug('Static directories configured', {
  mainStaticPath: path.join(__dirname, '../static'),
  vtonPath: '/VTON'
});

// Serve specific page types from their organized directories
app.use('/admin', express.static(path.join(__dirname, '../static/pages/admin')));
app.use('/main', express.static(path.join(__dirname, '../static/pages/main')));
app.use('/other', express.static(path.join(__dirname, '../static/pages/other')));

// Define routes for main HTML pages (MUST come AFTER static middleware)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/pages/main/index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/pages/main/login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/pages/main/register.html'));
});

app.get('/tryon', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/pages/main/tryon.html'));
});

app.get('/vton', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/pages/main/VTON.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/pages/main/user-dashboard.html'));
});

app.get('/test-upload', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/test-upload.html'));
});

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Define routes for admin pages
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/pages/admin/AdminDashBoard.html'));
});

app.get('/store/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/pages/admin/StoreDashBoard.html'));
});

// Socket.IO endpoint for health check
app.get('/socket.io/', (req, res) => {
  res.json({ 
    code: 0, 
    message: 'Socket.IO server is running',
    timestamp: new Date().toISOString()
  });
});

// Handle 404 errors for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

// Start server
httpServer.listen(process.env.PORT || 3000, async () => {
  logger.info(`Server running on port ${process.env.PORT || 3000}`, {
    port: process.env.PORT,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
  
  // Start ngrok tunnel in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    try {
      const ngrokUrl = await startNgrok(process.env.PORT || 3000);
      logger.info('Ngrok tunnel established', { ngrokUrl });
      
      // Automatically set PUBLIC_URL to current ngrok URL for webhooks
      if (ngrokUrl) {
        process.env.PUBLIC_URL = ngrokUrl;
        logger.info('PUBLIC_URL automatically set to current ngrok URL', { 
          publicUrl: process.env.PUBLIC_URL,
          ngrokUrl: ngrokUrl 
        });
      }
    } catch (error) {
      logger.error('Failed to start ngrok tunnel', { 
        error: error.message, 
        stack: error.stack
      });
    }
  }
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { 
    error: error.message, 
    stack: error.stack
  });
  // Allow the process to exit naturally after logging
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { 
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : 'No stack trace available'
  });
});

// Log when process is shutting down
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app; 