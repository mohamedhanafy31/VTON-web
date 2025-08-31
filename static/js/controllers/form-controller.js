/**
 * Form Controller
 * Handles form validation, submission, and user data collection
 */
const FormController = (() => {
  // Private variables
  const validators = {
    email: (value) => {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(value) ? null : 'Please enter a valid email address';
    },
    required: (value) => {
      return value && value.trim() !== '' ? null : 'This field is required';
    },
    phone: (value) => {
      const regex = /^\+?[0-9]{10,15}$/;
      return regex.test(value) ? null : 'Please enter a valid phone number';
    },
    minLength: (length) => (value) => {
      return value && value.length >= length ? null : `Must be at least ${length} characters`;
    }
  };
  
  /**
   * Initializes the form controller
   */
  function init() {
    console.log('Form Controller initialized');
  }

  /**
   * Validates a form element
   * @param {HTMLElement} element - The form element to validate
   * @returns {string|null} Error message or null if valid
   */
  function validateElement(element) {
    const value = element.value;
    const validations = element.dataset.validate ? element.dataset.validate.split(' ') : [];
    
    for (const validation of validations) {
      if (validation === 'required') {
        const error = validators.required(value);
        if (error) return error;
      } else if (validation === 'email') {
        const error = validators.email(value);
        if (error) return error;
      } else if (validation === 'phone') {
        const error = validators.phone(value);
        if (error) return error;
      } else if (validation.startsWith('minLength:')) {
        const length = parseInt(validation.split(':')[1]);
        const error = validators.minLength(length)(value);
        if (error) return error;
      }
    }
    
    return null;
  }

  /**
   * Validates a form
   * @param {HTMLFormElement} form - The form to validate
   * @returns {Object} Validation result { isValid, errors }
   */
  function validateForm(form) {
    const elements = form.querySelectorAll('[data-validate]');
    const errors = {};
    let isValid = true;
    
    elements.forEach(element => {
      const error = validateElement(element);
      if (error) {
        errors[element.name] = error;
        isValid = false;
      }
    });
    
    return { isValid, errors };
  }

  /**
   * Collects form data
   * @param {HTMLFormElement} form - The form to collect data from
   * @returns {Object} The form data as an object
   */
  function collectFormData(form) {
    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }
    
    return data;
  }

  /**
   * Displays form errors
   * @param {HTMLFormElement} form - The form to display errors for
   * @param {Object} errors - The errors to display
   */
  function displayErrors(form, errors) {
    // Reset previous errors
    form.querySelectorAll('.error-message').forEach(el => el.remove());
    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    
    // Display new errors
    for (const [field, message] of Object.entries(errors)) {
      const element = form.querySelector(`[name="${field}"]`);
      if (element) {
        element.classList.add('is-invalid');
        
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message text-danger mt-1';
        errorElement.textContent = message;
        
        element.parentNode.appendChild(errorElement);
      }
    }
  }

  /**
   * Handles form submission
   * @param {HTMLFormElement} form - The form being submitted
   * @param {Function} submitCallback - Callback to handle form data
   * @param {Function} errorCallback - Callback to handle validation errors
   */
  function handleSubmit(form, submitCallback, errorCallback) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      
      const { isValid, errors } = validateForm(form);
      
      if (isValid) {
        const data = collectFormData(form);
        submitCallback(data);
      } else {
        displayErrors(form, errors);
        if (errorCallback) {
          errorCallback(errors);
        }
      }
    });
  }

  // Public API
  return {
    init,
    validateElement,
    validateForm,
    collectFormData,
    displayErrors,
    handleSubmit
  };
})();

export default FormController; 