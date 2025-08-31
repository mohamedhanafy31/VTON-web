// Database Models and Schemas
// This file exports all the structured models for the VTON application

export { StoreModel } from './StoreModel.js';
export { GarmentModel } from './GarmentModel.js';
export { UserModel } from './UserModel.js';
export { OrderModel } from './OrderModel.js';
export { TryOnJobModel } from './TryOnJobModel.js';
export { ImageModel } from './ImageModel.js';
export { AdminModel } from './AdminModel.js';

// Database collection names constants
export const COLLECTIONS = {
  STORES: 'stores',
  GARMENTS: 'garments',
  USERS: 'users',
  ORDERS: 'orders',
  TRYON_JOBS: 'tryon_jobs',
  IMAGES: 'images',
  ADMINS: 'admins',
  SESSIONS: 'sessions'
};

// Validation schemas
export const VALIDATION_SCHEMAS = {
  STORE: {
    required: ['store_name', 'email', 'password'],
    optional: ['logo_link', 'specialization', 'access', 'garment_limit', 'tryon_limit', 'created_at', 'updated_at']
  },
  GARMENT: {
    required: ['name', 'store_id', 'type', 'category', 'url', 'public_id'],
    optional: ['color', 'description', 'price', 'tags', 'uploaded_at', 'updated_at']
  },
  USER: {
    required: ['email', 'name', 'phone'],
    optional: ['avatar', 'preferences', 'created_at', 'updated_at']
  },
  ORDER: {
    required: ['user_id', 'store_id', 'garment_id', 'status'],
    optional: ['quantity', 'notes', 'created_at', 'updated_at']
  }
};

