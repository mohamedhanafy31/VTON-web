import session from 'express-session';
import memoryStore from 'memorystore';
import { FirestoreStore } from '@google-cloud/connect-firestore';
import db from './db.js';
import logger from '../utils/logger.js';

// Configure session middleware
const MemoryStore = memoryStore(session);

// Default session durations
const USER_SESSION_MAX_AGE = parseInt(process.env.USER_SESSION_MAX_AGE) || 7 * 24 * 60 * 60 * 1000; // 7 days for users
const ADMIN_SESSION_MAX_AGE = parseInt(process.env.ADMIN_SESSION_MAX_AGE) || 8 * 60 * 60 * 1000; // 8 hours for admin
const STORE_SESSION_MAX_AGE = parseInt(process.env.STORE_SESSION_MAX_AGE) || 12 * 60 * 60 * 1000; // 12 hours for store

// Configure separate session stores
const createSessionStore = (kind) => {
  if (db) {
    try {
      return new FirestoreStore({
        dataset: db,
        kind: kind
      });
    } catch (error) {
      logger.error(`Failed to initialize Firestore session store for ${kind}`, { 
        error: error.message, 
        stack: error.stack 
      });
      return new MemoryStore({ checkPeriod: USER_SESSION_MAX_AGE });
    }
  } else {
    return new MemoryStore({ checkPeriod: USER_SESSION_MAX_AGE });
  }
};

// Create separate stores for different session types
const userSessionStore = createSessionStore('user-sessions');
const adminSessionStore = createSessionStore('admin-sessions');
const storeSessionStore = createSessionStore('store-sessions');

// Create session configurations for different types
const createSessionConfig = (sessionStore, maxAge, cookieName) => ({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'your_session_secret_key',
  resave: true,
  saveUninitialized: true,
  name: cookieName,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAge,
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  }
});

// Export different session configurations
export const userSession = session(createSessionConfig(
  userSessionStore, 
  USER_SESSION_MAX_AGE, 
  'user.sid'
));

export const adminSession = session(createSessionConfig(
  adminSessionStore, 
  ADMIN_SESSION_MAX_AGE, 
  'admin.sid'
));

export const storeSession = session(createSessionConfig(
  storeSessionStore, 
  STORE_SESSION_MAX_AGE, 
  'store.sid'
));

// Default session for backward compatibility (user session)
const defaultSession = userSession;

// Log session configuration
logger.info('Session configuration initialized', {
  store: db ? 'Firestore' : 'Memory',
  userSessionMaxAge: `${USER_SESSION_MAX_AGE / (60 * 60 * 1000)} hours`,
  adminSessionMaxAge: `${ADMIN_SESSION_MAX_AGE / (60 * 60 * 1000)} hours`,
  storeSessionMaxAge: `${STORE_SESSION_MAX_AGE / (60 * 60 * 1000)} hours`,
  secure: process.env.NODE_ENV === 'production'
});

export default defaultSession; 