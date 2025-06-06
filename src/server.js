import dotenv from 'dotenv';
const result = dotenv.config();
if (result.error) {
  console.error('Error loading .env file:', result.error);
} else {
  console.log('Environment variables loaded successfully');
}
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
import cloudinary from './config/cloudinary.js';

// Import middleware
import { requestLogger } from './utils/logger.js';
import logger from './utils/logger.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import tryonRoutes from './routes/tryonRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import miscRoutes from './routes/miscRoutes.js';

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
app.use(express.json());

// Request logging middleware should be early in the chain
app.use(requestLogger);

// Add cloudinary to app for middleware access
app.set('cloudinary', cloudinary);

// Static files - serve from organized directories
app.use(express.static(path.join(__dirname, '../static')));
app.use('/VTON', express.static(path.join(__dirname, '../static')));

// Log static file configuration
logger.debug('Static directories configured', {
  mainStaticPath: path.join(__dirname, '../static'),
  vtonPath: '/VTON'
});

// Serve specific page types from their organized directories
app.use('/admin', express.static(path.join(__dirname, '../static/pages/admin')));
app.use('/main', express.static(path.join(__dirname, '../static/pages/main')));
app.use('/other', express.static(path.join(__dirname, '../static/pages/other')));

// Define routes for main HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/pages/main/index.html'));
});

app.get('/tryon', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/pages/main/tryon.html'));
});

app.get('/vton', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/pages/main/VTON.html'));
});

// Define routes for admin pages
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/pages/admin/AdminDashBoard.html'));
});

app.get('/store/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../static/pages/admin/StoreDashBoard.html'));
});

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

// API Routes
app.use(authRoutes);
app.use(storeRoutes);
app.use('/api', imageRoutes);
app.use(tryonRoutes);
app.use(orderRoutes);
app.use(miscRoutes);

// Add global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled application error', { 
    error: err.message,
    stack: err.stack,
    url: req.originalUrl
  });
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

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