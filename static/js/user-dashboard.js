// user-dashboard.js - User Dashboard for Garment Management
document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let currentUser = null;
    let userGarments = [];

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

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', function() {
        document.body.dataset.theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
        this.innerHTML = document.body.dataset.theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', document.body.dataset.theme);
    });

    // Set theme from local storage
    if (localStorage.getItem('theme') === 'dark') {
        document.body.dataset.theme = 'dark';
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Check user session
    async function checkSession() {
        try {
            // First try to validate the session with the backend
            const response = await fetch('/validate-session');
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    currentUser = result.user;
                    return true;
                }
            }
            
            // If backend validation fails (404 or other errors), check localStorage as fallback
            console.log('Backend session validation failed, falling back to localStorage');
            const session = localStorage.getItem('userSession');
            if (session) {
                const sessionData = JSON.parse(session);
                if (sessionData.expires > Date.now()) {
                    currentUser = sessionData.user;
                    console.log('Using localStorage session for user:', currentUser.username);
                    
                    // Try to create a backend session from localStorage data
                    await createBackendSession(currentUser.id);
                    
                    return true;
                } else {
                    localStorage.removeItem('userSession');
                    console.log('localStorage session expired');
                }
            }
            
            return false;
        } catch (error) {
            console.error('Session validation error:', error);
            // Fall back to localStorage on any error
            const session = localStorage.getItem('userSession');
            if (session) {
                const sessionData = JSON.parse(session);
                if (sessionData.expires > Date.now()) {
                    currentUser = sessionData.user;
                    console.log('Using localStorage session after error for user:', currentUser.username);
                    
                    // Try to create a backend session from localStorage data
                    await createBackendSession(currentUser.id);
                    
                    return true;
                }
            }
            return false;
        }
    }

    // Create backend session from localStorage data
    async function createBackendSession(userId) {
        try {
            const response = await fetch('/create-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });
            
            if (response.ok) {
                console.log('Backend session created successfully');
            } else {
                console.log('Failed to create backend session, but continuing with localStorage');
            }
        } catch (error) {
            console.log('Error creating backend session, but continuing with localStorage:', error);
        }
    }

    // Show user info
    function showUserInfo() {
        if (currentUser) {
            document.getElementById('userName').textContent = currentUser.name;
            document.getElementById('userEmail').textContent = currentUser.email;
            document.getElementById('userInfoBar').classList.remove('hidden');
            document.getElementById('authSection').classList.add('hidden');
            document.getElementById('dashboardContent').classList.remove('hidden');
        }
    }

    // Load user statistics
    async function loadUserStats() {
        try {
            const response = await fetch(`/garments/user/${currentUser.id}/stats`);
            if (response.ok) {
                const stats = await response.json();
                document.getElementById('totalGarments').textContent = stats.total || 0;
                document.getElementById('approvedGarments').textContent = stats.approved || 0;
                document.getElementById('pendingGarments').textContent = stats.pending || 0;
                document.getElementById('totalViews').textContent = stats.totalViews || 0;
            } else {
                // Handle error response
                const error = await response.json();
                console.error('Stats endpoint error:', error);
                throw new Error(error.error || 'Failed to load stats');
            }
        } catch (error) {
            console.error('Failed to load user stats:', error);
            // Set default values on error
            document.getElementById('totalGarments').textContent = '0';
            document.getElementById('approvedGarments').textContent = '0';
            document.getElementById('pendingGarments').textContent = '0';
            document.getElementById('totalViews').textContent = '0';
        }
    }

    // Load user's garments
    async function loadUserGarments() {
        try {
            const response = await fetch(`/garments/user/${currentUser.id}`);
            if (response.ok) {
                const result = await response.json();
                userGarments = result.garments || [];
            } else {
                // Handle error response
                const error = await response.json();
                console.error('Garments endpoint error:', error);
                throw new Error(error.error || 'Failed to load garments');
            }
        } catch (error) {
            console.error('Failed to load user garments:', error);
            userGarments = [];
        }
        
        // Always display garments (even if empty or error)
        displayUserGarments();
    }

    // Display user's garments
    function displayUserGarments() {
        const garmentsGrid = document.getElementById('myGarmentsGrid');
        
        if (!userGarments || userGarments.length === 0) {
            garmentsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-light);">
                    <i class="fas fa-tshirt" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>No Garments Yet</h3>
                    <p>Start by uploading your first garment using the form above!</p>
                </div>
            `;
            return;
        }

        garmentsGrid.innerHTML = userGarments.map(garment => `
            <div class="garment-card" data-garment-id="${garment.id}">
                <img src="${garment.url}" alt="${garment.name}" class="garment-image" 
                     onerror="this.src='/Media/placeholder-garment.jpg'">
                <div class="garment-info">
                    <div class="garment-name">${garment.name}</div>
                    <div class="garment-details">
                        ${garment.category} • ${garment.type} • ${garment.color}
                        ${garment.price ? ` • $${garment.price}` : ''}
                    </div>
                    <div class="garment-actions">
                        <button class="btn btn-sm btn-outline" onclick="editGarment('${garment.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteGarment('${garment.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // File upload handling
    const fileUploadArea = document.getElementById('fileUploadArea');
    const garmentImageInput = document.getElementById('garmentImage');
    const previewImage = document.getElementById('previewImage');

    // Click to upload
    fileUploadArea.addEventListener('click', () => {
        garmentImageInput.click();
    });

    // File selection
    garmentImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                showToast('File size must be less than 10MB', 'error');
                return;
            }
            
            if (!file.type.startsWith('image/')) {
                showToast('Please select an image file', 'error');
                return;
            }

            // Preview image
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImage.src = e.target.result;
                previewImage.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    // Drag and drop
    fileUploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });

    fileUploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
    });

    fileUploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            garmentImageInput.files = files;
            
            if (file.size > 10 * 1024 * 1024) {
                showToast('File size must be less than 10MB', 'error');
                return;
            }
            
            if (!file.type.startsWith('image/')) {
                showToast('Please select an image file', 'error');
                return;
            }

            // Preview image
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImage.src = e.target.result;
                previewImage.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    // Garment upload form
    document.getElementById('garmentUploadForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const uploadBtn = document.getElementById('uploadBtn');
        const originalText = uploadBtn.innerHTML;
        
        try {
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
            
            const formData = new FormData();
            formData.append('name', document.getElementById('garmentName').value);
            formData.append('category', document.getElementById('garmentCategory').value);
            formData.append('type', document.getElementById('garmentType').value);
            formData.append('color', document.getElementById('garmentColor').value);
            formData.append('price', document.getElementById('garmentPrice').value || '');
            formData.append('size', document.getElementById('garmentSize').value || '');
            formData.append('description', document.getElementById('garmentDescription').value || '');
            formData.append('tags', document.getElementById('garmentTags').value || '');
            formData.append('image', garmentImageInput.files[0]);
            formData.append('userId', currentUser.id);

            const response = await fetch('/garments/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Upload failed');
            }

            const result = await response.json();
            showToast('Garment uploaded successfully!', 'success');
            
            // Reset form
            this.reset();
            previewImage.style.display = 'none';
            
            // Reload user garments and stats
            await loadUserGarments();
            await loadUserStats();
            
        } catch (error) {
            console.error('Upload error:', error);
            showToast(error.message, 'error');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = originalText;
        }
    });

    // Logout functionality
    document.getElementById('logoutBtn').addEventListener('click', function() {
        localStorage.removeItem('userSession');
        window.location.href = '/tryon';
    });

    // Global functions for garment actions
    window.editGarment = function(garmentId) {
        // TODO: Implement edit functionality
        showToast('Edit functionality coming soon!', 'info');
    };

    window.deleteGarment = async function(garmentId) {
        if (!confirm('Are you sure you want to delete this garment? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/garments/${garmentId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showToast('Garment deleted successfully!', 'success');
                await loadUserGarments();
                await loadUserStats();
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Delete failed');
            }
        } catch (error) {
            console.error('Delete error:', error);
            showToast(error.message, 'error');
        }
    };

    // Initialize dashboard
    async function initialize() {
        if (await checkSession()) {
            showUserInfo();
            await loadUserStats();
            await loadUserGarments();
        } else {
            // Redirect to login if no valid session
            window.location.href = '/tryon';
        }
    }

    // Start the application
    initialize();
});

