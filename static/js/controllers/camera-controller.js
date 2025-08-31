/**
 * Camera Controller
 * Handles camera initialization, photo capture, and media device management
 */
const CameraController = (() => {
  // Private variables
  let videoElement = null;
  let canvasElement = null;
  let mediaStream = null;
  let photoCallback = null;
  
  /**
   * Initializes the camera controller
   * @param {HTMLVideoElement} video - The video element
   * @param {HTMLCanvasElement} canvas - The canvas element
   */
  function init(video, canvas) {
    videoElement = video;
    canvasElement = canvas;
    console.log('Camera Controller initialized');
  }

  /**
   * Starts the camera
   * @returns {Promise<void>}
   */
  async function startCamera() {
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      };
      
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = mediaStream;
      
      return new Promise((resolve) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play();
          resolve();
        };
      });
    } catch (error) {
      console.error('Camera start error:', error);
      throw error;
    }
  }

  /**
   * Stops the camera
   */
  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    
    if (videoElement) {
      videoElement.srcObject = null;
    }
  }

  /**
   * Takes a photo
   * @returns {string} The photo as a data URL
   */
  function takePhoto() {
    if (!videoElement || !canvasElement) {
      throw new Error('Camera not initialized');
    }
    
    const context = canvasElement.getContext('2d');
    const width = videoElement.videoWidth;
    const height = videoElement.videoHeight;
    
    canvasElement.width = width;
    canvasElement.height = height;
    
    context.drawImage(videoElement, 0, 0, width, height);
    
    const dataUrl = canvasElement.toDataURL('image/jpeg');
    
    if (photoCallback) {
      photoCallback(dataUrl);
    }
    
    return dataUrl;
  }

  /**
   * Sets a callback to be called when a photo is taken
   * @param {Function} callback - The callback function
   */
  function onPhotoTaken(callback) {
    photoCallback = callback;
  }

  /**
   * Gets the available cameras
   * @returns {Promise<Array>} List of available cameras
   */
  async function getAvailableCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Get available cameras error:', error);
      throw error;
    }
  }

  /**
   * Switches to a different camera
   * @param {string} deviceId - The device ID to switch to
   * @returns {Promise<void>}
   */
  async function switchCamera(deviceId) {
    stopCamera();
    
    try {
      const constraints = {
        video: { deviceId: { exact: deviceId } }
      };
      
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = mediaStream;
      
      return new Promise((resolve) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play();
          resolve();
        };
      });
    } catch (error) {
      console.error('Switch camera error:', error);
      throw error;
    }
  }

  // Public API
  return {
    init,
    startCamera,
    stopCamera,
    takePhoto,
    onPhotoTaken,
    getAvailableCameras,
    switchCamera
  };
})();

export default CameraController; 