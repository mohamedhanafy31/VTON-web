async function fetchStores() {
    try {
      const snapshot = await db.collection('information').where('access', '==', true).get();
      if (snapshot.empty) {
        console.log('No stores found with access: true');
        return [];
      }
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Fetch stores failed:', error.message, error.code);
      throw error;
    }
  }
  
  async function fetchGarmentsForStore(storeId) {
    try {
      const infoDoc = await db.collection('garments').doc('information').get();
      if (!infoDoc.exists) {
        throw new Error('Garments information document does not exist');
      }
      const allGarments = infoDoc.data();
      return Object.entries(allGarments)
        .filter(([key, value]) => value.store === storeId)
        .map(([key, value]) => ({ id: key, ...value }));
    } catch (error) {
      console.error('Fetch garments failed:', error.message, error.code);
      throw error;
    }
  }