import db from '../config/db.js';
import admin from 'firebase-admin';
import logger from '../utils/logger.js';

// Save a new order
export const saveOrder = async (req, res) => {
  console.log('POST /save-order called with body:', req.body);
  try {
    if (!db) {
      throw new Error('Firestore is unavailable');
    }
    const { name, phone, garmentName, storeName } = req.body;
    if (!name || !phone || !garmentName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const ordersRef = db.collection('stores').doc('orders');
    const orderDoc = await ordersRef.get();
    let orders = orderDoc.exists ? orderDoc.data() : {};
    let orderId = Object.keys(orders).length + 1;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingOrder = Object.entries(orders).find(([id, order]) => {
      const timestamp = order.timestamp?.toDate();
      return (
        order.name === name &&
        order.phone === phone &&
        order.garmentName === garmentName &&
        order.storeName === (storeName || 'Unknown') &&
        timestamp && timestamp > fiveMinutesAgo
      );
    });

    if (existingOrder) {
      const [existingId] = existingOrder;
      console.log(`Duplicate order detected, returning existing orderId: ${existingId}`);
      return res.json({ success: true, orderId: existingId });
    }

    await ordersRef.set({
      [orderId]: {
        name,
        phone,
        garmentName,
        storeName: storeName || 'Unknown',
        wanted: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });

    console.log(`Order saved with ID: ${orderId}, wanted: false, Garment: ${garmentName}, Store: ${storeName}`);
    res.json({ success: true, orderId });
  } catch (error) {
    console.error('Error saving order:', error);
    logger.error('Save order error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to save order. Please try again later.' });
  }
};

// Update order wanted status
export const updateOrderWanted = async (req, res) => {
  console.log('POST /update-order-wanted called with body:', req.body);
  try {
    if (!db) {
      throw new Error('Firestore is unavailable');
    }
    const { orderId } = req.body;
    if (!orderId || isNaN(parseInt(orderId))) {
      return res.status(400).json({ error: 'Invalid or missing orderId' });
    }

    const ordersRef = db.collection('stores').doc('orders');
    const orderDoc = await ordersRef.get();
    if (!orderDoc.exists || !orderDoc.data()[orderId]) {
      return res.status(404).json({ error: `Order with ID ${orderId} not found` });
    }

    const order = orderDoc.data()[orderId];
    if (order.wanted === true) {
      console.log(`Order ${orderId} already has wanted: true, no update needed`);
      return res.json({ success: true, message: 'Order already marked as wanted' });
    }

    await ordersRef.update({
      [`${orderId}.wanted`]: true
    });

    console.log(`Order ${orderId} updated with wanted: true, Garment: ${order.garmentName}, Store: ${order.storeName}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating order status:', error);
    logger.error('Update order status error', { orderId: req.params.orderId, error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to update order status. Please try again later.' });
  }
}; 