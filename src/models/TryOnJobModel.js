import db from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * TryOnJobModel - Manages try-on job entities in the database
 */
export class TryOnJobModel {
  constructor(data) {
    logger.debug('TryOnJobModel constructor called with data:', data);
    
    this.id = data.id || null;
    this.userId = data.userId || data.user_id;
    this.garmentId = data.garmentId || data.garment_id;
    this.status = data.status || 'pending';
    this.category = data.category;
    this.userPhoto = data.userPhoto || data.user_photo;
    this.garmentUrl = data.garmentUrl || data.garment_url;
    // Only set apiJobId if it's provided and not undefined
    if (data.apiJobId !== undefined || data.api_job_id !== undefined) {
      this.apiJobId = data.apiJobId || data.api_job_id;
    }
    // Only set resultUrl if it's provided and not undefined
    if (data.resultUrl !== undefined || data.result_url !== undefined) {
      this.resultUrl = data.resultUrl || data.result_url;
    }
    // Only set error if it's provided and not undefined
    if (data.error !== undefined) {
      this.error = data.error;
    }
    this.createdAt = data.createdAt || data.created_at || new Date();
    this.updatedAt = data.updatedAt || data.updated_at || new Date();
    
    logger.debug('TryOnJobModel instance created:', this);
  }

  /**
   * Validate try-on job data
   */
  validate() {
    const errors = [];
    
    if (!this.userId) errors.push('User ID is required');
    if (!this.garmentId) errors.push('Garment ID is required');
    if (!this.category) errors.push('Category is required');
    if (!this.userPhoto) errors.push('User photo is required');
    if (!this.garmentUrl) errors.push('Garment URL is required');
    
    const validStatuses = ['pending', 'processing', 'completed', 'failed'];
    if (!validStatuses.includes(this.status)) {
      errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    const validCategories = ['upper_body', 'lower_body'];
    if (!validCategories.includes(this.category)) {
      errors.push(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
    }
    
    return errors;
  }

  /**
   * Create a new try-on job
   */
  static async create(jobData) {
    try {
      const job = new TryOnJobModel(jobData);
      const errors = job.validate();
      
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }

      if (!db) {
        throw new Error('Database connection not available');
      }

      const jobRef = db.collection('tryon_jobs').doc();
      const jobDoc = {
        ...job,
        id: jobRef.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await jobRef.set(jobDoc);
      logger.info('Try-on job created successfully', { jobId: jobRef.id });
      
      return { ...jobDoc, id: jobRef.id };
    } catch (error) {
      logger.error('Failed to create try-on job:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find try-on job by ID
   */
  static async findById(jobId) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const jobDoc = await db.collection('tryon_jobs').doc(jobId).get();
      
      if (!jobDoc.exists) {
        return null;
      }

      return { id: jobDoc.id, ...jobDoc.data() };
    } catch (error) {
      logger.error('Failed to find try-on job by ID:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find try-on jobs by user ID
   */
  static async findByUserId(userId, limit = 50, offset = 0) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const jobsSnapshot = await db.collection('tryon_jobs')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      return jobsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Failed to find try-on jobs by user ID:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find try-on jobs by status
   */
  static async findByStatus(status, limit = 50, offset = 0) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const jobsSnapshot = await db.collection('tryon_jobs')
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      return jobsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Failed to find try-on jobs by status:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find try-on job by API Job ID
   */
  static async findByApiJobId(apiJobId) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const jobsSnapshot = await db.collection('tryon_jobs')
        .where('apiJobId', '==', apiJobId)
        .limit(1)
        .get();

      if (jobsSnapshot.empty) {
        return null;
      }

      const doc = jobsSnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      logger.error('Failed to find try-on job by API Job ID:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Update try-on job
   */
  static async update(jobId, updateData) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const jobRef = db.collection('tryon_jobs').doc(jobId);
      const jobDoc = await jobRef.get();
      
      if (!jobDoc.exists) {
        throw new Error('Try-on job not found');
      }

      const updatedData = {
        ...updateData,
        updatedAt: new Date()
      };

      await jobRef.update(updatedData);
      logger.info('Try-on job updated successfully', { jobId });
      
      return { id: jobId, ...jobDoc.data(), ...updatedData };
    } catch (error) {
      logger.error('Failed to update try-on job:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Delete try-on job
   */
  static async delete(jobId) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const jobRef = db.collection('tryon_jobs').doc(jobId);
      const jobDoc = await jobRef.get();
      
      if (!jobDoc.exists) {
        throw new Error('Try-on job not found');
      }

      await jobRef.delete();
      logger.info('Try-on job deleted successfully', { jobId });
      
      return true;
    } catch (error) {
      logger.error('Failed to delete try-on job:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Get try-on job statistics
   */
  static async getStats() {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const jobsSnapshot = await db.collection('tryon_jobs').get();
      const jobs = jobsSnapshot.docs.map(doc => doc.data());

      const stats = {
        total: jobs.length,
        byStatus: {},
        byCategory: {},
        byMonth: {},
        successRate: 0
      };

      let completedCount = 0;
      let failedCount = 0;

      jobs.forEach(job => {
        // Count by status
        stats.byStatus[job.status] = (stats.byStatus[job.status] || 0) + 1;
        
        // Count by category
        stats.byCategory[job.category] = (stats.byCategory[job.category] || 0) + 1;
        
        // Count by month
        const month = new Date(job.createdAt).toISOString().substring(0, 7);
        stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
        
        // Count completed vs failed
        if (job.status === 'completed') completedCount++;
        if (job.status === 'failed') failedCount++;
      });

      // Calculate success rate
      if (jobs.length > 0) {
        stats.successRate = Math.round((completedCount / jobs.length) * 100);
      }

      logger.info('Try-on job statistics retrieved successfully');
      return stats;
    } catch (error) {
      logger.error('Failed to get try-on job statistics:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Get user's daily try-on count
   */
  static async getUserDailyCount(userId) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const jobsSnapshot = await db.collection('tryon_jobs')
        .where('userId', '==', userId)
        .where('createdAt', '>=', today)
        .get();

      return jobsSnapshot.size;
    } catch (error) {
      logger.error('Failed to get user daily try-on count:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Find try-on job by API job ID (from Artificial Studio)
   * @param {string} apiJobId - API job ID from Artificial Studio
   * @returns {Promise<Object|null>} Try-on job data or null if not found
   */
  static async findByApiJobId(apiJobId) {
    try {
      if (!db) {
        throw new Error('Database connection not available');
      }

      logger.debug('Finding try-on job by API job ID', { apiJobId });

      const jobsSnapshot = await db.collection('tryon_jobs')
        .where('apiJobId', '==', apiJobId)
        .limit(1)
        .get();

      if (jobsSnapshot.empty) {
        logger.warn('No try-on job found for API job ID', { apiJobId });
        return null;
      }

      const jobDoc = jobsSnapshot.docs[0];
      const jobData = jobDoc.data();

      logger.debug('Found try-on job by API job ID', { 
        apiJobId, 
        jobId: jobDoc.id,
        status: jobData.status 
      });

      return {
        id: jobDoc.id,
        ...jobData,
        createdAt: jobData.createdAt?.toDate?.() || jobData.createdAt,
        updatedAt: jobData.updatedAt?.toDate?.() || jobData.updatedAt
      };
    } catch (error) {
      logger.error('Failed to find try-on job by API job ID:', { 
        apiJobId,
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }
}


