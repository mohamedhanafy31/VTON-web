import { OrderModel } from '../models/OrderModel.js';
import logger from '../utils/logger.js';

// Create a new order
export const createOrder = async (req, res) => {
  const operationId = logger.startOperation('order-creation', {
    userId: req.session.user?.userId,
    garmentId: req.body.garment_id
  });
  
  try {
    const orderData = {
      ...req.body,
      user_id: req.session.user.userId
    };

    const order = await OrderModel.create(orderData);
    
    logger.succeedOperation(operationId, 'order-creation', {
      orderId: order.id,
      statusCode: 201
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: order
    });

  } catch (error) {
    logger.failOperation(operationId, 'order-creation', error, {
      statusCode: 400
    });
    
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get order by ID
export const getOrder = async (req, res) => {
  const operationId = logger.startOperation('order-retrieval', {
    orderId: req.params.id,
    userId: req.session.user?.userId
  });
  
  try {
    const { id } = req.params;
    const order = await OrderModel.findById(id);
    
    if (!order) {
      logger.failOperation(operationId, 'order-retrieval', new Error('Order not found'), {
        statusCode: 404
      });
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user has permission to view this order
    if (order.user_id !== req.session.user.userId) {
      logger.failOperation(operationId, 'order-retrieval', new Error('Unauthorized access'), {
        statusCode: 403
      });
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to access this order'
      });
    }

    logger.succeedOperation(operationId, 'order-retrieval', {
      orderId: order.id,
      statusCode: 200
    });

    res.json({
      success: true,
      order: order
    });

  } catch (error) {
    logger.failOperation(operationId, 'order-retrieval', error, {
      statusCode: 500
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update order
export const updateOrder = async (req, res) => {
  const operationId = logger.startOperation('order-update', {
    orderId: req.params.id,
    userId: req.session.user?.userId
  });
  
  try {
    const { id } = req.params;
    const updateData = req.body;

    // First check if order exists and user has permission
    const existingOrder = await OrderModel.findById(id);
    if (!existingOrder) {
      logger.failOperation(operationId, 'order-update', new Error('Order not found'), {
        statusCode: 404
      });
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (existingOrder.user_id !== req.session.user.userId) {
      logger.failOperation(operationId, 'order-update', new Error('Unauthorized access'), {
        statusCode: 403
      });
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to update this order'
      });
    }

    const updatedOrder = await OrderModel.update(id, updateData);
    
    logger.succeedOperation(operationId, 'order-update', {
      orderId: updatedOrder.id,
      statusCode: 200
    });

    res.json({
      success: true,
      message: 'Order updated successfully',
      order: updatedOrder
    });

  } catch (error) {
    logger.failOperation(operationId, 'order-update', error, {
      statusCode: 400
    });
    
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get orders for current user
export const getUserOrders = async (req, res) => {
  const operationId = logger.startOperation('user-orders-retrieval', {
    userId: req.session.user?.userId
  });
  
  try {
    const userId = req.session.user.userId;
    const { limit = 50, offset = 0 } = req.query;

    const orders = await OrderModel.findByUserId(userId, parseInt(limit), parseInt(offset));
    
    logger.succeedOperation(operationId, 'user-orders-retrieval', {
      userId,
      ordersCount: orders.length,
      statusCode: 200
    });

    res.json({
      success: true,
      orders: orders,
      count: orders.length
    });

  } catch (error) {
    logger.failOperation(operationId, 'user-orders-retrieval', error, {
      statusCode: 500
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Delete order
export const deleteOrder = async (req, res) => {
  const operationId = logger.startOperation('order-deletion', {
    orderId: req.params.id,
    userId: req.session.user?.userId
  });
  
  try {
    const { id } = req.params;

    // First check if order exists and user has permission
    const existingOrder = await OrderModel.findById(id);
    if (!existingOrder) {
      logger.failOperation(operationId, 'order-deletion', new Error('Order not found'), {
        statusCode: 404
      });
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (existingOrder.user_id !== req.session.user.userId) {
      logger.failOperation(operationId, 'order-deletion', new Error('Unauthorized access'), {
        statusCode: 403
      });
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to delete this order'
      });
    }

    await OrderModel.delete(id);
    
    logger.succeedOperation(operationId, 'order-deletion', {
      orderId: id,
      statusCode: 200
    });

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });

  } catch (error) {
    logger.failOperation(operationId, 'order-deletion', error, {
      statusCode: 500
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get order statistics (admin only)
export const getOrderStats = async (req, res) => {
  const operationId = logger.startOperation('order-stats-retrieval', {
    userId: req.session.user?.userId
  });
  
  try {
    const stats = await OrderModel.getStats();
    
    logger.succeedOperation(operationId, 'order-stats-retrieval', {
      statusCode: 200
    });

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    logger.failOperation(operationId, 'order-stats-retrieval', error, {
      statusCode: 500
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};