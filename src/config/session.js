import session from 'express-session';
import memoryStore from 'memorystore';
import { FirestoreStore } from '@google-cloud/connect-firestore';
import db from './db.js';
import logger from '../utils/logger.js';

// Configure session middleware
const MemoryStore = memoryStore(session);

// Default session duration is 24 hours
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000;

// Configure the session store
let sessionStore;
if (db) {
  try {
    sessionStore = new FirestoreStore({
      dataset: db,
      kind: 'express-sessions'
    });
    logger.info('Using Firestore session store');
  } catch (error) {
    logger.error('Failed to initialize Firestore session store', { 
      error: error.message, 
      stack: error.stack 
    });
    sessionStore = new MemoryStore({ checkPeriod: SESSION_MAX_AGE });
    logger.warn('Falling back to memory session store');
  }
} else {
  sessionStore = new MemoryStore({ checkPeriod: SESSION_MAX_AGE });
  logger.warn('Database unavailable, using memory session store');
}

// Configure session options
const sessionOptions = {
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'your_session_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    httpOnly: true
  }
};

// Log session configuration
logger.info('Session configuration initialized', {
  store: db ? 'Firestore' : 'Memory',
  secure: sessionOptions.cookie.secure,
  maxAge: `${SESSION_MAX_AGE / (60 * 60 * 1000)} hours`
});

export default session(sessionOptions); 