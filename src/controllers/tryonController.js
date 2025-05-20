import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import db from '../config/db.js';
import { startPollingForResults } from '../utils/jobManager.js';
import logger from '../utils/logger.js';
import admin from 'firebase-admin';

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

    // Get API key directly instead of from environment variable
    const api_key = 'dd240ad8f2e64de35e0b25ecddf1b42c2a7e637d';
    
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
  const jobId = req.query.job_id;
  console.log('Webhook received from Artificial Studio', {
    jobId,
    method: req.method,
    query: req.query,
    body: req.body,
    headers: req.headers,
    contentType: req.headers['content-type'],
    url: req.url
  });

  if (!jobId) {
    console.error('No job_id provided in webhook');
    return res.status(400).json({ error: 'No job_id provided' });
  }

  try {
    // Update job status in Firestore - using vton_jobs collection
    const jobRef = db.collection('vton_jobs').doc(jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      console.error('Job not found in Firestore:', jobId);
      return res.status(404).json({ error: 'Job not found' });
    }

    const jobData = jobDoc.data();
    const newStatus = req.body.status === 'success' ? 'completed' : 'failed';
    
    // Fix the output URL extension if needed
    let outputUrl = req.body.output;
    
    const hasOutput = req.body.status === 'success' && outputUrl;
    const outputId = hasOutput ? outputUrl.split('/').pop().split('.')[0] : null;

    await jobRef.update({
      status: newStatus,
      output_url: outputUrl,
      output_id: outputId,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('Updated job status from webhook in Firestore', {
      jobId,
      newStatus,
      hasOutput,
      outputUrl
    });

    // Forward webhook data to frontend
    const io = req.app.get('io');
    if (io) {
      io.emit('webhook', {
        type: 'webhook',
        payload: {
          id: req.body.id,
          job_id: jobId,
          status: req.body.status,
          output: outputUrl,
          error: req.body.error
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
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
    const jobRef = db.collection('vton_jobs').doc(jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      logger.warn('Job result requested for unknown or non-existent job', { jobId });
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const jobData = jobDoc.data();
    
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
      status: jobData.status,
      hasOutput: !!jobData.output_url
    });
    
    // Return relevant fields to the client
    res.json({
      job_id: jobId,
      status: jobData.status,
      api_job_id: jobData.api_job_id,
      output: jobData.output_url, // Client expects 'output' field
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