import { GarmentModel } from '../models/index.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

// Import Cloudinary upload functions
import { uploadGarment as uploadToCloudinary } from '../config/cloudinary.js';

// Upload function using Cloudinary with proper folder structure
const uploadFile = async (file, folder = 'general') => {
  try {
    return await uploadToCloudinary(file, folder);
  } catch (error) {
    logger.error('Cloudinary upload failed:', error);
    throw new Error(`Image upload failed: ${error.message}. Please ensure Cloudinary is properly configured.`);
  }
};

// Get all available garments for TryOn
export const getAvailableGarments = async (req, res) => {
  logger.info('GET /garments/available called');
  try {
    const garments = await GarmentModel.findAll(100); // Get up to 100 garments
    
    // Filter out garments without valid images
    const availableGarments = garments.filter(garment => 
      garment.url && garment.url.trim() !== '' && 
      garment.public_id && garment.public_id.trim() !== ''
    );
    
    logger.info(`Found ${availableGarments.length} available garments`);
    
    res.json({
      success: true,
      garments: availableGarments.map(garment => ({
        id: garment.id,
        name: garment.name,
        type: garment.type,
        category: garment.category,
        color: garment.color,
        url: garment.url,
        public_id: garment.public_id,
        description: garment.description,
        price: garment.price,
        tags: garment.tags
      }))
    });
    
  } catch (error) {
    logger.error('Failed to get available garments:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to load garments', details: error.message });
  }
};

// Get garment by ID
export const getGarmentById = async (req, res) => {
  logger.info('GET /garments/:id called', { garmentId: req.params.id });
  try {
    const garment = await GarmentModel.findById(req.params.id);
    
    if (!garment) {
      return res.status(404).json({ error: 'Garment not found' });
    }
    
    res.json({
      success: true,
      garment: {
        id: garment.id,
        name: garment.name,
        type: garment.type,
        category: garment.category,
        color: garment.color,
        url: garment.url,
        public_id: garment.public_id,
        description: garment.description,
        price: garment.price,
        tags: garment.tags
      }
    });
    
  } catch (error) {
    logger.error('Failed to get garment by ID:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to load garment', details: error.message });
  }
};

// Get garments by category
export const getGarmentsByCategory = async (req, res) => {
  logger.info('GET /garments/category/:category called', { category: req.params.category });
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const garments = await GarmentModel.findByCategory(category, limit, offset);
    
    res.json({
      success: true,
      category,
      garments: garments.map(garment => ({
        id: garment.id,
        name: garment.name,
        type: garment.type,
        category: garment.category,
        color: garment.color,
        url: garment.url,
        public_id: garment.public_id,
        description: garment.description,
        price: garment.price,
        tags: garment.tags
      }))
    });
    
  } catch (error) {
    logger.error('Failed to get garments by category:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to load garments', details: error.message });
  }
};

// Search garments
export const searchGarments = async (req, res) => {
  logger.info('GET /garments/search/:query called', { query: req.params.query });
  try {
    const { query } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const garments = await GarmentModel.search(query, limit, offset);
    
    res.json({
      success: true,
      query,
      garments: garments.map(garment => ({
        id: garment.id,
        name: garment.name,
        type: garment.type,
        category: garment.category,
        color: garment.color,
        url: garment.url,
        public_id: garment.public_id,
        description: garment.description,
        price: garment.price,
        tags: garment.tags
      }))
    });
    
  } catch (error) {
    logger.error('Failed to search garments:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to search garments', details: error.message });
  }
};

// Upload new garment (user contribution)
export const uploadGarment = async (req, res) => {
  logger.info('POST /garments/upload called', { userId: req.session.user.userId });
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Garment image is required' });
    }

    const {
      name,
      category,
      type,
      color,
      price,

      description,
      tags
    } = req.body;

    // Validate required fields
    if (!name || !category || !type || !color) {
      return res.status(400).json({ error: 'Name, category, type, and color are required' });
    }

    // Upload image to Cloudinary
    const uploadResult = await uploadFile(req.file, 'general');
    
    // Create garment data
    const garmentData = {
      name: name.trim(),
      category: category.trim(),
      type: type.trim(),
      color: color.trim(),
      price: price ? parseFloat(price) : null,

      description: description ? description.trim() : null,
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      user_id: req.session.user.userId,
      status: 'pending', // New uploads start as pending
      views: 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    logger.info('Creating garment with data:', garmentData);

    const newGarment = await GarmentModel.create(garmentData);
    
    logger.info('Garment uploaded successfully', { 
      garmentId: newGarment.id, 
      userId: req.session.user.userId 
    });
    
    res.status(201).json({
      success: true,
      message: 'Garment uploaded successfully! It will be reviewed by our team.',
      garment: {
        id: newGarment.id,
        name: newGarment.name,
        status: newGarment.status
      }
    });
    
  } catch (error) {
    logger.error('Failed to upload garment:', { error: error.message, stack: error.stack });
    
    // Provide more specific error messages
    if (error.message.includes('User not found')) {
      return res.status(400).json({ error: 'User session is invalid. Please login again.' });
    }
    
    if (error.message.includes('Validation failed')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to upload garment', details: error.message });
  }
};

// Get user's garments
export const getUserGarments = async (req, res) => {
  logger.info('GET /garments/user/:userId called', { userId: req.params.userId });
  try {
    const { userId } = req.params;
    
    // Verify user can only access their own garments
    if (req.session.user.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    logger.info('Fetching garments for user:', userId);
    const garments = await GarmentModel.findByUserId(userId, 100, 0);
    logger.info(`Found ${garments.length} garments for user ${userId}`);
    
    res.json({
      success: true,
      garments: garments.map(garment => ({
        id: garment.id,
        name: garment.name,
        type: garment.type,
        category: garment.category,
        color: garment.color,
        url: garment.url,
        public_id: garment.public_id,
        description: garment.description,
        price: garment.price,

        tags: garment.tags,
        status: garment.status,
        views: garment.views,
        created_at: garment.created_at,
        updated_at: garment.updated_at
      }))
    });
    
  } catch (error) {
    logger.error('Failed to get user garments:', { error: error.message, stack: error.stack });
    
    // Provide more specific error messages
    if (error.message.includes('User ID is required')) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    res.status(500).json({ error: 'Failed to load garments', details: error.message });
  }
};

// Get user's garment statistics
export const getUserGarmentStats = async (req, res) => {
  logger.info('GET /garments/user/:userId/stats called', { userId: req.params.userId });
  try {
    const { userId } = req.params;
    
    // Verify user can only access their own stats
    if (req.session.user.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    logger.info('Fetching garment stats for user:', userId);
    const garments = await GarmentModel.findByUserId(userId, 1000, 0);
    logger.info(`Found ${garments.length} garments for stats calculation`);
    
    const stats = {
      total: garments.length,
      approved: garments.filter(g => g.status === 'approved').length,
      pending: garments.filter(g => g.status === 'pending').length,
      rejected: garments.filter(g => g.status === 'rejected').length,
      totalViews: garments.reduce((sum, g) => sum + (g.views || 0), 0)
    };
    
    logger.info('Calculated stats:', stats);
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    logger.error('Failed to get user garment stats:', { error: error.message, stack: error.stack });
    
    // Provide more specific error messages
    if (error.message.includes('User ID is required')) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    res.status(500).json({ error: 'Failed to load statistics', details: error.message });
  }
};

// Delete garment
export const deleteGarment = async (req, res) => {
  logger.info('DELETE /garments/:id called', { garmentId: req.params.id });
  try {
    const { id } = req.params;
    
    // Get garment to verify ownership
    const garment = await GarmentModel.findById(id);
    if (!garment) {
      return res.status(404).json({ error: 'Garment not found' });
    }
    
    // Verify user can only delete their own garments
    if (garment.user_id !== req.session.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await GarmentModel.delete(id);
    
    logger.info('Garment deleted successfully', { 
      garmentId: id, 
      userId: req.session.user.userId 
    });
    
    res.json({
      success: true,
      message: 'Garment deleted successfully'
    });
    
  } catch (error) {
    logger.error('Failed to delete garment:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to delete garment', details: error.message });
  }
};

// =========================
// ADMIN-ONLY FUNCTIONS
// =========================

// Get all garments (admin only)
export const getAllGarmentsAdmin = async (req, res) => {
  logger.info('GET /garments/admin/all called by admin');
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    const garments = await GarmentModel.findAll(limit, offset);
    
    logger.info(`Admin retrieved ${garments.length} garments`);
    
    res.json({
      success: true,
      garments: garments.map(garment => ({
        id: garment.id,
        name: garment.name,
        type: garment.type,
        category: garment.category,
        color: garment.color,
        url: garment.url,
        public_id: garment.public_id,
        description: garment.description,
        price: garment.price,

        tags: garment.tags,
        status: garment.status,
        views: garment.views,
        user_id: garment.user_id,
        store_id: garment.store_id,
        created_at: garment.created_at,
        updated_at: garment.updated_at,
        uploaded_at: garment.uploaded_at
      }))
    });
    
  } catch (error) {
    logger.error('Failed to get all garments (admin):', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to load garments', details: error.message });
  }
};

// Create garment (admin only)
export const createGarmentAdmin = async (req, res) => {
  logger.info('POST /garments/admin/create called by admin');
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Garment image is required' });
    }

    const {
      name,
      category,
      type,
      color,
      price,

      description,
      tags,
      status = 'approved' // Admin-created garments are auto-approved
    } = req.body;

    // Validate required fields
    if (!category || !type || !color) {
      return res.status(400).json({ error: 'Category, type, and color are required' });
    }

    // Upload image to Cloudinary
    const uploadResult = await uploadFile(req.file, 'general');
    
    // Use provided name if present; otherwise auto-generate from color and type
    const providedName = (name && name.trim().length >= 2) ? name.trim() : null;
    const autoGeneratedName = `${color.trim()} ${type.trim()}`;
    
    // Auto-generate description if empty: {color} {type}
    const autoDescription = description && description.trim() ? description.trim() : autoGeneratedName;
    
    // Create garment data
    const garmentData = {
      name: providedName || autoGeneratedName,
      category: category.trim(),
      type: type.trim(),
      color: color.trim(),
      price: price ? parseFloat(price) : null,

      description: autoDescription,
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      store_id: null, // Admin-created garments don't belong to any store
      user_id: null, // Admin-created garments don't belong to any user
      status: status || 'approved',
      views: 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    logger.info('Admin creating garment with data:', garmentData);

    const newGarment = await GarmentModel.create(garmentData);
    
    logger.info('Garment created successfully by admin', { 
      garmentId: newGarment.id
    });
    
    res.status(201).json({
      success: true,
      message: 'Garment created successfully!',
      garment: {
        id: newGarment.id,
        name: newGarment.name,
        status: newGarment.status,
        url: newGarment.url
      }
    });
    
  } catch (error) {
    logger.error('Failed to create garment (admin):', { error: error.message, stack: error.stack });
    
    // Provide more specific error messages
    if (error.message.includes('Validation failed')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to create garment', details: error.message });
  }
};

// Update garment (admin only)
export const updateGarmentAdmin = async (req, res) => {
  logger.info('PUT /garments/admin/:id called by admin', { garmentId: req.params.id });
  try {
    const { id } = req.params;
    
    // Get garment to verify it exists
    const garment = await GarmentModel.findById(id);
    if (!garment) {
      return res.status(404).json({ error: 'Garment not found' });
    }

    const {
      name,
      category,
      type,
      color,
      price,

      description,
      tags,
      status
    } = req.body;

    // Prepare update data
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (category) updateData.category = category.trim();
    if (type) updateData.type = type.trim();
    if (color) updateData.color = color.trim();
    if (price !== undefined) updateData.price = price ? parseFloat(price) : null;

    if (tags !== undefined) updateData.tags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    if (status) updateData.status = status;
    
    // If name not explicitly provided but any of color/type changed, refresh derived name
    if (!name && (category || type || color)) {
      const currentColor = color || garment.color;
      const currentType = type || garment.type;
      updateData.name = `${currentColor} ${currentType}`;
    }
    
    // Auto-generate description if empty: {color} {type}
    if (description !== undefined) {
      if (description && description.trim()) {
        updateData.description = description.trim();
      } else {
        const currentColor = color || garment.color;
        const currentType = type || garment.type;
        updateData.description = `${currentColor} ${currentType}`;
      }
    }

    // Handle image update if provided
    if (req.file) {
      logger.info('Admin updating garment image', { garmentId: id });
      const uploadResult = await uploadFile(req.file, 'general');
      updateData.url = uploadResult.secure_url;
      updateData.public_id = uploadResult.public_id;
    }

    // Update the garment
    const updatedGarment = await garment.update(updateData);
    
    logger.info('Garment updated successfully by admin', { 
      garmentId: id,
      updateData
    });
    
    res.json({
      success: true,
      message: 'Garment updated successfully',
      garment: {
        id: updatedGarment.id,
        name: updatedGarment.name,
        status: updatedGarment.status,
        url: updatedGarment.url
      }
    });
    
  } catch (error) {
    logger.error('Failed to update garment (admin):', { error: error.message, stack: error.stack });
    
    if (error.message.includes('Validation failed')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update garment', details: error.message });
  }
};

// Delete garment (admin only)
export const deleteGarmentAdmin = async (req, res) => {
  logger.info('DELETE /garments/admin/:id called by admin', { garmentId: req.params.id });
  try {
    const { id } = req.params;
    
    // Get garment to verify it exists
    const garment = await GarmentModel.findById(id);
    if (!garment) {
      return res.status(404).json({ error: 'Garment not found' });
    }

    // Delete from Cloudinary if public_id exists
    if (garment.public_id) {
      try {
        logger.info('Deleting garment image from Cloudinary', { 
          garmentId: id, 
          publicId: garment.public_id 
        });
        
        const cloudinary = req.app.get('cloudinary');
        if (cloudinary) {
          await cloudinary.uploader.destroy(garment.public_id);
          logger.info('Successfully deleted image from Cloudinary', { 
            garmentId: id, 
            publicId: garment.public_id 
          });
        } else {
          logger.warn('Cloudinary not available, skipping image deletion', { garmentId: id });
        }
      } catch (cloudinaryError) {
        logger.error('Failed to delete image from Cloudinary', { 
          garmentId: id, 
          publicId: garment.public_id, 
          error: cloudinaryError.message 
        });
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }

    // Delete from Firebase
    await GarmentModel.delete(id);
    
    logger.info('Garment deleted successfully by admin', { 
      garmentId: id,
      name: garment.name,
      publicId: garment.public_id
    });
    
    res.json({
      success: true,
      message: 'Garment deleted successfully from both database and cloud storage'
    });
    
  } catch (error) {
    logger.error('Failed to delete garment (admin):', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to delete garment', details: error.message });
  }
};
