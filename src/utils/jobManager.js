import fetch from 'node-fetch';
import logger from './logger.js';
import db from '../config/db.js'; // Import Firestore instance

// Utility function to fix URLs with .undefined extension
export function fixUndefExtension(url) {
  if (!url) return url;
  
  // If URL ends with .undefined, replace with .jpg
  if (url.endsWith('.undefined')) {
    logger.debug('Fixing URL with .undefined extension', { 
      originalUrl: url.substring(0, 30) + '...' 
    });
    return url.replace(/\.undefined$/, '.jpg');
  }
  
  return url;
}

// In-memory storage for job results - REMOVE THIS
// export const jobResults = {};

// Start polling for tryon job results
export async function startPollingForResults(jobId, apiJobId, apiKey) {
  const checkInterval = 10000; // 10 seconds
  const maxAttempts = 90; // 15 minutes total
  let attempts = 0;
  let currentJobData = { notFoundAttempts: 0 };

  logger.info('Starting result polling', {
    jobId,
    apiJobId,
    checkInterval,
    maxAttempts
  });

  const pollJob = async () => {
    attempts++;
    
    if (attempts > maxAttempts) {
      logger.warn('Max polling attempts reached', {
        jobId,
        apiJobId,
        attempts,
        maxAttempts
      });
      
      if (db) {
        try {
          await db.collection('vton_jobs').doc(jobId).update({
            status: 'failed',
            error: 'Max polling attempts reached without completion',
            updated_at: new Date().toISOString()
          });
        } catch (dbError) {
          logger.error('Failed to update job status after max attempts', {
            jobId,
            error: dbError.message
          });
        }
      }
      return;
    }

    try {
      // Add initial delay before first poll
      if (attempts === 1) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second initial delay
      }

      logger.debug('Sending polling request', {
        jobId,
        apiJobId,
        attempt: attempts
      });
      
      // Use the correct endpoint for polling
      const response = await fetch(`https://api.artificialstudio.ai/api/generations/${apiJobId}`, {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        logger.warn('Failed to poll job status', {
          jobId,
          apiJobId,
          status: response.status,
          statusText: response.statusText
        });
        
        // Handle 404 errors from Artificial Studio API
        if (response.status === 404) {
          if (!currentJobData.notFoundAttempts) {
            currentJobData.notFoundAttempts = 1;
          } else {
            currentJobData.notFoundAttempts += 1;
          }
          
          // If we get multiple 404s, we'll be more patient - increase threshold from 3 to 6
          if (currentJobData.notFoundAttempts >= 6) {
            logger.error('Job not found after multiple attempts', {
              jobId,
              apiJobId,
              attempts: currentJobData.notFoundAttempts
            });
            
            if (db) {
              try {
                // Try to check one last time directly from the expected output URL pattern
                const possibleOutputId = apiJobId;
                const possibleOutputUrl = `https://files.artificialstudio.ai/${possibleOutputId}.jpg`;
                
                logger.info('Attempting final direct URL check before marking as failed', {
                  jobId,
                  possibleOutputUrl
                });
                
                try {
                  const finalCheck = await fetch(possibleOutputUrl, { method: 'HEAD' });
                  if (finalCheck.ok) {
                    // We found a valid output URL even after 404s from the API
                    logger.info('Found valid output URL after API 404s', {
                      jobId,
                      outputUrl: possibleOutputUrl
                    });
                    
                    await db.collection('vton_jobs').doc(jobId).update({
                      status: 'completed',
                      output_url: possibleOutputUrl,
                      updated_at: new Date().toISOString(),
                      error: null
                    });
                    return;
                  }
                } catch (urlCheckError) {
                  logger.debug('Final URL check failed', {
                    error: urlCheckError.message
                  });
                }
                
                // Mark as failed if we couldn't find the output
                await db.collection('vton_jobs').doc(jobId).update({
                  status: 'failed',
                  error: 'Job not found in Artificial Studio system. Please try again.',
                  updated_at: new Date().toISOString()
                });
              } catch (dbError) {
                logger.error('Failed to update job status after not found', {
                  jobId,
                  error: dbError.message
                });
              }
            }
            return;
          }
        }
        
        // Add exponential backoff for retries
        const backoffDelay = Math.min(1000 * Math.pow(2, currentJobData.notFoundAttempts), 30000);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        setTimeout(pollJob, checkInterval);
        return;
      }

      const data = await response.json();
      
      logger.debug('Received polling response', {
        jobId,
        status: data.status,
        hasOutput: !!data.output
      });

      if (data.status === 'success' || data.status === 'succeeded') {
        let outputUrl = data.output;
        let outputId = data.id;
        let extractedOutputId = null;

        if (!outputId && data.output) {
          outputId = apiJobId;
        }

        if (data.output) {
          const match = data.output.match(/files\.artificialstudio\.ai\/([0-9a-f-]+)(?:\.(\w+))?/);
          if (match) {
            extractedOutputId = match[1];
            const fileExtension = match[2] || 'jpg'; // Default to jpg if no extension found
            // Update the output URL to include the correct extension
            if (!outputUrl.endsWith(`.${fileExtension}`)) {
              // Fix URLs with .undefined extension or missing extensions
              outputUrl = outputUrl.includes('.') 
                ? `${outputUrl.split('.')[0]}.${fileExtension}`
                : `${outputUrl}.${fileExtension}`;
            }
          }
          logger.debug('Extracted output ID from URL', { jobId, extractedOutputId });
        }

        if (db) {
          try {
            await db.collection('vton_jobs').doc(jobId).update({
              status: 'completed',
              api_response: data,
              output_id: extractedOutputId,
              output_url: outputUrl,
              updated_at: new Date().toISOString(),
              error: null
            });
          } catch (dbError) {
            logger.error('Failed to update job to completed in Firestore', {
              jobId,
              error: dbError.message
            });
          }
        }
        return;
      }

      // Continue polling if not completed
      setTimeout(pollJob, checkInterval);
    } catch (error) {
      logger.error('Error during polling', {
        jobId,
        apiJobId,
        error: error.message,
        stack: error.stack
      });
      
      // Add exponential backoff for retries
      const backoffDelay = Math.min(1000 * Math.pow(2, currentJobData.notFoundAttempts), 30000);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      setTimeout(pollJob, checkInterval);
    }
  };

  // Start polling
  pollJob();
} 