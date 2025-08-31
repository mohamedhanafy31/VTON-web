/**
 * Authentication Service
 * Handles user authentication and session management
 */
const AuthService = (() => {
  // Private variables
  const config = window.AppConfig;
  
  /**
   * Initializes the authentication service
   */
  function init() {
    console.log('Auth Service initialized');
  }

  /**
   * Logs in with the provided credentials
   * @param {string} username - The username
   * @param {string} password - The password
   * @returns {Promise<Object>} The login result
   */
  async function login(username, password) {
    try {
      const response = await fetch(`${config.API_BASE_URL}/store/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Logs out the current user
   * @returns {Promise<void>}
   */
  async function logout() {
    try {
      const response = await fetch(`${config.API_BASE_URL}/store/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Logout failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Checks if user is currently authenticated
   * @returns {Promise<boolean>} Authentication status
   */
  async function isAuthenticated() {
    try {
      const response = await fetch(`${config.API_BASE_URL}/store/profile`, {
        credentials: 'include'
      });
      
      return response.ok;
    } catch (error) {
      console.error('Auth check error:', error);
      return false;
    }
  }

  // Public API
  return {
    init,
    login,
    logout,
    isAuthenticated
  };
})();

export default AuthService; 