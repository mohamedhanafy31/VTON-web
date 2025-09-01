import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import db from '../config/db.js';
import { startPollingForResults } from '../utils/jobManager.js';
import logger from '../utils/logger.js';
import admin from 'firebase-admin';
import { UserModel, GarmentModel, TryOnJobModel } from '../models/index.js';
import { uploadToCloudinary, uploadCapturedPhoto } from '../config/cloudinary.js';

// Helper function to process completed results
async function processResult(jobId, apiJobId, resultUrl) {
  try {
    // Upload to Cloudinary for reliability
    let finalUrl = resultUrl;
    try {
      const { uploadResultToCloudinary } = await import('../config/cloudinary.js');
      const cloudinaryResult = await uploadResultToCloudinary(resultUrl);
      finalUrl = cloudinaryResult.secure_url;
      logger.info('Result uploaded to Cloudinary via enhanced polling', { 
        originalUrl: resultUrl,
        cloudinaryUrl: finalUrl 
      });
    } catch (uploadError) {
      logger.warn('Cloudinary upload failed in enhanced polling, using original URL', {
        error: uploadError.message
      });
      // Keep original URL as fallback - this is expected for Artificial Studio URLs
    }
    
    // Update job status
    await TryOnJobModel.update(jobId, {
      status: 'completed',
      resultUrl: finalUrl,
      output_url: finalUrl, // Also set the database field for compatibility
      originalResultUrl: resultUrl,
      updatedAt: new Date()
    });
    
    // Send Socket.IO notification
    const io = global.io; // Access global io instance
    if (io) {
      io.emit('tryon-result', {
        type: 'tryon-result',
        jobId: jobId,
        apiJobId: apiJobId,
        status: 'completed',
        resultUrl: finalUrl
      });
      logger.debug('Sent real-time update via enhanced polling');
    }
    
    logger.info('Job completed via enhanced polling', { jobId, resultUrl: finalUrl });
  } catch (error) {
    logger.error('Error processing result in enhanced polling', { 
      jobId, 
      apiJobId, 
      error: error.message 
    });
  }
}

// Enhanced polling system for jobs without webhook
async function startEnhancedPolling(jobId, apiJobId) {
  const maxAttempts = 30; // Poll for 5 minutes (30 attempts x 10 seconds)
  let attempts = 0;
  
  logger.info('Starting enhanced polling for job', { jobId, apiJobId });
  
  const poll = async () => {
    try {
      attempts++;
      logger.debug(`Enhanced polling attempt ${attempts}/${maxAttempts} for job ${jobId}`);
      
      // Try multiple file extensions
      const extensions = ['jpg', 'png', 'jpeg', 'webp'];
      
      for (const ext of extensions) {
        const possibleUrl = `https://files.artificialstudio.ai/${apiJobId}.${ext}`;
        
        try {
          const response = await fetch(possibleUrl, { 
            method: 'HEAD',
            timeout: 5000 
          });
          
          // Handle different response codes
          if (response.ok) {
            // 200 OK - File exists and is accessible
            logger.info('Enhanced polling found result!', { 
              jobId, 
              apiJobId, 
              resultUrl: possibleUrl,
              attempt: attempts 
            });
            
            await processResult(jobId, apiJobId, possibleUrl);
            return; // Stop polling
          } else if (response.status === 403) {
            // 403 Forbidden - File exists but not publicly accessible
            // However, we should NOT process it immediately - wait for webhook
            logger.info('Result found at constructed URL! Status: ready but waiting for webhook (403)', {
              jobId, 
              apiJobId, 
              resultUrl: possibleUrl,
              attempt: attempts 
            });
            
            // Don't process the result yet - let the webhook handle it
            // This prevents premature completion with 403 URLs
            // Continue polling to wait for webhook processing
          } else if (response.status === 404) {
            // 404 Not Found - File doesn't exist yet
            logger.debug('Enhanced polling - file not ready yet (404)', { 
              url: possibleUrl 
            });
          } else {
            // Other status codes
            logger.debug('Enhanced polling - unexpected status', { 
              url: possibleUrl, 
              status: response.status 
            });
          }
        } catch (fetchError) {
          logger.debug('Enhanced polling - fetch error', { 
            url: possibleUrl, 
            error: fetchError.message 
          });
        }
      }
      
      // Continue polling if not found and within limits
      if (attempts < maxAttempts) {
        setTimeout(poll, 10000); // Poll every 10 seconds
      } else {
        logger.warn('Enhanced polling exhausted for job', { 
          jobId, 
          apiJobId, 
          totalAttempts: attempts 
        });
        
        // Mark as failed after exhausting attempts
        await TryOnJobModel.update(jobId, {
          status: 'failed',
          error: 'Result not found after enhanced polling',
          updatedAt: new Date()
        });
      }
      
    } catch (error) {
      logger.error('Enhanced polling error', { 
        jobId, 
        apiJobId, 
        attempt: attempts,
        error: error.message 
      });
      
      // Continue polling on errors unless max attempts reached
      if (attempts < maxAttempts) {
        setTimeout(poll, 10000);
      }
    }
  };
  
  // Start the polling
  poll();
}

// Process user TryOn request (public demo)
export const processUserTryOn = async (req, res) => {
  // For demo purposes, create a demo user ID if no session user exists
  let userId = 'demo-user-' + Date.now();
  if (req.session && req.session.user && req.session.user.userId) {
    userId = req.session.user.userId;
  }
  
  const operationId = logger.startOperation('user-tryon-processing', {
    userId: userId,
    garmentId: req.body.garmentId
  });
  
  try {
    const { garmentId } = req.body;
    const userPhoto = req.file;
    
    logger.debug('User Try-on request received', { 
      userId,
      garmentId,
      hasUserPhoto: !!userPhoto
    });

    if (!userPhoto || !garmentId) {
      logger.warn('Missing required fields in user tryon request', { 
        hasUserPhoto: !!userPhoto, 
        hasGarmentId: !!garmentId
      });
      logger.failOperation(operationId, 'user-tryon-processing', new Error('Missing required fields: userPhoto and garmentId are required'), {
        statusCode: 400
      });
      return res.status(400).json({ error: 'Missing required fields: userPhoto and garmentId are required' });
    }

    // For demo purposes, skip user verification if it's a demo user
    if (!userId.startsWith('demo-user-')) {
      const user = await UserModel.findById(userId);
      if (!user) {
        logger.warn('User not found for tryon request', { userId });
        logger.failOperation(operationId, 'user-tryon-processing', new Error('User not found'), {
          statusCode: 404
        });
        return res.status(404).json({ error: 'User not found' });
      }
    }

    // Get garment details
    const garment = await GarmentModel.findById(garmentId);
    if (!garment) {
      logger.warn('Garment not found for tryon request', { garmentId });
      logger.failOperation(operationId, 'user-tryon-processing', new Error('Garment not found'), {
        statusCode: 404
      });
      return res.status(404).json({ error: 'Garment not found' });
    }

    // Check if user has reached daily tryon limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const userTryOns = await db.collection('tryon_jobs')
      .where('userId', '==', userId)
      .where('createdAt', '>=', today)
      .get();
    
    const dailyLimit = 10; // Default daily limit for users
    if (userTryOns.size >= dailyLimit) {
      logger.warn('User reached daily tryon limit', { userId, dailyLimit, currentCount: userTryOns.size });
      logger.failOperation(operationId, 'user-tryon-processing', new Error('Daily tryon limit reached'), {
        statusCode: 429
      });
      return res.status(429).json({ error: 'Daily tryon limit reached. Please try again tomorrow.' });
    }

    // Upload user photo to Cloudinary (or save locally if Cloudinary not configured)
    logger.debug('Processing user photo upload');
    let userPhotoUrl;
    
    try {
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        logger.debug('Uploading user photo to Cloudinary');
        const userPhotoUpload = await uploadToCloudinary(userPhoto, 'tryon/user-photos');
        userPhotoUrl = userPhotoUpload.secure_url;
      } else {
        logger.debug('Cloudinary not configured, saving locally');
        // Save file locally and create URL
        const fs = await import('fs').then(m => m.promises);
        const path = await import('path');
        
        const uploadDir = path.join(process.cwd(), 'static/uploads/tryon-user-photos');
        await fs.mkdir(uploadDir, { recursive: true });
        
        const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        const filepath = path.join(uploadDir, filename);
        
        await fs.writeFile(filepath, userPhoto.buffer);
        userPhotoUrl = `/uploads/tryon-user-photos/${filename}`;
        logger.debug('User photo saved locally', { filename, userPhotoUrl });
      }
    } catch (uploadError) {
      logger.error('Failed to upload user photo', { error: uploadError.message });
      throw new Error('Failed to process user photo');
    }

    // Get API key from environment variable
    const api_key = process.env.TRYON_API_KEY;
    
    if (!api_key) {
      logger.warn('API key is not configured, using mock response for testing');
      
      // For testing purposes, create a mock successful response
      const mockResult = {
        job_id: `mock_${jobId}`,
        output: 'https://via.placeholder.com/400x600/4CAF50/FFFFFF?text=Mock+Try-On+Result'
      };
      
      // Update job with mock result
      await db.collection('tryon_jobs').doc(jobId).update({
        status: 'completed',
        apiJobId: mockResult.job_id,
        resultUrl: mockResult.output,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info('Mock Try-on completed successfully', {
        jobId,
        userId,
        garmentId,
        apiJobId: mockResult.job_id
      });

      logger.succeedOperation(operationId, 'user-tryon-processing', {
        jobId,
        statusCode: 200
      });

      return res.json({
        success: true,
        message: 'Try-on completed successfully (mock response)',
        jobId: jobId,
        resultUrl: mockResult.output,
        userPhotoUrl: userPhotoUrl,
        garmentUrl: garment.url,
        garmentName: garment.name,
        apiJobId: mockResult.job_id
      });
    }
    
    // Create tryon job record
    const jobId = uuidv4();
    const jobData = {
      id: jobId,
      userId: userId,
      garmentId: garmentId,
      status: 'processing',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      category: garment.category,
      userPhotoUrl: userPhotoUrl,
      garmentUrl: garment.url
    };

    // Save job to database
    await db.collection('tryon_jobs').doc(jobId).set(jobData);

    // Process with Artificial Studio API
    const apiUrl = 'https://api.artificialstudio.ai/api/generate';
    const requestBody = {
      model: 'try-clothes',
      input: {
        model: 'v1.0',
        human: userPhotoUrl,
        garment: garment.url,
        category: garment.category.toLowerCase(),
        garment_description: garment.description || 'Selected garment'
      }
    };

    logger.info('Sending request to Artificial Studio API', {
      jobId,
      category: garment.category,
      apiUrl
    });

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': api_key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      logger.error('Artificial Studio API error', {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        error: errorText
      });
      
      // Update job status to failed
      await db.collection('tryon_jobs').doc(jobId).update({
        status: 'failed',
        error: errorText,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.failOperation(operationId, 'user-tryon-processing', new Error(`API error: ${apiResponse.status}`), {
        statusCode: apiResponse.status
      });
      return res.status(apiResponse.status).json({ error: 'Try-on processing failed', details: errorText });
    }

    const apiResult = await apiResponse.json();
    
    // Update job with API result
    await db.collection('tryon_jobs').doc(jobId).update({
      status: 'completed',
      apiJobId: apiResult.job_id,
      resultUrl: apiResult.output,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info('User Try-on completed successfully', {
      jobId,
      userId,
      garmentId,
      apiJobId: apiResult.job_id
    });

    logger.succeedOperation(operationId, 'user-tryon-processing', {
      jobId,
      statusCode: 200
    });

    res.json({
      success: true,
      message: 'Try-on completed successfully',
      jobId: jobId,
      resultUrl: apiResult.output,
      userPhotoUrl: userPhotoUrl,
      garmentUrl: garment.url,
      garmentName: garment.name,
      apiJobId: apiResult.job_id
    });

  } catch (error) {
    logger.error('User Try-on processing error:', { 
      message: error.message, 
      stack: error.stack,
      userId: req.session.user?.userId
    });
    
    logger.failOperation(operationId, 'user-tryon-processing', error, {
      statusCode: 500
    });
    
    res.status(500).json({ error: 'Try-on processing failed', details: error.message });
  }
};

// Process try-on request
export const processTryon = async (req, res) => {
  const operationId = logger.startOperation('tryon-processing', {
    category: req.body.category,
    storeName: req.body.storeName
  });
  
  try {
    const { human, garment, garment_description, category, storeName } = req.body;
    
    logger.debug('Try-on request received', { 
      human: human?.substring(0, 50) + '...',  // Don't log full URLs
      garment: garment?.substring(0, 50) + '...',
      category,
      storeName,
      hasDescription: !!garment_description
    });

    if (!human || !garment || !category) {
      logger.warn('Missing required fields in tryon request', { 
        hasHuman: !!human, 
        hasGarment: !!garment, 
        hasCategory: !!category 
      });
      logger.failOperation(operationId, 'tryon-processing', new Error('Missing required fields: human, garment, and category are required'), {
        statusCode: 400
      });
      return res.status(400).json({ error: 'Missing required fields: human, garment, and category are required' });
    }

    const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/;
    if (!urlPattern.test(human) || !urlPattern.test(garment)) {
      logger.warn('Invalid URLs provided for tryon', { 
        humanUrlValid: urlPattern.test(human), 
        garmentUrlValid: urlPattern.test(garment) 
      });
      logger.failOperation(operationId, 'tryon-processing', new Error('Invalid URLs'), {
        statusCode: 400
      });
      return res.status(400).json({ error: 'Invalid human or garment URL' });
    }

    const validCategories = ["upper_body", "lower_body"];
    if (!validCategories.includes(category.toLowerCase())) {
      logger.warn('Invalid category for tryon', { 
        providedCategory: category, 
        validCategories 
      });
      logger.failOperation(operationId, 'tryon-processing', new Error('Invalid category'), {
        statusCode: 400
      });
      return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    // Get API key from environment variable
    const api_key = process.env.TRYON_API_KEY;
    
    // Add detailed logging
    logger.debug('API Key Check', {
      hasApiKey: !!api_key,
      keyLength: api_key?.length,
      keyPrefix: api_key?.substring(0, 4)
    });

    if (!api_key) {
      logger.error('API key is not configured');
      logger.failOperation(operationId, 'tryon-processing', new Error('API key not configured'), {
        statusCode: 500
      });
      return res.status(500).json({ error: 'Try-on service is not configured correctly. API key missing.' });
    }
    
    // Log that we're using the API key (but don't log the actual key)
    logger.info('Using Artificial Studio API key', { 
      keyLength: api_key.length,
      keyPrefix: api_key.substring(0, 4) + '...',
      source: 'hardcoded'
    });

    let tryonLimit = 10; // Default if no specific limits found
    let limitUpdated = false;

    try {
      if (db) { // Check if Firestore is initialized
        await db.runTransaction(async (transaction) => {
          let currentLimit = -1; // Use -1 to indicate limit not yet fetched or applicable

          if (storeName) {
            const storeRef = db.collection('information').doc(storeName);
            const storeDoc = await transaction.get(storeRef);
            if (storeDoc.exists) {
              const storeData = storeDoc.data();
              currentLimit = storeData.tryon_limit !== undefined ? storeData.tryon_limit : 10;
              logger.info('Retrieved store-specific TryOn limit within transaction', { storeName, currentLimit });
              if (currentLimit > 0) {
                transaction.update(storeRef, { tryon_limit: currentLimit - 1 });
                tryonLimit = currentLimit -1; // Update the outer scope variable for logging
                limitUpdated = true;
                logger.info('Updated store TryOn limit within transaction', { storeName, newLimit: currentLimit - 1 });
              } else {
                tryonLimit = 0;
              }
            } else {
              logger.warn('Store not found during transaction, cannot apply store-specific limit', { storeName });
              // Optionally, fall through to global limit or deny if store-specific is required
              // For now, if store is specified but not found, we might not want to use global limit.
              // This depends on desired business logic. Assuming for now: if store specified, its limit (or lack thereof) is authoritative.
              currentLimit = 0; // Effectively no trials if store config is missing.
              tryonLimit = 0;
            }
          } else {
            const trialRef = db.collection('trails').doc('info');
            const trialDoc = await transaction.get(trialRef);
            if (trialDoc.exists) {
              const dataFromDb = trialDoc.data();
              currentLimit = dataFromDb.num_trails !== undefined ? dataFromDb.num_trails : 10;
              logger.info('Retrieved global TryOn limit within transaction', { currentLimit });
              if (currentLimit > 0) {
                transaction.update(trialRef, { num_trails: currentLimit - 1 });
                tryonLimit = currentLimit -1;
                limitUpdated = true;
                logger.info('Updated global TryOn limit within transaction', { newLimit: currentLimit - 1 });
              } else {
                tryonLimit = 0;
              }
            } else {
              logger.warn('Global trial info not found, cannot apply global limit', { });
              // If no global config, this implies no limit or a default kicks in elsewhere.
              // For safety, if this is the only limit mechanism, treat as no trials.
              currentLimit = 0;
              tryonLimit = 0;
            }
          }

          if (currentLimit <= 0 && limitUpdated == false) { // Check if the fetched limit was already 0
             tryonLimit = 0; // ensure outer scope tryonLimit is 0 if fetched limit is 0.
          }
        });
      } else {
        logger.warn('Firestore (db) is not available. Proceeding without try-on limit checks/updates.');
        // If DB is not available, we proceed without limit. This might be a desired behavior or should be an error.
        // For now, it follows the previous logic of defaulting to 10 if db operations fail.
        // tryonLimit remains its default value (10 in this case) or what was set before this block.
      }
    } catch (error) {
      logger.error('Transaction to update try-on limit failed', { 
        storeName, 
        error: error.message, 
        stack: error.stack 
      });
      logger.failOperation(operationId, 'tryon-processing', error, {
        statusCode: 500,
        reason: 'Failed to update try-on limit'
      });
      // If the transaction fails, it means the limit was not decremented.
      // We should not proceed with the try-on as the limit state is uncertain or couldn't be updated.
      return res.status(500).json({ error: 'Failed to update try-on limit. Please try again.' });
    }

    if (tryonLimit <= 0 && !limitUpdated) { // Check if the limit was 0 to begin with and wasn't just updated to 0
      logger.warn('No tryon trials remaining', {
        currentLimitValue: tryonLimit, // this will be 0
        storeName
      });
      logger.failOperation(operationId, 'tryon-processing', new Error('No trials remaining'), {
        statusCode: 400
      });
      return res.status(400).json({ error: 'No trials remaining' });
    }

    const jobId = uuidv4();
    logger.info('Generated job ID for tryon request', { jobId });

    // Construct webhook URL
    let publicUrl = process.env.NGROK_URL;
    if (!publicUrl) {
      try {
        const response = await fetch('http://127.0.0.1:4040/api/tunnels');
        const data = await response.json();
        if (data.tunnels && data.tunnels.length > 0) {
          const httpsTunnel = data.tunnels.find(t => t.proto === 'https');
          if (httpsTunnel) {
            publicUrl = httpsTunnel.public_url;
          }
        }
      } catch (error) {
        logger.warn('Could not connect to ngrok API', { error: error.message });
        publicUrl = process.env.PUBLIC_URL || 'https://metavrai.shop';
      }
    }

    // Ensure the webhook URL is properly formatted
    const webhookUrl = `${publicUrl.replace(/\/$/, '')}/api/webhook?job_id=${jobId}`;
    logger.info('Using webhook URL:', { webhookUrl });

    // Add webhook URL validation
    try {
      new URL(webhookUrl);
    } catch (error) {
      logger.error('Invalid webhook URL constructed', { webhookUrl, error: error.message });
      throw new Error('Invalid webhook URL configuration');
    }

    const initialJobData = {
      status: 'pending',
      api_key: api_key, // Store api_key for potential use by polling or webhook if needed separately
      webhook_url: webhookUrl,
      human_image_url: human,
      garment_image_url: garment,
      category: category,
      store_name: storeName || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      api_job_id: null, // Will be updated after API call
      api_response: null, // Will be updated after API call
      output_url: null,
      error: null
    };

    if (db) {
      try {
        await db.collection('vton_jobs').doc(jobId).set(initialJobData);
        logger.info('Initial job data saved to Firestore', { jobId });
      } catch (dbError) {
        logger.error('Failed to save initial job data to Firestore', { jobId, error: dbError.message, stack: dbError.stack });
        logger.failOperation(operationId, 'tryon-processing', dbError, {
          statusCode: 500,
          reason: 'Failed to save job state'
        });
        return res.status(500).json({ error: 'Failed to initialize try-on job. Please try again later.' });
      }
    } else {
      logger.error('Firestore (db) is not available. Cannot save job state.');
      logger.failOperation(operationId, 'tryon-processing', new Error('DB unavailable for job state'), {
        statusCode: 500
      });
      return res.status(500).json({ error: 'Try-on service is experiencing issues. Please try again later.' });
    }

    // Verify image URLs are accessible before sending to Artificial Studio
    logger.info('Verifying image accessibility before proceeding', { 
      humanImageUrl: human.substring(0, 50) + '...',
      garmentImageUrl: garment.substring(0, 50) + '...'
    });
    
    try {
      // Verify human image
      const humanImageResponse = await fetch(human, { method: 'HEAD' });
      if (!humanImageResponse.ok) {
        logger.error('Human image is not accessible', {
          status: humanImageResponse.status,
          statusText: humanImageResponse.statusText,
          url: human.substring(0, 50) + '...'
        });
        
        throw new Error(`User image not accessible: ${humanImageResponse.status} ${humanImageResponse.statusText}`);
      }
      
      // Verify garment image
      const garmentImageResponse = await fetch(garment, { method: 'HEAD' });
      if (!garmentImageResponse.ok) {
        logger.error('Garment image is not accessible', {
          status: garmentImageResponse.status,
          statusText: garmentImageResponse.statusText,
          url: garment.substring(0, 50) + '...'
        });
        
        throw new Error(`Garment image not accessible: ${garmentImageResponse.status} ${garmentImageResponse.statusText}`);
      }
      
      logger.info('Image verification successful, proceeding with API request', { jobId });
    } catch (verificationError) {
      logger.error('Image verification failed', {
        error: verificationError.message,
        stack: verificationError.stack
      });
      
      // Update job status in Firestore
      if (db) {
        try {
          await db.collection('vton_jobs').doc(jobId).update({
            status: 'failed',
            error: `Image verification failed: ${verificationError.message}`,
            updated_at: new Date().toISOString()
          });
        } catch (dbError) {
          logger.error('Failed to update job status after verification error', {
            jobId,
            error: dbError.message
          });
        }
      }
      
      logger.failOperation(operationId, 'tryon-processing', verificationError, {
        statusCode: 400,
        reason: 'Image verification failed'
      });
      
      return res.status(400).json({ 
        error: `Image verification failed: ${verificationError.message}. Please check image URLs and try again.` 
      });
    }
    
    const payload = {
      model: 'try-clothes',
      input: {
        human: human,
        garment: garment,
        category: category.toLowerCase(),
        garment_description: garment_description || ''
      },
      webhook: webhookUrl
    };

    logger.debug('Preparing API request to Artificial Studio', { 
      model: payload.model,
      category: payload.input.category,
      hasDescription: !!payload.input.garment_description,
      webhookUrl
    });
    
    logger.info('Sending request to Artificial Studio API', { jobId });
    const response = await fetch('https://api.artificialstudio.ai/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': api_key
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('API request to Artificial Studio failed', {
        jobId,
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      
      // Update job status in Firestore
      if (db) {
        try {
          await db.collection('vton_jobs').doc(jobId).update({
            status: 'failed',
            error: `API request failed: ${response.statusText}`,
            updated_at: new Date().toISOString()
          });
        } catch (dbError) {
          logger.error('Failed to update job status after API error', {
            jobId,
            error: dbError.message
          });
        }
      }
      
      const error = new Error(`API request failed with status ${response.status}: ${errorText}`);
      logger.failOperation(operationId, 'tryon-processing', error, {
        statusCode: 500,
        apiStatus: response.status
      });
      throw error;
    }

    const responseData = await response.json();
    logger.debug('Received response from Artificial Studio', { 
      jobId,
      apiResponseStatus: responseData.status,
      hasJobId: !!responseData.id
    });

    const apiJobId = responseData.id || responseData._id;
    if (!apiJobId) {
      logger.error('No job ID returned in API response', { 
        jobId,
        responseData 
      });
      
      if (db) {
        try {
          await db.collection('vton_jobs').doc(jobId).update({
            status: 'failed',
            error: 'No job ID returned from Artificial Studio',
            updated_at: new Date().toISOString()
          });
        } catch (dbError) {
          logger.error('Failed to update job status after missing job ID', {
            jobId,
            error: dbError.message
          });
        }
      }
      
      const error = new Error('Invalid API response: No job ID returned');
      logger.failOperation(operationId, 'tryon-processing', error, {
        statusCode: 500
      });
      throw error;
    }

    if (db) {
      try {
        await db.collection('vton_jobs').doc(jobId).update({
          status: 'submitted',
          api_response: responseData,
          api_job_id: apiJobId,
          updated_at: new Date().toISOString()
        });
        logger.info('Updated job data in Firestore after API submission', { jobId, apiJobId });
      } catch (dbError) {
        logger.error('Failed to update job data in Firestore after API submission', { jobId, apiJobId, error: dbError.message, stack: dbError.stack });
        // Log the error but don't fail the whole operation here, as the job is submitted to AI Studio
        // The webhook/polling might still recover or log its own issues.
      }
    }

    startPollingForResults(jobId, apiJobId, api_key);
    
    logger.endOperation(operationId, 'tryon-processing', {
      jobId,
      apiJobId,
      status: 'submitted'
    });

    
    res.json({
      success: true,
      job_id: jobId,
      message: 'Job submitted successfully',
      api_job_id: apiJobId
    });
  } catch (error) {
    logger.error('Try-on processing error', {
      operationId,
      error: error.message,
      stack: error.stack
    });
    
    logger.failOperation(operationId, 'tryon-processing', error, {
      statusCode: 500
    });
    
    res.status(500).json({ error: 'Failed to process try-on request. Please try again later.' });
  }
};

// Process webhook from Artificial Studio
export const handleWebhook = async (req, res) => {
  const operationId = logger.startOperation('artificial-studio-webhook');
  
  logger.info('Webhook received from Artificial Studio', {
    method: req.method,
    query: req.query,
    body: req.body,
    headers: req.headers,
    contentType: req.headers['content-type'],
    url: req.url
  });

  try {
    const webhookData = req.body;
    const { id, _id, status, output, error } = webhookData;
    
    // Handle both 'id' and '_id' fields from webhook
    const apiJobId = id || _id;

    // For demo purposes, handle missing ID gracefully
    if (!apiJobId) {
      logger.warn('No id or _id provided in webhook - this might be a demo/test call', { 
        webhookData,
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer'],
        contentType: req.headers['content-type']
      });
      
      // For demo purposes, always return success for missing IDs
      // This prevents the system from crashing on malformed webhook calls
      logger.info('Demo/malformed webhook call detected - returning success response');
      return res.json({ 
        success: true, 
        message: 'Webhook call received successfully',
        note: 'This was a call without job ID - treating as demo/test'
      });
    }

    // Find the TryOnJob by apiJobId
    const job = await TryOnJobModel.findByApiJobId(apiJobId);
    if (!job) {
      logger.warn('Job not found for apiJobId', { apiJobId: apiJobId });
      logger.failOperation(operationId, 'artificial-studio-webhook', new Error('Job not found'), {
        statusCode: 404
      });
      return res.status(404).json({ error: 'Job not found' });
    }

    logger.info('Processing webhook for job', { 
      jobId: job.id, 
      apiJobId: apiJobId, 
      status 
    });

    let cloudinaryResultUrl = null;

    // If successful and we have output, handle the result URL properly
    if (status === 'success' && output) {
      logger.debug('Processing result output', { outputUrl: output });
      
      // Check if the output URL is accessible or if it's a 403 Forbidden URL
      try {
        // Test if the URL is accessible
        const response = await fetch(output, { method: 'HEAD', timeout: 10000 });
        
        if (response.ok) {
          // URL is accessible, try to upload to Cloudinary
          try {
            logger.debug('Uploading accessible result to Cloudinary', { outputUrl: output });
            
            // Import uploadResultToCloudinary function
            const { uploadResultToCloudinary } = await import('../config/cloudinary.js');
            
            // Upload the result image to Cloudinary in "VTON Web site/VTON Results" folder
            const cloudinaryResult = await uploadResultToCloudinary(output);
            cloudinaryResultUrl = cloudinaryResult.secure_url;
            
            logger.info('Result uploaded to Cloudinary successfully', {
              jobId: job.id,
              originalUrl: output,
              cloudinaryUrl: cloudinaryResultUrl,
              publicId: cloudinaryResult.public_id
            });
            
          } catch (uploadError) {
            logger.error('Failed to upload result to Cloudinary', {
              jobId: job.id,
              error: uploadError.message,
              originalUrl: output
            });
            // Use original URL as fallback
            cloudinaryResultUrl = output;
          }
        } else if (response.status === 403) {
          // 403 Forbidden - URL exists but access is restricted
          // This is expected for Artificial Studio URLs
          logger.info('Result URL exists but access restricted (403) - using proxy approach', {
            jobId: job.id,
            originalUrl: output
          });
          
          // Extract the job ID from the URL to construct a proxy URL
          // Handle both formats: UUID-based (.undefined) and simple ID (.jpg)
          const urlMatch = output.match(/files\.artificialstudio\.ai\/([0-9a-f-]+(?:-[0-9a-f]+)*)/);
          if (urlMatch) {
            const extractedJobId = urlMatch[1];
            // Check if this is a UUID format (with .undefined extension)
            const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(extractedJobId);
            
            if (isUuidFormat) {
              // This is a real working URL - use it directly
              logger.info('Detected real working UUID-based result URL', {
                jobId: job.id,
                originalUrl: output,
                extractedJobId: extractedJobId
              });
              cloudinaryResultUrl = output; // Use the original URL directly
            } else {
              // This is a restricted URL - use proxy approach
              cloudinaryResultUrl = `${process.env.PUBLIC_URL}/tryon/serve-image/${extractedJobId}`;
              
              logger.info('Constructed proxy URL for restricted result', {
                jobId: job.id,
                originalUrl: output,
                proxyUrl: cloudinaryResultUrl
              });
            }
          } else {
            // Fallback to original URL
            cloudinaryResultUrl = output;
          }
        } else {
          // Other error status - log and use original URL
          logger.warn('Result URL returned unexpected status', {
            jobId: job.id,
            originalUrl: output,
            status: response.status
          });
          cloudinaryResultUrl = output;
        }
        
      } catch (fetchError) {
        // Network error or timeout - assume URL might be valid and try Cloudinary
        logger.warn('Could not verify result URL accessibility, attempting Cloudinary upload', {
          jobId: job.id,
          originalUrl: output,
          error: fetchError.message
        });
        
        try {
          const { uploadResultToCloudinary } = await import('../config/cloudinary.js');
          const cloudinaryResult = await uploadResultToCloudinary(output);
          cloudinaryResultUrl = cloudinaryResult.secure_url;
          
          logger.info('Result uploaded to Cloudinary despite URL verification failure', {
            jobId: job.id,
            originalUrl: output,
            cloudinaryUrl: cloudinaryResultUrl
          });
          
        } catch (uploadError) {
          logger.error('Failed to upload result to Cloudinary after URL verification failure', {
            jobId: job.id,
            error: uploadError.message,
            originalUrl: output
          });
          // Use original URL as final fallback
          cloudinaryResultUrl = output;
        }
      }
    }

    // Update job status
    const updateData = {
      status: status === 'success' ? 'completed' : 'failed',
      updatedAt: new Date()
    };

    if (status === 'success' && cloudinaryResultUrl) {
      // Set both fields to ensure compatibility with both old and new code
      updateData.resultUrl = cloudinaryResultUrl;
      updateData.output_url = cloudinaryResultUrl; // Database field
      updateData.originalResultUrl = output; // Keep original URL as backup
      
      logger.info('Setting both resultUrl and output_url fields for compatibility', {
        jobId: job.id,
        resultUrl: cloudinaryResultUrl,
        output_url: cloudinaryResultUrl
      });
    }

    if (error) {
      updateData.error = error;
    }

    await TryOnJobModel.update(job.id, updateData);

    logger.info('Updated job status from webhook', {
      jobId: job.id,
      status: updateData.status,
      hasResultUrl: !!updateData.resultUrl
    });

    // Decrease user trials when result is received (only for successful completions)
    if (status === 'success' && cloudinaryResultUrl) {
      try {
        // Find the user to decrease their trials
        const user = await UserModel.findById(job.userId);
        if (user) {
          const trialsRemaining = await user.decreaseTrials();
          logger.info('User trials decreased after receiving result', { 
            userId: job.userId, 
            username: user.username,
            trialsRemaining 
          });
        } else {
          logger.warn('User not found for trials decrease', { userId: job.userId });
        }
      } catch (trialError) {
        logger.error('Failed to decrease user trials after result', { 
          userId: job.userId, 
          error: trialError.message 
        });
        // Don't fail the webhook processing if trials decrease fails
        // The result is still valid and should be delivered
      }
    }

    // Forward webhook data to frontend via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      io.emit('tryon-result', {
        type: 'tryon-result',
        jobId: job.id,
        apiJobId: apiJobId,
        status: updateData.status,
        resultUrl: updateData.resultUrl,
        error: error
      });
      logger.debug('Sent webhook data to frontend via Socket.IO');
    }

    logger.succeedOperation(operationId, 'artificial-studio-webhook', {
      jobId: job.id,
      status: updateData.status,
      statusCode: 200
    });

    res.json({ success: true, jobId: job.id });

  } catch (error) {
    logger.error('Error processing webhook', {
      error: error.message,
      stack: error.stack
    });
    
    logger.failOperation(operationId, 'artificial-studio-webhook', error, {
      statusCode: 500
    });
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Process manual webhook
export const processManualWebhook = async (req, res) => {
  const operationId = logger.startOperation('manual-webhook-processing');
  
  logger.info('Manual webhook request received', {
    body: Object.keys(req.body)
  });
  
  try {
    const { job_id, webhook_payload } = req.body;
    
    if (!job_id || !webhook_payload) {
      logger.warn('Missing job_id or webhook_payload in manual webhook', {
        hasJobId: !!job_id,
        hasPayload: !!webhook_payload
      });
      
      logger.failOperation(operationId, 'manual-webhook-processing', 
        new Error('Missing job_id or webhook_payload'), {
          statusCode: 400
        });
      
      return res.status(400).json({ error: 'Missing job_id or webhook_payload' });
    }

    if (!db) {
      logger.error('Firestore (db) is not available. Cannot process manual webhook for job.', { jobId: job_id });
      logger.failOperation(operationId, 'manual-webhook-processing', new Error('DB unavailable for manual webhook'), {
        statusCode: 500,
        jobId: job_id
      });
      return res.status(500).json({ error: 'Manual webhook processing failed due to a server issue.' });
    }

    let outputUrl = webhook_payload.output || null;
    let extractedOutputId = null;
    
    logger.debug('Processing manual webhook data', {
      jobId: job_id,
      hasOutput: !!outputUrl,
      webhookStatus: webhook_payload.status
    });
    
    if (outputUrl) {
      const match = outputUrl.match(/files\.artificialstudio.ai\/([0-9a-f-]+)/);
      if (match) extractedOutputId = match[1];
      logger.debug('Extracted output ID from URL in manual webhook', { jobId: job_id, extractedOutputId });
    }

    const jobRef = db.collection('vton_jobs').doc(job_id);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      logger.warn('Manual webhook for unknown job_id or job not found in Firestore', { jobId: job_id });
      logger.failOperation(operationId, 'manual-webhook-processing', 
        new Error('Unknown job_id for manual webhook'), {
          statusCode: 404,
          jobId: job_id
        });
      return res.status(404).json({ error: 'Job not found', job_id });
    }
    
    const newStatus = webhook_payload.status === 'success' || webhook_payload.status === 'succeeded' 
      ? 'completed' : webhook_payload.status;

    const updatePayload = {
      status: newStatus,
      api_response: webhook_payload, // Store the full webhook payload
      output_url: outputUrl,
      output_id: extractedOutputId,
      error: newStatus === 'failed' ? (webhook_payload.error || 'Unknown error from manual webhook') : null,
      updated_at: new Date().toISOString()
    };
    
    await jobRef.update(updatePayload);
    
    logger.info('Updated job status from manual webhook in Firestore', {
      jobId: job_id,
      newStatus,
      hasOutput: !!outputUrl
    });
    
    logger.endOperation(operationId, 'manual-webhook-processing', {
      jobId: job_id,
      status: newStatus,
      hasOutput: !!outputUrl
    });

    res.json({
      success: true,
      message: 'Manual webhook processed',
      job_status: newStatus,
      output_url: outputUrl
    });

  } catch (error) {
    logger.error('Error processing manual webhook', {
      error: error.message,
      stack: error.stack
    });
    
    logger.failOperation(operationId, 'manual-webhook-processing', error, {
      statusCode: 500
    });
    
    res.status(500).json({ error: 'Manual webhook processing error. Please try again later.' });
  }
};

// Get job result
export const getJobResult = async (req, res) => {
  const jobId = req.params.jobId;
  
  logger.info('Job result requested', { jobId });
  
  if (!jobId) {
    logger.warn('Job result requested with no jobId provided');
    return res.status(400).json({ error: 'Job ID is required' });
  }

  if (!db) {
    logger.error('Firestore (db) is not available. Cannot get job result.', { jobId });
    return res.status(500).json({ error: 'Failed to retrieve job result due to a server issue.' });
  }

  try {
    // Check both collections for the job
    let jobRef = db.collection('tryon_jobs').doc(jobId);
    let jobDoc = await jobRef.get();
    let collectionName = 'tryon_jobs';

    // If not found in tryon_jobs, check vton_jobs
    if (!jobDoc.exists) {
      jobRef = db.collection('vton_jobs').doc(jobId);
      jobDoc = await jobRef.get();
      collectionName = 'vton_jobs';
    }

    if (!jobDoc.exists) {
      logger.warn('Job result requested for unknown or non-existent job', { jobId });
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const jobData = jobDoc.data();
    
    // If job is already completed with a result, return it immediately
    // Check both possible field names: output_url (database) and resultUrl (webhook)
    const hasResult = jobData.output_url || jobData.resultUrl;
    if (jobData.status === 'completed' && hasResult) {
      const resultUrl = jobData.output_url || jobData.resultUrl;
      
      // CRITICAL: Only return completed if we have a Cloudinary URL, not a 403 URL
      if (resultUrl && resultUrl.includes('res.cloudinary.com')) {
        logger.info('Job already completed with Cloudinary result, returning stored result', { 
          jobId, 
          status: jobData.status,
          outputUrl: resultUrl,
          fieldUsed: jobData.output_url ? 'output_url' : 'resultUrl'
        });
        
        return res.json({
          success: true,
          jobId: jobId,
          status: 'completed',
          apiJobId: jobData.apiJobId || jobData.api_job_id,
          resultUrl: resultUrl,
          output: resultUrl, // Also include 'output' for compatibility
          message: 'Try-on completed successfully'
        });
      } else if (resultUrl && resultUrl.includes('files.artificialstudio.ai')) {
        // We have a 403 URL but job is marked as completed
        // This means the webhook hasn't processed it yet - return pending
        logger.info('Job marked as completed but has 403 URL - webhook not processed yet, returning pending', { 
          jobId, 
          status: jobData.status,
          outputUrl: resultUrl
        });
        
        return res.json({
          success: true,
          jobId: jobId,
          status: 'pending',
          apiJobId: jobData.apiJobId || jobData.api_job_id,
          message: 'Try-on result is ready but being processed. Please wait for completion.'
        });
      }
    }
    
             // If job is still pending, actively check Artificial Studio API for updates
         if (jobData.status === 'pending' && jobData.apiJobId && !(jobData.output_url || jobData.resultUrl)) {
           logger.info('Job is pending, checking Artificial Studio API for updates', { 
             jobId, 
             apiJobId: jobData.apiJobId 
           });
           
           try {
             // Use enhanced polling to check for results
             const possibleExtensions = ['jpg', 'png', 'jpeg', 'webp'];
             
             for (const ext of possibleExtensions) {
               const possibleResultUrl = `https://files.artificialstudio.ai/${jobData.apiJobId}.${ext}`;
               
               try {
                 logger.info('Checking for result at constructed URL', { 
                   jobId, 
                   apiJobId: jobData.apiJobId,
                   possibleResultUrl
                 });
                 
                 // Check if the result file exists
                 const headResponse = await fetch(possibleResultUrl, { 
                   method: 'HEAD',
                   timeout: 10000 // 10 second timeout
                 });
                 
                 if (headResponse.ok) {
                   // 200 OK means file exists and is accessible
                   logger.info(`Result found at constructed URL! Status: completed`, { 
                     jobId, 
                     resultUrl: possibleResultUrl,
                     httpStatus: headResponse.status
                   });
                   
                   // Process the result
                   await processResult(jobId, jobData.apiJobId, possibleResultUrl);
                   
                   // Return the completed result
                   // Note: processResult will update the job with Cloudinary URL
                   // So we should get the updated result from the database
                   const updatedJobDoc = await jobRef.get();
                   const updatedJobData = updatedJobDoc.data();
                   const finalResultUrl = updatedJobData.output_url || updatedJobData.resultUrl;
                   
                   logger.info('Returning completed result after processing', {
                     jobId,
                     originalUrl: possibleResultUrl,
                     finalUrl: finalResultUrl,
                     isCloudinary: finalResultUrl && finalResultUrl.includes('res.cloudinary.com')
                   });
                   
                   return res.json({
                     success: true,
                     jobId: jobId,
                     status: 'completed',
                     apiJobId: jobData.apiJobId,
                     resultUrl: finalResultUrl,
                     output: finalResultUrl, // Also include 'output' for compatibility
                     message: 'Try-on completed successfully'
                   });
                 } else if (headResponse.status === 403) {
                   // 403 Forbidden means file exists and result is ready but access is restricted
                   // However, we should NOT mark it as completed yet - wait for webhook to process
                   logger.info(`Result file exists and is ready (403 Forbidden) - waiting for webhook processing`, { 
                     jobId, 
                     resultUrl: possibleResultUrl,
                     httpStatus: headResponse.status
                   });
                   
                   // Return pending status - let the webhook handle the completion
                   // This prevents the frontend from getting the 403 URL too early
                   return res.json({
                     success: true,
                     jobId: jobId,
                     status: 'pending',
                     apiJobId: jobData.apiJobId,
                     message: 'Try-on result is ready but being processed. Please wait for completion.'
                   });
                 }
               } catch (fetchError) {
                 logger.debug('Error checking result URL', {
                   error: fetchError.message,
                   url: possibleResultUrl
                 });
                 // Continue to next extension
               }
             }
             
             // If no results found, return pending
             logger.info('Result not ready yet, still processing', { jobId, apiJobId: jobData.apiJobId });
             return res.json({
               success: true,
               jobId: jobId,
               status: 'pending',
               apiJobId: jobData.apiJobId,
               message: 'Try-on is still processing'
             });
           } catch (apiError) {
             logger.warn('Error checking Artificial Studio API', {
               error: apiError.message,
               jobId: jobId
             });
             // Continue to normal flow
           }
         }
    
    // Check if job is marked as failed but we can attempt to find the result directly
    if (jobData.status === 'failed' && jobData.api_job_id) {
      logger.info('Job was marked as failed, attempting to check for direct result', { 
        jobId, 
        apiJobId: jobData.api_job_id 
      });
      
      try {
        // Try different possible file extensions for direct URL check
        const possibleOutputId = jobData.api_job_id;
        const possibleExtensions = ['jpg', 'png', 'undefined'];
        
        for (const ext of possibleExtensions) {
          const possibleOutputUrl = `https://files.artificialstudio.ai/${possibleOutputId}.${ext}`;
          
          try {
            logger.debug('Checking if output exists at URL', { possibleOutputUrl });
            const headResponse = await fetch(possibleOutputUrl, { method: 'HEAD' });
            
            if (headResponse.ok) {
              // Found a valid URL! Update job status and return the found URL
              logger.info('Found output URL for previously failed job', { jobId, possibleOutputUrl });
              
              // Get proper URL with jpg extension instead of undefined
              let outputUrl = possibleOutputUrl;
              if (ext === 'undefined') {
                outputUrl = `${possibleOutputUrl.split('.')[0]}.jpg`;
              }
              
              // Update the job record
              await jobRef.update({
                status: 'completed',
                output_url: outputUrl,
                error: null,
                updated_at: new Date().toISOString()
              });
              
              // Return the updated information
              return res.json({
                job_id: jobId,
                status: 'completed',
                api_job_id: jobData.api_job_id,
                output: outputUrl,
                output_id: possibleOutputId,
                error: null,
                timestamp: new Date().toISOString(),
                recovered: true
              });
            }
          } catch (fetchError) {
            logger.debug('Error checking possible output URL', { 
              error: fetchError.message,
              url: possibleOutputUrl
            });
            // Continue to next extension
          }
        }
        
        logger.debug('No direct output URL found after checking all extensions');
      } catch (recoveryError) {
        logger.warn('Error during attempt to recover failed job', {
          error: recoveryError.message,
          stack: recoveryError.stack
        });
        // Continue to return original job data
      }
    }
    
    logger.debug('Returning job result from Firestore', {
      jobId,
      collection: collectionName,
      status: jobData.status,
      hasOutput: !!jobData.output_url
    });
    
    // Return relevant fields to the client
    res.json({
      job_id: jobId,
      status: jobData.status,
      api_job_id: jobData.api_job_id,
      output: jobData.output_url, // Client expects 'output' field
      resultUrl: jobData.output_url, // Also include 'resultUrl' for frontend compatibility
      output_id: jobData.output_id,
      error: jobData.error,
      timestamp: jobData.updated_at // or created_at, depending on what's more relevant
    });

  } catch (dbError) {
    logger.error('Error fetching job result from Firestore', { jobId, error: dbError.message, stack: dbError.stack });
    res.status(500).json({ error: 'Failed to retrieve job result. Please try again later.' });
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

// Upload captured photo and create TryOnJob
export const uploadCapturedPhotoAndCreateJob = async (req, res) => {
  const operationId = logger.startOperation('upload-captured-photo');
  
  try {
    const { garmentId, imageData, category = 'upper_body' } = req.body;
    
    // For demo purposes, create a demo user ID if no session user exists
    let userId = 'demo-user-' + Date.now();
    if (req.session && req.session.user && req.session.user.userId) {
      userId = req.session.user.userId;
    }
    
    logger.debug('Captured photo upload request received', { 
      userId,
      garmentId,
      hasImageData: !!imageData,
      category
    });

    if (!imageData || !garmentId) {
      logger.warn('Missing required fields in captured photo upload request', { 
        hasImageData: !!imageData, 
        hasGarmentId: !!garmentId
      });
      logger.failOperation(operationId, 'upload-captured-photo', new Error('Missing required fields: imageData and garmentId are required'), {
        statusCode: 400
      });
      return res.status(400).json({ error: 'Missing required fields: imageData and garmentId are required' });
    }

    // For demo purposes, skip user verification if it's a demo user
    if (!userId.startsWith('demo-user-')) {
      const user = await UserModel.findById(userId);
      if (!user) {
        logger.warn('User not found for captured photo upload', { userId });
        logger.failOperation(operationId, 'upload-captured-photo', new Error('User not found'), {
          statusCode: 404
        });
        return res.status(404).json({ error: 'User not found' });
      }
    }

    // Get garment details
    const garment = await GarmentModel.findById(garmentId);
    if (!garment) {
      logger.warn('Garment not found for captured photo upload', { garmentId });
      logger.failOperation(operationId, 'upload-captured-photo', new Error('Garment not found'), {
        statusCode: 404
      });
      return res.status(404).json({ error: 'Garment not found' });
    }

    // Convert base64 image data to buffer
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Upload captured photo to Cloudinary
    logger.debug('Uploading captured photo to Cloudinary');
    let userPhotoUrl;
    
    try {
      const uploadResult = await uploadCapturedPhoto(imageBuffer, 'image/jpeg');
      userPhotoUrl = uploadResult.secure_url;
      logger.info('Captured photo uploaded successfully to Cloudinary', { 
        publicId: uploadResult.public_id,
        url: userPhotoUrl
      });
    } catch (uploadError) {
      logger.error('Failed to upload captured photo to Cloudinary', { error: uploadError.message });
      logger.failOperation(operationId, 'upload-captured-photo', uploadError, {
        statusCode: 500
      });
      return res.status(500).json({ error: 'Failed to upload photo to Cloudinary' });
    }

    // Create TryOnJob record
    logger.debug('Creating TryOnJob record');
    try {
      const jobData = {
        userId: userId,
        garmentId: garmentId,
        status: 'pending',
        category: category,
        userPhoto: userPhotoUrl,
        garmentUrl: garment.url || garment.secure_url,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      logger.debug('Job data being passed to TryOnJobModel.create:', jobData);

      const newJob = await TryOnJobModel.create(jobData);
      logger.info('TryOnJob created successfully', { jobId: newJob.id });

      logger.endOperation(operationId, 'upload-captured-photo', { 
        jobId: newJob.id,
        userPhotoUrl,
        garmentUrl: jobData.garmentUrl
      });

      res.json({
        success: true,
        message: 'Photo uploaded and TryOn job created successfully',
        jobId: newJob.id,
        userPhotoUrl: userPhotoUrl,
        garmentUrl: jobData.garmentUrl,
        job: newJob
      });

    } catch (jobError) {
      logger.error('Failed to create TryOnJob', { error: jobError.message });
      logger.failOperation(operationId, 'upload-captured-photo', jobError, {
        statusCode: 500
      });
      return res.status(500).json({ error: 'Failed to create TryOn job' });
    }

  } catch (error) {
    logger.error('Error in upload captured photo endpoint', {
      error: error.message,
      stack: error.stack
    });
    
    logger.failOperation(operationId, 'upload-captured-photo', error, {
      statusCode: 500
    });
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Process try-on using Artificial Studio API (public demo)
export const processArtificialStudioTryOn = async (req, res) => {
  const operationId = logger.startOperation('artificial-studio-tryon');
  
  try {
    const { garmentId, userPhotoUrl, garmentUrl, garmentDescription, category } = req.body;
    
    // For demo purposes, create a demo user ID if no session user exists
    let userId = 'demo-user-' + Date.now();
    let isDemoUser = false;
    if (req.session && req.session.user && req.session.user.userId) {
      userId = req.session.user.userId;
      isDemoUser = false;
    } else {
      isDemoUser = true;
      // For demo users, we'll allow a limited number of try-ons per session
      // This prevents abuse while allowing testing
      const demoTryOns = req.session?.demoTryOns || 0;
      if (demoTryOns >= 3) { // Limit demo users to 3 try-ons per session
        logger.warn('Demo user exceeded try-on limit', { demoTryOns });
        return res.status(400).json({ error: 'Demo limit reached. Please register for more try-ons.' });
      }
      // Increment demo try-on counter
      if (!req.session) req.session = {};
      req.session.demoTryOns = demoTryOns + 1;
    }
    
    logger.debug('Artificial Studio try-on request received', { 
      userId,
      garmentId,
      hasUserPhotoUrl: !!userPhotoUrl,
      hasGarmentUrl: !!garmentUrl,
      category
    });

    if (!userPhotoUrl || !garmentUrl || !garmentId || !category) {
      logger.warn('Missing required fields in artificial studio tryon request', { 
        hasUserPhotoUrl: !!userPhotoUrl, 
        hasGarmentUrl: !!garmentUrl,
        hasGarmentId: !!garmentId,
        hasCategory: !!category
      });
      logger.failOperation(operationId, 'artificial-studio-tryon', new Error('Missing required fields'), {
        statusCode: 400
      });
      return res.status(400).json({ 
        error: 'Missing required fields: userPhotoUrl, garmentUrl, garmentId, and category are required' 
      });
    }

    // For demo purposes, skip user verification if it's a demo user
    if (!userId.startsWith('demo-user-')) {
      const user = await UserModel.findById(userId);
      if (!user) {
        logger.warn('User not found for artificial studio tryon request', { userId });
        logger.failOperation(operationId, 'artificial-studio-tryon', new Error('User not found'), {
          statusCode: 404
        });
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Check if user has trials remaining
      if (user.trials_remaining <= 0) {
        logger.warn('User has no trials remaining', { userId, trialsRemaining: user.trials_remaining });
        logger.failOperation(operationId, 'artificial-studio-tryon', new Error('No trials remaining'), {
          statusCode: 400
        });
        return res.status(400).json({ error: 'No trials remaining. Please contact support for more information.' });
      }
      
      // Note: Trials will be decreased when the result is received, not when starting the try-on
      logger.info('Trials validation passed, trials will be decreased when result is received', { userId, trialsRemaining: user.trials_remaining });
    }

    // Get garment details (or use mock for testing)
    let garment;
    if (garmentId.startsWith('test-garment-')) {
      // Mock garment for testing
      garment = {
        id: garmentId,
        name: 'Test Garment',
        category: category || 'upper_body',
        url: garmentUrl,
        description: garmentDescription || 'Test garment for API testing'
      };
      logger.info('Using mock garment for testing', { garmentId });
    } else {
      try {
        garment = await GarmentModel.findById(garmentId);
        if (!garment) {
          logger.warn('Garment not found for artificial studio tryon request', { garmentId });
          logger.failOperation(operationId, 'artificial-studio-tryon', new Error('Garment not found'), {
            statusCode: 404
          });
          return res.status(404).json({ error: 'Garment not found' });
        }
      } catch (dbError) {
        logger.warn('Database error, using mock garment for testing', { garmentId, error: dbError.message });
        garment = {
          id: garmentId,
          name: 'Test Garment (DB Fallback)',
          category: category || 'upper_body',
          url: garmentUrl,
          description: garmentDescription || 'Test garment for API testing'
        };
      }
    }

    // Get API key from environment variable
    const api_key = process.env.TRYON_API_KEY;
    
    if (!api_key) {
      logger.warn('TRYON_API_KEY is not configured, using mock response for testing');
      // For testing without API key, return a mock response
      const mockJob = await TryOnJobModel.create({
        userId,
        garmentId,
        userPhotoUrl,
        garmentUrl,
        status: 'completed',
        resultUrl: 'https://via.placeholder.com/400x600/00ff00/ffffff?text=Mock+Try-On+Result',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      logger.info('Mock try-on job created for testing', { jobId: mockJob.id });
      
      return res.json({
        success: true,
        message: 'Mock try-on completed (no API key configured)',
        jobId: mockJob.id,
        resultUrl: mockJob.resultUrl,
        status: 'completed'
      });
    }

    // Create TryOnJob record first
    logger.debug('Creating TryOnJob record for Artificial Studio API');
    const jobData = {
      userId: userId,
      garmentId: garmentId,
      status: 'pending',
      category: category,
      userPhoto: userPhotoUrl,
      garmentUrl: garmentUrl,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newJob = await TryOnJobModel.create(jobData);
    logger.info('TryOnJob created for Artificial Studio processing', { jobId: newJob.id });

    // Enhanced polling instead of webhook system
    let webhookUrl = null;
    
    // Check if we have a configured public webhook URL
    if (process.env.PUBLIC_WEBHOOK_URL) {
      webhookUrl = `${process.env.PUBLIC_WEBHOOK_URL}/tryon/api/webhook`;
      logger.info('Using configured webhook URL', { webhookUrl });
    } else if (process.env.PUBLIC_URL) {
      webhookUrl = `${process.env.PUBLIC_URL}/tryon/api/webhook`;
      logger.info('Using PUBLIC_URL for webhook', { webhookUrl });
    } else {
      // Start enhanced polling for this job immediately
      logger.info('No webhook URL configured, starting enhanced polling system');
      
      // Start polling after 10 seconds to give API time to process
      // Note: apiJobId will be available after the API call
      logger.info('Enhanced polling will be started after API call');
    }

    // Prepare payload for Artificial Studio API
    const artificialStudioPayload = {
      model: 'try-clothes',
      input: {
        model: 'v1.0',
        human: userPhotoUrl,
        garment: garmentUrl,
        garment_description: garmentDescription || 'Selected garment',
        category: category
      }
    };
    
    // Only add webhook if available
    if (webhookUrl) {
      artificialStudioPayload.webhook = webhookUrl;
    }

    logger.debug('Sending request to Artificial Studio API', {
      payload: {
        ...artificialStudioPayload,
        webhook: webhookUrl
      }
    });

    // Make API call to Artificial Studio
    const apiResponse = await fetch('https://api.artificialstudio.ai/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': api_key
      },
      body: JSON.stringify(artificialStudioPayload)
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      logger.error('Artificial Studio API error', {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        error: errorText
      });

      // Update job status to failed
      await TryOnJobModel.update(newJob.id, {
        status: 'failed',
        error: errorText,
        updatedAt: new Date()
      });

      logger.failOperation(operationId, 'artificial-studio-tryon', new Error(`API error: ${apiResponse.status}`), {
        statusCode: apiResponse.status
      });
      return res.status(apiResponse.status).json({ 
        error: 'Try-on processing failed', 
        details: errorText 
      });
    }

    const apiResult = await apiResponse.json();
    logger.info('Artificial Studio API response received', {
      jobId: newJob.id,
      apiResult: apiResult,
      apiJobId: apiResult._id || apiResult.id,
      status: apiResult.status
    });
    
    // Check if we have a valid API job ID
    const apiJobId = apiResult._id || apiResult.id;
    if (!apiJobId) {
      logger.error('No job ID in API response', { apiResult });
      throw new Error('Invalid API response: No job ID returned');
    }
    
    // Update job with API result
    await TryOnJobModel.update(newJob.id, {
      apiJobId: apiJobId,
      status: apiResult.status || 'processing',
      updatedAt: new Date()
    });
    
    // If no webhook URL was configured, start enhanced polling now that we have the apiJobId
    if (!webhookUrl) {
      logger.info('Starting enhanced polling for job', { jobId: newJob.id, apiJobId });
      // Start polling after 10 seconds to give API time to process
      setTimeout(() => {
        startEnhancedPolling(newJob.id, apiJobId);
      }, 10000);
    }

    logger.succeedOperation(operationId, 'artificial-studio-tryon', {
      jobId: newJob.id,
      apiJobId: apiJobId,
      statusCode: 200
    });

    res.json({
      success: true,
      message: 'Try-on request submitted successfully',
      jobId: newJob.id,
      apiJobId: apiJobId,
      status: apiResult.status || 'processing',
      userPhotoUrl: userPhotoUrl,
      garmentUrl: garmentUrl,
      garmentName: garment.name
    });

  } catch (error) {
    logger.error('Artificial Studio try-on processing error:', { 
      message: error.message, 
      stack: error.stack,
      userId: req.session.user?.userId
    });
    
    logger.failOperation(operationId, 'artificial-studio-tryon', error, {
      statusCode: 500
    });
    
    res.status(500).json({ 
      error: 'Try-on processing failed', 
      details: error.message 
    });
  }
}; 