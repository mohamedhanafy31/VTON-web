import dotenv from 'dotenv';
import logger from './logger.js';

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration validation utility
 * Validates that all required environment variables are present
 */

const requiredEnvVars = {
  // Server configuration
  PORT: {
    required: false,
    default: '3000',
    description: 'Server port'
  },
  NODE_ENV: {
    required: false,
    default: 'development',
    description: 'Node environment'
  },
  SESSION_SECRET: {
    required: true,
    description: 'Session secret key for security'
  },

  // Firebase configuration
  GOOGLE_APPLICATION_CREDENTIALS: {
    required: false,
    default: './serviceAccountKey.json',
    description: 'Path to Firebase service account key'
  },

  // Cloudinary configuration (required in development)
  CLOUDINARY_CLOUD_NAME: {
    required: true,
    description: 'Cloudinary cloud name for image storage'
  },
  CLOUDINARY_API_KEY: {
    required: true,
    description: 'Cloudinary API key'
  },
  CLOUDINARY_API_SECRET: {
    required: true,
    description: 'Cloudinary API secret'
  },

  // Try-On API configuration
  TRYON_API_KEY: {
    required: true,
    description: 'Artificial Studio API key for virtual try-on'
  },

  // Public URL configuration
  PUBLIC_URL: {
    required: false,
    default: 'http://localhost:3000',
    description: 'Public URL for webhooks and external services'
  }
};

/**
 * Validates environment configuration
 * @returns {Object} Validation result
 */
export function validateConfig() {
  const errors = [];
  const warnings = [];
  const config = {};

  for (const [key, settings] of Object.entries(requiredEnvVars)) {
    const value = process.env[key];

    if (!value) {
      if (settings.required) {
        errors.push({
          variable: key,
          message: `Required environment variable ${key} is missing`,
          description: settings.description
        });
      } else if (settings.default) {
        warnings.push({
          variable: key,
          message: `Using default value for ${key}: ${settings.default}`,
          description: settings.description
        });
        config[key] = settings.default;
      } else {
        warnings.push({
          variable: key,
          message: `Optional environment variable ${key} is not set`,
          description: settings.description
        });
      }
    } else {
      config[key] = value;
    }
  }

  // Additional validation
  if (config.NODE_ENV === 'production') {
    // In production, Cloudinary is recommended but not required
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      warnings.push({
        variable: 'CLOUDINARY_CLOUD_NAME',
        message: 'Cloudinary not configured - using local file storage in production',
        description: 'Consider setting up Cloudinary for production image storage'
      });
    }

    if (process.env.SESSION_SECRET === 'your_super_secure_session_secret_key_change_this_in_production') {
      errors.push({
        variable: 'SESSION_SECRET',
        message: 'Default session secret detected in production',
        description: 'Change SESSION_SECRET to a secure random string'
      });
    }
  } else {
    // In development, Cloudinary is required
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      errors.push({
        variable: 'CLOUDINARY_*',
        message: 'Cloudinary configuration is required in development mode',
        description: 'Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config
  };
}

/**
 * Logs configuration validation results
 * @param {Object} validation - Validation result
 */
export function logConfigValidation(validation) {
  if (validation.isValid) {
    logger.info('Configuration validation passed', {
      warningCount: validation.warnings.length
    });
  } else {
    logger.error('Configuration validation failed', {
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length
    });
  }

  // Log errors
  validation.errors.forEach(error => {
    logger.error('Configuration error', error);
  });

  // Log warnings
  validation.warnings.forEach(warning => {
    logger.warn('Configuration warning', warning);
  });
}

/**
 * Validates configuration and exits if invalid
 */
export function validateConfigOrExit() {
  const validation = validateConfig();
  logConfigValidation(validation);

  if (!validation.isValid) {
    logger.error('Server cannot start due to configuration errors');
    process.exit(1);
  }

  return validation.config;
}

export default {
  validateConfig,
  logConfigValidation,
  validateConfigOrExit
};
