import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import db, { isDatabaseAvailable } from '../config/db.js';
import logger from '../utils/logger.js';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get public URL
export const getPublicUrl = (req, res) => {
  logger.info('Public URL requested');
  // The ngrokUrl should be set in the environment variables
  const publicUrl = process.env.PUBLIC_URL || 'https://metavrai.shop';
  logger.debug('Returning public URL', { publicUrl });
  res.json({ publicUrl, message: 'Using server public URL' });
};

// Process client logs
export const processClientLogs = (req, res) => {
  logger.info('Client logs received');
  try {
    const { logs } = req.body;
    if (logs && Array.isArray(logs)) {
      logs.forEach(log => {
        const level = log.level || 'info';
        const action = log.action || 'unknown';
        const details = log.details ? JSON.stringify(log.details) : '';
        
        // Map client log levels to server log levels
        switch(level.toLowerCase()) {
          case 'error':
            logger.error(`[CLIENT] ${action}`, { page: log.page, details: log.details });
            break;
          case 'warn':
            logger.warn(`[CLIENT] ${action}`, { page: log.page, details: log.details });
            break;
          case 'debug':
            logger.debug(`[CLIENT] ${action}`, { page: log.page, details: log.details });
            break;
          default:
            logger.info(`[CLIENT] ${action}`, { page: log.page, details: log.details });
        }
      });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Error processing client logs', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to process client logs', details: error.message });
  }
};

// Get garment descriptions
export const getDescriptions = (req, res) => {
  const operationId = logger.startOperation('get-descriptions');
  
  try {
    const descriptionsPath = path.join(__dirname, '../../static/descriptions.json');
    
    logger.debug('Reading descriptions file', { path: descriptionsPath });
    
    if (!fs.existsSync(descriptionsPath)) {
      logger.warn('Descriptions file not found', { path: descriptionsPath });
      logger.failOperation(operationId, 'get-descriptions', 
        new Error('Descriptions file not found'), {
          statusCode: 404
        });
      return res.status(404).json({ error: 'Descriptions file not found' });
    }
    
    const descriptionsData = fs.readFileSync(descriptionsPath, 'utf8');
    const descriptions = JSON.parse(descriptionsData);
    
    logger.info('Successfully retrieved descriptions', { 
      descriptionCount: Object.keys(descriptions).length
    });
    
    logger.endOperation(operationId, 'get-descriptions', {
      count: Object.keys(descriptions).length
    });
    
    res.json(descriptions);
  } catch (error) {
    logger.error('Error getting descriptions', {
      error: error.message,
      stack: error.stack
    });
    
    logger.failOperation(operationId, 'get-descriptions', error, {
      statusCode: 500
    });
    
    res.status(500).json({ error: 'Failed to get descriptions', details: error.message });
  }
};

// Get trials remaining
export const getTrials = async (req, res) => {
  const operationId = logger.startOperation('get-trials');
  
  try {
    let numTrials = 3; // Default value
    const maxTrials = 3; // Default max value
    
    if (db) {
      try {
        const trialDoc = await db.collection('trails').doc('info').get();
        if (trialDoc.exists) {
          const dataFromDb = trialDoc.data();
          if (typeof dataFromDb.num_trails === 'number') {
            numTrials = dataFromDb.num_trails;
            logger.debug('Retrieved number of trials from database', { numTrials });
          }
        } else {
          logger.info('Trials document not found, creating with default values');
          await db.collection('trails').doc('info').set({ num_trails: numTrials });
        }
      } catch (error) {
        logger.error('Error getting trials information', {
          error: error.message,
          stack: error.stack
        });
      }
    } else {
      logger.warn('Database not initialized, using default trial values');
    }
    
    logger.endOperation(operationId, 'get-trials', { 
      remainingTrials: numTrials,
      maxTrials
    });
    
    res.json({ remainingTrials: numTrials, maxTrials });
  } catch (error) {
    logger.error('Error getting trials information', {
      error: error.message,
      stack: error.stack
    });
    
    logger.failOperation(operationId, 'get-trials', error, {
      statusCode: 500
    });
    
    res.status(500).json({ error: 'Failed to get trials information' });
  }
};

// Update trials
export const updateTrials = async (req, res) => {
  const operationId = logger.startOperation('update-trials');
  
  try {
    const numTrials = req.body.numTrials;
    
    if (typeof numTrials !== 'number' || numTrials < 0) {
      logger.warn('Invalid trial count provided', { numTrials });
      
      logger.failOperation(operationId, 'update-trials', 
        new Error('Invalid trial count'), {
          statusCode: 400,
          providedValue: numTrials
        });
      
      return res.status(400).json({ error: 'Invalid trial count' });
    }
    
    logger.info('Updating number of trials', { newTrialCount: numTrials });
    
    if (db) {
      try {
        await db.collection('trails').doc('info').set({ num_trails: numTrials });
        
        logger.info('Successfully updated trial count in database', { numTrials });
        logger.endOperation(operationId, 'update-trials', { numTrials });
        
        res.json({ success: true, message: 'Trials updated', numTrials });
      } catch (error) {
        logger.error('Error updating trials in database', {
          error: error.message,
          stack: error.stack
        });
        
        logger.failOperation(operationId, 'update-trials', error, {
          statusCode: 500,
          numTrials
        });
        
        res.status(500).json({ error: 'Failed to update trials' });
      }
    } else {
      logger.warn('Database not initialized, cannot update trials');
      
      logger.failOperation(operationId, 'update-trials', 
        new Error('Database not initialized'), {
          statusCode: 500
        });
      
      res.status(500).json({ error: 'Database not initialized' });
    }
  } catch (error) {
    logger.error('Error in update trials endpoint', {
      error: error.message,
      stack: error.stack
    });
    
    logger.failOperation(operationId, 'update-trials', error, {
      statusCode: 500
    });
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update trial counts
export const updateTrialCounts = async (req, res) => {
  logger.info('POST /update-trials called', { 
    storeId: req.body.storeId,
    field: req.body.field,
    value: req.body.value
  });
  
  try {
    if (!isDatabaseAvailable()) {
      throw new Error('Firestore is unavailable');
    }
    
    const { storeId, field, value } = req.body;
    
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID is required' });
    }
    
    if (!field || !['num_uploaded', 'num_tryons'].includes(field)) {
      return res.status(400).json({ error: 'Invalid field. Must be num_uploaded or num_tryons' });
    }
    
    if (value === undefined || isNaN(parseInt(value))) {
      return res.status(400).json({ error: 'Value must be a valid number' });
    }
    
    const storeRef = db.collection('information').doc(storeId);
    const storeDoc = await storeRef.get();
    
    if (!storeDoc.exists) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    // Update the specified field
    await storeRef.update({
      [field]: parseInt(value),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info(`Successfully updated ${field} for store ${storeId} to ${value}`);
    
    res.json({ 
      success: true, 
      message: `Successfully updated ${field}`,
      storeId,
      field,
      value: parseInt(value)
    });
  } catch (error) {
    logger.error('Update trial counts error:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to update trial counts', details: error.message });
  }
};

// Reset trial counts
export const resetTrialCounts = async (req, res) => {
  logger.info('POST /reset-trials called', { 
    storeId: req.body.storeId,
    field: req.body.field
  });
  
  try {
    if (!isDatabaseAvailable()) {
      throw new Error('Firestore is unavailable');
    }
    
    const { storeId, field } = req.body;
    
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID is required' });
    }
    
    if (field && !['num_uploaded', 'num_tryons'].includes(field)) {
      return res.status(400).json({ error: 'Invalid field. Must be num_uploaded or num_tryons' });
    }
    
    const storeRef = db.collection('information').doc(storeId);
    const storeDoc = await storeRef.get();
    
    if (!storeDoc.exists) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    // If field is specified, reset only that field; otherwise reset both
    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (field) {
      updateData[field] = 0;
    } else {
      updateData.num_uploaded = 0;
      updateData.num_tryons = 0;
    }
    
    await storeRef.update(updateData);
    
    logger.info(`Successfully reset trial counts for store ${storeId}`, { field });
    
    res.json({ 
      success: true, 
      message: field ? `Successfully reset ${field}` : 'Successfully reset all trial counts',
      storeId
    });
  } catch (error) {
    logger.error('Reset trial counts error:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to reset trial counts', details: error.message });
  }
}; 