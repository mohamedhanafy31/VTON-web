import admin from 'firebase-admin';
import logger from '../utils/logger.js';

// Initialize Firebase Admin SDK
let db;
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json')
    });
    logger.info('Firebase Admin SDK initialized successfully');
  } else {
    logger.info('Firebase Admin SDK already initialized, skipping initialization');
  }
  db = admin.firestore();
  
  // Test database connection
  db.collection('information').limit(1).get()
    .then(() => {
      logger.info('Firestore connection verified successfully');
    })
    .catch(error => {
      logger.error('Firestore connection test failed, may have connectivity issues', {
        error: error.message,
        code: error.code
      });
    });
    
} catch (error) {
  logger.error('Failed to initialize Firebase Admin SDK:', {
    message: error.message,
    code: error.code,
    details: error.details,
    stack: error.stack
  });
  logger.warn('Firestore will be unavailable; using fallback for Firestore-dependent routes');
  db = null;
}

// Export the database instance
export default db;

// Helper function for components to check database status
export const isDatabaseAvailable = () => {
  return !!db;
};

// Mock database functionality for testing without Firebase
export const getMockData = (collection) => {
  // Return mock data for basic functionality when Firestore is unavailable
  const mockData = {
    information: [
      {
        id: 'mock_store',
        store_name: 'Mock Store',
        email: 'mock@example.com',
        logo_link: '/MetaVrLogo.jpg',
        specialization: 'Development',
        access: true,
        garment_limit: 10,
        tryon_limit: 10
      }
    ]
  };
  
  return mockData[collection] || [];
}; 