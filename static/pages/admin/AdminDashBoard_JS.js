// JavaScript functions for the Admin Dashboard Garment Management

// Validation function for garment forms
function validateGarmentForm(formId = 'create-garment-form') {
  debugLog(`Starting garment form validation for ${formId}`);
  const errors = {};
  const prefix = formId === 'edit-garment-form' ? 'edit-' : '';
  
  // Get form field values (only for fields that exist)
  const categoryField = document.getElementById(`${prefix}category`);
  const typeField = document.getElementById(`${prefix}garment_type`);
  const colorField = document.getElementById(`${prefix}color`);
  const imageField = document.getElementById(`${prefix}garment_image`);
  
  debugLog('Garment form fields found:', {
    categoryField: !!categoryField,
    typeField: !!typeField,
    colorField: !!colorField,
    imageField: !!imageField
  });

  // Check if required fields exist
  if (!categoryField) errors.category = 'Category field not found';
  if (!typeField) errors.garment_type = 'Type field not found';
  if (!colorField) errors.color = 'Color field not found';
  if (formId === 'create-garment-form' && !imageField) errors.garment_image = 'Image field not found';
  
  const requiredFieldsPresent = Object.keys(errors).length === 0;
  debugLog(`Required fields present: ${requiredFieldsPresent}`, errors);

  if (!requiredFieldsPresent) {
    logClientAction('garment_form_validation_error', { form: formId, errors, stage: 'missing_fields' });
    document.querySelectorAll(`#${formId} .form-error`).forEach(el => el.textContent = '');
    Object.keys(errors).forEach(key => {
      const errorElement = document.getElementById(`${prefix}${key}-error`);
      if (errorElement) errorElement.textContent = errors[key];
    });
    return false;
  }

  // Extract values
  const category = categoryField.value;
  const type = typeField.value.trim();
  const color = colorField.value.trim();
  const hasImage = imageField && imageField.files.length > 0;
  
  debugLog('Garment values extracted:', {
    category,
    type,
    color,
    hasImage
  });

  // Validate values
  if (!category) errors.category = 'Category is required';
  if (!type) errors.garment_type = 'Type is required';
  if (!color) errors.color = 'Color is required';
  if (formId === 'create-garment-form' && !hasImage) errors.garment_image = 'Garment image is required';

  const validationPassed = Object.keys(errors).length === 0;
  debugLog(`Validation passed: ${validationPassed}`, errors);
  
  if (!validationPassed) {
    logClientAction('garment_form_validation_error', { form: formId, errors, stage: 'validation' });
  }

  // Display errors
  document.querySelectorAll(`#${formId} .form-error`).forEach(el => el.textContent = '');
  Object.keys(errors).forEach(key => {
    const errorElement = document.getElementById(`${prefix}${key}-error`);
    if (errorElement) errorElement.textContent = errors[key];
  });

  return validationPassed;
}

// Fetch all garments
async function fetchGarments() {
  const tableSpinner = document.getElementById('table-spinner');
  const noGarments = document.getElementById('no-garments');
  const garmentsCards = document.getElementById('garments-cards');
  const garmentsCardsContainer = document.getElementById('garments-cards-container');
  
  showElement(tableSpinner);
  hideElement(noGarments);
  hideElement(garmentsCards);
  garmentsCardsContainer.innerHTML = '';
  debugLog('Fetching garments with token:', token ? `${token.substring(0, 5)}...` : 'none');

  try {
    const response = await fetch(`${API_URL}/garments/admin/all`, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include'
    });
    
    debugLog('Fetch garments response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      debugLog('Error response body:', errorText);
      throw new Error(`HTTP error: ${response.status} - ${errorText || response.statusText}`);
    }
    
    let result;
    try {
      const responseText = await response.text();
      debugLog('Raw response:', responseText);
      result = JSON.parse(responseText);
      debugLog('Parsed garments result:', result);
    } catch (parseError) {
      debugLog('Failed to parse response:', parseError);
      throw new Error(`Failed to parse response: ${parseError.message}`);
    }
    
    if (!result || !Array.isArray(result.garments)) {
      debugLog('Invalid response format:', result);
      throw new Error('Invalid response format - garments data not found');
    }
    
    const garments = result.garments || [];
    if (garments.length === 0) {
      showElement(noGarments);
    } else {
      garments.forEach(garment => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer overflow-hidden';
        card.dataset.garmentId = garment.id;
        
        // Format date
        const createdDate = new Date(garment.created_at).toLocaleDateString();
        
        // Status badge styling
        let statusClass = 'bg-gray-100 text-gray-800';
        if (garment.status === 'approved') statusClass = 'bg-green-100 text-green-800';
        else if (garment.status === 'pending') statusClass = 'bg-yellow-100 text-yellow-800';
        else if (garment.status === 'rejected') statusClass = 'bg-red-100 text-red-800';
        
        card.innerHTML = `
          <div class="aspect-square bg-gray-100 overflow-hidden">
            ${garment.url ? 
              `<img src="${sanitize(garment.url)}" alt="${sanitize(garment.type)}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300" onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'">` : 
              '<div class="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500"><svg class="w-16 h-16" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg></div>'
            }
          </div>
          <div class="p-4">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-semibold text-gray-800 truncate flex-1 pr-2 capitalize">${sanitize(garment.type)}</h3>
              <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass} flex-shrink-0">${sanitize(garment.status)}</span>
            </div>
            <p class="text-sm text-gray-600 mb-1 capitalize">${sanitize(garment.category)} • ${sanitize(garment.color)}</p>
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-500">${garment.views || 0} views</span>
            </div>
            <div class="flex items-center mt-2 text-xs text-gray-500">
              <span class="flex items-center">
                <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path>
                </svg>
                ${createdDate}
              </span>
            </div>
            <div class="flex space-x-2 mt-3">
              <button class="edit-garment-card-btn flex-1 bg-blue-50 text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-100 transition-colors" data-garment-id="${sanitize(garment.id)}">
                Edit
              </button>
              <button class="delete-garment-card-btn flex-1 bg-red-50 text-red-600 px-3 py-1 rounded text-sm hover:bg-red-100 transition-colors" data-garment-id="${sanitize(garment.id)}">
                Delete
              </button>
            </div>
          </div>
        `;
        
        // Add click event to open detail modal (if function exists)
        card.addEventListener('click', (e) => {
          // Don't open modal if clicking on edit/delete buttons
          if (!e.target.closest('.edit-garment-card-btn') && !e.target.closest('.delete-garment-card-btn')) {
            if (window.openGarmentDetailModal) {
              window.openGarmentDetailModal(garment);
            }
          }
        });
        
        garmentsCardsContainer.appendChild(card);
      });
      
      // Add event listeners for action buttons
      document.querySelectorAll('.edit-garment-card-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openEditGarmentModal(btn.dataset.garmentId);
        });
      });
      
      document.querySelectorAll('.delete-garment-card-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteGarment(btn.dataset.garmentId);
        });
      });
      
      showElement(garmentsCards);
    }
  } catch (err) {
    console.error('Error fetching garments:', err);
    showError(formError, `Failed to fetch garments: ${err.message}`);
    
    if (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('403') || err.message.includes('Forbidden')) {
      debugLog('Authentication error detected, clearing token and showing login screen');
      token = '';
      localStorage.removeItem('adminToken');
      showElement(loginScreen);
      hideElement(dashboardScreen);
    }
  } finally {
    hideElement(tableSpinner);
  }
}

// Open edit garment modal
async function openEditGarmentModal(garmentId) {
  clearMessages();
  showElement(editGarmentModal);
  logClientAction('open_edit_garment_modal', { garment_id: garmentId });

  try {
    const response = await fetch(`${API_URL}/garments/${garmentId}`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}` 
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch garment: ${response.status}`);
    }
    
    const result = await response.json();
    const garment = result.garment;
    
    if (garment) {
      document.getElementById('edit-garment-id').value = garment.id;
      document.getElementById('edit-category').value = garment.category;
      document.getElementById('edit-garment_type').value = garment.type;
      document.getElementById('edit-color').value = garment.color;
      document.getElementById('edit-size').value = garment.size || '';
      document.getElementById('edit-description').value = garment.description || '';
      
      // Update color picker to match the color value
      const editColorPicker = document.getElementById('edit-color-picker');
      if (editColorPicker && garment.color) {
        // Try to find a matching hex color for the color name
        const colorName = garment.color.toLowerCase();
        let hexColor = '#000000'; // default to black
        
        // Simple color name to hex mapping for common colors
        const colorMap = {
          'black': '#000000', 'white': '#ffffff', 'red': '#ff0000', 'green': '#00ff00',
          'blue': '#0000ff', 'yellow': '#ffff00', 'orange': '#ffa500', 'purple': '#800080',
          'pink': '#ffc0cb', 'brown': '#a52a2a', 'gray': '#808080', 'grey': '#808080'
        };
        
        if (colorMap[colorName]) {
          hexColor = colorMap[colorName];
        }
        
        editColorPicker.value = hexColor;
      }
    } else {
      throw new Error('Garment not found');
    }
  } catch (error) {
    console.error('Error opening edit modal:', error);
    showError(editFormError, `Error: ${error.message}`);
  }
}

// Delete garment
async function deleteGarment(garmentId) {
  if (!confirm('Are you sure you want to delete this garment?')) {
    return;
  }
  clearMessages();
  logClientAction('delete_garment_attempt', { garment_id: garmentId });
  debugLog('Attempting to delete garment:', garmentId);

  try {
    const response = await fetch(`${API_URL}/garments/admin/${garmentId}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      credentials: 'include'
    });
    
    debugLog('Delete response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      debugLog('Error response body:', errorText);
      throw new Error(`HTTP error: ${response.status} - ${errorText || response.statusText}`);
    }
    
    const result = await response.json();
    debugLog('Delete result:', result);
    
    if (result.success) {
      showSuccess(formSuccess, 'Garment deleted successfully');
      logClientAction('delete_garment_success', { garment_id: garmentId });
      fetchGarments();
    } else {
      throw new Error(result.error || 'Failed to delete garment');
    }
  } catch (err) {
    showError(formError, `Error deleting garment: ${err.message}`);
    logClientAction('delete_garment_error', { message: err.message, garment_id: garmentId });
    
    if (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('403') || err.message.includes('Forbidden')) {
      debugLog('Authentication error detected during delete, clearing token and showing login screen');
      token = '';
      localStorage.removeItem('adminToken');
      showElement(loginScreen);
      hideElement(dashboardScreen);
    }
  }
}

// Export functions to global scope
window.validateGarmentForm = validateGarmentForm;
window.fetchGarments = fetchGarments;
window.openEditGarmentModal = openEditGarmentModal;
window.deleteGarment = deleteGarment;
