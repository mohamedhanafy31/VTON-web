/**
 * Virtual Try-On Backend Functions
 * This file contains the client-side functions that interact with the server APIs.
 */

// Fetch available stores
async function fetchStores() {
  try {
    console.log("Fetching available stores...");
    const response = await fetch('/active-stores', {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch stores: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("Stores fetched successfully:", data.stores);
    return data.stores || [];
  } catch (error) {
    console.error("Error fetching stores:", error);
    throw error;
  }
}

// Fetch garments for a specific store
async function fetchGarmentsForStore(storeId) {
  try {
    console.log(`Fetching garments for store: ${storeId}`);
    // Get garments from Firestore directly or via API
    const response = await fetch(`/store/garments/${storeId}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch garments: ${response.status} ${response.statusText}`);
    }
    
    const garments = await response.json();
    console.log(`Found ${garments.length} garments for store ${storeId}`);
    return garments;
  } catch (error) {
    console.error(`Error fetching garments for store ${storeId}:`, error);
    
    // Fallback to Firestore if available
    try {
      if (firebase && firebase.firestore) {
        const snapshot = await firebase.firestore().collection('garments').doc('information').get();
        
        if (!snapshot.exists) {
          console.log("No garments found in Firestore");
          return [];
        }
        
        const garmentData = snapshot.data();
        const garments = Object.entries(garmentData)
          .filter(([_, data]) => data.store === storeId)
          .map(([id, data]) => ({
            id,
            url: data.url,
            public_id: data.public_id,
            color: data.color,
            name: data.name || `${data.color} ${data.type}`,
            type: data.type,
            category: data.category || determineCategory(data.type)
          }));
        
        console.log(`Found ${garments.length} garments in Firestore for store ${storeId}`);
        return garments;
      }
    } catch (fbError) {
      console.error("Firestore fallback error:", fbError);
    }
    
    throw error;
  }
}

// Helper function to determine category based on garment type if not specified
function determineCategory(type) {
  if (!type) return 'upper_body'; // Default
  
  type = type.toLowerCase();
  if (['shirt', 't-shirt', 'jacket', 'sweater', 'top', 'blouse'].includes(type)) {
    return 'upper_body';
  } else if (['pants', 'jeans', 'shorts', 'skirt'].includes(type)) {
    return 'lower_body';
  } else if (['dress'].includes(type)) {
    return 'dress';
  }
  return 'upper_body'; // Default fallback
}

// Submit a try-on request
async function submitTryOnRequest(human, garment, category, garmentDescription, storeName) {
  try {
    console.log("Submitting try-on request...");
    const response = await fetch('/tryon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify({
        human,
        garment,
        category,
        garment_description: garmentDescription,
        storeName
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `Server returned ${response.status}: ${response.statusText}`);
    }
    
    console.log("Try-on request submitted successfully:", data);
    return {
      success: true,
      job_id: data.job_id,
      api_job_id: data.api_job_id,
      message: data.message
    };
  } catch (error) {
    console.error("Error submitting try-on request:", error);
    return {
      success: false,
      error: error.message,
      details: error.toString()
    };
  }
}

// Get result of a try-on job
async function getTryOnResult(jobId) {
  try {
    console.log(`Fetching result for job: ${jobId}`);
    const response = await fetch(`/get-result/${jobId}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch result: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Result for job ${jobId}:`, data);
    return data;
  } catch (error) {
    console.error(`Error fetching result for job ${jobId}:`, error);
    throw error;
  }
}

// Save order information
async function saveOrder(orderData) {
  try {
    console.log("Saving order:", orderData);
    const response = await fetch('/save-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify(orderData)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save order: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Order saved successfully:", data);
    return data;
  } catch (error) {
    console.error("Error saving order:", error);
    throw error;
  }
}

// Update order status to wanted
async function updateOrderWanted(orderId) {
  try {
    console.log(`Updating order ${orderId} to wanted status`);
    const response = await fetch('/update-order-wanted', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify({ orderId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update order: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Order ${orderId} updated successfully:`, data);
    return data;
  } catch (error) {
    console.error(`Error updating order ${orderId}:`, error);
    throw error;
  }
}

// Exports for use in browser
window.fetchStores = fetchStores;
window.fetchGarmentsForStore = fetchGarmentsForStore;
window.submitTryOnRequest = submitTryOnRequest;
window.getTryOnResult = getTryOnResult;
window.saveOrder = saveOrder;
window.updateOrderWanted = updateOrderWanted; 