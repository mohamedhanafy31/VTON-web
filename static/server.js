import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import ngrok from 'ngrok';

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

// Parse JSON bodies
app.use(express.json());

// Serve static files
app.use(express.static(__dirname));

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Start ngrok to expose the local server
let ngrokUrl;
async function startNgrok() {
  try {
    ngrokUrl = await ngrok.connect({
      addr: port,
      authtoken: process.env.NGROK_AUTHTOKEN || undefined // Use .env or global config
    });
    console.log('Ngrok URL:', ngrokUrl);
  } catch (error) {
    console.error('Error starting ngrok:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    // Fallback to public server URL
    ngrokUrl = 'https://metavrai.shop';
    console.log('Falling back to public URL:', ngrokUrl);
  }
}

// Start server and ngrok
app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);
  await startNgrok();
});

// Define routes
app.post('/upload', upload.array('images'), async (req, res) => {
  console.log('POST /upload called');
  try {
    const { color, garmentType, folder } = req.body;
    if (!color || !garmentType) {
      return res.status(400).json({ error: 'Color and garment type are required' });
    }

    const imageCount = await getImageCount();
    if (imageCount + req.files.length > 6) {
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

    if (!folder || folder === 'VirtualTryOn_Images') {
      const descriptionsFile = `${__dirname}/descriptions.json`;
      let descriptions = {};
      try {
        const data = await fs.readFile(descriptionsFile, 'utf8');
        descriptions = JSON.parse(data);
      } catch (error) {
      }

      uploadedImages.forEach(image => {
        descriptions[image.public_id] = { color, garmentType };
      });

      await fs.writeFile(descriptionsFile, JSON.stringify(descriptions, null, 2));
    }

    res.json({ images: uploadedImages });
  } catch (error) {
    console.error('Upload error:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'Failed to upload images', details: error.message });
  }
});

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
    
    res.json({ images });
  } catch (error) {
    console.error('Error fetching images:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'Failed to fetch images', details: error.message });
  }
});

app.get('/descriptions', async (req, res) => {
  console.log('GET /descriptions called');
  try {
      const descriptionsFile = `${__dirname}/descriptions.json`;
      let descriptions = {};
      try {
          const data = await fs.readFile(descriptionsFile, 'utf8');
          descriptions = JSON.parse(data);
      } catch (error) {
      }
      res.json({ descriptions });
  } catch (error) {
      console.error('Error fetching descriptions:', JSON.stringify(error, null, 2));
      res.status(500).json({ error: 'Failed to fetch descriptions', details: error.message });
  }
});

app.delete('/delete/:publicId', async (req, res) => {
  console.log('DELETE /delete/:publicId called with publicId:', req.params.publicId);
  res.setHeader('Content-Type', 'application/json');
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

      const descriptionsFile = `${__dirname}/descriptions.json`;
      let descriptions = {};
      try {
          const data = await fs.readFile(descriptionsFile, 'utf8');
          descriptions = JSON.parse(data);
      } catch (error) {
          console.warn('Descriptions file not found or invalid, proceeding with empty object');
      }

      if (descriptions[fullPublicId]) {
          delete descriptions[fullPublicId];
          await fs.writeFile(descriptionsFile, JSON.stringify(descriptions, null, 2));
          console.log('Updated descriptions.json after deletion');
      }

      res.json({ success: true });
  } catch (error) {
      console.error('Delete error:', JSON.stringify(error, null, 2));
      res.status(500).json({ success: false, error: 'Failed to delete image', details: error.message });
  }
});

// Artificial Studio API - Try-on endpoint
app.post('/tryon', async (req, res) => {
  try {
    const { api_key, human, garment, garment_description, category } = req.body;
    
    if (!api_key || !human || !garment || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const job_id = uuidv4();
    jobResults[job_id] = { status: "pending", api_job_id: null, api_key };
    
    // Use ngrok URL or fallback to public server URL
    if (!ngrokUrl) {
      return res.status(500).json({ error: 'Public URL not available' });
    }
    const webhook_url = `${ngrokUrl}/webhook?job_id=${job_id}`;
    
    // Store the webhook URL in job results
    jobResults[job_id].webhook_url = webhook_url;
    
    const payload = {
      model: "try-clothes",
      input: {
        model: "v1.0",
        human: human,
        garment: garment,
        garment_description: garment_description || "",
        category: category
      },
      webhook: webhook_url
    };
    
    console.log('Sending request to Artificial Studio API with payload:', payload);
    
    const response = await fetch("https://api.artificialstudio.ai/api/generate", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': api_key
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    const responseData = await response.json();
    console.log('Received response from Artificial Studio:', responseData);
    
    // Store the job_id from the API response
    const api_job_id = responseData.id;
    jobResults[job_id] = {
      status: "submitted",
      api_response: responseData,
      api_job_id,
      api_key,
      webhook_url
    };

    // Start polling as a fallback
    startPollingForResults(job_id, api_job_id, api_key);
    
    res.json({ 
      success: true, 
      job_id,
      message: "Job submitted successfully. The result will be processed automatically.",
      api_job_id: api_job_id
    });
  } catch (error) {
    console.error('Try-on error:', error);
    res.status(500).json({ error: 'Failed to process try-on request', details: error.message });
  }
});

// Function to poll Artificial Studio API for job results
async function startPollingForResults(job_id, api_job_id, api_key) {
  const checkInterval = 10000; // Check every 10 seconds
  const maxAttempts = 30; // Try for 5 minutes maximum
  let attempts = 0;

  const pollJob = async () => {
    if (attempts >= maxAttempts) {
      console.log(`Polling timeout for job ${job_id} after ${maxAttempts} attempts`);
      return;
    }

    if (jobResults[job_id]?.status === "completed") {
      console.log(`Job ${job_id} already completed, stopping polling`);
      return;
    }

    attempts++;
    console.log(`Polling attempt ${attempts} for job ${job_id}`);

    try {
      const response = await fetch(`https://api.artificialstudio.ai/api/generations/${api_job_id}`, {
        method: 'GET',
        headers: {
          'Authorization': api_key,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Polled status for job ${job_id}:`, data);

        if (data.status === "success" || data.status === "succeeded") {
          const outputUrl = data.output;
          let output_id = data.id;
          if (!output_id && data.output) {
            const match = data.output.match(/files\.artificialstudio\.ai\/([0-9a-f-]+)/);
            if (match) {
              output_id = match[1];
            }
          }
          
          jobResults[job_id] = {
            status: "completed",
            result: data,
            api_job_id,
            api_key,
            output_id,
            output: outputUrl,
            timestamp: new Date().toISOString()
          };
          console.log(`Job ${job_id} completed via polling, output URL: ${outputUrl}`);
          return;
        } else if (data.status === "failed") {
          jobResults[job_id] = {
            status: "failed",
            result: {
              id: data.id,
              status: "failed",
              error: data.error || "Unknown error"
            },
            api_job_id,
            api_key,
            timestamp: new Date().toISOString()
          };
          console.log(`Job ${job_id} failed: ${data.error || "Unknown error"}`);
          return;
        }
      } else {
        console.warn(`Failed to poll job status: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error polling job status: ${error.message}`);
    }

    setTimeout(pollJob, checkInterval);
  };

  setTimeout(pollJob, checkInterval);
}

// Webhook endpoint to receive results from Artificial Studio
app.post('/webhook', async (req, res) => {
  const job_id = req.query.job_id;
  
  if (!job_id) {
    console.error('Webhook request missing job_id');
    return res.status(400).json({ error: 'Missing job_id in webhook request' });
  }
  
  try {
    console.log(`Received webhook for job ${job_id}:`, req.body);
    
    const webhookData = req.body;
    
    let outputUrl = null;
    if (webhookData && webhookData.output) {
      outputUrl = webhookData.output;
      console.log(`Output URL found for job ${job_id}: ${outputUrl}`);
    } else {
      console.warn(`No output URL found in webhook for job ${job_id}`);
    }
    
    let output_id = webhookData.id;
    if (!output_id && webhookData.output) {
      const match = webhookData.output.match(/files\.artificialstudio\.ai\/([0-9a-f-]+)/);
      if (match) {
        output_id = match[1];
      }
    }
    
    if (jobResults[job_id]) {
      const api_key = jobResults[job_id].api_key;
      const existing_api_job_id = jobResults[job_id].api_job_id;
      const api_job_id = webhookData.id || existing_api_job_id;
      
      jobResults[job_id] = {
        status: webhookData.status === "success" || webhookData.status === "succeeded" ? "completed" : webhookData.status,
        result: webhookData,
        api_job_id,
        api_key,
        output_id,
        output: outputUrl,
        timestamp: new Date().toISOString()
      };
      
      console.log(`Updated job ${job_id} status to ${jobResults[job_id].status}`);
    } else {
      console.warn(`Received webhook for unknown job_id: ${job_id}, creating new entry`);
      jobResults[job_id] = {
        status: webhookData.status === "success" || webhookData.status === "succeeded" ? "completed" : webhookData.status,
        result: webhookData,
        api_job_id: webhookData.id,
        output_id,
        output: outputUrl,
        timestamp: new Date().toISOString()
      };
    }
    
    res.json({ success: true, message: "Webhook received and processed successfully" });
  } catch (error) {
    console.error(`Error processing webhook for job ${job_id}:`, error);
    res.status(500).json({ error: 'Webhook processing error', details: error.message });
  }
});

// JSON endpoint to manually process the webhook data
app.post('/process-webhook-json', async (req, res) => {
  try {
    const webhookData = req.body;
    
    if (!webhookData || !webhookData.id) {
      return res.status(400).json({ error: 'Invalid webhook data' });
    }
    
    const job_id = uuidv4();
    
    const outputUrl = webhookData.output;
    
    let output_id = webhookData.id;
    if (!output_id && webhookData.output) {
      const match = webhookData.output.match(/files\.artificialstudio\.ai\/([0-9a-f-]+)/);
      if (match) {
        output_id = match[1];
      }
    }
    
    jobResults[job_id] = {
      status: webhookData.status === "success" || webhookData.status === "succeeded" ? "completed" : webhookData.status,
      result: webhookData,
      api_job_id: webhookData.id,
      output_id,
      output: outputUrl,
      timestamp: new Date().toISOString()
    };
    
    console.log(`Created new job ${job_id} with manual webhook data`, webhookData);
    
    res.json({ 
      success: true, 
      job_id, 
      status: jobResults[job_id].status,
      output: outputUrl 
    });
  } catch (error) {
    console.error('Error processing webhook JSON:', error);
    res.status(500).json({ error: 'Error processing webhook data', details: error.message });
  }
});

// Get result endpoint
app.get('/get-result/:job_id', (req, res) => {
  const job_id = req.params.job_id;
  
  if (!jobResults[job_id]) {
    console.warn(`Job not found: ${job_id}`);
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(jobResults[job_id]);
});

// Helper function to get current image count in garments folder
async function getImageCount() {
  try {
    const result = await cloudinary.api.resources({
      resource_type: 'image',
      type: 'upload',
      prefix: 'VirtualTryOn_Images/',
      max_results: 100
    });
    return result.resources.length;
  } catch (error) {
    console.error('Error counting images:', JSON.stringify(error, null, 2));
    return 0;
  }
}

// Endpoint to get public URL for clients
app.get('/public-url', (req, res) => {
  console.log('GET /public-url called');
  if (ngrokUrl) {
    res.json({ publicUrl: ngrokUrl });
  } else {
    res.json({ publicUrl: 'https://metavrai.shop', message: 'Using server public URL' });
  }
});

// Endpoint to test image accessibility
app.post('/test-image', async (req, res) => {
  console.log('POST /test-image called');
  const { imageUrl } = req.body;
  
  if (!imageUrl) {
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

// Endpoint to receive client-side logs
app.post('/client-logs', (req, res) => {
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
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing client logs:', error);
    res.status(500).json({ error: 'Failed to process client logs' });
  }
});

// Diagnostic endpoint for browser capabilities
app.post('/diagnostic', (req, res) => {
  console.log('POST /diagnostic called');
  try {
    const { userAgent, capabilities, errors } = req.body;
    
    console.log('Browser diagnostic information:');
    console.log(`User Agent: ${userAgent}`);
    
    if (capabilities) {
      console.log('Device/Browser Capabilities:');
      Object.entries(capabilities).forEach(([key, value]) => {
        console.log(`- ${key}: ${value}`);
      });
    }
    
    if (errors && errors.length) {
      console.log('Reported Errors:');
      errors.forEach((err, index) => {
        console.log(`Error ${index+1}: ${err.name} - ${err.message}`);
      });
    }
    
    res.status(200).json({ 
      success: true,
      message: 'Diagnostic information received',
      recommendations: [
        'Make sure you are using a modern browser like Chrome, Firefox or Safari',
        'Access the site using HTTPS in production',
        'Ensure camera permissions are granted',
        'Try using the alternative image upload option if camera access continues to fail'
      ]
    });
  } catch (error) {
    console.error('Error processing diagnostic information:', error);
    res.status(500).json({ error: 'Failed to process diagnostic information' });
  }
});

// Test endpoint to manually process a webhook payload
app.post('/manual-webhook', async (req, res) => {
  try {
    const { job_id, webhook_payload } = req.body;
    
    if (!job_id || !webhook_payload) {
      return res.status(400).json({ error: 'Missing job_id or webhook_payload' });
    }
    
    console.log(`Processing manual webhook for job ${job_id}:`, webhook_payload);
    
    let outputUrl = null;
    if (webhook_payload && webhook_payload.output) {
      outputUrl = webhook_payload.output;
      console.log(`Output URL found for job ${job_id}: ${outputUrl}`);
    }
    
    let output_id = webhook_payload.id;
    if (!output_id && webhook_payload.output) {
      const match = webhook_payload.output.match(/files\.artificialstudio\.ai\/([0-9a-f-]+)/);
      if (match) {
        output_id = match[1];
      }
    }
    
    if (jobResults[job_id]) {
      const api_key = jobResults[job_id].api_key;
      const existing_api_job_id = jobResults[job_id].api_job_id;
      const api_job_id = webhook_payload.id || existing_api_job_id;
      
      jobResults[job_id] = {
        status: webhook_payload.status === "success" || webhook_payload.status === "succeeded" ? "completed" : webhook_payload.status,
        result: webhook_payload,
        api_job_id,
        api_key,
        output_id,
        output: outputUrl,
        timestamp: new Date().toISOString()
      };
      
      res.json({ 
        success: true, 
        message: "Manual webhook processed",
        job_status: jobResults[job_id].status,
        output_url: outputUrl
      });
    } else {
      const new_job_id = uuidv4();
      jobResults[new_job_id] = {
        status: webhook_payload.status === "success" || webhook_payload.status === "succeeded" ? "completed" : webhook_payload.status,
        result: webhook_payload,
        api_job_id: webhook_payload.id,
        output_id,
        output: outputUrl,
        timestamp: new Date().toISOString()
      };
      
      res.json({ 
        success: true, 
        message: "New job created with webhook data",
        job_id: new_job_id,
        output_url: outputUrl
      });
    }
  } catch (error) {
    console.error('Error processing manual webhook:', error);
    res.status(500).json({ error: 'Manual webhook processing error', details: error.message });
  }
});