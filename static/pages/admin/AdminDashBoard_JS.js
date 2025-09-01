// Enhanced Admin Dashboard JavaScript with Modern Error Handling and UI/UX
class AdminDashboard {
  constructor() {
    this.API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000'
      : window.location.origin;
    
    this.token = localStorage.getItem('adminToken') || '';
    this.currentlyEditing = null;
    this.garments = [];
    this.filteredGarments = [];
    this.currentFilter = 'all';
    this.searchQuery = '';
    
    this.initializeElements();
    this.setupEventListeners();
    this.initializeColorPickers();
    this.updateCurrentTime();
    this.checkAuthenticationState();
    
    // Update time every minute
    setInterval(() => this.updateCurrentTime(), 60000);
  }

  // Initialize DOM elements
  initializeElements() {
    // Screens
    this.loginScreen = document.getElementById('login-screen');
    this.dashboardScreen = document.getElementById('dashboard-screen');
    
    // Login elements
    this.loginForm = document.getElementById('login-form');
    this.loginEmail = document.getElementById('login-email');
    this.loginPassword = document.getElementById('login-password');
    this.loginButton = document.getElementById('login-button');
    this.loginSpinner = document.getElementById('login-spinner');
    this.toggleLoginPassword = document.getElementById('toggle-login-password');
    this.loginMessages = document.getElementById('login-messages');
    
    // Dashboard elements
    this.logoutButton = document.getElementById('logout-button');
    this.currentTime = document.getElementById('current-time');
    
    // Stats elements
    this.totalGarments = document.getElementById('total-garments');
    this.approvedGarments = document.getElementById('approved-garments');
    this.pendingGarments = document.getElementById('pending-garments');
    this.rejectedGarments = document.getElementById('rejected-garments');
    
    // Form elements
    this.createGarmentForm = document.getElementById('create-garment-form');
    this.createGarmentButton = document.getElementById('create-garment-button');
    this.formSpinner = document.getElementById('form-spinner');
    
    // Garment management elements
    this.tableSpinner = document.getElementById('table-spinner');
    this.noGarments = document.getElementById('no-garments');
    this.garmentsCards = document.getElementById('garments-cards');
    this.garmentsCardsContainer = document.getElementById('garments-cards-container');
    
    // Search and filter elements
    this.searchInput = document.getElementById('search-garments');
    this.filterButtons = document.querySelectorAll('[data-filter]');
    
    // Modal elements
    this.editModal = document.getElementById('edit-garment-modal');
    this.detailModal = document.getElementById('garment-detail-modal');
    this.deleteModal = document.getElementById('delete-confirmation-modal');
    this.loadingOverlay = document.getElementById('loading-overlay');
    
    // Color picker elements
    this.colorPicker = document.getElementById('color-picker');
    this.colorInput = document.getElementById('color');
    this.editColorPicker = document.getElementById('edit-color-picker');
    this.editColorInput = document.getElementById('edit-color');
    
    // Image preview elements
    this.garmentImageInput = document.getElementById('garment_image');
    this.imagePreviewContainer = document.getElementById('image-preview-container');
    this.imagePreview = document.getElementById('image-preview');
    this.removeImagePreview = document.getElementById('remove-image-preview');
    
    this.editGarmentImageInput = document.getElementById('edit-garment_image');
    this.editImagePreviewContainer = document.getElementById('edit-image-preview-container');
    this.editImagePreview = document.getElementById('edit-image-preview');
    this.removeEditImagePreview = document.getElementById('remove-edit-image-preview');
  }

  // Setup event listeners
  setupEventListeners() {
    // Login events
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }
    if (this.toggleLoginPassword) {
      this.toggleLoginPassword.addEventListener('click', () => this.togglePasswordVisibility());
    }
    if (this.logoutButton) {
      this.logoutButton.addEventListener('click', () => this.handleLogout());
    }
    
    // Form events
    if (this.createGarmentForm) {
      this.createGarmentForm.addEventListener('submit', (e) => this.handleCreateGarment(e));
    }
    
    // Search and filter events
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }
    this.filterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleFilter(e.target.dataset.filter));
    });
    
    // Image preview events
    this.garmentImageInput.addEventListener('change', (e) => this.handleImagePreview(e, 'create'));
    this.editGarmentImageInput.addEventListener('change', (e) => this.handleImagePreview(e, 'edit'));
    this.removeImagePreview.addEventListener('click', () => this.removeImagePreview('create'));
    this.removeEditImagePreview.addEventListener('click', () => this.removeImagePreview('edit'));
    
    // Modal close events
    document.addEventListener('click', (e) => this.handleModalClose(e));
    
    // Color picker events
    this.colorPicker.addEventListener('input', (e) => this.updateColorName(e.target.value, 'create'));
    this.editColorPicker.addEventListener('input', (e) => this.updateColorName(e.target.value, 'edit'));
    
    // Refresh button
    const refreshButton = document.getElementById('refresh-garments');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => this.fetchGarments());
    }
    
    // Delete modal cancel button
    const cancelDeleteButton = document.getElementById('cancel-delete');
    if (cancelDeleteButton) {
      cancelDeleteButton.addEventListener('click', () => {
        console.log('❌ Delete cancelled by user');
        this.closeModal('delete-confirmation-modal');
      });
    }
  }

  // Initialize color pickers
  initializeColorPickers() {
    this.colorMap = {
      '#000000': 'Black', '#FFFFFF': 'White', '#FF0000': 'Red', '#00FF00': 'Lime',
      '#0000FF': 'Blue', '#FFFF00': 'Yellow', '#FF00FF': 'Magenta', '#00FFFF': 'Cyan',
      '#800000': 'Maroon', '#808000': 'Olive', '#008000': 'Green', '#800080': 'Purple',
      '#008080': 'Teal', '#000080': 'Navy', '#C0C0C0': 'Silver', '#808080': 'Gray',
      '#FFA500': 'Orange', '#FFB6C1': 'Light Pink', '#FF69B4': 'Hot Pink', '#FF1493': 'Deep Pink',
      '#DC143C': 'Crimson', '#B22222': 'Fire Brick', '#8B0000': 'Dark Red', '#CD5C5C': 'Indian Red',
      '#F08080': 'Light Coral', '#FA8072': 'Salmon', '#E9967A': 'Dark Salmon', '#FFA07A': 'Light Salmon',
      '#FF7F50': 'Coral', '#FF6347': 'Tomato', '#FF4500': 'Orange Red', '#FF8C00': 'Dark Orange',
      '#FFD700': 'Gold', '#FFFFE0': 'Light Yellow', '#FFFACD': 'Lemon Chiffon', '#FFEFD5': 'Papaya Whip',
      '#FFE4B5': 'Moccasin', '#FFDAB9': 'Peach Puff', '#F5DEB3': 'Wheat', '#DEB887': 'Burlywood',
      '#D2B48C': 'Tan', '#BC8F8F': 'Rosy Brown', '#F4A460': 'Sandy Brown', '#DAA520': 'Goldenrod',
      '#B8860B': 'Dark Goldenrod', '#CD853F': 'Peru', '#D2691E': 'Chocolate', '#8B4513': 'Saddle Brown',
      '#A0522D': 'Sienna', '#A52A2A': 'Brown', '#556B2F': 'Dark Olive Green', '#6B8E23': 'Olive Drab',
      '#9ACD32': 'Yellow Green', '#32CD32': 'Lime Green', '#00FF32': 'Lime', '#00FF7F': 'Spring Green',
      '#00FA9A': 'Medium Spring Green', '#90EE90': 'Light Green', '#98FB98': 'Pale Green', '#8FBC8F': 'Dark Sea Green',
      '#7CFC00': 'Lawn Green', '#7FFF00': 'Chartreuse', '#ADFF2F': 'Green Yellow', '#228B22': 'Forest Green',
      '#006400': 'Dark Green', '#00CED1': 'Dark Turquoise', '#40E0D0': 'Turquoise', '#48D1CC': 'Medium Aquamarine',
      '#E0FFFF': 'Light Cyan', '#AFEEEE': 'Pale Turquoise', '#7FFFD4': 'Aquamarine', '#66CDAA': 'Medium Aquamarine',
      '#5F9EA0': 'Cadet Blue', '#4682B4': 'Steel Blue', '#6495ED': 'Cornflower Blue', '#00BFFF': 'Deep Sky Blue',
      '#87CEEB': 'Sky Blue', '#87CEFA': 'Light Sky Blue', '#ADD8E6': 'Light Blue', '#B0C4DE': 'Light Steel Blue',
      '#B0E0E6': 'Powder Blue', '#F0F8FF': 'Alice Blue', '#1E90FF': 'Dodger Blue', '#4169E1': 'Royal Blue',
      '#0000CD': 'Medium Blue', '#00008B': 'Dark Blue', '#191970': 'Midnight Blue', '#8A2BE2': 'Blue Violet',
      '#4B0082': 'Indigo', '#483D8B': 'Dark Slate Blue', '#6A5ACD': 'Slate Blue', '#7B68EE': 'Medium Slate Blue',
      '#9370DB': 'Medium Purple', '#8B008B': 'Dark Magenta', '#9400D3': 'Dark Violet', '#9932CC': 'Dark Orchid',
      '#BA55D3': 'Medium Orchid', '#DA70D6': 'Orchid', '#EE82EE': 'Violet', '#DDA0DD': 'Plum',
      '#D8BFD8': 'Thistle', '#FFE4E1': 'Misty Rose', '#FFF0F5': 'Lavender Blush', '#FAEBD7': 'Antique White',
      '#F5F5DC': 'Beige', '#FFE4C4': 'Bisque', '#FFEBCD': 'Blanched Almond', '#F5F5F5': 'White Smoke',
      '#F8F8FF': 'Ghost White', '#F0F0F0': 'Gray', '#DCDCDC': 'Gainsboro', '#D3D3D3': 'Light Gray',
      '#A9A9A9': 'Dark Gray', '#696969': 'Dim Gray', '#778899': 'Light Slate Gray', '#708090': 'Slate Gray',
      '#2F4F4F': 'Dark Slate Gray'
    };
    
    // Initialize color inputs
    this.updateColorName(this.colorPicker.value, 'create');
    this.updateColorName(this.editColorPicker.value, 'edit');
  }

  // Update current time
  updateCurrentTime() {
    const now = new Date();
    if (this.currentTime) {
      this.currentTime.textContent = now.toLocaleTimeString();
    }
  }

  // Check authentication state
  async checkAuthenticationState() {
    try {
      const storedToken = localStorage.getItem('adminToken');
      if (storedToken) {
        this.token = storedToken;
        const hasSession = await this.checkSession();
        
        if (hasSession) {
          this.showDashboard();
          await this.fetchGarments();
          this.showToast('Welcome back! Session restored.', 'success');
        } else {
          localStorage.removeItem('adminToken');
          this.token = null;
          this.showLogin();
        }
      } else {
        this.showLogin();
      }
    } catch (error) {
      console.error('Error checking authentication state:', error);
      this.showLogin();
    }
  }

  // Check session validity
  async checkSession() {
    try {
      const response = await fetch(`${this.API_URL}/admin/session`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (response.status === 200) {
        const sessionData = await response.json();
        return sessionData.authenticated;
      }
      return false;
    } catch (error) {
      console.error('Session check error:', error);
      return false;
    }
  }

  // Handle login
  async handleLogin(e) {
    e.preventDefault();
    
    const email = this.loginEmail.value.trim();
    const password = this.loginPassword.value;
    
    if (!email || !password) {
      this.showLoginMessage('Please enter both email and password', 'error');
      return;
    }
    
    this.setLoginLoading(true);
    this.clearLoginMessages();
    
    try {
      const result = await this.performLogin(email, password);
      
      if (result.success) {
        this.token = result.token || 'session-auth';
        localStorage.setItem('adminToken', this.token);
        
        this.showDashboard();
        this.loginForm.reset();
        this.showToast('Login successful!', 'success');
        
        await this.fetchGarments();
      } else {
        throw new Error('Login failed with unknown error');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showLoginMessage(`Login failed: ${error.message}`, 'error');
    } finally {
      this.setLoginLoading(false);
    }
  }

  // Perform login request
  async performLogin(email, password) {
    try {
      const response = await fetch(`${this.API_URL}/admin/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        return { success: true, token: result.token };
      } else {
        throw new Error(result.error || 'Login request failed');
      }
    } catch (error) {
      throw error;
    }
  }

  // Handle logout
  handleLogout() {
    this.token = '';
    localStorage.removeItem('adminToken');
    this.showLogin();
    this.showToast('Logged out successfully', 'success');
    
    // Reset forms and data
    if (this.createGarmentForm) {
      this.createGarmentForm.reset();
    }
    this.clearImagePreviews();
    this.garments = [];
    this.filteredGarments = [];
    this.updateStats();
  }

  // Handle create garment
  async handleCreateGarment(e) {
    e.preventDefault();
    
    if (!this.validateGarmentForm('create')) {
      return;
    }
    
    this.setFormLoading(true);
    this.clearFormMessages();
    
    try {
      const formData = new FormData();
      const nameInput = document.getElementById('garment_name');
      if (nameInput && nameInput.value.trim()) {
        formData.append('name', nameInput.value.trim());
      }
      formData.append('category', document.getElementById('category').value);
      formData.append('type', document.getElementById('garment_type').value);
      formData.append('color', document.getElementById('color').value);

      formData.append('status', 'approved');
      
      const description = document.getElementById('description').value.trim();
      const autoDescription = description || `${document.getElementById('color').value} ${document.getElementById('garment_type').value}`;
      formData.append('description', autoDescription);
      
      const imageFile = document.getElementById('garment_image').files[0];
      if (imageFile) {
        formData.append('garment_image', imageFile);
      }
      
      const response = await fetch(`${this.API_URL}/garments/admin/create`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` },
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText || 'Unknown error'}`);
      }
      
      const result = await response.json();
      
      this.showToast(`Garment "${result.garment?.name || 'created'}" added successfully!`, 'success');
      this.createGarmentForm.reset();
      this.clearImagePreviews();
      await this.fetchGarments();
      
    } catch (error) {
      console.error('Error creating garment:', error);
      this.showFormMessage(`Failed to create garment: ${error.message}`, 'error');
    } finally {
      this.setFormLoading(false);
    }
  }

  // Validate garment form
  validateGarmentForm(formType = 'create') {
    const errors = {};
    const prefix = formType === 'edit' ? 'edit-' : '';
    
    const category = document.getElementById(`${prefix}category`);
    const type = document.getElementById(`${prefix}garment_type`);
    const color = document.getElementById(`${prefix}color`);
    
    if (!category || !category.value) errors.category = 'Category is required';
    if (!type || !type.value.trim()) errors.type = 'Type is required';
    if (!color || !color.value.trim()) errors.color = 'Color is required';
    
    if (formType === 'create') {
      const imageFile = document.getElementById('garment_image');
      if (!imageFile || !imageFile.files[0]) errors.image = 'Garment image is required';
    }
    
    // Display errors
    this.clearFormErrors(formType);
    Object.keys(errors).forEach(key => {
      const errorElement = document.getElementById(`${prefix}${key}-error`);
      if (errorElement) {
        errorElement.textContent = errors[key];
        errorElement.classList.remove('hidden');
      }
    });
    
    return Object.keys(errors).length === 0;
  }

  // Fetch garments
  async fetchGarments() {
    console.log('🔄 Fetching garments...');
    this.showTableLoading();
    
    try {
      const response = await fetch(`${this.API_URL}/garments/admin/all`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      
      console.log('📡 Fetch garments API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error: ${response.status} - ${errorText || response.statusText}`);
      }
      
      const result = await response.json();
      console.log('📦 Fetch garments API response data:', result);
      this.garments = result.garments || [];
      this.filteredGarments = [...this.garments];
      
      console.log('📊 Found', this.garments.length, 'garments');
      
      this.updateStats();
      console.log('🎨 Rendering garments...');
      this.renderGarments();
      
    } catch (error) {
      console.error('Error fetching garments:', error);
      this.showToast(`Failed to fetch garments: ${error.message}`, 'error');
      
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        this.handleAuthenticationError();
      }
    } finally {
      this.hideTableLoading();
    }
  }

  // Render garments
  renderGarments() {
    console.log('🎨 Rendering garments, count:', this.filteredGarments.length);
    
    if (this.filteredGarments.length === 0) {
      console.log('📭 No garments to render, showing empty state');
      this.showEmptyState();
      return;
    }
    
    console.log('🧹 Clearing existing garment cards');
    this.garmentsCardsContainer.innerHTML = '';
    
    console.log('🔄 Creating garment cards...');
    this.filteredGarments.forEach((garment, index) => {
      console.log(`📦 Creating card ${index + 1}/${this.filteredGarments.length} for garment:`, garment.id);
      const card = this.createGarmentCard(garment);
      this.garmentsCardsContainer.appendChild(card);
    });
    
    console.log('✅ Finished rendering all garment cards');
    this.showGarmentsGrid();
    
    // Ensure all event listeners are properly attached
    this.attachGarmentEventListeners();
  }
  
  // Attach event listeners to all garment cards
  attachGarmentEventListeners() {
    console.log('🔗 Attaching event listeners to all garment cards');
    
    const editButtons = document.querySelectorAll('.edit-garment-btn');
    const deleteButtons = document.querySelectorAll('.delete-garment-btn');
    
    console.log('✏️ Found', editButtons.length, 'edit buttons');
    console.log('🗑️ Found', deleteButtons.length, 'delete buttons');
    
    editButtons.forEach((btn, index) => {
      const garmentId = btn.dataset.garmentId;
      console.log(`✏️ Attaching edit listener ${index + 1} for garment:`, garmentId);
      
      // Remove any existing listeners
      btn.replaceWith(btn.cloneNode(true));
      const newBtn = document.querySelector(`[data-garment-id="${garmentId}"].edit-garment-btn`);
      
      if (newBtn) {
        newBtn.addEventListener('click', (e) => {
          console.log('✏️ Edit button clicked for garment:', garmentId);
          e.stopPropagation();
          this.openEditModal(garmentId);
        });
      }
    });
    
    deleteButtons.forEach((btn, index) => {
      const garmentId = btn.dataset.garmentId;
      console.log(`🗑️ Attaching delete listener ${index + 1} for garment:`, garmentId);
      
      // Remove any existing listeners
      btn.replaceWith(btn.cloneNode(true));
      const newBtn = document.querySelector(`[data-garment-id="${garmentId}"].delete-garment-btn`);
      
      if (newBtn) {
        newBtn.addEventListener('click', (e) => {
          console.log('🗑️ Delete button clicked for garment:', garmentId);
          e.stopPropagation();
          this.showDeleteConfirmation(garmentId);
        });
      }
    });
    
    console.log('✅ Event listeners attached successfully');
  }

  // Create garment card
  createGarmentCard(garment) {
    const card = document.createElement('div');
    card.className = 'garment-card bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer';
    card.dataset.garmentId = garment.id;
    
    const createdDate = new Date(garment.created_at).toLocaleDateString();
    const statusClass = this.getStatusClass(garment.status);
    
    card.innerHTML = `
      <div class="aspect-square bg-gray-100 overflow-hidden">
        ${garment.url ? 
          `<img src="${this.sanitize(garment.url)}" alt="${this.sanitize(garment.type)}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300" onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'">` : 
          '<div class="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500"><i class="fas fa-tshirt text-4xl"></i></div>'
        }
      </div>
      <div class="p-4">
        <div class="flex justify-between items-start mb-2">
          <h3 class="font-semibold text-gray-800 truncate flex-1 pr-2">${this.sanitize(garment.name || garment.type)}</h3>
          <span class="status-badge ${statusClass}">${this.sanitize(garment.status)}</span>
        </div>
        <p class="text-sm text-gray-600 mb-1 capitalize">${this.sanitize(garment.type)} • ${this.sanitize(garment.category)} • ${this.sanitize(garment.color)}</p>
        <div class="flex justify-between items-center">
          <span class="text-xs text-gray-500">${garment.views || 0} views</span>
        </div>
        <div class="flex items-center mt-2 text-xs text-gray-500">
          <span class="flex items-center">
            <i class="fas fa-calendar mr-1"></i>
            ${createdDate}
          </span>
        </div>
        <div class="flex space-x-2 mt-3">
          <button class="edit-garment-btn flex-1 bg-blue-50 text-blue-600 px-3 py-2 rounded-lg text-sm hover:bg-blue-100 transition-colors duration-200 font-medium" data-garment-id="${this.sanitize(garment.id)}">
            <i class="fas fa-edit mr-1"></i>Edit
          </button>
          <button class="delete-garment-btn flex-1 bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm hover:bg-red-100 transition-colors duration-200 font-medium" data-garment-id="${this.sanitize(garment.id)}">
            <i class="fas fa-trash mr-1"></i>Delete
          </button>
        </div>
      </div>
    `;
    
    // Add event listeners with comprehensive logging
    console.log('🔧 Adding event listeners for garment card:', garment.id);
    
    card.addEventListener('click', (e) => {
      console.log('📱 Card clicked for garment:', garment.id, 'Target:', e.target);
      if (!e.target.closest('.edit-garment-btn') && !e.target.closest('.delete-garment-btn')) {
        console.log('📖 Opening detail modal for garment:', garment.id);
        this.openGarmentDetail(garment);
      }
    });
    
    const editBtn = card.querySelector('.edit-garment-btn');
    const deleteBtn = card.querySelector('.delete-garment-btn');
    
    if (editBtn) {
      console.log('✏️ Adding edit button listener for garment:', garment.id);
      editBtn.addEventListener('click', (e) => {
        console.log('✏️ Edit button clicked for garment:', garment.id);
        e.stopPropagation();
        this.openEditModal(garment.id);
      });
    } else {
      console.error('❌ Edit button not found for garment:', garment.id);
    }
    
    if (deleteBtn) {
      console.log('🗑️ Adding delete button listener for garment:', garment.id);
      deleteBtn.addEventListener('click', (e) => {
        console.log('🗑️ Delete button clicked for garment:', garment.id);
        e.stopPropagation();
        this.showDeleteConfirmation(garment.id);
      });
    } else {
      console.error('❌ Delete button not found for garment:', garment.id);
    }
    
    return card;
  }

  // Get status class for styling
  getStatusClass(status) {
    switch (status) {
      case 'approved': return 'status-approved';
      case 'pending': return 'status-pending';
      case 'rejected': return 'status-rejected';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  // Handle search
  handleSearch(query) {
    this.searchQuery = query.toLowerCase();
    this.applyFilters();
  }

  // Handle filter
  handleFilter(filter) {
    this.currentFilter = filter;
    
    // Update active filter button
    this.filterButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    this.applyFilters();
  }

  // Apply filters and search
  applyFilters() {
    this.filteredGarments = this.garments.filter(garment => {
      const matchesFilter = this.currentFilter === 'all' || garment.status === this.currentFilter;
      const matchesSearch = !this.searchQuery || 
        garment.type.toLowerCase().includes(this.searchQuery) ||
        garment.category.toLowerCase().includes(this.searchQuery) ||
        garment.color.toLowerCase().includes(this.searchQuery);
      
      return matchesFilter && matchesSearch;
    });
    
    this.renderGarments();
  }

  // Update statistics
  updateStats() {
    if (!this.totalGarments || !this.approvedGarments || !this.pendingGarments || !this.rejectedGarments) {
      return;
    }
    
    const total = this.garments.length;
    const approved = this.garments.filter(g => g.status === 'approved').length;
    const pending = this.garments.filter(g => g.status === 'pending').length;
    const rejected = this.garments.filter(g => g.status === 'rejected').length;
    
    this.totalGarments.textContent = total;
    this.approvedGarments.textContent = approved;
    this.pendingGarments.textContent = pending;
    this.rejectedGarments.textContent = rejected;
    
    // Update garment count display
    const garmentCount = document.getElementById('garment-count');
    if (garmentCount) {
      garmentCount.textContent = `${total} garments found`;
    }
  }

  // Handle image preview
  handleImagePreview(event, type) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (type === 'create') {
          if (this.imagePreview) {
            this.imagePreview.src = e.target.result;
            this.imagePreviewContainer.classList.remove('hidden');
          }
        } else {
          if (this.editImagePreview) {
            this.editImagePreview.src = e.target.result;
            this.editImagePreviewContainer.classList.remove('hidden');
          }
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // Remove image preview
  removeImagePreview(type) {
    if (type === 'create') {
      if (this.garmentImageInput) {
        this.garmentImageInput.value = '';
      }
      if (this.imagePreviewContainer) {
        this.imagePreviewContainer.classList.add('hidden');
      }
    } else {
      if (this.editGarmentImageInput) {
        this.editGarmentImageInput.value = '';
      }
      if (this.editImagePreviewContainer) {
        this.editImagePreviewContainer.classList.add('hidden');
      }
    }
  }

  // Clear image previews
  clearImagePreviews() {
    this.removeImagePreview('create');
    this.removeImagePreview('edit');
  }

  // Update color name
  updateColorName(hexColor, type) {
    const colorName = this.getClosestColorName(hexColor);
    if (type === 'create') {
      if (this.colorInput) {
        this.colorInput.value = colorName;
      }
    } else {
      if (this.editColorInput) {
        this.editColorInput.value = colorName;
      }
    }
  }

  // Get closest color name
  getClosestColorName(hex) {
    hex = hex.toUpperCase();
    
    if (this.colorMap[hex]) {
      return this.colorMap[hex];
    }
    
    const targetRgb = this.hexToRgb(hex);
    let closestColor = 'Unknown';
    let minDistance = Infinity;
    
    for (const [colorHex, colorName] of Object.entries(this.colorMap)) {
      const colorRgb = this.hexToRgb(colorHex);
      const distance = Math.sqrt(
        Math.pow(targetRgb.r - colorRgb.r, 2) +
        Math.pow(targetRgb.g - colorRgb.g, 2) +
        Math.pow(targetRgb.b - colorRgb.b, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestColor = colorName;
      }
    }
    
    return closestColor;
  }

  // Convert hex to RGB
  hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  // Toggle password visibility
  togglePasswordVisibility() {
    if (!this.loginPassword || !this.toggleLoginPassword) return;
    
    const type = this.loginPassword.type === 'password' ? 'text' : 'password';
    this.loginPassword.type = type;
    this.toggleLoginPassword.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
  }

  // Show dashboard
  showDashboard() {
    if (this.loginScreen && this.dashboardScreen) {
      this.loginScreen.classList.add('hidden');
      this.dashboardScreen.classList.remove('hidden');
    }
  }

  // Show login
  showLogin() {
    if (this.dashboardScreen && this.loginScreen) {
      this.dashboardScreen.classList.add('hidden');
      this.loginScreen.classList.remove('hidden');
    }
  }

  // Show table loading
  showTableLoading() {
    if (this.tableSpinner && this.noGarments && this.garmentsCards) {
      this.tableSpinner.classList.remove('hidden');
      this.noGarments.classList.add('hidden');
      this.garmentsCards.classList.add('hidden');
    }
  }

  // Hide table loading
  hideTableLoading() {
    if (this.tableSpinner) {
      this.tableSpinner.classList.add('hidden');
    }
  }

  // Show empty state
  showEmptyState() {
    if (this.noGarments && this.garmentsCards) {
      this.noGarments.classList.remove('hidden');
      this.garmentsCards.classList.add('hidden');
    }
  }

  // Show garments grid
  showGarmentsGrid() {
    if (this.noGarments && this.garmentsCards) {
      this.noGarments.classList.add('hidden');
      this.garmentsCards.classList.remove('hidden');
    }
  }

  // Set login loading state
  setLoginLoading(loading) {
    if (!this.loginButton || !this.loginSpinner) return;
    
    this.loginButton.disabled = loading;
    this.loginSpinner.classList.toggle('hidden', !loading);
    const buttonText = this.loginButton.querySelector('#login-button-text');
    if (buttonText) {
      buttonText.textContent = loading ? 'Signing In...' : 'Sign In';
    }
  }

  // Set form loading state
  setFormLoading(loading) {
    if (!this.createGarmentButton || !this.formSpinner) return;
    
    this.createGarmentButton.disabled = loading;
    this.formSpinner.classList.toggle('hidden', !loading);
    const buttonText = this.createGarmentButton.querySelector('#create-button-text');
    if (buttonText) {
      buttonText.textContent = loading ? 'Adding...' : 'Add Garment';
    }
  }

  // Clear login messages
  clearLoginMessages() {
    if (this.loginMessages) {
      this.loginMessages.innerHTML = '';
    }
  }

  // Show login message
  showLoginMessage(message, type) {
    if (!this.loginMessages) return;
    
    this.loginMessages.innerHTML = `
      <div class="p-3 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">
        ${message}
      </div>
    `;
  }

  // Clear form messages
  clearFormMessages() {
    // Implementation for form messages
  }

  // Show form message
  showFormMessage(message, type) {
    // Implementation for form messages
  }

  // Clear form errors
  clearFormErrors(formType) {
    const prefix = formType === 'edit' ? 'edit-' : '';
    const errorElements = document.querySelectorAll(`[id$="-error"]`);
    errorElements.forEach(el => {
      if (el.id.startsWith(prefix)) {
        el.textContent = '';
        el.classList.add('hidden');
      }
    });
  }

  // Show toast notification
  showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Hide and remove toast
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Handle authentication error
  handleAuthenticationError() {
    this.token = '';
    localStorage.removeItem('adminToken');
    this.showLogin();
    this.showToast('Session expired. Please log in again.', 'warning');
  }

  // Sanitize input
  sanitize(input) {
    if (!input) return '';
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  // Handle modal close
  handleModalClose(event) {
    if (event.target.classList.contains('modal')) {
      this.closeModal(event.target.id);
    }
  }

  // Close modal
  closeModal(modalId) {
    console.log('🚪 Closing modal:', modalId);
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
      modal.style.display = 'none';
      console.log('🚪 Modal closed:', modalId);
    } else {
      console.error('❌ Modal not found:', modalId);
    }
  }

  // Show loading overlay
  showLoadingOverlay() {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.remove('hidden');
    }
  }

  // Hide loading overlay
  hideLoadingOverlay() {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.add('hidden');
    }
  }

  // Open garment detail
  openGarmentDetail(garment) {
    if (!this.detailModal) return;
    
    // Populate detail modal
    const detailImage = document.getElementById('garment-detail-image');
    const detailType = document.getElementById('garment-detail-type');
    const detailCategory = document.getElementById('garment-detail-category');
    const detailColor = document.getElementById('garment-detail-color');

    const detailViews = document.getElementById('garment-detail-views');
    const detailDescription = document.getElementById('garment-detail-description');
    const detailCreated = document.getElementById('garment-detail-created');
    const detailUpdated = document.getElementById('garment-detail-updated');
    
    if (detailImage) detailImage.src = garment.url || 'https://via.placeholder.com/400x400?text=No+Image';
    if (detailType) detailType.textContent = garment.type;
    if (detailCategory) detailCategory.textContent = garment.category;
    if (detailColor) detailColor.textContent = garment.color;

    if (detailViews) detailViews.textContent = garment.views || 0;
    if (detailDescription) detailDescription.textContent = garment.description || 'No description available';
    if (detailCreated) detailCreated.textContent = new Date(garment.created_at).toLocaleDateString();
    if (detailUpdated) detailUpdated.textContent = new Date(garment.updated_at).toLocaleDateString();
    
    // Set up action buttons
    const editBtn = document.getElementById('edit-garment-detail-btn');
    const deleteBtn = document.getElementById('delete-garment-detail-btn');
    
    if (editBtn) {
      editBtn.onclick = () => {
        this.closeModal('garment-detail-modal');
        this.openEditModal(garment.id);
      };
    }
    
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        this.closeModal('garment-detail-modal');
        this.showDeleteConfirmation(garment.id);
      };
    }
    
    // Show modal
    this.detailModal.classList.add('show');
  }

  // Open edit modal
  async openEditModal(garmentId) {
    try {
      console.log('🚀 Opening edit modal for garment:', garmentId);
      
      const response = await fetch(`${this.API_URL}/garments/${garmentId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.token}` },
        credentials: 'include'
      });
      
      console.log('📡 Edit modal API response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch garment: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('📦 Edit modal API response data:', result);
      const garment = result.garment;
      
      if (garment) {
        console.log('✅ Garment found, populating edit form:', garment);
        this.populateEditForm(garment);
        if (this.editModal) {
          console.log('📋 Showing edit modal');
          this.editModal.classList.add('show');
          this.editModal.style.display = 'flex';
          this.editModal.style.zIndex = '9999';
          console.log('📋 Edit modal display set to flex, classes:', this.editModal.className);
          console.log('📋 Edit modal computed styles:', {
            display: window.getComputedStyle(this.editModal).display,
            visibility: window.getComputedStyle(this.editModal).visibility,
            opacity: window.getComputedStyle(this.editModal).opacity,
            zIndex: window.getComputedStyle(this.editModal).zIndex
          });
        } else {
          console.error('❌ Edit modal element not found');
        }
      } else {
        throw new Error('Garment not found');
      }
    } catch (error) {
      console.error('❌ Error opening edit modal:', error);
      this.showToast(`Error: ${error.message}`, 'error');
    }
  }

  // Populate edit form
  populateEditForm(garment) {
    const editId = document.getElementById('edit-garment-id');
    const editName = document.getElementById('edit-garment_name');
    const editCategory = document.getElementById('edit-category');
    const editType = document.getElementById('edit-garment_type');
    const editColor = document.getElementById('edit-color');

    const editDescription = document.getElementById('edit-description');
    
    if (editId) editId.value = garment.id;
    if (editName) editName.value = garment.name || '';
    if (editCategory) editCategory.value = garment.category;
    if (editType) editType.value = garment.type;
    if (editColor) editColor.value = garment.color;

    if (editDescription) editDescription.value = garment.description || '';
    
    // Update color picker
    if (this.editColorPicker && garment.color) {
      const colorName = garment.color.toLowerCase();
      const colorMap = {
        'black': '#000000', 'white': '#ffffff', 'red': '#ff0000', 'green': '#00ff00',
        'blue': '#0000ff', 'yellow': '#ffff00', 'orange': '#ffa500', 'purple': '#800080',
        'pink': '#ffc0cb', 'brown': '#a52a2a', 'gray': '#808080', 'grey': '#808080'
      };
      
      if (colorMap[colorName]) {
        this.editColorPicker.value = colorMap[colorName];
      }
    }
  }

  // Show delete confirmation
  showDeleteConfirmation(garmentId) {
    console.log('🗑️ Showing delete confirmation for garment:', garmentId);
    
    if (!this.deleteModal) {
      console.error('❌ Delete modal element not found');
      return;
    }
    
    const confirmDelete = document.getElementById('confirm-delete');
    if (confirmDelete) {
      console.log('✅ Delete confirmation button found, setting up click handler');
      confirmDelete.onclick = () => {
        console.log('🗑️ Delete confirmed for garment:', garmentId);
        this.deleteGarment(garmentId);
        this.closeModal('delete-confirmation-modal');
      };
    } else {
      console.error('❌ Delete confirmation button not found');
    }
    
    console.log('📋 Showing delete confirmation modal');
    this.deleteModal.classList.add('show');
    this.deleteModal.style.display = 'flex';
    this.deleteModal.style.zIndex = '9999';
    console.log('📋 Delete modal display set to flex, classes:', this.deleteModal.className);
    console.log('📋 Delete modal computed styles:', {
      display: window.getComputedStyle(this.deleteModal).display,
      visibility: window.getComputedStyle(this.deleteModal).visibility,
      opacity: window.getComputedStyle(this.deleteModal).opacity,
      zIndex: window.getComputedStyle(this.deleteModal).zIndex
    });
  }

  // Delete garment
  async deleteGarment(garmentId) {
    console.log('🗑️ Starting delete process for garment:', garmentId);
    
    if (!confirm('Are you sure you want to delete this garment? This action cannot be undone and will remove the garment from both the database and cloud storage.')) {
      console.log('❌ Delete cancelled by user');
      return;
    }
    
    try {
      console.log('⏳ Showing loading overlay');
      this.showLoadingOverlay();
      
      console.log('📡 Sending delete request to:', `${this.API_URL}/garments/admin/${garmentId}`);
      const response = await fetch(`${this.API_URL}/garments/admin/${garmentId}`, {
        method: 'DELETE',
        headers: { 
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
      
      console.log('📡 Delete API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Delete API error:', response.status, errorText);
        throw new Error(`HTTP error: ${response.status} - ${errorText || response.statusText}`);
      }
      
      const result = await response.json();
      console.log('📦 Delete API response data:', result);
      
      if (result.success) {
        console.log('✅ Delete successful, showing success message');
        this.showToast('Garment deleted successfully from database and cloud storage', 'success');
        console.log('🔄 Refreshing garments list');
        await this.fetchGarments();
      } else {
        console.error('❌ Delete failed:', result.error);
        throw new Error(result.error || 'Failed to delete garment');
      }
    } catch (error) {
      console.error('Error deleting garment:', error);
      this.showToast(`Error deleting garment: ${error.message}`, 'error');
      
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        this.handleAuthenticationError();
      }
    } finally {
      this.hideLoadingOverlay();
    }
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.adminDashboard = new AdminDashboard();
});

// Export for global access
window.AdminDashboard = AdminDashboard;

// Export garment functions for global access
window.openEditGarmentModal = (garmentId) => {
  if (window.adminDashboard) {
    window.adminDashboard.openEditModal(garmentId);
  } else {
    console.error('AdminDashboard not initialized');
  }
};

window.deleteGarment = (garmentId) => {
  if (window.adminDashboard) {
    window.adminDashboard.deleteGarment(garmentId);
  } else {
    console.error('AdminDashboard not initialized');
  }
};
