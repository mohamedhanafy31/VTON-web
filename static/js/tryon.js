// tryon.js - Virtual Try-On Frontend (User Authentication Version)
document.addEventListener('DOMContentLoaded', function() {
    // Tab-specific state management
    const TAB_ID = generateTabId();
    const TAB_STORAGE_KEY = `tryon_tab_${TAB_ID}`;
    
    // Generate unique tab ID
    function generateTabId() {
        return 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Tab-specific storage functions
    function getTabStorage() {
        const stored = localStorage.getItem(TAB_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    }
    
    function setTabStorage(data) {
        localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(data));
    }
    
    function clearTabStorage() {
        localStorage.removeItem(TAB_STORAGE_KEY);
    }
    
    // Clean up storage when tab is closed
    window.addEventListener('beforeunload', function() {
        clearTabStorage();
    });
    
    // Handle page refresh - restore state
    window.addEventListener('load', function() {
        // Check if this is a page refresh
        if (performance.navigation.type === 1) {
            initializeTabState();
            
            // Restore UI state based on stored data
            if (selectedGarment) {
                // Restore garment selection
                const garmentElement = document.querySelector(`[data-garment-id="${selectedGarment}"]`);
                if (garmentElement) {
                    garmentElement.classList.add('selected');
                }
            }
            
            if (capturedImage) {
                // Restore captured image display
                displayCapturedImage(capturedImage);
            }
            
            // Navigate to the correct step
            if (currentStep > 1) {
                goToPage(currentStep);
            }
        }
    });
    
    // Global variables - now tab-specific
    let currentUser = null;
    let selectedGarment = null;
    let selectedGarmentData = null; // Store full garment data
    let capturedImage = null;
    let currentStep = 1;
    let socket = null; // Socket.IO connection
    let pollingInterval = null; // Store polling interval reference
    let currentTryOnJobId = null; // Track current try-on job ID
    
    // Critical condition variables for image result synchronization
    let pendingImageResult = null; // Store image result while waiting for user info
    let imageResultReceived = false; // Flag to track if image result arrived
    let waitingForUserInfo = false; // Flag to track if we're waiting for user info
    let customerInfoSubmitted = false; // Track if customer info has been submitted
    let currentOrder = null;
    let customerInfo = null;
    let orderCreationInProgress = false; // Prevent duplicate order creation
    let resultProcessed = false; // Track if result has been processed
    
    // Initialize tab-specific state from storage
    function initializeTabState() {
        const stored = getTabStorage();
        if (stored.currentStep) currentStep = stored.currentStep;
        if (stored.selectedGarment) selectedGarment = stored.selectedGarment;
        if (stored.selectedGarmentData) selectedGarmentData = stored.selectedGarmentData;
        if (stored.capturedImage) capturedImage = stored.capturedImage;
        if (stored.currentTryOnJobId) currentTryOnJobId = stored.currentTryOnJobId;
        if (stored.pendingImageResult) pendingImageResult = stored.pendingImageResult;
        if (stored.imageResultReceived !== undefined) imageResultReceived = stored.imageResultReceived;
        if (stored.waitingForUserInfo !== undefined) waitingForUserInfo = stored.waitingForUserInfo;
        if (stored.customerInfoSubmitted !== undefined) customerInfoSubmitted = stored.customerInfoSubmitted;
        if (stored.currentOrder !== undefined) currentOrder = stored.currentOrder;
        if (stored.customerInfo !== undefined) customerInfo = stored.customerInfo;
        if (stored.orderCreationInProgress !== undefined) orderCreationInProgress = stored.orderCreationInProgress;
        if (stored.resultProcessed !== undefined) resultProcessed = stored.resultProcessed;
        

    }
    
    // Save tab-specific state to storage
    function saveTabState() {
        const state = {
            currentStep,
            selectedGarment,
            selectedGarmentData,
            capturedImage,
            currentTryOnJobId,
            pendingImageResult,
            imageResultReceived,
            waitingForUserInfo,
            customerInfoSubmitted,
            currentOrder,
            customerInfo,
            orderCreationInProgress,
            resultProcessed
        };
        setTabStorage(state);
    }
    
    // Clear tab-specific state
    function clearTabState() {
        selectedGarment = null;
        selectedGarmentData = null;
        capturedImage = null;
        currentTryOnJobId = null;
        currentStep = 1;
        customerInfoSubmitted = false;
        currentOrder = null;
        customerInfo = null;
        orderCreationInProgress = false;
        resultProcessed = false;
        clearTabStorage();

    }
    
    // Reset to initial state (useful for starting over)
    function resetToInitialState() {
        clearTabState();
        
        // Reset UI elements
        const allGarments = document.querySelectorAll('.garment-item');
        allGarments.forEach(item => item.classList.remove('selected'));
        
        const nextButton = document.getElementById('toPage2');
        if (nextButton) {
            nextButton.setAttribute('disabled', 'disabled');
            nextButton.classList.remove('btn-success');
        }
        
        const toPage3Button = document.getElementById('toPage3');
        if (toPage3Button) {
            toPage3Button.setAttribute('disabled', 'disabled');
            toPage3Button.classList.remove('btn-success');
        }
        
        // Go back to first page
        goToPage(1);
        
        // Toast notification removed
    }
    
    // Initialize state from storage
    initializeTabState();
    
    // Check for pending image results on page load
    if (imageResultReceived && pendingImageResult && !customerInfoSubmitted) {
        // Toast notification removed
    }
    
    // Debug function to check global state
    function debugGlobalState() {
        // Debug function - console logs removed
    }

    // Toast notification function - removed
    function showToast(message, type = 'info') {
        // Toast notifications removed
    }

    // Close toast - removed
    document.getElementById('toastClose')?.addEventListener('click', function() {
        // Toast close functionality removed
    });
    


    // Navigation functions
    function goToPage(pageNumber) {

        
        // Hide all pages
        const allPages = document.querySelectorAll('.page');
        allPages.forEach((page, index) => {
            page.classList.remove('active');
        });
        
        // Show target page
        const targetPage = document.getElementById(`page${pageNumber}`);
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        // Update progress stepper
        const allSteps = document.querySelectorAll('.step');
        allSteps.forEach((step, index) => {
            if (index + 1 < pageNumber) {
                step.classList.add('completed');
                step.classList.remove('active');
            } else if (index + 1 === pageNumber) {
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                step.classList.remove('active', 'completed');
            }
        });
        
        currentStep = pageNumber;
        
        // Save tab-specific state
        saveTabState();
    }

    // Clear garment grid
    function clearGarmentGrid() {
        const garmentGrid = document.getElementById('garmentGrid');
        if (garmentGrid) {
            garmentGrid.innerHTML = '';
        }
    }

    // Debug function to log garment grid state
    function debugGarmentGrid() {
        // Debug function - console logs removed
    }

    // Function to handle garment selection
    function selectGarment(garmentId, garmentElement) {
        // Remove previous selection
        const allGarments = document.querySelectorAll('.garment-item');
        allGarments.forEach(item => {
            item.classList.remove('selected');
        });
        
        // Select the clicked garment
        garmentElement.classList.add('selected');
        selectedGarment = garmentId;
        
        // Get full garment data for storage
        const garmentData = garmentElement.dataset;
        selectedGarmentData = {
            id: garmentId,
            name: garmentData.name || '',
            image: garmentData.image || '',
            price: garmentData.price || '',
            category: garmentData.category || ''
        };
        

        
        // Save tab-specific state
        saveTabState();
        
        // Enable the Next button
        const nextButton = document.getElementById('toPage2');
        if (nextButton) {
            nextButton.removeAttribute('disabled');
            nextButton.classList.add('btn-success');
            nextButton.innerHTML = 'Next: Take Photo <i class="fas fa-arrow-right"></i>';
        }
        
        // Toast notification removed
    }

    // Function to update button states based on current state
    function updateButtonStates() {
        const nextButton = document.getElementById('toPage2');
        const toPage3Button = document.getElementById('toPage3');
        
        // Step 1: Enable Next button only if garment is selected
        if (nextButton) {
            if (selectedGarment) {
                nextButton.removeAttribute('disabled');
                nextButton.classList.add('btn-success');
            } else {
                nextButton.setAttribute('disabled', 'disabled');
                nextButton.classList.remove('btn-success');
            }
        }
        
        // Step 2: Enable Next button only if photo is captured
        if (toPage3Button) {
            if (userPhoto) {
                toPage3Button.removeAttribute('disabled');
                toPage3Button.classList.add('btn-success');
            } else {
                toPage3Button.setAttribute('disabled', 'disabled');
                toPage3Button.classList.remove('btn-success');
            }
        }
    }





    function showUserInfo() {
        if (currentUser) {
            // Handle different user data structures
            const userName = currentUser.name || currentUser.username || 'User';
            const userDisplay = currentUser.username || currentUser.userAddress || '@user';
            
            document.getElementById('userName').textContent = userName;
            if (currentUser.username) {
                document.getElementById('userUsername').textContent = `@${currentUser.username}`;
            } else if (currentUser.userAddress) {
                document.getElementById('userUsername').textContent = currentUser.userAddress.substring(0, 10) + '...';
            } else {
                document.getElementById('userUsername').textContent = '@user';
            }
            
            document.getElementById('userInfo').classList.remove('hidden');
        } else {
            // Hide user info when not authenticated
            document.getElementById('userInfo').classList.add('hidden');
        }
    }



    async function logoutUser() {
        try {
            // Call backend logout endpoint to destroy session
            const response = await fetch('/logout', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                // Toast notification removed
            }
        } catch (error) {
            // Continue with client logout even if backend fails
        }
        
        // Clear localStorage session
        localStorage.removeItem('userSession');
        
        // Reset client state
        currentUser = null;
        selectedGarment = null;
        selectedGarmentData = null;
        capturedImage = null;
        
        // Reset UI
        document.getElementById('userInfo').classList.add('hidden');
        document.getElementById('toPage2').setAttribute('disabled', '');
        
        // Go back to first page
        goToPage(1);
        
        // Show login prompt instead of redirecting
        setTimeout(() => {
            showLoginPrompt();
        }, 1000);
    }

    async function checkSession() {
        try {
            // First check localStorage for client-side session
            const session = localStorage.getItem('userSession');
            
            if (session) {
                const sessionData = JSON.parse(session);
                
                if (sessionData.expires > Date.now()) {
                    // Client session is valid, set current user
                    currentUser = sessionData.user;
                    showUserInfo();
                    document.getElementById('toPage2').removeAttribute('disabled');
                    return true;
                } else {
                    // Session expired, remove it
                    localStorage.removeItem('userSession');
                }
            }
            
            // Fallback to server-side session check
            const response = await fetch('/api/check-session', {
                method: 'GET',
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.authenticated) {
                    currentUser = data.user;
                    showUserInfo();
                    document.getElementById('toPage2').removeAttribute('disabled');
                    return true;
                }
            }
        } catch (error) {
            // Session check error - silent fail
        }
        return false;
    }



    // Logout button event listener - will be set up in initialize function
    function setupLogoutButton() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                logoutUser();
            });
        }
    }

    // Update trials display
    async function updateTrialsDisplay() {
        try {
            if (!currentUser) return;
            
            const trialsCountElement = document.getElementById('trialsCount');
            if (!trialsCountElement) return;
            
            // Get current trials from server
            const response = await fetch('/trials', {
                method: 'GET',
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                const trialsRemaining = data.trials_remaining;
                
                // Update display
                trialsCountElement.textContent = trialsRemaining;
                
                // Update styling based on trials remaining
                const userTrialsElement = document.getElementById('userTrials');
                if (userTrialsElement) {
                    userTrialsElement.classList.remove('trials-warning', 'trials-danger');
                    
                    if (trialsRemaining <= 5) {
                        userTrialsElement.classList.add('trials-danger');
                    } else if (trialsRemaining <= 15) {
                        userTrialsElement.classList.add('trials-warning');
                    }
                }
                
                // Store trials count in currentUser for local access
                currentUser.trials_remaining = trialsRemaining;
                
                // Update try-on button state based on trials
                updateTryOnButtonState(trialsRemaining);
            } else {
                // Set default trials to 0 if we can't get the count
                currentUser.trials_remaining = 0;
                updateTryOnButtonState(0);
            }
        } catch (error) {
            // Set default trials to 0 if there's an error
            currentUser.trials_remaining = 0;
            updateTryOnButtonState(0);
        }
    }

    // Check if user has trials remaining
    function hasTrialsRemaining() {
        return currentUser && currentUser.trials_remaining > 0;
    }

    // Update try-on button state based on trials
    function updateTryOnButtonState(trialsRemaining) {
        const tryOnBtn = document.getElementById('startTryOnBtn');
        if (tryOnBtn) {
            if (trialsRemaining <= 0) {
                tryOnBtn.disabled = true;
                tryOnBtn.innerHTML = '<i class="fas fa-ban"></i> No Trials Remaining';
                tryOnBtn.title = 'You have no trials remaining. Please contact support for more information.';
                tryOnBtn.classList.add('btn-disabled');
            } else {
                tryOnBtn.disabled = false;
                tryOnBtn.innerHTML = '<i class="fas fa-magic"></i> Start Virtual Try-On';
                tryOnBtn.title = `Start virtual try-on (${trialsRemaining} trials remaining)`;
                tryOnBtn.classList.remove('btn-disabled');
            }
        }
    }

    // Decrease trials count (called after successful try-on)
    async function decreaseTrials() {
        try {
            const response = await fetch('/decrease-trials', {
                method: 'POST',
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                const trialsRemaining = data.trials_remaining;
                
                // Update local user data
                if (currentUser) {
                    currentUser.trials_remaining = trialsRemaining;
                }
                
                // Update display
                updateTrialsDisplay();
                
                return trialsRemaining;
            } else {
                return null;
            }
        } catch (error) {
            return null;
        }
    }

    // Load available garments from Cloudinary
    async function loadGarments() {
        // Check if user is authenticated before loading garments
        if (!currentUser) {
            return;
        }
        
        const garmentGrid = document.getElementById('garmentGrid');
        const loadingElement = document.getElementById('garmentSpinner');
        
        if (!garmentGrid) {
            return;
        }
        
        // Clear the grid before loading new garments
        clearGarmentGrid();
        
        try {
            // Show loading spinner
            if (loadingElement) {
                loadingElement.style.display = 'block';
            }
            
            // Fetch garments from database API
            const response = await fetch('/api/cloudinary/garments', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // Include cookies for session authentication
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Hide loading spinner
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
            
            if (!data.garments || data.garments.length === 0) {
                garmentGrid.innerHTML = `
                    <div class="no-garments-message">
                        <div class="no-garments-icon">
                            <i class="fas fa-tshirt"></i>
                        </div>
                        <h3>No Garments Currently Available</h3>
                        <p>There are no garments uploaded to the system at the moment.</p>
                        <p class="sub-text">Please check back later or contact an administrator to upload new garments.</p>
                    </div>
                `;
                return;
            }
            
            const garmentsHTML = data.garments.map(garment => `
                <div class="garment-item" data-garment-id="${garment.id || garment.public_id}">
                    <div class="garment-category-badge">${garment.category || 'General'}</div>
                    <img src="${garment.secure_url}" alt="${garment.original_filename || 'Garment'}" loading="lazy">
                    <h3>${garment.original_filename || 'Garment'}</h3>
                    <p><strong>Type:</strong> ${garment.type || 'Unknown'}</p>
                    ${garment.size ? `<p><strong>Size:</strong> ${garment.size}</p>` : ''}
                    ${garment.price && garment.price > 0 ? `<p><strong>Price:</strong> $${garment.price}</p>` : ''}
                    ${garment.description ? `<p><strong>Description:</strong> ${garment.description}</p>` : ''}
                    <p class="price">Uploaded: ${new Date(garment.created_at).toLocaleDateString()}</p>
                    <div class="garment-check">
                        <i class="fas fa-check"></i>
                    </div>
                </div>
            `).join('');
            
            garmentGrid.innerHTML = garmentsHTML;
            
            // Add click handlers
            document.querySelectorAll('.garment-item').forEach(garmentItem => {
                garmentItem.addEventListener('click', function() {
                    // Remove previous selection
                    document.querySelectorAll('.garment-item').forEach(g => g.classList.remove('selected'));
                    
                    // Select current garment
                    this.classList.add('selected');
                    selectedGarment = this.dataset.garmentId;
                    
                    // Store full garment data for later use
                    const garmentIndex = data.garments.findIndex(g => (g.id || g.public_id) === selectedGarment);
                    if (garmentIndex !== -1) {
                        selectedGarmentData = data.garments[garmentIndex];
                    }
                    
                    // Debug global state
                    debugGlobalState();
                    
                    // Enable and style the Next button
                    const nextButton = document.getElementById('toPage2');
                    if (nextButton) {
                        nextButton.removeAttribute('disabled');
                        nextButton.classList.add('btn-success');
                        nextButton.innerHTML = 'Next: Take Photo <i class="fas fa-arrow-right"></i>';
                    }
                    
                    // Toast notification removed
                });
                // Enable next button when garment is selected
            });
            
        } catch (error) {
            // Hide loading spinner
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
            
            // Show error message
            garmentGrid.innerHTML = `
                <div class="no-garments-message">
                    <div class="no-garments-icon error">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Unable to Load Garments</h3>
                    <p>There was an error loading garments from the system.</p>
                    <p class="sub-text">Error: ${error.message}</p>
                    <button id="tryAgainBtn" class="btn btn-primary">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            `;
        }
    }

    // Camera functionality
    let stream = null;
    let facingMode = 'user';

    async function initializeCamera() {
        try {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            const constraints = {
                video: {
                    facingMode: facingMode,
                    height: { ideal: 720 }
                }
            };

            stream = await navigator.mediaDevices.getUserMedia(constraints);
            const video = document.getElementById('video');
            if (video) {
                video.srcObject = stream;
                video.style.display = 'block';
            }
            
            // Reset captured image state
            const capturedImageContainer = document.getElementById('capturedImageContainer');
            if (capturedImageContainer) {
                capturedImageContainer.style.display = 'none';
            }
            
            // Reset user photo state
            userPhoto = null;
            capturedImage = null;
            
            // Reset button states
            const captureBtn = document.getElementById('captureBtn');
            const retakeBtn = document.getElementById('retakePhotoBtn');
            
            if (captureBtn) {
                captureBtn.disabled = false;
                captureBtn.style.opacity = '1';
                captureBtn.style.cursor = 'pointer';
            }
            
            if (retakeBtn) {
                retakeBtn.style.display = 'none';
            }
            
            // Note: We don't reset selectedGarment here to preserve user's garment selection
            // when navigating between pages
            
            // Disable Next button for step 3
            const toPage3Button = document.getElementById('toPage3');
            if (toPage3Button) {
                toPage3Button.setAttribute('disabled', 'disabled');
                toPage3Button.classList.remove('btn-success');
            }
            
            // Hide any error messages
            const cameraError = document.getElementById('cameraError');
            if (cameraError) {
                cameraError.style.display = 'none';
            }
            
            // Hide alternative upload section initially
            const alternativeUpload = document.getElementById('alternativeUpload');
            if (alternativeUpload) {
                alternativeUpload.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Camera error:', error);
            
            // Show error message if element exists
            const cameraError = document.getElementById('cameraError');
            if (cameraError) {
                cameraError.textContent = 'Camera access denied. Please use the alternative upload option.';
                cameraError.style.display = 'block';
            }
            
            // Show alternative upload section if element exists
            const alternativeUpload = document.getElementById('alternativeUpload');
            if (alternativeUpload) {
                alternativeUpload.style.display = 'block';
            }
            
            // Show toast notification
            // Toast notification removed
        }
    }

    // Countdown and photo capture functionality
    let isCountingDown = false;
    
    function startCountdown() {
        if (isCountingDown) return;
        
        // Debug global state
        debugGlobalState();
        
        // Check if a garment is selected
        if (!selectedGarment) {
            // Toast notification removed
            return;
        }
        
        isCountingDown = true;
        const countdownOverlay = document.getElementById('countdownOverlay');
        const countdownNumber = document.getElementById('countdownNumber');
        const captureBtn = document.getElementById('captureBtn');
        
        if (!countdownOverlay || !countdownNumber) return;
        
        // Disable capture button during countdown
        if (captureBtn) {
            captureBtn.disabled = true;
            captureBtn.innerHTML = '<i class="fas fa-clock"></i>';
        }
        
        // Show countdown overlay
        countdownOverlay.classList.add('active');
        
        let count = 3;
        countdownNumber.textContent = count;
        
        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownNumber.textContent = count;
            } else {
                // Countdown finished, capture photo
                clearInterval(countdownInterval);
                countdownOverlay.classList.remove('active');
                isCountingDown = false;
                
                // Re-enable capture button
                if (captureBtn) {
                    captureBtn.disabled = false;
                    captureBtn.innerHTML = '<i class="fas fa-camera"></i>';
                }
                
                // Small delay to ensure video is ready, then capture and display the photo immediately
                setTimeout(() => {
                    captureAndDisplayImmediately();
                }, 100);
            }
        }, 1000);
    }
    
    // Function to capture and display image immediately without uploading
    function captureAndDisplayImmediately() {
        const video = document.getElementById('video');
        if (!video || !video.srcObject) {
            // Toast notification removed
            return;
        }
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Check if video is ready
        if (video.readyState < 2) {
            // Toast notification removed
            return;
        }
        
        // Ensure video has valid dimensions
        if (!video.videoWidth || !video.videoHeight || video.videoWidth === 0 || video.videoHeight === 0) {
            // Toast notification removed
            return;
        }
        
        // Optimize canvas size to reduce payload
        const maxWidth = 800;
        const maxHeight = 600;
        let { videoWidth, videoHeight } = video;
        
        // Calculate new dimensions maintaining aspect ratio
        if (videoWidth > maxWidth || videoHeight > maxHeight) {
            const ratio = Math.min(maxWidth / videoWidth, maxHeight / videoHeight);
            width = Math.floor(videoWidth * ratio);
            height = Math.floor(videoHeight * ratio);
        } else {
            width = videoWidth;
            height = videoHeight;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and scale the image
        context.drawImage(video, 0, 0, width, height);
        
        // Verify canvas has content
        try {
            const imageDataCheck = canvas.toDataURL('image/jpeg', 0.1);
            if (imageDataCheck.length < 100) {
                // Toast notification removed
                return;
            }
        } catch (error) {
            // Toast notification removed
            return;
        }
        
        // Show flash effect
        const flash = document.getElementById('flash');
        if (flash) {
            flash.classList.add('active');
            setTimeout(() => flash.classList.remove('active'), 200);
        }
        
        // Store canvas data for later upload (no local blob storage)
        capturedImage = canvas;
        userPhoto = canvas;
        
        // Save tab-specific state
        saveTabState();
        
        // Display captured image from canvas
        displayCapturedImage(canvas);
        
        // Enable the Next button for step 3
        const toPage3Button = document.getElementById('toPage3');
        if (toPage3Button) {
            toPage3Button.removeAttribute('disabled');
            toPage3Button.classList.add('btn-success');
        }
        
        // Toast notification removed
    }

    // This function is now used for uploading the already captured image when needed
    async function capturePhoto() {
        // If we already have a captured image, use it
        if (capturedImage && userPhoto) {
            // The image is already displayed, just proceed
            return;
        }
        
        // Fallback: capture image if none exists (this shouldn't happen with the new flow)
        // ... rest of the old capture logic could go here if needed
    }

    // Function to upload the captured image when needed for try-on
    async function uploadCapturedImage() {
        if (!capturedImage || !userPhoto) {
            // Toast notification removed
            return false;
        }

        try {
            let imageData;
            
            if (capturedImage instanceof HTMLCanvasElement) {
                // If it's a canvas, convert directly to base64
                imageData = capturedImage.toDataURL('image/jpeg', 0.6);
            } else if (capturedImage instanceof Blob) {
                // If it's a blob, convert to base64
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                
                // Create a temporary image to get dimensions
                const img = new Image();
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    context.drawImage(img, 0, 0);
                    imageData = canvas.toDataURL('image/jpeg', 0.6);
                };
                
                if (capturedImage instanceof Blob) {
                    img.src = URL.createObjectURL(capturedImage);
                } else {
                    img.src = capturedImage;
                }
            } else {
                // If it's already a URL, return true
                return true;
            }
            
            // Upload to Cloudinary
            const response = await fetch('/tryon/upload-captured-photo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    garmentId: selectedGarment,
                    imageData: imageData,
                    category: 'upper_body'
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // Update the captured image URL
                    capturedImage = result.userPhotoUrl;
                    userPhoto = result.userPhotoUrl;
                    saveTabState();
                    // Toast notification removed
                    return true
                }
            }
            
            return false;
        } catch (error) {
            // Toast notification removed
            return false;
        }
    }
    
    function displayCapturedImage(imageSource) {
        const capturedImageContainer = document.getElementById('capturedImageContainer');
        const capturedImage = document.getElementById('capturedImage');
        const video = document.getElementById('video');
        const cameraContainer = document.getElementById('cameraContainer');
        const captureBtn = document.getElementById('captureBtn');
        const retakeBtn = document.getElementById('retakePhotoBtn');
        
        if (capturedImageContainer && capturedImage) {
            if (typeof imageSource === 'string') {
                // If it's a URL (from Cloudinary), use it directly
                capturedImage.src = imageSource;
            } else if (imageSource instanceof HTMLCanvasElement) {
                // If it's a canvas, convert to data URL for display
                const imageUrl = imageSource.toDataURL('image/jpeg', 0.8);
                capturedImage.src = imageUrl;
            } else if (imageSource instanceof Blob) {
                // If it's a blob (local fallback), create object URL
                const imageUrl = URL.createObjectURL(imageSource);
                capturedImage.src = imageUrl;
            }
            
            // Hide camera container and show captured image
            if (cameraContainer) {
                cameraContainer.style.display = 'none';
            }
            
            capturedImageContainer.style.display = 'flex';
            
            // Update button states
            if (captureBtn) {
                captureBtn.disabled = true;
                captureBtn.style.opacity = '0.5';
                captureBtn.style.cursor = 'not-allowed';
            }
            
            if (retakeBtn) {
                retakeBtn.style.display = 'flex';
            }
            
            // Force a reflow to ensure the display change takes effect
            capturedImageContainer.offsetHeight;
        }
    }
    
    function retakePhoto() {
        const capturedImageContainer = document.getElementById('capturedImageContainer');
        const cameraContainer = document.getElementById('cameraContainer');
        const toPage3Button = document.getElementById('toPage3');
        const captureBtn = document.getElementById('captureBtn');
        const retakeBtn = document.getElementById('retakePhotoBtn');
        
        if (capturedImageContainer && cameraContainer) {
            // Hide captured image and show camera
            capturedImageContainer.style.display = 'none';
            cameraContainer.style.display = 'block';
            
            // Reset user photo
            userPhoto = null;
            capturedImage = null;
            
            // Reset button states
            if (captureBtn) {
                captureBtn.disabled = false;
                captureBtn.style.opacity = '1';
                captureBtn.style.cursor = 'pointer';
            }
            
            if (retakeBtn) {
                retakeBtn.style.display = 'none';
            }
            
            // Disable Next button
            if (toPage3Button) {
                toPage3Button.setAttribute('disabled', 'disabled');
                toPage3Button.classList.remove('btn-success');
            }
            
            // Toast notification removed
        }
    }

    // Navigation Event Listeners
    document.getElementById('toPage2').addEventListener('click', function() {
        // Debug global state
        debugGlobalState();
        
        goToPage(2);
        initializeCamera();
    });

    document.getElementById('toPage3').addEventListener('click', async function() {
        if (selectedGarment && capturedImage) {
            // Go to page 3 first
            goToPage(3);
            
            // Check if image needs to be uploaded
            if (typeof capturedImage !== 'string' || !capturedImage.includes('cloudinary')) {
                // Show loading state while uploading
                showLoadingState();
                // Toast notification removed
                
                try {
                    const uploadSuccess = await uploadCapturedImage();
                    if (uploadSuccess) {
                        // Hide loading state and show preview
                        hideLoadingState();
                        showPreviewSection();
                        // Toast notification removed
                    } else {
                        throw new Error('Failed to upload image');
                    }
                } catch (error) {
                    hideLoadingState();
                    // Toast notification removed
                    // Go back to page 2 if upload fails
                    goToPage(2);
                    return;
                }
            } else {
                // Image already uploaded, show preview directly
                showPreviewSection();
            }
        } else {
            // Toast notification removed
        }
    });

    document.getElementById('backToPage1').addEventListener('click', function() {
        goToPage(1);
    });

    // Remove the old toPage3 event listener since we added a new one above

    // Safely add event listener for backToPage2 button (might not exist if removed)
    const backToPage2Btn = document.getElementById('backToPage2');
    if (backToPage2Btn) {
        backToPage2Btn.addEventListener('click', function() {
            goToPage(2);
        });
    }

    // Camera Control Event Listeners
    document.getElementById('captureBtn').addEventListener('click', startCountdown);
    
    document.getElementById('switchCamera').addEventListener('click', function() {
        facingMode = facingMode === 'user' ? 'environment' : 'user';
        initializeCamera();
    });

    // Show loading state while uploading image
    function showLoadingState() {
        const previewSection = document.getElementById('previewSection');
        const tryonResult = document.getElementById('tryonResult');
        
        // Hide preview section, show loading state
        previewSection.style.display = 'none';
        tryonResult.style.display = 'block';
        
        // Show spinner
        const resultSpinner = document.getElementById('resultSpinner');
        const resultContent = document.getElementById('resultContent');
        if (resultSpinner) resultSpinner.style.display = 'block';
        if (resultContent) resultContent.style.display = 'none';
        
        // Update loading message
        const resultSpinnerElement = document.querySelector('#resultSpinner .spinner-text');
        if (resultSpinnerElement) {
            resultSpinnerElement.textContent = 'Uploading image to Cloudinary...';
        }
    }
    
    // Hide loading state
    function hideLoadingState() {
        const resultSpinner = document.getElementById('resultSpinner');
        if (resultSpinner) resultSpinner.style.display = 'none';
    }
    
    // Check if we should show results based on critical condition
    function shouldShowResult() {
        if (!customerInfoSubmitted) {
            return false;
        }
        return true;
    }
    
    // Show pending image result when user info is submitted
    function showPendingImageResult(result) {
        logWithTimestamp('🎯 ===== SHOWING PENDING IMAGE RESULT =====');
        logWithTimestamp('📋 Pending result data:', result);
        
        // Double-check critical condition
        if (!shouldShowResult()) {
            return;
        }
        
        // Mark result as processed
        resultProcessed = true;
        
        // Show the result content
        const resultContent = document.getElementById('resultContent');
        if (resultContent) {
            resultContent.style.display = 'block';
            logWithTimestamp('✅ Result content displayed from pending result');
        }
        
        // Update the result image
        const resultImage = document.getElementById('resultImage');
        if (resultImage) {
            resultImage.style.display = 'block';
            
            // For Artificial Studio URLs, use them directly
            let displayUrl = result.resultUrl;
            if (result.resultUrl && result.resultUrl.includes('files.artificialstudio.ai')) {
                logWithTimestamp('🔄 Using Artificial Studio URL directly:', result.resultUrl);
            }
            
            resultImage.src = displayUrl;
            resultImage.alt = 'Try-On Result';
            logWithTimestamp('✅ Result image updated from pending result:', displayUrl);
            
            // Force image load and then proceed with order creation
            resultImage.onload = () => {
                logWithTimestamp('✅ Pending result image loaded successfully - proceeding with order creation');
                handleOrderCreationAfterResult(result, result.jobId || currentTryOnJobId);
            };
            resultImage.onerror = () => {
                // Even if image fails, proceed with order creation
                handleOrderCreationAfterResult(result, result.jobId || currentTryOnJobId);
            };
        } else {
            // If no result image element, proceed with order creation
            handleOrderCreationAfterResult(result, result.jobId || currentTryOnJobId);
        }
        
        // Show success message
        // Toast notification removed
        
        logWithTimestamp('✅ Pending image result displayed successfully');
    }

    // Show preview section with selected garment and user photo
    function showPreviewSection() {
        const previewSection = document.getElementById('previewSection');
        const tryonResult = document.getElementById('tryonResult');
        
        // Always show preview section, hide tryon result initially
        previewSection.style.display = 'block';
        tryonResult.style.display = 'none';
        
        // Update preview user photo
        const previewUserPhoto = document.getElementById('previewUserPhoto');
        if (previewUserPhoto && capturedImage) {
            if (typeof capturedImage === 'string') {
                // If it's a Cloudinary URL
                previewUserPhoto.src = capturedImage;
            } else if (capturedImage instanceof HTMLCanvasElement) {
                // If it's a canvas, convert to data URL
                previewUserPhoto.src = capturedImage.toDataURL('image/jpeg', 0.8);
            } else if (capturedImage instanceof Blob) {
                // If it's a blob, create object URL
                previewUserPhoto.src = URL.createObjectURL(capturedImage);
            }
        }
        
        // Update preview garment photo and info
        const previewGarment = document.getElementById('previewGarment');
        const previewGarmentName = document.getElementById('previewGarmentName');
        const previewGarmentCategory = document.getElementById('previewGarmentCategory');
        
        if (previewGarment && selectedGarmentData) {
            previewGarment.src = selectedGarmentData.secure_url;
        }
        
        if (previewGarmentName && selectedGarmentData) {
            previewGarmentName.textContent = selectedGarmentData.original_filename || 'Selected Garment';
        }
        
        if (previewGarmentCategory && selectedGarmentData) {
            previewGarmentCategory.textContent = selectedGarmentData.category || 'General';
        }
        

    }

    // Show preview of selected garment and user photo
    function showPreview() {
        logWithTimestamp('🖼️ ===== SHOW PREVIEW FUNCTION STARTED =====');
        logWithTimestamp('📋 Preview function state:');
        logWithTimestamp('  - capturedImage:', capturedImage);
        logWithTimestamp('  - selectedGarmentData:', selectedGarmentData);
        logWithTimestamp('  - resultSpinner element exists:', !!document.getElementById('resultSpinner'));
        logWithTimestamp('  - resultContent element exists:', !!document.getElementById('resultContent'));
        logWithTimestamp('  - previewUserPhoto element exists:', !!document.getElementById('previewUserPhoto'));
        logWithTimestamp('  - previewGarment element exists:', !!document.getElementById('previewGarment'));
        logWithTimestamp('  - previewGarmentName element exists:', !!document.getElementById('previewGarmentName'));
        
        const resultSpinner = document.getElementById('resultSpinner');
        const resultContent = document.getElementById('resultContent');
        
        // Hide spinner and show content
        resultSpinner.style.display = 'none';
        resultContent.style.display = 'block';
        logWithTimestamp('🎨 UI updated: spinner hidden, content shown');
        
        // Update user photo
        const userPhotoResult = document.getElementById('previewUserPhoto');
        if (userPhotoResult && capturedImage) {
            if (typeof capturedImage === 'string') {
                // If it's a Cloudinary URL
                userPhotoResult.src = capturedImage;
                logWithTimestamp('✅ User photo updated with Cloudinary URL:', capturedImage);
            } else if (capturedImage instanceof HTMLCanvasElement) {
                // If it's a canvas, convert to data URL
                userPhotoResult.src = capturedImage.toDataURL('image/jpeg', 0.8);
                logWithTimestamp('✅ User photo updated with canvas data URL');
            } else if (capturedImage instanceof Blob) {
                // If it's a blob, create object URL
                userPhotoResult.src = URL.createObjectURL(capturedImage);
                logWithTimestamp('✅ User photo updated with blob URL');
            }
        }
        
        // Update garment photo and name
        const garmentPhotoResult = document.getElementById('previewGarment');
        const garmentNameResult = document.getElementById('previewGarmentName');
        
        if (garmentPhotoResult && selectedGarmentData) {
            garmentPhotoResult.src = selectedGarmentData.secure_url;
            logWithTimestamp('✅ Garment photo updated:', selectedGarmentData.secure_url);
        }
        
        if (garmentNameResult && selectedGarmentData) {
            garmentNameResult.textContent = selectedGarmentData.original_filename || 'Selected Garment';
            logWithTimestamp('✅ Garment name updated:', selectedGarmentData.original_filename);
        }
        
        // Note: Generation modal is no longer used, continue with processing
        logWithTimestamp('🚀 Try-on processing started');
        
        logWithTimestamp('✅ Preview displayed successfully');
    }

    // TryOn Processing
    async function processTryOn() {
        const resultSpinner = document.getElementById('resultSpinner');
        const resultContent = document.getElementById('resultContent');
        
        try {
            logWithTimestamp('🚀 ===== TRY-ON PROCESS STARTED =====');
            logWithTimestamp('📋 Current state before try-on:');
            logWithTimestamp('  - currentUser:', currentUser);
            logWithTimestamp('  - selectedGarment:', selectedGarment);
            logWithTimestamp('  - selectedGarmentData:', selectedGarmentData);
            logWithTimestamp('  - capturedImage:', capturedImage);
            logWithTimestamp('  - currentStep:', currentStep);
            logWithTimestamp('  - resultProcessed:', resultProcessed);
            logWithTimestamp('  - pollingInterval:', pollingInterval);
            logWithTimestamp('  - currentOrder:', currentOrder);
            logWithTimestamp('  - customerInfo:', customerInfo);
            logWithTimestamp('  - customerInfoSubmitted:', customerInfoSubmitted);
            
            // Reset result processing state for new try-on
            resultProcessed = false;
            currentTryOnJobId = null; // Reset job ID for new try-on
            
            // Save tab-specific state
            saveTabState();
            
            // Stop all existing polling before starting new try-on
            stopAllPolling();
            logWithTimestamp('🔄 Reset polling state for new try-on');
            
            // Check if user is authenticated
            if (!currentUser) {
                throw new Error('User must be authenticated to perform try-on');
            }
            
            // Debug: Check session status before making request
            try {
                const sessionCheck = await fetch('/api/check-session', {
                    method: 'GET',
                    credentials: 'include'
                });
                const sessionData = await sessionCheck.json();
            } catch (sessionError) {
                // Session check failed - continue with try-on
            }
            
            // Check if both user image and garment are selected
            if (!capturedImage || !selectedGarment || !selectedGarmentData) {
                throw new Error('Please select both a user image and a garment');
            }
            
            // Show loading state
            resultSpinner.style.display = 'block';
            resultContent.style.display = 'none';
            
            // Show loading message
            // Toast notification removed
            
            // Image should already be uploaded by now (handled in navigation)
            // Prepare the API request payload
            const payload = {
                garmentId: selectedGarment,
                userPhotoUrl: capturedImage, // Should be Cloudinary URL by now
                garmentUrl: selectedGarmentData.secure_url,
                garmentDescription: selectedGarmentData.original_filename || 'Selected garment',
                category: selectedGarmentData.category?.toLowerCase() === 'upperbody' ? 'upper_body' : 'lower_body'
            };
            

            
            // Make API call to our backend which will handle the Artificial Studio API
            const response = await fetch('/tryon/process-artificial-studio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Include cookies for session authentication
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            logWithTimestamp('📡 Try-on API response received:', result);
            logWithTimestamp('🔍 Response analysis:');
            logWithTimestamp('  - success:', result.success);
            logWithTimestamp('  - jobId:', result.jobId);
            logWithTimestamp('  - apiJobId:', result.apiJobId);
            logWithTimestamp('  - status:', result.status);
            logWithTimestamp('  - message:', result.message);
            
            if (result.success) {
                logWithTimestamp('✅ Try-on request successful, proceeding with UI updates');
                
                // Trials are decreased in the backend when the try-on request is made
                logWithTimestamp('🎯 Trials decreased in backend when request was made');
                // Update trials display to reflect the decreased count
                updateTrialsDisplay();
                
                // Store the current try-on job ID for result coordination
                currentTryOnJobId = result.jobId;
                logWithTimestamp('🔑 Current try-on job ID set to:', currentTryOnJobId);
                
                // Save tab-specific state
                saveTabState();
                
                // Hide spinner and show content with preview
                resultSpinner.style.display = 'none';
                resultContent.style.display = 'block';
                logWithTimestamp('🎨 UI updated: spinner hidden, content shown');
                
                // Show the preview first
                logWithTimestamp('🖼️ Calling showPreview()...');
                showPreview();
                
                                    // Update order with try-on job ID
                    if (currentOrder && result.jobId) {
                        try {
                            await fetch(`/api/orders/${currentOrder.id}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                credentials: 'include',
                                body: JSON.stringify({
                                    tryon_job_id: result.jobId
                                })
                            });
                        } catch (updateError) {
                            // Failed to update order with job ID
                        }
                    }
                
                // If we have an immediate result, show it
                if (result.resultUrl) {
                    // Show the result content
                    const resultContent = document.getElementById('resultContent');
                    if (resultContent) {
                        resultContent.style.display = 'block';
                    }
                    
                    const resultImage = document.getElementById('resultImage');
                    if (resultImage) {
                        resultImage.style.display = 'block';
                        resultImage.src = result.resultUrl;
                        resultImage.alt = 'Try-On Result';
                    }
                    
                    // Update order with result URL
                    if (currentOrder) {
                        try {
                            await fetch(`/api/orders/${currentOrder.id}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                credentials: 'include',
                                body: JSON.stringify({
                                    tryon_result_url: result.resultUrl
                                })
                            });
                        } catch (updateError) {
                            // Failed to update order with result URL
                        }
                    }
                    
                    // Toast notification removed
                    
                    // Trials are already decreased in the backend when the try-on request was made
                    logWithTimestamp('🎯 Trials already decreased in backend when request was made');
                    // Update trials display to reflect current count
                    updateTrialsDisplay();
                } else {
                    // Only show thank you modal if customer info has been submitted
                    if (customerInfoSubmitted) {
                        const thankYouModal = document.getElementById('thankYouModal');
                        if (!thankYouModal.classList.contains('show')) {
                            showThankYouModal();
                        }
                    }
                    
                    // Start polling for result or wait for webhook
                    if (result.jobId) {
                        pollForResult(result.jobId);
                    }
                }
                
            } else {
                throw new Error(result.error || 'Try-on processing failed');
            }
            
        } catch (error) {
            // Hide all modals on error
            hideAllModals();
            
            resultSpinner.style.display = 'none';
            document.getElementById('tryonResult').innerHTML = `
                <div class="error-message">
                    <h4>Try-On Processing Failed</h4>
                    <p>${error.message}</p>
                    <button id="retryTryOnBtn" class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-redo"></i> Retry Try-On
                    </button>
                </div>
            `;
            
            // Add retry button event listener
            document.getElementById('retryTryOnBtn')?.addEventListener('click', function() {
                processTryOn();
            });
        }
    }

    // Poll for try-on result (fallback if webhook doesn't work)
    async function pollForResult(jobId) {
        logWithTimestamp('🔄 ===== POLLING FUNCTION STARTED =====');
        logWithTimestamp('📋 Polling function state:');
        logWithTimestamp('  - jobId:', jobId);
        logWithTimestamp('  - resultProcessed:', resultProcessed);
        logWithTimestamp('  - customerInfoSubmitted:', customerInfoSubmitted);
        logWithTimestamp('  - customerInfo:', customerInfo);
        logWithTimestamp('  - currentOrder:', currentOrder);
        logWithTimestamp('  - orderCreationInProgress:', orderCreationInProgress);
        
        const maxAttempts = 60; // Poll for up to 10 minutes (more time)
        let attempts = 0;
        
        logWithTimestamp(`🔄 Starting polling for job ${jobId} - will poll ${maxAttempts} times`);
        
        const poll = async () => {
            try {
                // CRITICAL: Check if result has already been processed by another handler
                if (resultProcessed) {
                    logWithTimestamp('🛑 Polling stopped: result already processed by another handler');
                    return; // Stop polling immediately
                }
                
                // CRITICAL: Check if this is still the current try-on job
                if (jobId !== currentTryOnJobId) {
                    logWithTimestamp('🛑 Polling stopped: job ID changed, this is no longer the current try-on job');
                    return; // Stop polling immediately
                }
                
                attempts++;
                logWithTimestamp(`🔄 Polling for result, attempt ${attempts}/${maxAttempts}`);
                
                logWithTimestamp(`📡 Polling attempt ${attempts}: Fetching /tryon/get-result/${jobId}`);
                const response = await fetch(`/tryon/get-result/${jobId}`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                logWithTimestamp(`📡 Polling response status: ${response.status} ${response.statusText}`);
                
                if (response.ok) {
                    const result = await response.json();
                    logWithTimestamp(`Polling response data:`, result);
                    
                    if (result.success && result.status === 'completed' && result.resultUrl) {
                        logWithTimestamp('✅ Polling found completed result:', result);
                        
                        // Check if result has already been processed by another handler
                        if (resultProcessed) {
                            logWithTimestamp('🔄 Result already processed by another handler, skipping polling processing');
                            return; // Stop polling
                        }
                        
                        // CRITICAL CONDITION: Check if user info is submitted before showing result
                        if (!customerInfoSubmitted) {
                            logWithTimestamp('🎯 CRITICAL CONDITION: Image result received but user info not submitted yet');
                            logWithTimestamp('📋 Storing pending result and waiting for user info...');
                            
                            // Store the pending result
                            pendingImageResult = result;
                            imageResultReceived = true;
                            waitingForUserInfo = true;
                            
                            // Save state
                            saveTabState();
                            
                            // Stop polling but don't show result yet
                            stopAllPolling();
                            
                            // Show message that we're waiting for user info
                            // Toast notification removed
                            
                            logWithTimestamp('⏳ Waiting for user to submit information before showing result');
                            return; // Stop polling, wait for user info
                        }
                        
                        // Mark result as processed
                        resultProcessed = true;
                        logWithTimestamp('🔄 Marking result as processed by polling handler');
                        
                                // Stop ALL polling immediately since we have the result
        stopAllPolling();
                        
                        // FOLLOW THE FLOWCHART: Show result FIRST, then handle order creation
                        logWithTimestamp('🎯 FOLLOWING FLOWCHART: Got image result, now showing result content');
                        
                        // Show the result content FIRST
                        const resultContent = document.getElementById('resultContent');
                        if (resultContent) {
                            resultContent.style.display = 'block';
                            logWithTimestamp('✅ Result content displayed via polling');
                        }
                        
                        // Update the result image FIRST
                        const resultImage = document.getElementById('resultImage');
                        if (resultImage) {
                            resultImage.style.display = 'block';
                            
                            // For Artificial Studio URLs, we'll use them directly since proxy doesn't work
                            let displayUrl = result.resultUrl;
                            if (result.resultUrl && result.resultUrl.includes('files.artificialstudio.ai')) {
                                logWithTimestamp('🔄 Using Artificial Studio URL directly:', result.resultUrl);
                                // Note: These URLs may not display directly due to CORS restrictions
                                // but they are accessible when opened in new tabs
                            }
                            
                            resultImage.src = displayUrl;
                            resultImage.alt = 'Try-On Result';
                            logWithTimestamp('✅ Result image updated via polling:', displayUrl);
                            
                            // Force image load and ONLY THEN proceed with order creation
                            resultImage.onload = () => {
                                logWithTimestamp('✅ Result image loaded successfully - NOW proceeding with order creation');
                                
                                // FOLLOW THE FLOWCHART: After image is displayed, then handle order
                                handleOrderCreationAfterResult(result, jobId);
                            };
                            resultImage.onerror = () => {
                                // Even if image fails, proceed with order creation
                                handleOrderCreationAfterResult(result, jobId);
                            };
                        } else {
                            // If no result image element, proceed with order creation
                            handleOrderCreationAfterResult(result, jobId);
                        }
                        
                        // Show success message
                        // Toast notification removed
                        
                        // Trials are already decreased in the backend when the try-on request was made
                        logWithTimestamp('🎯 Trials already decreased in backend when request was made');
                        // Update trials display to reflect current count
                        updateTrialsDisplay();
                        

                        
                                        // Check if order already exists or is being created
                
                // FOLLOW THE FLOWCHART: Order creation will be handled AFTER image is displayed
                // This prevents the thank you popup from disappearing before the result is shown
                logWithTimestamp('🎯 FOLLOWING FLOWCHART: Order creation deferred until after image display');
                logWithTimestamp('✅ Polling completed successfully - stopping all polling');
                return; // Stop polling
                    } else if (result.status === 'failed') {
                        // Hide all modals
                        hideAllModals();
                        throw new Error(result.error || 'Try-on processing failed');
                    } else if (result.status === 'pending') {
                        
                        // Show progress to user in thank you modal
                        const thankYouModal = document.getElementById('thankYouModal');
                        if (thankYouModal && thankYouModal.classList.contains('show')) {
                            const thankYouContent = thankYouModal.querySelector('.thank-you-content');
                            if (thankYouContent) {
                                thankYouContent.innerHTML = `
                                    <div class="thank-you-icon">
                                        <i class="fas fa-clock fa-3x text-primary"></i>
                                    </div>
                                    <h3 class="text-primary">Processing Your Try-On</h3>
                                    <div class="progress mt-3">
                                        <div class="progress-bar" style="width: ${(attempts / maxAttempts) * 100}%"></div>
                                    </div>
                                `;
                            }
                        }
                    }
                }
                
                // Continue polling if not complete and within max attempts
                if (attempts < maxAttempts) {
                    // Store the timeout ID in global window object so it can be cleared from other functions
                    window.pollingTimeoutId = setTimeout(poll, 3000); // Poll every 3 seconds (even more aggressive)
                } else {
                    // Hide all modals
                    hideAllModals();
                    // Toast notification removed
                    
                    // Show manual check option
                    setTimeout(() => {
                        const checkButton = document.createElement('button');
                        checkButton.className = 'btn btn-primary';
                        checkButton.innerHTML = '<i class="fas fa-sync-alt"></i> Check Result Manually';
                        checkButton.onclick = () => manualCheckResult(jobId);
                        
                        // Add button to the result section if it exists
                        const resultSection = document.querySelector('.result-section') || document.querySelector('.preview-section');
                        if (resultSection) {
                            resultSection.appendChild(checkButton);
                        }
                        
                        // Toast notification removed
                    }, 2000);
                }
                
            } catch (error) {
                // Don't hide modals on network errors, just continue polling
                if (attempts >= maxAttempts) {
                    hideAllModals();
                    // Toast notification removed
                }
            }
        };
        
        // Start polling after 3 seconds (faster start)
        pollingInterval = setTimeout(poll, 3000);
        // Also store in global window object for cross-function access
        window.pollingTimeoutId = pollingInterval;
    }

    // Initialize Socket.IO for real-time updates
    function initializeSocket() {
        try {
            // Check if Socket.IO is available
            if (typeof io !== 'undefined') {
                socket = io();
                
                socket.on('connect', () => {
                    logWithTimestamp('Connected to Socket.IO server');
                });

                socket.on('disconnect', () => {
                    logWithTimestamp('Disconnected from Socket.IO server');
                });

                // Listen for try-on result updates
                socket.on('tryon-result', (data) => {
                    logWithTimestamp('Received real-time try-on result:', data);
                    logWithTimestamp('Socket.IO event received - jobId:', data.jobId, 'status:', data.status, 'resultUrl:', data.resultUrl);
                    handleRealtimeResult(data);
                });

                logWithTimestamp('Socket.IO initialized successfully');
            }
        } catch (error) {
            // Failed to initialize Socket.IO
        }
    }

    // Handle real-time result updates from Socket.IO
    async function handleRealtimeResult(data) {
        logWithTimestamp('🔌 ===== REAL-TIME RESULT HANDLER STARTED =====');
        logWithTimestamp('📋 Real-time handler state:');
        logWithTimestamp('  - data received:', data);
        logWithTimestamp('  - jobId:', data.jobId);
        logWithTimestamp('  - status:', data.status);
        logWithTimestamp('  - resultUrl:', data.resultUrl);
        logWithTimestamp('  - error:', data.error);
        logWithTimestamp('  - resultProcessed:', resultProcessed);
        logWithTimestamp('  - pollingInterval:', pollingInterval);
        logWithTimestamp('  - customerInfoSubmitted:', customerInfoSubmitted);
        logWithTimestamp('  - currentOrder:', currentOrder);
        logWithTimestamp('  - orderCreationInProgress:', orderCreationInProgress);
        
        const { jobId, status, resultUrl, error } = data;
        logWithTimestamp('🔌 handleRealtimeResult called with:', { jobId, status, resultUrl, error });
        
        if (status === 'completed' && resultUrl) {
            // Verify this is the result for the current try-on session
            if (jobId !== currentTryOnJobId) {
                return;
            }
            
            // Check if result has already been processed by another handler
            if (resultProcessed) {
                return; // Stop processing
            }
            
            // CRITICAL CONDITION: Check if user info is submitted before showing result
            if (!customerInfoSubmitted) {
                // Store the pending result
                pendingImageResult = {
                    success: true,
                    status: 'completed',
                    resultUrl: resultUrl,
                    jobId: jobId
                };
                imageResultReceived = true;
                waitingForUserInfo = true;
                
                // Save state
                saveTabState();
                
                // Stop polling but don't show result yet
                stopAllPolling();
                
                // Show message that we're waiting for user info
                // Toast notification removed
                
                return; // Stop processing, wait for user info
            }
            
            // Mark result as processed BEFORE any processing
            resultProcessed = true;
            
            // Stop ALL polling immediately since we have the result
            stopAllPolling();
            
            // FOLLOW THE FLOWCHART: Show result FIRST, then handle order creation
            console.log('🎯 FOLLOWING FLOWCHART: Got image result via Socket.IO, now showing result content');
            
            // Show the result content FIRST
            const resultContent = document.getElementById('resultContent');
            if (resultContent) {
                resultContent.style.display = 'block';
                console.log('✅ Result content displayed via real-time update');
            }
            
            // Update the result image FIRST
            const resultImage = document.getElementById('resultImage');
            if (resultImage) {
                resultImage.style.display = 'block';
                
                // For Artificial Studio URLs, we'll use them directly since proxy doesn't work
                let displayUrl = resultUrl;
                if (resultUrl && resultUrl.includes('files.artificialstudio.ai')) {
                    // Note: These URLs may not display directly due to CORS restrictions
                    // but they are accessible when opened in new tabs
                }
                
                resultImage.src = displayUrl;
                resultImage.alt = 'Try-On Result';
                
                // Force image load and ONLY THEN proceed with order creation
                resultImage.onload = () => {
                    // FOLLOW THE FLOWCHART: After image is displayed, then handle order
                    handleOrderCreationAfterResult({
                        success: true,
                        status: 'completed',
                        resultUrl: resultUrl
                    }, jobId);
                };
                resultImage.onerror = () => {
                    // Even if image fails, proceed with order creation
                    handleOrderCreationAfterResult({
                        success: true,
                        status: 'completed',
                        resultUrl: resultUrl
                    }, jobId);
                };
            } else {
                // If no result image element, proceed with order creation
                handleOrderCreationAfterResult({
                    success: true,
                    status: 'completed',
                    resultUrl: resultUrl
                }, jobId);
            }
            
            // Show success message
            // Toast notification removed
            
            // Trials are already decreased in the backend when the try-on request was made
            logWithTimestamp('🎯 Trials already decreased in backend when request was made');
            // Update trials display to reflect current count
            updateTrialsDisplay();
            

            
            // FOLLOW THE FLOWCHART: Order creation will be handled AFTER image is displayed
            // This prevents the thank you popup from disappearing before the result is shown
        } else if (status === 'failed') {
            // Hide all modals
            hideAllModals();
            // Toast notification removed
        }
    }

    // Try Another Garment
    document.getElementById('tryAnotherBtn').addEventListener('click', function() {
        // Refresh the page to start fresh
        window.location.reload();
    });

    // QR Code Button
    document.getElementById('qrCodeBtn').addEventListener('click', function() {
        const resultImage = document.getElementById('resultImage');
        
        if (!resultImage || !resultImage.src) {
            // Toast notification removed
            return;
        }
        
        // Generate QR code for the result image URL
        const qrContainer = document.getElementById('qrCodeContainer');
        if (!qrContainer) {
            // Toast notification removed
            return;
        }
        
        qrContainer.innerHTML = ''; // Clear previous content
        
        // Create QR code using the QRCode library
        if (typeof QRCode !== 'undefined') {
            try {
                const qr = new QRCode(qrContainer, {
                    text: resultImage.src,
                    width: 200,
                    height: 200,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
                
                // Show the modal
                showModal('qrCodeModal');
                // Toast notification removed
                    } catch (qrError) {
            // Toast notification removed
        }
        } else {
            // Toast notification removed
        }
    });

    // Download Result
    document.getElementById('downloadBtn').addEventListener('click', function() {
        const resultImage = document.getElementById('resultImage');
        
        if (!resultImage.src) {
            // Toast notification removed
            return;
        }
        
        try {
            // Create a canvas to handle the image download properly
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.crossOrigin = 'anonymous'; // Handle CORS issues
            
            img.onload = function() {
                // Set canvas dimensions to match image
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw image on canvas
                ctx.drawImage(img, 0, 0);
                
                // Convert to blob and download
                canvas.toBlob(function(blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `tryon-result-${Date.now()}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    // Toast notification removed
                }, 'image/png');
            };
            
            img.onerror = function() {
                // Fallback to direct download if canvas method fails
        const link = document.createElement('a');
        link.href = resultImage.src;
                link.download = `tryon-result-${Date.now()}.jpg`;
                link.target = '_blank';
                document.body.appendChild(link);
        link.click();
                document.body.removeChild(link);
                
                // Toast notification removed
            };
            
            img.src = resultImage.src;
            
        } catch (error) {
            // Toast notification removed
        }
    });

    // Safely add event listener for finishBtn button (might not exist if removed)
    const finishBtn = document.getElementById('finishBtn');
    if (finishBtn) {
        finishBtn.addEventListener('click', function() {
            // Reset everything and go back to start
            selectedGarment = null;
            selectedGarmentData = null;
            capturedImage = null;
            goToPage(1);
        });
    }

    // Alternative Upload
    document.getElementById('uploadImageBtn').addEventListener('click', function() {
        const fileInput = document.getElementById('manualImageUpload');
        const file = fileInput.files[0];
        
        if (file) {
            capturedImage = file;
            document.getElementById('toPage3').removeAttribute('disabled');
            showToast('Image uploaded successfully!', 'success');
        } else {
            showToast('Please select an image file', 'error');
        }
    });

    // QR Modal Close Button
    document.getElementById('closeQrBtn').addEventListener('click', function() {
        hideModal('qrCodeModal');
    });

    // Preview Section Event Listeners
    document.getElementById('startTryOnBtn').addEventListener('click', function() {
        logWithTimestamp('🎯 ===== START TRY-ON BUTTON CLICKED =====');
        
        // Reset customer info submitted flag for new try-on
        customerInfoSubmitted = false;
        logWithTimestamp('🔄 Customer info submitted flag reset for new try-on');
        
        // Show customer information modal and start try-on process in parallel
        logWithTimestamp('📋 Showing customer modal and starting try-on process in parallel');
        showCustomerModal();
        
        // Keep preview visible, show tryon result
        const previewSection = document.getElementById('previewSection');
        const tryonResult = document.getElementById('tryonResult');
        previewSection.style.display = 'block';
        tryonResult.style.display = 'block';
        logWithTimestamp('🎨 Preview and tryon result sections displayed');
        
        // Start the try-on process immediately in parallel
        logWithTimestamp('🚀 Starting try-on process in parallel with customer modal');
        processTryOn();
    });



    // Safety wrapper for all event listeners to prevent null reference errors
    function safeAddEventListener(elementId, eventType, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(eventType, handler);
            return true;
        } else {
            return false;
        }
    }

    // Check if all required elements exist before setting up event listeners
    const requiredElements = [
        'customerForm', 'customerFormSubmit', 'submitOrderBtn', 
        'quantityForm', 'cancelOrderBtn', 'toastClose'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
        // Some required elements are missing - this might be normal if the page is still loading
    }

    // Customer Form Event Listener
    const customerForm = document.getElementById('customerForm');
    if (customerForm) {
        customerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        logWithTimestamp('📝 ===== CUSTOMER FORM SUBMITTED =====');
        logWithTimestamp('📋 Form submission state:');
        logWithTimestamp('  - customerName:', document.getElementById('customerName').value.trim());
        logWithTimestamp('  - customerPhone:', document.getElementById('customerName').value.trim());
        logWithTimestamp('  - currentOrder:', currentOrder);
        logWithTimestamp('  - resultProcessed:', resultProcessed);
        logWithTimestamp('  - customerInfoSubmitted:', customerInfoSubmitted);
        logWithTimestamp('  - orderCreationInProgress:', orderCreationInProgress);
        
        const customerName = document.getElementById('customerName').value.trim();
        const customerPhone = document.getElementById('customerPhone').value.trim();
        
        if (!customerName || !customerPhone) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        logWithTimestamp('✅ Form validation passed, storing customer info');
        
        // Store customer info but DON'T create order yet
        // Order will only be created after try-on result is received
        customerInfo = {
            name: customerName,
            phone: customerPhone
        };
        
        customerInfoSubmitted = true; // Mark customer info as submitted
        logWithTimestamp('💾 Customer info stored, waiting for try-on result before creating order');
        logWithTimestamp('📋 Updated state:');
        logWithTimestamp('  - customerInfo:', customerInfo);
        logWithTimestamp('  - customerInfoSubmitted:', customerInfoSubmitted);
        
        // Check if there's a pending image result waiting for user info
        if (imageResultReceived && pendingImageResult) {
            logWithTimestamp('🎯 CRITICAL CONDITION: User info submitted, now showing pending image result');
            
            // Reset the waiting flags
            waitingForUserInfo = false;
            imageResultReceived = false;
            
            // Save state
            saveTabState();
            
            // Show message that we're proceeding with the result
            showToast('Customer information saved. Now showing your try-on result...', 'success');
            
            // Smooth transition from customer modal to thank you modal
            logWithTimestamp('🔄 Transitioning from customer modal to thank you modal');
            transitionModal('customerModal', 'thankYouModal');
            
            // After a short delay, show the pending result
            setTimeout(() => {
                showPendingImageResult(pendingImageResult);
                // Clear the pending result
                pendingImageResult = null;
                saveTabState();
            }, 1000);
        } else {
            // Show message that we're waiting for try-on result
            showToast('Customer information saved. Waiting for try-on result...', 'info');
            
            // Smooth transition from customer modal to thank you modal
            logWithTimestamp('🔄 Transitioning from customer modal to thank you modal');
            transitionModal('customerModal', 'thankYouModal');
        }
        });
    }

    // Also add click listener to the Done button for better UX
    const customerFormSubmit = document.getElementById('customerFormSubmit');
    if (customerFormSubmit) {
        customerFormSubmit.addEventListener('click', function(e) {
            // Trigger form submission
            const customerForm = document.getElementById('customerForm');
            if (customerForm) {
                customerForm.dispatchEvent(new Event('submit'));
            }
        });
    }

    // Submit Order Button Event Listener
    const submitOrderBtn = document.getElementById('submitOrderBtn');
    if (submitOrderBtn) {
        submitOrderBtn.addEventListener('click', function() {
            // Only allow submission if we have a valid order
            if (!currentOrder) {
                showToast('Please wait for the try-on result before submitting an order.', 'warning');
                return;
            }
            showQuantityModal();
        });
    }
    
    // Initially disable the Submit Order button until we have a try-on result and order
    if (submitOrderBtn) {
        submitOrderBtn.disabled = true;
        submitOrderBtn.classList.remove('btn-primary');
        submitOrderBtn.classList.add('btn-secondary');
        submitOrderBtn.title = 'Submit Order (disabled until try-on result is received)';

    }
    


    // Quantity Form Event Listener
    const quantityForm = document.getElementById('quantityForm');
    if (quantityForm) {
        quantityForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const quantity = parseInt(document.getElementById('orderQuantity').value);
        const notes = document.getElementById('orderNotes').value.trim();
        
        if (!quantity || quantity < 1) {
            showToast('Please enter a valid quantity', 'error');
            return;
        }
        
        try {
            // Update order status to approved and set quantity
            const response = await fetch(`/api/orders/${currentOrder.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    status: 'approved',
                    quantity: quantity,
                    notes: notes
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                currentOrder = result.order;
                
                hideModal('quantityModal');
                showToast('Order submitted successfully!', 'success');
                
                // Hide submit order button and show order status
                document.getElementById('submitOrderBtn').style.display = 'none';
                
                // Show order confirmation
                const orderConfirmation = document.createElement('div');
                orderConfirmation.className = 'order-confirmation';
                orderConfirmation.innerHTML = `
                    <div class="alert alert-success">
                        <h4><i class="fas fa-check-circle"></i> Order Confirmed!</h4>
                        <p><strong>Order ID:</strong> ${currentOrder.id}</p>
                        <p><strong>Quantity:</strong> ${quantity}</p>
                        <p><strong>Status:</strong> Approved</p>
                        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
                    </div>
                `;
                
                document.querySelector('.result-section').appendChild(orderConfirmation);
            } else {
                throw new Error('Failed to update order');
            }
        } catch (error) {
            showToast('Failed to submit order. Please try again.', 'error');
        }
        });
    }

    // Cancel Order Button Event Listener
    const cancelOrderBtn = document.getElementById('cancelOrderBtn');
    if (cancelOrderBtn) {
        cancelOrderBtn.addEventListener('click', function() {
            hideModal('quantityModal');
        });
    }

    // Show main content for authenticated users
    function showMainContent() {
        // Hide login prompt if it exists
        const loginPrompt = document.getElementById('loginPrompt');
        if (loginPrompt) {
            loginPrompt.style.display = 'none';
        }
        
        // Show the main tryon content using proper page navigation
        const header = document.querySelector('header');
        const userInfo = document.getElementById('userInfo');
        
        if (header) header.style.display = 'block';
        if (userInfo) userInfo.style.display = 'flex';
        
        // Navigate to page 1 using the proper navigation system
        goToPage(1);
    }

    // Hide main content for unauthenticated users
    function hideMainContent() {
        // Hide all main content elements
        const header = document.querySelector('header');
        const userInfo = document.getElementById('userInfo');
        const page1 = document.getElementById('page1');
        const page2 = document.getElementById('page2');
        const page3 = document.getElementById('page3');
        
        if (header) header.style.display = 'none';
        if (userInfo) userInfo.style.display = 'none';
        if (page1) page1.style.display = 'none';
        if (page2) page2.style.display = 'none';
        if (page3) page3.style.display = 'none';
        
        // Clear any existing garment grid
        const garmentGrid = document.getElementById('garmentGrid');
        if (garmentGrid) {
            garmentGrid.innerHTML = '';
        }
    }

    // Show login prompt for unauthenticated users
    function showLoginPrompt() {
        // Hide the main tryon content using the centralized function
        hideMainContent();
        
        // Show login prompt
        const loginPrompt = document.getElementById('loginPrompt');
        if (loginPrompt) {
            loginPrompt.style.display = 'block';
        } else {
            // Create login prompt if it doesn't exist
            createLoginPrompt();
        }
    }

    // Create login prompt element
    function createLoginPrompt() {
        const container = document.querySelector('.container');
        const loginPrompt = document.createElement('div');
        loginPrompt.id = 'loginPrompt';
        loginPrompt.className = 'text-center py-5';
        loginPrompt.innerHTML = `
            <div class="card shadow-lg">
                <div class="card-body p-5">
                    <h2 class="mb-4">Login Required</h2>
                    <p class="lead mb-4">Please log in to access the Virtual Try-On feature.</p>
                    <div class="d-grid gap-3 d-md-block">
                        <a href="/login" class="btn btn-primary btn-lg px-4">Go to Login</a>
                        <a href="/" class="btn btn-outline-secondary btn-lg px-4">Back to Home</a>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(loginPrompt);
    }

    // Helper function to add timestamps to logs
    function logWithTimestamp(message, data = null) {
        const timestamp = new Date().toISOString();
        return timestamp;
    }
    
    // Helper function to completely stop all polling
    function stopAllPolling() {
        logWithTimestamp('🛑 ===== STOPPING ALL POLLING =====');
        
        // Clear the main polling interval
        if (pollingInterval) {
            clearTimeout(pollingInterval);
            pollingInterval = null;
            logWithTimestamp('✅ Main polling interval cleared');
        }
        
        // Clear any pending polling timeouts
        if (window.pollingTimeoutId) {
            clearTimeout(window.pollingTimeoutId);
            window.pollingTimeoutId = null;
            logWithTimestamp('✅ Pending polling timeout cleared');
        }
        
        // Clear any other potential timeouts
        if (window.enhancedPollingTimeout) {
            clearTimeout(window.enhancedPollingTimeout);
            window.enhancedPollingTimeout = null;
            logWithTimestamp('✅ Enhanced polling timeout cleared');
        }
        
        logWithTimestamp('✅ All polling stopped successfully');
    }
    
    // Initialize
    async function initialize() {
        // Set up logout button first
        setupLogoutButton();
        
        // Initialize Socket.IO for real-time updates
        initializeSocket();
        
        // Show user info only if authenticated
        if (currentUser) {
            showUserInfo();
        }
        
        // Check for existing session
        const isAuthenticated = await checkSession();
        
        if (isAuthenticated) {
            showToast('Welcome back! Your session is still active.', 'success');
            // Show main content and load garments
            showMainContent();
            loadGarments();
        } else {
            // Ensure main content is hidden and no garments are loaded
            hideMainContent();
            showLoginPrompt();
        }
        
        // Set up event listeners for manual image upload
        document.getElementById('manualImageUpload').addEventListener('change', function() {
            const file = this.files[0];
            if (file && file.type.startsWith('image/')) {
                document.getElementById('uploadImageBtn').removeAttribute('disabled');
            }
        });
        
        // Initialize button states - Next button should be disabled until garment is selected
        const nextButton = document.getElementById('toPage2');
        if (nextButton) {
            nextButton.setAttribute('disabled', 'disabled');
            nextButton.classList.remove('btn-success');
            nextButton.innerHTML = 'Select a Garment First';
        }
        
        // Set up refresh button for garments
        const refreshBtn = document.getElementById('refreshGarmentsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                // Only refresh if user is authenticated
                if (currentUser) {
                    loadGarments();
                    showToast('Refreshing garments...', 'info');
                } else {
                    showToast('Please login to access garments', 'warning');
                }
            });
        }
        
        // Set up try again button for error cases (using event delegation)
        document.addEventListener('click', function(e) {
            if (e.target && e.target.id === 'tryAgainBtn') {
                console.log('Try again button clicked');
                loadGarments();
                showToast('Retrying to load garments...', 'info');
            }
        });
        
        // Set up toast close button
        const toastClose = document.getElementById('toastClose');
        if (toastClose) {
            toastClose.addEventListener('click', function() {
                const toast = document.getElementById('toast');
                if (toast) {
                    toast.classList.remove('show');
                }
            });
        }
        
        // Set up retake photo button
        const retakePhotoBtn = document.getElementById('retakePhotoBtn');
        if (retakePhotoBtn) {
            retakePhotoBtn.addEventListener('click', retakePhoto);
        }
        
        console.log('Initialize function completed');
    }

    // Check if user is coming back from login
    function checkLoginReturn() {
        const urlParams = new URLSearchParams(window.location.search);
        console.log('Checking login return, URL params:', urlParams.toString());
        if (urlParams.get('login') === 'success') {
            console.log('Login success detected, refreshing page...');
            // User just logged in, refresh the page to show authenticated state
            window.location.href = window.location.pathname;
        }
    }

    // Modal management variables
    
    // Modal Functions
    function showModal(modalId) {
        logWithTimestamp(`🎯 showModal called for: ${modalId}`);
        const modal = document.getElementById(modalId);
        if (modal) {
            logWithTimestamp(`✅ Modal ${modalId} found, showing...`);
            modal.style.display = 'flex';
            setTimeout(() => {
                modal.classList.add('show');
                logWithTimestamp(`✨ Modal ${modalId} now has 'show' class`);
            }, 10);
            logWithTimestamp(`${modalId} shown with animation`);
        } else {
            console.error(`❌ Modal ${modalId} not found in DOM`);
        }
    }
    
    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            logWithTimestamp(`hideModal called for ${modalId}`);
            logWithTimestamp(`  Before hiding - display: ${modal.style.display}, show class: ${modal.classList.contains('show')}`);
            
            modal.classList.remove('show');
            setTimeout(() => {
            modal.style.display = 'none';
                logWithTimestamp(`${modalId} display set to none`);
            }, 300);
            logWithTimestamp(`${modalId} hidden with animation`);
        } else {
            console.warn(`hideModal: Modal with ID '${modalId}' not found`);
        }
    }
    
    // Show Customer Information Modal
    function showCustomerModal() {
        showModal('customerModal');
    }
    

    
    // Show Thank You Modal
    function showThankYouModal() {
        console.log('showThankYouModal called - customerInfoSubmitted:', customerInfoSubmitted);
        console.log('currentOrder:', currentOrder);
        
        // Only allow showing thank you modal if customer info has been submitted
        if (!customerInfoSubmitted) {
            console.warn('Attempted to show thank you modal without customer info submitted');
            return;
        }
        
        showModal('thankYouModal');
        
        // Show success message
        showToast('✅ Customer information submitted successfully! Processing your try-on...', 'success');
        
        // Add a timeout to automatically close the modal after 5 minutes if no result
        const modalTimeout = setTimeout(() => {
            console.log('⏰ Thank you modal timeout - automatically closing');
            hideAllModals();
            showToast('Processing is taking longer than expected. The result will be ready shortly.', 'info');
            
            // Show a manual check option
            setTimeout(() => {
                showToast('You can refresh the page to check if your result is ready.', 'info');
            }, 3000);
        }, 5 * 60 * 1000); // 5 minutes
        
        // Also add a minimum display time so users can see the message
        setTimeout(() => {
            if (window.thankYouModalTimeout) {
                showToast('⏳ Processing your try-on request...', 'info');
            }
        }, 2000); // Show processing message after 2 seconds
        
        // Store timeout ID so it can be cleared when result arrives
        window.thankYouModalTimeout = modalTimeout;
    }
    
    // Show Quantity Modal
    function showQuantityModal() {
        showModal('quantityModal');
    }
    
    // Hide all modals
    function hideAllModals() {
        console.log('hideAllModals called - hiding all modals');
        
        // Clear any pending timeout for thank you modal
        if (window.thankYouModalTimeout) {
            console.log('⏰ Clearing thank you modal timeout');
            clearTimeout(window.thankYouModalTimeout);
            window.thankYouModalTimeout = null;
        }
        
        hideModal('customerModal');
        hideModal('thankYouModal');
        hideModal('quantityModal');
        
        // Double-check that all modals are hidden
        setTimeout(() => {
            const customerModal = document.getElementById('customerModal');
            const thankYouModal = document.getElementById('thankYouModal');
            const quantityModal = document.getElementById('quantityModal');
            
            console.log('Modal visibility check after hideAllModals:');
            console.log('  customerModal display:', customerModal?.style.display);
            console.log('  thankYouModal display:', thankYouModal?.style.display);
            console.log('  quantityModal display:', quantityModal?.style.display);
            console.log('  thankYouModal show class:', thankYouModal?.classList.contains('show'));
        }, 350);
    }
    
    // Smooth transition between modals
    function transitionModal(fromModalId, toModalId) {
        logWithTimestamp(`🔄 Transitioning from ${fromModalId} to ${toModalId}`);
        
        const fromModal = document.getElementById(fromModalId);
        const toModal = document.getElementById(toModalId);
        
        if (fromModal && toModal) {
            logWithTimestamp('✅ Both modals found, starting transition');
            
            // Add transitioning class for smoother animation
            fromModal.classList.add('transitioning');
            
            // Fade out the current modal
            fromModal.classList.remove('show');
            logWithTimestamp(`📤 Fading out ${fromModalId}`);
            
            // After the fade out completes, show the new modal
            setTimeout(() => {
                fromModal.classList.remove('transitioning');
                toModal.classList.add('transitioning');
                logWithTimestamp(`📥 Showing ${toModalId}`);
                showModal(toModalId);
                
                // Remove transitioning class after animation
                setTimeout(() => {
                    toModal.classList.remove('transitioning');
                    logWithTimestamp(`✅ Transition complete: ${fromModalId} → ${toModalId}`);
                }, 400);
            }, 200);
        } else {
            console.error(`❌ Modal transition failed:`, {
                fromModal: !!fromModal,
                toModal: !!toModal,
                fromModalId,
                toModalId
            });
        }
    }
    

    
    // Debug function to check current state (global scope)
    window.debugTryOnState = function() {
        console.log('=== Try-On Debug State ===');
        console.log('currentOrder:', currentOrder);
        console.log('customerInfoSubmitted:', customerInfoSubmitted);
        console.log('currentUser:', currentUser);
        console.log('capturedImage:', capturedImage ? 'present' : 'null');
        console.log('selectedGarment:', selectedGarment);
        console.log('selectedGarmentData:', selectedGarmentData);
        
        // Check modals
        const customerModal = document.getElementById('customerModal');
        const thankYouModal = document.getElementById('thankYouModal');
        const quantityModal = document.getElementById('quantityModal');
        const resultContent = document.getElementById('resultContent');
        
        console.log('Modal states:');
        console.log('  customerModal display:', customerModal?.style.display, 'show class:', customerModal?.classList.contains('show'));
        console.log('  thankYouModal display:', thankYouModal?.style.display, 'show class:', thankYouModal?.classList.contains('show'));
        console.log('  quantityModal display:', quantityModal?.style.display, 'show class:', quantityModal?.classList.contains('show'));
        console.log('  resultContent display:', resultContent?.style.display);
        console.log('========================');
    };
    
    // Debug function to simulate completed result (for testing)
    window.simulateCompletedResult = function() {
        console.log('Simulating completed result...');
        
        // Simulate a completed result
        const testResultUrl = 'https://res.cloudinary.com/dj3ewvbqm/image/upload/v1756571048/VTON%20Web%20site/customers_captures/wsg1bicp5zjuiscgwi3q.jpg';
        
        // Hide all modals
        hideAllModals();
        
        // Show the result content
        const resultContent = document.getElementById('resultContent');
        if (resultContent) {
            resultContent.style.display = 'block';
            console.log('Result content displayed via simulation');
        }
        
        // Update the result image
        const resultImage = document.getElementById('resultImage');
        if (resultImage) {
            resultImage.style.display = 'block';
            resultImage.src = testResultUrl;
            resultImage.alt = 'Try-On Result (Simulated)';
            console.log('Result image updated via simulation');
        }
        
        showToast('Simulated result displayed successfully!', 'success');
    };
    
    // Manual update job result function (global scope)

window.manualUpdateResult = async function(jobId, resultUrl) {
        console.log('🔧 Manual update requested for job:', jobId, 'with URL:', resultUrl);
        
        if (!resultUrl) {
            resultUrl = prompt('Enter the result image URL from Artificial Studio dashboard:');
            if (!resultUrl) {
                showToast('Result URL is required', 'error');
                return;
            }
        }
        
        try {
            const response = await fetch(`/tryon/manual-update/${jobId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    status: 'completed',
                    resultUrl: resultUrl
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Manual update successful:', result);
                showToast('Job updated successfully! Checking result...', 'success');
                
                // Wait a moment then check the result
                setTimeout(() => {
                    window.manualCheckResult(jobId);
                }, 1000);
            } else {
                throw new Error(`Update failed: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Manual update failed:', error);
            showToast(`Failed to update job: ${error.message}`, 'error');
        }
    };

    // Manual check result function (global scope for onclick)
    window.manualCheckResult = async function(jobId) {
        console.log('🔄 Manual check requested for job:', jobId);
        
        // Show loading state in the button
        const manualCheckBtn = document.getElementById('manualCheckBtn');
        if (manualCheckBtn) {
            const originalText = manualCheckBtn.innerHTML;
            manualCheckBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
            manualCheckBtn.disabled = true;
            
            // Reset button after 5 seconds regardless of outcome
            setTimeout(() => {
                if (manualCheckBtn) {
                    manualCheckBtn.innerHTML = originalText;
                    manualCheckBtn.disabled = false;
                }
            }, 5000);
        }
        
        try {
            console.log('🔄 Fetching result from server...');
            const response = await fetch(`/tryon/get-result/${jobId}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('🔄 Manual check result:', result);
                
                if (result.success && result.status === 'completed' && result.resultUrl) {
                    console.log('✅ Manual check found completed result!');
                    
                    // Check if result has already been processed by another handler
                    if (resultProcessed) {
                        console.log('🔄 Result already processed by another handler, skipping manual check processing');
                        return; // Stop processing
                    }
                    
                    // CRITICAL CONDITION: Check if user info is submitted before showing result
                    if (!customerInfoSubmitted) {
                        console.log('🎯 CRITICAL CONDITION: Manual check found result but user info not submitted yet');
                        console.log('📋 Storing pending result and waiting for user info...');
                        
                        // Store the pending result
                        pendingImageResult = result;
                        imageResultReceived = true;
                        waitingForUserInfo = true;
                        
                        // Save state
                        saveTabState();
                        
                        // Stop polling but don't show result yet
                        if (pollingInterval) {
                            clearTimeout(pollingInterval);
                            pollingInterval = null;
                            console.log('🛑 Polling stopped by manual check (waiting for user info)');
                        }
                        
                        // Show message that we're waiting for user info
                        showToast('🎉 Try-on completed! Please fill in your information to see the result.', 'info');
                        
                        console.log('⏳ Waiting for user to submit information before showing result (manual check)');
                        return; // Stop processing, wait for user info
                    }
                    
                    // Mark result as processed
                    resultProcessed = true;
                    console.log('🔄 Marking result as processed by manual check handler');
                    
                    // Stop polling immediately since we have the result
                    if (pollingInterval) {
                        clearTimeout(pollingInterval);
                        pollingInterval = null;
                        console.log('🛑 Polling stopped by manual check result');
                    }
                    
                    // Hide all modals immediately
                    hideAllModals();
                    
                    // Wait a moment for modal animation, then show result
                    setTimeout(() => {
                        // Show the result content
                        const resultContent = document.getElementById('resultContent');
                        if (resultContent) {
                            resultContent.style.display = 'block';
                            console.log('✅ Result content displayed via manual check');
                        } else {
                            console.warn('❌ Result content element not found');
                        }
                        
                        // Update the result image
                        const resultImage = document.getElementById('resultImage');
                        if (resultImage) {
                            resultImage.style.display = 'block';
                            resultImage.src = result.resultUrl;
                            resultImage.alt = 'Try-On Result';
                            console.log('✅ Result image updated via manual check:', result.resultUrl);
                            
                            // Add image load handlers
                            resultImage.onload = () => {
                                console.log('✅ Manual check - Result image loaded successfully');
                            };
                            resultImage.onerror = () => {
                                console.error('❌ Manual check - Failed to load result image');
                            };
                        }
                        
                        showToast('Virtual try-on completed successfully!', 'success');
                    }, 500);
                    
                    // Check if order already exists or is being created
                    if (currentOrder) {
                        console.log('Order already exists, skipping creation (manual check)');
                    } else if (orderCreationInProgress) {
                        console.log('Order creation already in progress, skipping (manual check)');
                    } else if (customerInfo && customerInfoSubmitted) {
                        // Create order now that we have the try-on result (manual check)
                        try {
                            orderCreationInProgress = true; // Set flag to prevent duplicate creation
                            console.log('Creating order now that try-on result is received (manual check)');
                            const orderData = {
                                user_id: currentUser.userId,
                                garment_id: selectedGarment,
                                customer_name: customerInfo.name,
                                customer_phone: customerInfo.phone,
                                status: 'pending',
                                quantity: 0,
                                tryon_job_id: jobId,
                                tryon_result_url: result.resultUrl
                            };
                            
                            const orderResponse = await fetch('/api/orders', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                credentials: 'include',
                                body: JSON.stringify(orderData)
                            });
                            
                            if (orderResponse.ok) {
                                const orderResult = await orderResponse.json();
                                currentOrder = orderResult.order;
                                console.log('Order created after try-on result (manual check):', currentOrder);
                                
                                // Enable the Submit Order button now that we have an order
                                const submitOrderBtn = document.getElementById('submitOrderBtn');
                                if (submitOrderBtn) {
                                    submitOrderBtn.disabled = false;
                                    submitOrderBtn.classList.remove('btn-secondary');
                                    submitOrderBtn.classList.add('btn-primary');
                                    console.log('Submit Order button enabled (manual check)');
                                }
                                
                                showToast('Order created successfully! You can now submit it.', 'success');
                            } else {
                                console.warn('Failed to create order after try-on result (manual check)');
                            }
                        } catch (orderError) {
                            console.error('Error creating order after try-on result (manual check):', orderError);
                        } finally {
                            orderCreationInProgress = false; // Reset flag
                        }
                    } else {
                        console.log('Customer info not submitted yet, skipping order creation (manual check)');
                    }
                    
                    console.log('✅ Manual check result processed successfully');

                } else if (result.status === 'pending') {
                    console.log('⏳ Manual check - Job still pending');
                    showToast('Try-on is still processing. Please wait a bit longer.', 'info');
                } else if (result.status === 'failed') {
                    console.log('❌ Manual check - Job failed:', result.error);
                    hideAllModals();
                    showToast(`Try-on failed: ${result.error || 'Unknown error'}`, 'error');
                } else {
                    console.log('❓ Manual check - Unexpected status:', result.status);
                    showToast('Unexpected result status. Please try again.', 'warning');
                }
            } else {
                console.error('❌ Manual check - Request failed:', response.status, response.statusText);
                showToast('Failed to check try-on status. Please try again.', 'error');
            }
        } catch (error) {
            console.error('❌ Manual check error:', error);
            showToast('Error checking try-on status. Please try again.', 'error');
        }
    };
    
    // Global function to force check any job (for debugging)
    window.forceCheckJob = async function(jobId) {
        if (!jobId) {
            console.error('❌ No job ID provided');
            showToast('Please provide a job ID', 'error');
            return;
        }
        
        console.log(`🔍 Force checking job: ${jobId}`);
        await manualCheckResult(jobId);
    };
    
    // Check recent jobs from server logs (for debugging)
    window.checkRecentJobs = async function() {
        const recentJobIds = [
            'CgxrtYD6EfPrJcKIY7wO', // Most recent
            'EqSTh7meCcEfyautnVpd', // Previous
            'WvQo3pJWVRO1nEGDzxom', // Older
            'ETkq8O3UCwWekVtgtU65', // Older
            'F2ZNyiYs6v2VBBTtVw23'  // Oldest
        ];
        
        console.log('🔍 Checking recent jobs for completed results...');
        
        for (const jobId of recentJobIds) {
            try {
                console.log(`🔍 Checking job: ${jobId}`);
                const response = await fetch(`/tryon/get-result/${jobId}`);
                if (response.ok) {
                    const result = await response.json();
                    console.log(`📊 Job ${jobId} status:`, result.status);
                    
                    if (result.success && result.status === 'completed' && result.resultUrl) {
                        console.log(`✅ Found completed job: ${jobId}`);
                        
                        // CRITICAL CONDITION: Check if user info is submitted before showing result
                        if (!customerInfoSubmitted) {
                            console.log('🎯 CRITICAL CONDITION: Debug check found result but user info not submitted yet');
                            showToast('🎉 Try-on completed! Please fill in your information to see the result.', 'info');
                            return; // Don't show result yet
                        }
                        
                        showToast(`Found completed result from job ${jobId}!`, 'success');
                        await manualCheckResult(jobId);
                        return; // Stop checking once we find a completed one
                    }
                }
            } catch (error) {
                console.warn(`❌ Failed to check job ${jobId}:`, error.message);
            }
        }
        
        console.log('📊 No completed jobs found in recent attempts');
        showToast('No completed results found in recent jobs', 'info');
    };
    
    // Start the application
    checkLoginReturn();
    
    // Add a small delay to ensure DOM is fully loaded
    setTimeout(() => {
        console.log('Starting initialization...');
        initialize();
    }, 100);
    
    // FOLLOW THE FLOWCHART: Handle order creation AFTER image is displayed
    async function handleOrderCreationAfterResult(result, jobId) {
        logWithTimestamp('🎯 ===== ORDER CREATION AFTER RESULT DISPLAY =====');
        logWithTimestamp('📋 Order creation state after image display:');
        logWithTimestamp('  - currentOrder:', currentOrder);
        logWithTimestamp('  - orderCreationInProgress:', orderCreationInProgress);
        logWithTimestamp('  - customerInfo:', customerInfo);
        logWithTimestamp('  - customerInfoSubmitted:', customerInfoSubmitted);
        logWithTimestamp('  - currentUser.userId:', currentUser?.userId);
        logWithTimestamp('  - selectedGarment:', selectedGarment);
        logWithTimestamp('  - jobId:', jobId);
        logWithTimestamp('  - result.resultUrl:', result.resultUrl);
        
        // FOLLOW THE FLOWCHART: Now that image is displayed, handle order creation
        if (currentOrder) {
            logWithTimestamp('✅ Order already exists, skipping creation (after image display)');
        } else if (orderCreationInProgress) {
            logWithTimestamp('⏳ Order creation already in progress, skipping (after image display)');
        } else if (customerInfo && customerInfoSubmitted) {
            // Create order now that we have the try-on result AND image is displayed
            try {
                orderCreationInProgress = true; // Set flag to prevent duplicate creation
                logWithTimestamp('🚀 FOLLOWING FLOWCHART: Creating order after image display');
                
                const orderData = {
                    user_id: currentUser?.userId,
                    garment_id: selectedGarment,
                    customer_name: customerInfo.name,
                    customer_phone: customerInfo.phone,
                    status: 'pending',
                    quantity: 0,
                    tryon_job_id: jobId,
                    tryon_result_url: result.resultUrl
                };
                
                logWithTimestamp('📦 Order data prepared:', orderData);
                logWithTimestamp('📡 Sending order creation request to /api/orders...');
                
                const orderResponse = await fetch('/api/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify(orderData)
                });
                
                logWithTimestamp('📡 Order creation response status:', orderResponse.status, orderResponse.statusText);
                
                if (orderResponse.ok) {
                    const orderResult = await orderResponse.json();
                    currentOrder = orderResult.order || orderResult;
                    logWithTimestamp('✅ Order created after image display:', currentOrder);
                    
                    // Enable the Submit Order button now that we have an order
                    const submitOrderBtn = document.getElementById('submitOrderBtn');
                    if (submitOrderBtn) {
                        submitOrderBtn.disabled = false;
                        submitOrderBtn.classList.remove('btn-secondary');
                        submitOrderBtn.classList.add('btn-primary');
                        logWithTimestamp('✅ Submit Order button enabled (after image display)');
                    } else {
                        console.warn('⚠️ Submit Order button element not found');
                    }
                    
                    showToast('Order created successfully! You can now submit it.', 'success');
                } else {
                    console.warn('❌ Failed to create order after image display');
                    const errorText = await orderResponse.text();
                    console.error('Error response:', errorText);
                }
            } catch (orderError) {
                console.error('❌ Error creating order after image display:', orderError);
            } finally {
                orderCreationInProgress = false; // Reset flag
                logWithTimestamp('🔄 Order creation flag reset');
            }
        } else {
            logWithTimestamp('⚠️ Cannot create order: missing customer info or not submitted');
            logWithTimestamp('💡 User needs to fill customer form first');
        }
        
        // FOLLOW THE FLOWCHART: Now hide modals AFTER order creation
        logWithTimestamp('🎯 FOLLOWING FLOWCHART: Hiding modals after order creation');
        setTimeout(() => {
            logWithTimestamp('Hiding all modals after order creation...');
            hideAllModals();
        }, 1000); // 1 second delay to show success message
        
        // Trials are already decreased in the backend when the try-on request was made
        logWithTimestamp('🎯 Trials already decreased in backend when request was made');
        // Update trials display to reflect current count
        updateTrialsDisplay();
        
        logWithTimestamp('✅ Order creation after result display completed');
    }
});