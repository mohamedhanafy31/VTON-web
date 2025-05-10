// tryon.js - Virtual Try-On Frontend (Backend API Version)
document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let selectedStore = null;
    let selectedGarment = null;
    let capturedImage = null;
    let currentStep = 1;
    let sessionUser = null;
  
    // Toast notification function
    function showToast(message, type = 'info') {
      const toast = document.getElementById('toast');
      const toastMessage = document.getElementById('toastMessage');
      const toastIcon = document.getElementById('toastIcon');
      
      toastMessage.textContent = message;
      
      if (type === 'success') {
        toastIcon.className = 'fas fa-check-circle';
        toast.className = 'toast toast-success show';
      } else if (type === 'error') {
        toastIcon.className = 'fas fa-exclamation-circle';
        toast.className = 'toast toast-error show';
      } else {
        toastIcon.className = 'fas fa-info-circle';
        toast.className = 'toast show';
      }
      
      setTimeout(() => {
        toast.className = toast.className.replace('show', '');
      }, 3000);
    }
  
    // Close toast
    document.getElementById('toastClose').addEventListener('click', function() {
      document.getElementById('toast').className = document.getElementById('toast').className.replace('show', '');
    });
  
    // Theme toggle (unchanged)
    document.getElementById('themeToggle').addEventListener('click', function() {
      document.body.dataset.theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
      this.innerHTML = document.body.dataset.theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
      localStorage.setItem('theme', document.body.dataset.theme);
    });
  
    // Set theme from local storage (unchanged)
    if (localStorage.getItem('theme') === 'dark') {
      document.body.dataset.theme = 'dark';
      document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
    }
  
    // Navigation functions (unchanged)
    function showPage(pageNumber) {
      document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
      document.getElementById(`page${pageNumber}`).classList.add('active');
      document.querySelector('.progress-stepper').dataset.progress = pageNumber;
      currentStep = pageNumber;
    }
  
    // Step 1: Store Selection
    async function loadStores() {
      const storesContainer = document.getElementById('stores-container');
      const loadingElement = document.getElementById('loading-stores');
      
      try {
        const response = await fetch('/active-stores');
        if (!response.ok) throw new Error('Failed to load stores');
        
        const { stores } = await response.json();
        
        if (!stores.length) {
          storesContainer.innerHTML = '<div class="error-message">No stores available</div>';
          return;
        }
        
        storesContainer.innerHTML = stores.map(store => `
          <div class="store-card" data-store-id="${store.id}">
            <div class="store-logo-container">
              <img src="${store.logo_link || '/images/default-store.png'}" alt="${store.store_name}">
            </div>
            <h3 class="store-name">${store.store_name}</h3>
            <p class="store-specialty">${store.specialization}</p>
            <p class="store-garment-info"><i class="fas fa-tshirt"></i> ${store.garment_limit} garments</p>
            <p class="store-tryon-info"><i class="fas fa-sync"></i> ${store.tryon_limit} try-ons/day</p>
          </div>
        `).join('');
        
        // Add click handlers
        document.querySelectorAll('.store-card').forEach(storeCard => {
          storeCard.addEventListener('click', function() {
            document.querySelectorAll('.store-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedStore = this.dataset.storeId;
            document.getElementById('toPage2').removeAttribute('disabled');
          });
        });
        
      } catch (error) {
        console.error("Store load error:", error);
        storesContainer.innerHTML = `<div class="error-message">${error.message}</div>`;
      } finally {
        loadingElement.style.display = 'none';
      }
    }
  
    // Step 2: Garment Selection
    async function loadGarments(storeId) {
      const garmentGrid = document.getElementById('garmentGrid');
      garmentGrid.innerHTML = '<div class="spinner"></div>';
      
      try {
        const response = await fetch(`/store-garments/${storeId}`);
        if (!response.ok) throw new Error('Failed to load garments');
        
        const { garments } = await response.json();
        
        garmentGrid.innerHTML = garments.map(garment => `
          <div class="garment-card" data-garment-id="${garment.id}">
            <div class="garment-image-container">
              <img src="${garment.url}" alt="${garment.garmentType}">
            </div>
            <div class="garment-info">
              <h3 class="garment-name">${garment.garmentType}</h3>
              <p class="garment-details">
                <span class="garment-type">${garment.garmentType}</span>
                <span class="garment-color">${garment.color}</span>
              </p>
            </div>
          </div>
        `).join('');
        
        // Add click handlers
        document.querySelectorAll('.garment-card').forEach(garmentCard => {
          garmentCard.addEventListener('click', function() {
            document.querySelectorAll('.garment-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedGarment = this.dataset.garmentId;
            
            // Update preview
            document.getElementById('selectedGarment').src = this.querySelector('img').src;
            document.getElementById('garmentType').textContent = 
              this.querySelector('.garment-type').textContent;
            document.getElementById('garmentColor').textContent = 
              this.querySelector('.garment-color').textContent;
              
            document.getElementById('toPage3').removeAttribute('disabled');
          });
        });
        
      } catch (error) {
        console.error("Garment load error:", error);
        garmentGrid.innerHTML = `<div class="error-message">${error.message}</div>`;
      }
    }
  
    // Step 3: Camera Handling (unchanged except upload)
    let videoStream = null;
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const captureBtn = document.getElementById('captureBtn');
  
    async function initCamera() { /* Same camera initialization */ }
    document.getElementById('switchCamera').addEventListener('click', function() { /* Same */ });
  
    // Capture Photo (updated upload)
    async function capturePhoto() {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      capturedImage = canvas.toDataURL('image/jpeg');
      document.getElementById('userPhoto').src = capturedImage;
      document.getElementById('toPage4').removeAttribute('disabled');
  
      // Upload to backend
      try {
        showToast('Uploading image...', 'info');
        const formData = new FormData();
        const blob = await fetch(capturedImage).then(r => r.blob());
        formData.append('images', blob, 'user-photo.jpg');
        formData.append('isUserPhoto', 'true');
  
        const response = await fetch('/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        const { images } = await response.json();
        capturedImage = images[0].url;
        showToast('Image uploaded!', 'success');
      } catch (error) {
        console.error('Upload error:', error);
        showToast('Using local image', 'warning');
      }
    }
  
    // Manual Upload Handler
    document.getElementById('uploadImageBtn').addEventListener('click', async function() {
      const fileInput = document.getElementById('manualImageUpload');
      if (!fileInput.files.length) return showToast('Select an image', 'error');
      
      try {
        const formData = new FormData();
        formData.append('images', fileInput.files[0]);
        formData.append('isUserPhoto', 'true');
  
        const response = await fetch('/upload', {
          method: 'POST',
          body: formData
        });
        
        const { images } = await response.json();
        capturedImage = images[0].url;
        document.getElementById('userPhoto').src = capturedImage;
        document.getElementById('toPage4').removeAttribute('disabled');
      } catch (error) {
        showToast('Upload failed', 'error');
      }
    });
  
    // Step 4: Try-On Processing
    async function processTryOn(userName, userPhone) {
      const spinner = document.getElementById('spinner');
      const progressBar = document.getElementById('progressBar');
      const tryOnBtn = document.getElementById('tryOnBtn');
      
      try {
        spinner.style.display = 'block';
        tryOnBtn.disabled = true;
        
        const response = await fetch('/tryon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            human: capturedImage,
            garment: document.getElementById('selectedGarment').src,
            category: document.getElementById('garmentType').textContent,
            storeName: selectedStore
          })
        });
        
        if (!response.ok) throw new Error('Try-on failed');
        const { job_id } = await response.json();
        
        // Poll for results
        const result = await pollJobResult(job_id);
        document.getElementById('resultImage').src = result.output;
        document.getElementById('outputId').textContent = `Output ID: ${result.output_id}`;
        document.getElementById('resultContainer').style.display = 'block';
        
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        spinner.style.display = 'none';
        tryOnBtn.disabled = false;
        progressBar.style.width = '0%';
      }
    }
  
    async function pollJobResult(jobId) {
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
          try {
            const response = await fetch(`/get-result/${jobId}`);
            const result = await response.json();
            
            if (result.status === 'completed') {
              clearInterval(checkInterval);
              resolve(result);
            } else if (result.status === 'failed') {
              clearInterval(checkInterval);
              reject(new Error(result.error));
            }
          } catch (error) {
            clearInterval(checkInterval);
            reject(error);
          }
        }, 3000);
      });
    }
  
    // User Authentication Flow
    async function handleConnectAccount(email, password) {
      try {
        const response = await fetch('/connect-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) throw new Error('Connection failed');
        const { store_name } = await response.json();
        sessionUser = { role: 'store', storeName: store_name };
        showToast(`Connected to ${store_name}`, 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  
    // Event Listeners
    document.getElementById('toPage2').addEventListener('click', () => {
      if (!selectedStore) return showToast('Select a store', 'error');
      showPage(2);
      loadGarments(selectedStore);
    });
  
    document.getElementById('toPage3').addEventListener('click', () => {
      if (!selectedGarment) return showToast('Select a garment', 'error');
      showPage(3);
      initCamera();
    });
  
    document.getElementById('tryOnBtn').addEventListener('click', () => {
      if (!capturedImage) return showToast('Take a photo first', 'error');
      showUserInfoForm();
    });
  
    // Initialize
    loadStores();
    showPage(1);
  });