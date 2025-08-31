import { Router } from 'express';
import { 
  processTryon, 
  handleWebhook, 
  processManualWebhook, 
  getJobResult, 
  getTrials, 
  updateTrials,
  processUserTryOn,
  uploadCapturedPhotoAndCreateJob,
  processArtificialStudioTryOn
} from '../controllers/tryonController.js';
import { authenticateSession, restrictTo } from '../middleware/auth.js';
import { uploadSingle } from '../config/multer.js';

const router = Router();

// TryOn processing
router.post('/tryon', processTryon);

// User TryOn processing (public access for demo)
router.post('/process', uploadSingle, processUserTryOn);

// Upload captured photo and create TryOnJob (public access for demo)
router.post('/upload-captured-photo', uploadCapturedPhotoAndCreateJob);

// Process try-on using Artificial Studio API (public access for demo)
router.post('/process-artificial-studio', processArtificialStudioTryOn);

// Webhook processing - no auth required for webhooks
router.post('/api/webhook', handleWebhook);
router.get('/api/webhook', handleWebhook);
router.post('/api/manual-webhook', processManualWebhook);

// Job result and trials management (public access for demo)
router.get('/get-result/:jobId', getJobResult);
router.get('/trials', getTrials);
router.post('/update-trials', updateTrials);

// Note: Webhook handling is now done by the handleWebhook function in the controller
// This removes the duplicate route that was overriding the proper webhook handler

// Image proxy endpoint to serve Artificial Studio results
router.get('/proxy-image/:apiJobId', async (req, res) => {
  try {
    const { apiJobId } = req.params;
    const { ext = 'jpg' } = req.query;
    
    console.log('🖼️ Image proxy requested for:', { apiJobId, ext });
    
    // Construct the Artificial Studio URL
    const imageUrl = `https://files.artificialstudio.ai/${apiJobId}.${ext}`;
    
    // Try to fetch the image with proper headers
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VTON-Web/1.0)',
        'Accept': 'image/*',
        'Referer': 'https://artificialstudio.ai/'
      },
      timeout: 30000 // 30 second timeout
    });
    
    // Check if response is successful OR if file exists but access is forbidden (403)
    if (!response.ok && response.status !== 403) {
      console.warn('⚠️ Failed to fetch image from Artificial Studio:', {
        apiJobId,
        ext,
        status: response.status,
        statusText: response.statusText
      });
      
      // Try alternative extensions
      const alternativeExts = ['png', 'jpeg', 'webp'];
      for (const altExt of alternativeExts) {
        if (altExt === ext) continue;
        
        const altUrl = `https://files.artificialstudio.ai/${apiJobId}.${altExt}`;
        console.log('🔄 Trying alternative extension:', altExt);
        
        try {
          const altResponse = await fetch(altUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; VTON-Web/1.0)',
              'Accept': 'image/*',
              'Referer': 'https://artificialstudio.ai/'
            },
            timeout: 15000
          });
          
          if (altResponse.ok || altResponse.status === 403) {
            console.log('✅ Found image with alternative extension:', altExt);
            
            // Set appropriate headers
            res.set({
              'Content-Type': altResponse.headers.get('content-type') || 'image/jpeg',
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*'
            });
            
            // For 403 responses, we need to construct a proxy URL that the frontend can use
            if (altResponse.status === 403) {
              console.log('✅ Image exists but access forbidden (403) - returning proxy URL');
              return res.json({
                success: true,
                proxyUrl: `/tryon/proxy-image/${apiJobId}?ext=${altExt}`,
                originalUrl: altUrl,
                message: 'Image exists but requires proxy access'
              });
            }
            
            // Stream the image for successful responses
            altResponse.body.pipe(res);
            return;
          }
        } catch (altError) {
          console.debug('Alternative extension failed:', altExt, altError.message);
        }
      }
      
      // If all extensions fail, return error
      return res.status(404).json({ 
        error: 'Image not accessible',
        message: 'All image extensions failed to load from Artificial Studio'
      });
    }
    
    // Log the response status for debugging
    if (response.status === 403) {
      console.log('✅ Image exists but access is forbidden (403) - returning proxy URL');
      
      // For 403 responses, return a proxy URL that the frontend can use
      // Since 403 means the file exists but access is forbidden, we'll provide
      // a way for the frontend to access it through our proxy
      
      // Set appropriate headers for JSON response
      res.set({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      
      return res.json({
        success: true,
        proxyUrl: `/tryon/proxy-image/${apiJobId}?ext=${ext}`,
        originalUrl: imageUrl,
        message: 'Image exists but requires proxy access',
        status: 'ready'
      });
    }
    
    // For successful responses (200), stream the image
    if (response.ok) {
      // Set appropriate headers
      res.set({
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      });
      
      // Stream the image
      response.body.pipe(res);
    }
    
  } catch (error) {
    console.error('❌ Image proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to proxy image',
      message: error.message 
    });
  }
});

// Enhanced image serving endpoint for Artificial Studio results
router.get('/serve-image/:apiJobId', async (req, res) => {
  try {
    const { apiJobId } = req.params;
    const { ext = 'jpg' } = req.query;
    
    console.log('🖼️ Enhanced image serving requested for:', { apiJobId, ext });
    
    // Construct the Artificial Studio URL
    // Handle both formats: UUID-based (.undefined) and simple ID (.jpg)
    let imageUrl;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(apiJobId)) {
      // This is a UUID format - use .undefined extension
      imageUrl = `https://files.artificialstudio.ai/${apiJobId}.undefined`;
      console.log('🆔 Detected UUID format, using .undefined extension');
    } else {
      // This is a simple ID format - use provided extension or default to .jpg
      imageUrl = `https://files.artificialstudio.ai/${apiJobId}.${ext}`;
      console.log('🆔 Using simple ID format with extension:', ext);
    }
    
    // Try to fetch the image with proper headers
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VTON-Web/1.0)',
        'Accept': 'image/*',
        'Referer': 'https://artificialstudio.ai/'
      },
      timeout: 30000
    });
    
    // Handle different response statuses
    if (response.ok) {
      // 200 OK - Image accessible, stream it directly
      console.log('✅ Image accessible, streaming directly');
      
      // Get content type safely
      const contentType = response.headers.get('content-type');
      console.log('📋 Content-Type detected:', contentType);
      
      // Set response headers
      res.set({
        'Content-Type': contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      });
      
      // Handle response body properly for different Node.js versions
      if (response.body && typeof response.body.pipe === 'function') {
        // Node.js 18+ with readable streams
        response.body.pipe(res);
      } else if (response.body && response.body.on) {
        // Node.js 16+ with readable streams
        response.body.pipe(res);
      } else {
        // Fallback: convert to buffer and send
        console.log('⚠️ Using buffer fallback for response body');
        const chunks = [];
        for await (const chunk of response.body) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        res.send(buffer);
      }
      return;
    } else if (response.status === 403) {
      // 403 Forbidden - Image exists but access restricted
      console.log('✅ Image exists but access forbidden (403) - using alternative method');
      
      // Try to fetch with different approach
      try {
        const altResponse = await fetch(imageUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*',
            'Referer': 'https://artificialstudio.ai/',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          timeout: 30000
        });
        
        if (altResponse.ok) {
          console.log('✅ Alternative method successful');
          
          // Get content type safely
          const altContentType = altResponse.headers.get('content-type');
          console.log('📋 Alternative Content-Type detected:', altContentType);
          
          // Set response headers
          res.set({
            'Content-Type': altContentType || 'image/jpeg',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
          });
          
          // Handle response body properly for different Node.js versions
          if (altResponse.body && typeof altResponse.body.pipe === 'function') {
            // Node.js 18+ with readable streams
            altResponse.body.pipe(res);
          } else if (altResponse.body && altResponse.body.on) {
            // Node.js 16+ with readable streams
            altResponse.body.pipe(res);
          } else {
            // Fallback: convert to buffer and send
            console.log('⚠️ Using buffer fallback for alternative response body');
            const chunks = [];
            for await (const chunk of altResponse.body) {
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            res.send(buffer);
          }
          return;
        }
      } catch (altError) {
        console.log('⚠️ Alternative method failed:', altError.message);
      }
      
      // If all methods fail, return a placeholder or error image
      console.log('⚠️ All methods failed, returning placeholder');
      
      // Set proper headers for JSON response
      res.set({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      
      res.status(200).json({
        success: false,
        message: 'Image exists but cannot be served directly',
        originalUrl: imageUrl,
        suggestion: 'Use the original Artificial Studio URL directly in your application'
      });
      return;
    } else {
      // Other error statuses
      console.warn('⚠️ Image not accessible:', response.status);
      
      // Set proper headers for JSON response
      res.set({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      
      res.status(response.status).json({
        error: 'Image not accessible',
        status: response.status,
        message: 'Image may not exist or be ready yet'
      });
      return;
    }
    
  } catch (error) {
    console.error('❌ Enhanced image serving error:', error);
    res.status(500).json({ 
      error: 'Failed to serve image',
      message: error.message 
    });
  }
});

// Manual job status update endpoint (for testing)
router.post('/manual-update/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, resultUrl } = req.body;
    
    const { TryOnJobModel } = await import('../models/index.js');
    const job = await TryOnJobModel.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Update job status
    await TryOnJobModel.update(jobId, {
      status: status || 'completed',
      resultUrl: resultUrl,
      updatedAt: new Date()
    });
    
    // Send Socket.IO update if available
    const io = req.app.get('io');
    if (io) {
      io.emit('tryon-result', {
        type: 'tryon-result',
        jobId: jobId,
        status: status || 'completed',
        resultUrl: resultUrl
      });
    }
    
    res.json({
      success: true,
      message: 'Job updated successfully',
      jobId,
      status: status || 'completed',
      resultUrl
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 