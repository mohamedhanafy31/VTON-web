/**
 * UI Controller
 * Manages all UI interactions, notifications, and page navigation
 */

const UIController = (() => {
  // Private variables
  const pages = document.querySelectorAll('.page');
  const steps = document.querySelectorAll('.step');
  const progressStepper = document.querySelector('.progress-stepper');
  let currentPage = 1;
  let isDarkMode = localStorage.getItem('darkMode') === 'true';
  
  // Initialize UI state
  const initialize = () => {
    // Set initial theme
    applyTheme();
    
    // Set up page transition handlers
    setupNavigation();
    
    // Event delegation for tooltips and help icons
    addTooltipsAndHelp();
  };
  
  // Toggle dark/light theme
  const toggleTheme = () => {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    applyTheme();
    showToast(`Switched to ${isDarkMode ? 'dark' : 'light'} mode`, 'success');
  };
  
  // Apply current theme to document
  const applyTheme = () => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.innerHTML = `<i class="fas fa-${isDarkMode ? 'sun' : 'moon'}"></i>`;
    }
  };
  
  // Toast notification system
  const showToast = (message, type = 'info', duration = CONFIG.ui.toastDuration.default) => {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');
    const toastClose = document.getElementById('toastClose');

    if (window.toastTimeout) {
      clearTimeout(window.toastTimeout);
    }

    let iconClass = 'fa-info-circle';
    if (type === 'success') {
      iconClass = 'fa-check-circle';
      duration = duration || CONFIG.ui.toastDuration.success;
    } else if (type === 'error') {
      iconClass = 'fa-exclamation-circle';
      duration = duration || CONFIG.ui.toastDuration.error;
    } else if (type === 'warning') {
      iconClass = 'fa-exclamation-triangle';
      duration = duration || CONFIG.ui.toastDuration.warning;
    }

    toast.className = `toast show toast-${type}`;
    toastMessage.textContent = message;
    toastIcon.className = `fas ${iconClass}`;

    toastClose.onclick = () => {
      toast.className = 'toast';
      if (window.toastTimeout) {
        clearTimeout(window.toastTimeout);
      }
    };

    window.toastTimeout = setTimeout(() => {
      toast.className = 'toast';
    }, duration);
  };
  
  // Show an error message in a specific element
  const showError = (element, message) => {
    if (!element) return;
    
    element.innerHTML = message;
    element.classList.add('visible', 'animate-pulse');
    setTimeout(() => {
      element.classList.remove('animate-pulse');
    }, 2000);
    
    // Add dismiss button if it doesn't exist
    if (!element.querySelector('button')) {
      const dismissBtn = document.createElement('button');
      dismissBtn.className = 'btn btn-sm btn-outline';
      dismissBtn.style.marginTop = '10px';
      dismissBtn.innerHTML = '<i class="fas fa-times"></i> Dismiss';
      dismissBtn.onclick = () => {
        element.classList.remove('visible');
      };
      element.appendChild(dismissBtn);
    }
  };
  
  // Navigate to a specific page
  const showPage = (pageNum) => {
    if (currentPage === 3 && pageNum !== 3) {
      // Stop camera when leaving camera page
      CameraController.stopCamera();
    }

    pages.forEach(page => page.classList.remove('active'));
    steps.forEach(step => step.classList.remove('active'));

    const newPage = document.getElementById(`page${pageNum}`);
    const newStep = document.querySelector(`.step[data-step="${pageNum}"]`);
    
    if (newPage) newPage.classList.add('active');
    if (newStep) newStep.classList.add('active');

    progressStepper.setAttribute('data-progress', pageNum);

    if (pageNum === 3) {
      steps[1].classList.add('completed');
      setTimeout(() => CameraController.initCamera(), 500);
    } else if (pageNum === 4) {
      steps[2].classList.add('completed');
      TryOnService.fetchAndUpdateTrialCount();
    }

    currentPage = pageNum;
  };
  
  // Get current page number
  const getCurrentPage = () => currentPage;
  
  // Setup page navigation event handlers
  const setupNavigation = () => {
    // Next buttons
    document.getElementById('toPage2')?.addEventListener('click', (event) => {
      event.preventDefault();
      if (!AppState.selectedStore) {
        showToast('Please select a store first', 'error');
        return;
      }
      showPage(2);
      GarmentService.loadGarments();
    });

    document.getElementById('toPage3')?.addEventListener('click', (event) => {
      event.preventDefault();
      if (!AppState.selectedGarment) {
        showToast('Please select a garment first', 'error');
        return;
      }
      showPage(3);
    });

    document.getElementById('toPage4')?.addEventListener('click', (event) => {
      event.preventDefault();
      if (!AppState.userPhotoUrl) {
        showToast('Please capture a photo first', 'error');
        return;
      }
      showPage(4);
    });

    // Back buttons
    document.getElementById('backToPage1')?.addEventListener('click', (event) => {
      event.preventDefault();
      showPage(1);
    });
    
    document.getElementById('backToPage2')?.addEventListener('click', (event) => {
      event.preventDefault();
      showPage(2);
    });
    
    document.getElementById('backToPage3')?.addEventListener('click', (event) => {
      event.preventDefault();
      showPage(3);
    });
    
    // Start over button
    document.getElementById('startOver')?.addEventListener('click', (event) => {
      event.preventDefault();
      AppState.resetState();
      
      const buttons = ['toPage2', 'toPage3', 'toPage4'];
      buttons.forEach(id => {
        const button = document.getElementById(id);
        if (button) button.disabled = true;
      });
      
      const elements = ['resultImage', 'resultContainer'];
      elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
      });
      
      const textElements = ['outputId', 'errorMessage'];
      textElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = '';
      });
      
      steps.forEach(s => s.classList.remove('completed'));
      showPage(1);
      StoreService.loadStores();
      showToast('Started over', 'success');
    });
    
    // Theme toggle
    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
  };
  
  // Add tooltips and help icons to UI elements
  const addTooltipsAndHelp = () => {
    // Add tooltips
    const tooltips = [
      { id: 'captureBtn', text: 'Take a photo' },
      { id: 'switchCamera', text: 'Switch camera' },
      { id: 'themeToggle', text: 'Toggle dark/light mode' },
      { id: 'connectWalletBtn', text: 'Connect with account' },
      { id: 'logoutBtn', text: 'Logout from account' }
    ];
    
    tooltips.forEach(({id, text}) => {
      const element = document.getElementById(id);
      if (!element) return;
      
      const tooltip = document.createElement('span');
      tooltip.className = 'tooltip-text';
      tooltip.textContent = text;
      element.classList.add('tooltip');
      element.appendChild(tooltip);
    });
    
    // Add help icons
    const helpIcons = [
      { selector: '#page1 h2', text: 'Select a store to browse their garment collection' },
      { selector: '#page2 h2', text: 'Browse and select a garment to virtually try on' },
      { selector: '#page3 h2', text: 'Make sure you\'re in good lighting and fully visible' },
      { selector: '#page4 h2', text: 'Our AI will create a realistic try-on image for you' }
    ];
    
    helpIcons.forEach(({selector, text}) => {
      const element = document.querySelector(selector);
      if (!element) return;
      
      const helpIcon = document.createElement('i');
      helpIcon.className = 'fas fa-question-circle help-icon tooltip';
      
      const tooltip = document.createElement('span');
      tooltip.className = 'tooltip-text';
      tooltip.textContent = text;
      
      helpIcon.appendChild(tooltip);
      element.appendChild(helpIcon);
    });
  };
  
  // Reset UI elements when starting over
  const resetUI = () => {
    // Reset preview images
    const userPhotoElement = document.getElementById('userPhoto');
    if (userPhotoElement) userPhotoElement.src = '';
    
    const selectedGarmentElement = document.getElementById('selectedGarment');
    if (selectedGarmentElement) selectedGarmentElement.src = '';
    
    // Hide result area
    const resultContainer = document.getElementById('resultContainer');
    if (resultContainer) resultContainer.style.display = 'none';
    
    // Reset progress indicators
    const spinner = document.getElementById('spinner');
    if (spinner) spinner.style.display = 'none';
    
    const progressBarContainer = document.getElementById('progressBarContainer');
    if (progressBarContainer) progressBarContainer.style.display = 'none';
    
    // Clear error messages
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) errorMessage.textContent = '';
  };
  
  // Update user interface based on login state
  const updateUserUI = (isLoggedIn, userAddress) => {
    const userAddressElement = document.getElementById('userAddress');
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (isLoggedIn) {
      if (userAddressElement) userAddressElement.textContent = userAddress;
      if (connectWalletBtn) connectWalletBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
      if (userAddressElement) userAddressElement.textContent = '';
      if (connectWalletBtn) connectWalletBtn.style.display = 'inline-block';
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  };
  
  // Public API
  return {
    initialize,
    showToast,
    showError,
    showPage,
    getCurrentPage,
    updateUserUI,
    resetUI,
    isDarkMode
  };
})(); 