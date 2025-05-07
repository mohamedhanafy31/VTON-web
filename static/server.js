import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import ngrok from 'ngrok';
import cors from 'cors';
import admin from 'firebase-admin';

// Load the service account key directly from the file
import serviceAccount from './serviceAccountKey.json' with { type: 'json' };
console.log('Service account loaded:', serviceAccount.project_id); // Debug log

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 3000;

// In-memory storage for job results from Artificial Studio API
const jobResults = {};

// Log environment variables for debugging
console.log('NGROK_AUTHTOKEN:', process.env.NGROK_AUTHTOKEN ? 'Loaded' : 'Not loaded');

// Configure Cloudinary
cloudinary.config({ 
  cloud_name: 'dj3ewvbqm', 
  api_key: '182963992493551', 
  api_secret: 'Jw9FTSGXX2VxuEaxKA-l8E2Kqag'
});

// Configure Multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image file'), false);
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.static(__dirname));
app.use(cors({
  origin: ['https://metavrai.shop', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Start ngrok to expose the local server
let ngrokUrl;
async function startNgrok() {
  try {
    ngrokUrl = await ngrok.connect({
      addr: port,
      authtoken: process.env.NGROK_AUTHTOKEN || undefined
    });
    console.log('Ngrok URL:', ngrokUrl);
  } catch (error) {
    console.error('Error starting ngrok:', error);
    ngrokUrl = 'https://metavrai.shop';
    console.log('Falling back to public URL:', ngrokUrl);
  }
}

// Start server and ngrok
app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);
  await startNgrok();
});

// Get trial count from Firestore
app.get('/trials', async (req, res) => {
  console.log('GET /trials called');
  try {
    const trialDoc = await db.collection('trails').doc('info').get();
    let responsePayload;
    const defaultDbValue = 10;

    if (trialDoc.exists) {
      const dataFromDb = trialDoc.data();
      if (dataFromDb && typeof dataFromDb.num_trails === 'number') {
        responsePayload = { num_trials: dataFromDb.num_trails };
        console.log('Trials data read from Firestore (num_trails):', dataFromDb.num_trails, 'Sending as num_trials:', responsePayload.num_trials);
      } else {
        console.warn('num_trails in Firestore is missing or not a number, re-initializing.');
        await db.collection('trails').doc('info').set({ num_trails: defaultDbValue });
        responsePayload = { num_trials: defaultDbValue };
      }
    } else {
      await db.collection('trails').doc('info').set({ num_trails: defaultDbValue });
      responsePayload = { num_trials: defaultDbValue };
      console.log('Initialized trials in Firestore with num_trails:', defaultDbValue, 'Sending as num_trials:', responsePayload.num_trials);
    }
    res.json(responsePayload);
  } catch (error) {
    console.error('Error reading trials from Firestore:', error);
    res.status(500).json({ error: 'Failed to fetch trials', details: error.message });
  }
});

// Update trial count in Firestore
app.post('/update-trials', async (req, res) => {
  console.log('POST /update-trials called with body:', req.body);
  try {
    const { num_trials } = req.body;
    if (typeof num_trials !== 'number' || num_trials < 0) {
      console.warn('Invalid trial count received (client sent num_trials):', num_trials);
      return res.status(400).json({ error: 'Invalid trial count' });
    }
    await db.collection('trails').doc('info').set({ num_trails: num_trials });
    console.log('Trials updated successfully in Firestore (stored as num_trails):', num_trials);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating trials in Firestore:', error);
    res.status(500).json({ error: 'Failed to update trial count', details: error.message });
  }
});

// Upload images
app.post('/upload', upload.array('images'), async (req, res) => {
  console.log('POST /upload called');
  try {
    const { color, garmentType, folder } = req.body;
    if (!color || !garmentType) {
      console.warn('Missing color or garmentType in upload request');
      return res.status(400).json({ error: 'Color and garment type are required' });
    }

    const imageCount = await getImageCount();
    if (imageCount + req.files.length > 6) {
      console.warn('Image limit exceeded:', imageCount + req.files.length);
      return res.status(400).json({ error: 'Maximum limit of 6 images reached' });
    }

    const uploadPromises = req.files.map(async (file) => {
      const base64Image = file.buffer.toString('base64');
      const dataURI = `data:${file.mimetype};base64,${base64Image}`;
      const publicId = `vton_image_${Date.now()}`;
      
      const uploadFolder = folder || 'VirtualTryOn_Images';
      
      const result = await cloudinary.uploader.upload(dataURI, {
        public_id: publicId,
        folder: uploadFolder,
        timestamp: Math.round(Date.now() / 1000)
      });
      return {
        public_id: result.public_id,
        url: result.secure_url
      };
    });

    const uploadedImages = await Promise.all(uploadPromises);
    console.log('Uploaded images:', uploadedImages);

    if (!folder || folder === 'VirtualTryOn_Images') {
      const descriptionsRef = db.collection('descriptions').doc('garments');
      let descriptions = (await descriptionsRef.get()).data() || {};
      uploadedImages.forEach(image => {
        descriptions[image.public_id] = { color, garmentType };
      });
      await descriptionsRef.set(descriptions);
      console.log('Updated descriptions in Firestore');
    }

    res.json({ images: uploadedImages });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload images', details: error.message });
  }
});

// Get images
app.get('/images', async (req, res) => {
  console.log('GET /images called');
  try {
    const result = await cloudinary.api.resources({
      resource_type: 'image',
      type: 'upload',
      prefix: 'VirtualTryOn_Images/',
      max_results: 100
    });
    
    const images = result.resources.map(resource => ({
      public_id: resource.public_id,
      url: resource.secure_url
    }));
    console.log('Images fetched:', images.length);
    
    res.json({ images });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images', details: error.message });
  }
});

// Get descriptions from Firestore
app.get('/descriptions', async (req, res) => {
  console.log('GET /descriptions called');
  try {
    const descriptionsRef = db.collection('descriptions').doc('garments');
    const doc = await descriptionsRef.get();
    const descriptions = doc.exists ? doc.data() : {};
    console.log('Descriptions read from Firestore:', Object.keys(descriptions).length);
    res.json({ descriptions });
  } catch (error) {
    console.error('Error fetching descriptions from Firestore:', error);
    res.status(500).json({ error: 'Failed to fetch descriptions', details: error.message });
  }
});

// Delete image
app.delete('/delete/:publicId', async (req, res) => {
  console.log('DELETE /delete/:publicId called with publicId:', req.params.publicId);
  try {
    const basePublicId = req.params.publicId;
    const fullPublicId = `VirtualTryOn_Images/${basePublicId}`;
    console.log('Attempting to delete image with full public_id:', fullPublicId);
    const destroyResult = await cloudinary.uploader.destroy(fullPublicId, { resource_type: 'image' });
    console.log('Cloudinary destroy result:', destroyResult);

    if (destroyResult.result !== 'ok') {
      console.error('Deletion failed:', destroyResult);
      return res.status(400).json({ success: false, error: 'Deletion failed: Image not found' });
    }

    const descriptionsRef = db.collection('descriptions').doc('garments');
    const doc = await descriptionsRef.get();
    let descriptions = doc.exists ? doc.data() : {};
    if (descriptions[fullPublicId]) {
      delete descriptions[fullPublicId];
      await descriptionsRef.set(descriptions);
      console.log('Updated descriptions in Firestore after deletion');
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete image', details: error.message });
  }
});

// Try-on endpoint
app.post('/tryon', async (req, res) => {
  console.log('POST /tryon called with body:', req.body);
  try {
    const trialDoc = await db.collection('trails').doc('info').get();
    let current_db_trials = 0;

    if (trialDoc.exists) {
      const dataFromDb = trialDoc.data();
      if (dataFromDb && typeof dataFromDb.num_trails === 'number') {
        current_db_trials = dataFromDb.num_trails;
        console.log('Current trials from DB (num_trails) for tryon check:', current_db_trials);
      } else {
        console.warn('num_trails in Firestore is missing or not a number for tryon check. Assuming 0 trials.');
      }
    } else {
      console.warn('Trials document not found in Firestore for tryon check. Assuming 0 trials, will be init by /trials.');
    }

    if (current_db_trials <= 0) {
      console.warn('No trials remaining based on num_trails from DB:', current_db_trials);
      return res.status(400).json({ error: 'No trials remaining' });
    }

    const { api_key, human, garment, garment_description, category } = req.body;
    if (!api_key || !human || !garment || !category) {
      console.warn('Missing required fields in tryon request');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const jobId = uuidv4();
    console.log('Generated jobId:', jobId);
    jobResults[jobId] = { status: 'pending', api_job_id: null, api_key };

    if (!ngrokUrl) {
      console.warn('Ngrok URL not available');
      return res.status(500).json({ error: 'Public URL not available' });
    }
    const webhookUrl = `${ngrokUrl}/webhook?job_id=${jobId}`;
    jobResults[jobId].webhook_url = webhookUrl;

    const payload = {
      model: 'try-clothes',
      input: {
        model: 'v1.0',
        human,
        garment,
        garment_description: garment_description || '',
        category
      },
      webhook: webhookUrl
    };

    console.log('Sending request to Artificial Studio API with payload:', payload);
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
      console.error('API request failed:', errorText);
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    console.log('Received response from Artificial Studio:', responseData);

    const apiJobId = responseData.id;
    jobResults[jobId] = {
      status: 'submitted',
      api_response: responseData,
      api_job_id: apiJobId,
      api_key,
      webhook_url: webhookUrl
    };

    startPollingForResults(jobId, apiJobId, api_key);
    res.json({
      success: true,
      job_id: jobId,
      message: 'Job submitted successfully',
      api_job_id: apiJobId
    });
  } catch (error) {
    console.error('Try-on error:', error);
    res.status(500).json({ error: 'Failed to process try-on request', details: error.message });
  }
});

// Poll Artificial Studio API for job results
async function startPollingForResults(jobId, apiJobId, apiKey) {
  const checkInterval = 10000; // 10 seconds
  const maxAttempts = 30; // 5 minutes
  let attempts = 0;

  const pollJob = async () => {
    if (attempts >= maxAttempts) {
      console.log(`Polling timeout for job ${jobId} after ${maxAttempts} attempts`);
      jobResults[jobId].status = 'failed';
      jobResults[jobId].error = 'Job timed out';
      return;
    }

    if (jobResults[jobId]?.status === 'completed') {
      console.log(`Job ${jobId} already completed, stopping polling`);
      return;
    }

    attempts++;
    console.log(`Polling attempt ${attempts} for job ${jobId}`);

    try {
      const response = await fetch(`https://api.artificialstudio.ai/api/generations/${apiJobId}`, {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`Failed to poll job status: ${response.status}`);
        setTimeout(pollJob, checkInterval);
        return;
      }

      const data = await response.json();
      console.log(`Polled status for job ${jobId}:`, data);

      if (data.status === 'success' || data.status === 'succeeded') {
        const outputUrl = data.output;
        let outputId = data.id;
        if (!outputId && data.output) {
          const match = data.output.match(/files\.artificialstudio.ai\/([0-9a-f-]+)/);
          if (match) outputId = match[1];
        }

        jobResults[jobId] = {
          status: 'completed',
          result: data,
          api_job_id: apiJobId,
          api_key: apiKey,
          output_id: outputId,
          output: outputUrl,
          timestamp: new Date().toISOString()
        };
        console.log(`Job ${jobId} completed via polling, output URL: ${outputUrl}`);
      } else if (data.status === 'failed') {
        jobResults[jobId] = {
          status: 'failed',
          result: {
            id: data.id,
            status: 'failed',
            error: data.error || 'Unknown error'
          },
          api_job_id: apiJobId,
          api_key: apiKey,
          timestamp: new Date().toISOString()
        };
        console.log(`Job ${jobId} failed: ${data.error || 'Unknown error'}`);
      } else {
        setTimeout(pollJob, checkInterval);
      }
    } catch (error) {
      console.error(`Error polling job status: ${error.message}`);
      setTimeout(pollJob, checkInterval);
    }
  };

  setTimeout(pollJob, checkInterval);
}

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  console.log('POST /webhook called with query:', req.query, 'body:', req.body);
  const jobId = req.query.job_id;

  if (!jobId) {
    console.error('Webhook request missing job_id');
    return res.status(400).json({ error: 'Missing job_id in webhook request' });
  }

  try {
    const webhookData = req.body;
    let outputUrl = webhookData.output || null;
    let outputId = webhookData.id;

    if (!outputId && outputUrl) {
      const match = outputUrl.match(/files\.artificialstudio.ai\/([0-9a-f-]+)/);
      if (match) outputId = match[1];
    }

    if (jobResults[jobId]) {
      const apiKey = jobResults[jobId].api_key;
      const apiJobId = webhookData.id || jobResults[jobId].api_job_id;

      jobResults[jobId] = {
        status: webhookData.status === 'success' || webhookData.status === 'succeeded' ? 'completed' : webhookData.status,
        result: webhookData,
        api_job_id: apiJobId,
        api_key: apiKey,
        output_id: outputId,
        output: outputUrl,
        timestamp: new Date().toISOString()
      };
      console.log(`Updated job ${jobId} status to ${jobResults[jobId].status}`);
    } else {
      console.warn(`Received webhook for unknown job_id: ${jobId}, creating new entry`);
      jobResults[jobId] = {
        status: webhookData.status === 'success' || webhookData.status === 'succeeded' ? 'completed' : webhookData.status,
        result: webhookData,
        api_job_id: webhookData.id,
        output_id: outputId,
        output: outputUrl,
        timestamp: new Date().toISOString()
      };
    }

    res.json({ success: true, message: 'Webhook received and processed' });
  } catch (error) {
    console.error(`Error processing webhook for job ${jobId}:`, error);
    res.status(500).json({ error: 'Webhook processing error', details: error.message });
  }
});

// Manual webhook processing
app.post('/manual-webhook', async (req, res) => {
  console.log('POST /manual-webhook called with body:', req.body);
  try {
    const { job_id, webhook_payload } = req.body;
    if (!job_id || !webhook_payload) {
      console.warn('Missing job_id or webhook_payload');
      return res.status(400).json({ error: 'Missing job_id or webhook_payload' });
    }

    let outputUrl = webhook_payload.output || null;
    let outputId = webhook_payload.id;
    if (!outputId && outputUrl) {
      const match = outputUrl.match(/files\.artificialstudio.ai\/([0-9a-f-]+)/);
      if (match) outputId = match[1];
    }

    if (jobResults[job_id]) {
      const apiKey = jobResults[job_id].api_key;
      const apiJobId = webhook_payload.id || jobResults[job_id].api_job_id;

      jobResults[job_id] = {
        status: webhook_payload.status === 'success' || webhook_payload.status === 'succeeded' ? 'completed' : webhook_payload.status,
        result: webhook_payload,
        api_job_id: apiJobId,
        api_key: apiKey,
        output_id: outputId,
        output: outputUrl,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        message: 'Manual webhook processed',
        job_status: jobResults[job_id].status,
        output_url: outputUrl
      });
    } else {
      const newJobId = uuidv4();
      jobResults[newJobId] = {
        status: webhook_payload.status === 'success' || webhook_payload.status === 'succeeded' ? 'completed' : webhook_payload.status,
        result: webhook_payload,
        api_job_id: webhook_payload.id,
        output_id: outputId,
        output: outputUrl,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        message: 'New job created with webhook data',
        job_id: newJobId,
        output_url: outputUrl
      });
    }
  } catch (error) {
    console.error('Error processing manual webhook:', error);
    res.status(500).json({ error: 'Manual webhook processing error', details: error.message });
  }
});

// Get result
app.get('/get-result/:jobId', (req, res) => {
  console.log('GET /get-result/:jobId called with jobId:', req.params.jobId);
  const jobId = req.params.jobId;

  if (!jobResults[jobId]) {
    console.warn(`Job not found: ${jobId}`);
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(jobResults[jobId]);
});

// Get public URL
app.get('/public-url', (req, res) => {
  console.log('GET /public-url called');
  if (ngrokUrl) {
    console.log('Returning ngrok URL:', ngrokUrl);
    res.json({ publicUrl: ngrokUrl });
  } else {
    console.warn('Ngrok URL not available, falling back to default');
    res.json({ publicUrl: 'https://metavrai.shop', message: 'Using server public URL' });
  }
});

// Test image accessibility
app.post('/test-image', async (req, res) => {
  console.log('POST /test-image called with body:', req.body);
  const { imageUrl } = req.body;

  if (!imageUrl) {
    console.warn('Image URL missing');
    return res.status(400).json({ error: 'Image URL is required' });
  }

  try {
    const startTime = Date.now();
    const response = await fetch(imageUrl, { method: 'HEAD' });
    const endTime = Date.now();

    const result = {
      url: imageUrl,
      accessible: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      responseTime: `${endTime - startTime}ms`
    };
    console.log('Image test result:', result);

    res.json(result);
  } catch (error) {
    console.error('Error testing image URL:', error);
    res.status(500).json({
      error: 'Failed to test image',
      details: error.message,
      url: imageUrl,
      accessible: false
    });
  }
});

// Client logs
app.post('/client-logs', (req, res) => {
  console.log('POST /client-logs called');
  try {
    const { logs } = req.body;
    if (logs && Array.isArray(logs)) {
      logs.forEach(log => {
        const level = log.level || 'info';
        const action = log.action || 'unknown';
        const details = log.details ? JSON.stringify(log.details) : '';
        console.log(`[CLIENT-LOG][${level.toUpperCase()}][${log.page || 'unknown'}] ${action} ${details}`);
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error processing client logs:', error);
    res.status(500).json({ error: 'Failed to process client logs', details: error.message });
  }
});

// Diagnostic endpoint
app.post('/diagnostic', (req, res) => {
  console.log('POST /diagnostic called with body:', req.body);
  try {
    const { userAgent, capabilities, errors } = req.body;
    console.log('Browser diagnostic information:', { userAgent, capabilities, errors });

    const recommendations = [];
    if (!capabilities?.hasMediaDevices || !capabilities?.hasGetUserMedia) {
      recommendations.push('Use a browser that supports MediaDevices API (e.g., Chrome, Firefox, Safari)');
    }
    if (capabilities?.cameraPermission === 'denied') {
      recommendations.push('Grant camera permissions in your browser settings');
    }
    if (capabilities?.videoDevices === 0) {
      recommendations.push('Ensure a camera is connected to your device');
    }

    res.json({
      success: true,
      message: 'Diagnostic information received',
      recommendations
    });
  } catch (error) {
    console.error('Error processing diagnostic information:', error);
    res.status(500).json({ error: 'Failed to process diagnostic information', details: error.message });
  }
});

// Helper function to get image count
async function getImageCount() {
  try {
    const result = await cloudinary.api.resources({
      resource_type: 'image',
      type: 'upload',
      prefix: 'VirtualTryOn_Images/',
      max_results: 100
    });
    console.log('Image count:', result.resources.length);
    return result.resources.length;
  } catch (error) {
    console.error('Error getting image count:', error);
    return 0;
  }
}

// Catch-all route for undefined endpoints
app.use((req, res) => {
  console.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found' });
});