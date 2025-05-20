// Debug utilities for the frontend
const debug = {
  log: (message, data) => {
    console.log(`[DEBUG] ${message}`, data);
  },
  error: (message, error) => {
    console.error(`[DEBUG ERROR] ${message}`, error);
  },
  upload: {
    beforeUpload: (formData) => {
      console.log('[DEBUG] Before upload:', {
        hasImage: formData.has('images'),
        isUserPhoto: formData.get('isUserPhoto'),
        folder: formData.get('folder')
      });
    },
    afterUpload: (response) => {
      console.log('[DEBUG] Upload response:', response);
    }
  }
};

// Add debug logging to the capturePhoto function
function capturePhoto() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const toPage4Btn = document.getElementById('toPage4');
  const cameraError = document.getElementById('cameraError');

  debug.log('Starting photo capture', {
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight
  });

  // Disable button and clear previous errors at the start of capture
  if (toPage4Btn) toPage4Btn.disabled = true;
  if (cameraError) cameraError.textContent = '';
  userPhotoUrl = null; // Clear previous photo URL

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  
  debug.log('Canvas prepared', {
    width: canvas.width,
    height: canvas.height
  });
  
  // Convert canvas to blob
  canvas.toBlob(async (blob) => {
    try {
      debug.log('Canvas converted to blob', {
        size: blob.size,
        type: blob.type
      });

      const formData = new FormData();
      formData.append('images', blob, 'user_photo.jpg');
      formData.append('isUserPhoto', 'true');
      formData.append('folder', 'user_photos');

      debug.upload.beforeUpload(formData);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      debug.log('Server response status', {
        status: response.status,
        statusText: response.statusText
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      debug.upload.afterUpload(result);
      
      if (result.success && result.image && result.image.url) {
        userPhotoUrl = result.image.url;
        debug.log('User photo uploaded successfully', {
          url: userPhotoUrl
        });
        if (toPage4Btn) toPage4Btn.disabled = false;
      } else {
        debug.error('Invalid response format', result);
        throw new Error('Upload response missing image URL');
      }
    } catch (error) {
      debug.error('Upload process failed', error);
      if (cameraError) cameraError.textContent = 'Failed to upload photo. Please try again.';
      if (toPage4Btn) toPage4Btn.disabled = true;
      userPhotoUrl = null;
    }
  }, 'image/jpeg', 0.9); // Use JPEG format with 90% quality
} 