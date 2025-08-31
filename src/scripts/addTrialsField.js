import db from '../config/db.js';
import logger from '../utils/logger.js';

const COLLECTIONS = {
  USERS: 'users'
};

async function addTrialsFieldToUsers() {
  const operationId = logger.startOperation('add-trials-field-migration');
  
  try {
    logger.info('Starting migration: Adding trials_remaining field to all users');
    
    // Get all users
    const usersSnapshot = await db.collection(COLLECTIONS.USERS).get();
    
    if (usersSnapshot.empty) {
      logger.info('No users found in database');
      return;
    }
    
    logger.info(`Found ${usersSnapshot.size} users to update`);
    
    const batch = db.batch();
    let updatedCount = 0;
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      
      // Check if trials_remaining field already exists
      if (userData.trials_remaining === undefined) {
        // Add trials_remaining field with default value 50
        batch.update(doc.ref, {
          trials_remaining: 50,
          updated_at: new Date()
        });
        updatedCount++;
        logger.info(`User ${doc.id} will be updated with trials_remaining: 50`);
      } else {
        logger.info(`User ${doc.id} already has trials_remaining: ${userData.trials_remaining}`);
      }
    });
    
    if (updatedCount > 0) {
      // Commit the batch
      await batch.commit();
      logger.info(`Successfully updated ${updatedCount} users with trials_remaining field`);
    } else {
      logger.info('No users needed updates');
    }
    
    logger.succeedOperation(operationId, 'add-trials-field-migration', {
      totalUsers: usersSnapshot.size,
      updatedUsers: updatedCount
    });
    
  } catch (error) {
    logger.error('Migration failed:', error);
    logger.failOperation(operationId, 'add-trials-field-migration', error);
    throw error;
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addTrialsFieldToUsers()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default addTrialsFieldToUsers;
