/**
 * Firebase Service
 * Handles all Firebase interactions including initialization and data operations
 */

const FirebaseService = (() => {
  // Private variables
  let db;
  let firebaseInitialized = false;
  
  // Initialize Firebase with error handling
  const initialize = async () => {
    try {
      firebase.initializeApp(CONFIG.firebase);
      db = firebase.firestore();
      
      // Configure offline persistence with a smaller cache size
      db.settings({
        cacheSizeBytes: 5000000 // 5MB
      });
      
      // Set up error handler for Firebase connection issues
      await db.enablePersistence({ synchronizeTabs: true }).catch(err => {
        if (err.code === 'failed-precondition') {
          // Multiple tabs open, persistence can only be enabled in one tab
          console.warn('Firebase persistence failed: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
          // Current browser doesn't support persistence
          console.warn('Firebase persistence not supported in this browser');
        }
      });
      
      // Test Firebase connection
      await db.collection('test').doc('connection').set({
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('Firebase connected successfully');
      firebaseInitialized = true;
      return true;
    } catch (error) {
      console.error('Firebase initialization error:', error);
      UIController.showToast('Using local storage fallback', 'warning', 3000);
      db = null;
      return false;
    }
  };
  
  // Sync local data to Firebase
  const syncLocalDataToFirebase = async () => {
    if (!firebaseInitialized || !db) return false;
    
    try {
      // Get orders from localStorage
      const localOrders = JSON.parse(localStorage.getItem('tryon_orders') || '[]');
      if (localOrders.length === 0) return true; // Nothing to sync
      
      console.log(`Attempting to sync ${localOrders.length} local orders to Firebase`);
      
      let syncCount = 0;
      for (const order of localOrders) {
        try {
          // Remove the local ID
          const { id, ...orderData } = order;
          
          // Convert ISO string timestamp back to Firestore timestamp
          const timestamp = orderData.timestamp ? 
            firebase.firestore.Timestamp.fromDate(new Date(orderData.timestamp)) : 
            firebase.firestore.FieldValue.serverTimestamp();
          
          // Add to Firestore
          await db.collection('stores').doc('orders').collection('orders').add({
            ...orderData,
            timestamp,
            synced_from_local: true
          });
          
          syncCount++;
        } catch (err) {
          console.error('Failed to sync order:', order, err);
        }
      }
      
      if (syncCount > 0) {
        // Clear synced orders
        localStorage.setItem('tryon_orders', JSON.stringify([]));
        console.log(`Successfully synced ${syncCount} orders to Firebase`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error syncing local data to Firebase:', error);
      return false;
    }
  };
  
  // Save user data to Firebase or localStorage
  const saveUserData = async (userData, isOrder = false) => {
    console.log('Saving user data to Firebase:', userData);
    
    if (isOrder) {
      userData.status = 'new';
    }
    
    try {
      // First attempt: Try to use Firebase Firestore
      if (firebase && firebase.firestore && firebaseInitialized) {
        try {
          console.log('Attempting to save to Firebase Firestore:', userData);
          
          // Save order data
          const orderRef = db.collection('stores').doc('orders').collection('orders');
          await orderRef.add({
            ...userData,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          // Create notification if this is a buy request
          if (isOrder) {
            try {
              const notifRef = db.collection('stores').doc('orders').collection('notifications');
              await notifRef.add({
                storeName: userData.storeName,
                message: `${userData.name} wants to buy ${userData.garmentColor} ${userData.garmentType}`,
                customerPhone: userData.phone,
                garmentId: userData.garmentId,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
              });
              console.log('Notification saved to Firebase');
            } catch (notifError) {
              console.warn('Failed to save notification, continuing with order:', notifError);
            }
          }
          
          console.log('Order data saved to Firebase successfully');
          return true;
        } catch (firestoreError) {
          console.error('Firestore error, falling back to local storage:', firestoreError);
        }
      }
      
      // Second attempt: Use localStorage as fallback
      try {
        // Get any existing orders from localStorage
        const existingOrders = JSON.parse(localStorage.getItem('tryon_orders') || '[]');
        
        // Add the new order
        existingOrders.push({
          ...userData,
          id: 'local_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
        });
        
        // Save back to localStorage
        localStorage.setItem('tryon_orders', JSON.stringify(existingOrders));
        console.log('Order saved to localStorage as fallback');
        
        UIController.showToast('Your information is saved locally and will be synced later.', 'info', 5000);
        
        return true;
      } catch (localStorageError) {
        console.error('LocalStorage fallback also failed:', localStorageError);
        throw new Error('Could not save your information. Please try again later.');
      }
    } catch (error) {
      console.error('Error in saveUserData:', error);
      UIController.showToast('Failed to save your details. Please try again.', 'error');
      return false;
    }
  };
  
  // Update user data with result URL
  const updateUserDataWithResult = async (name, phone, resultUrl) => {
    if (!resultUrl || !name || !phone) return;
    
    try {
      console.log('Updating Firebase with result URL:', resultUrl);
      
      if (firebase && firebase.firestore && firebaseInitialized) {
        // Query to find the most recent entry for this user/phone
        const orderRef = db.collection('stores').doc('orders').collection('orders');
        const snapshot = await orderRef
          .where('name', '==', name)
          .where('phone', '==', phone)
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get();
        
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          await doc.ref.update({
            tryonResult: resultUrl,
            resultReceived: true,
            resultTimestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
          console.log('Updated Firebase record with result URL');
          return true;
        } else {
          console.log('No matching document found to update with result URL');
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error('Error updating result URL in Firebase:', error);
      return false;
    }
  };
  
  // Get database instance (for other services to use if needed)
  const getDB = () => db;
  
  // Check if Firebase is initialized
  const isInitialized = () => firebaseInitialized;
  
  // Public API
  return {
    initialize,
    syncLocalDataToFirebase,
    saveUserData,
    updateUserDataWithResult,
    getDB,
    isInitialized
  };
})(); 