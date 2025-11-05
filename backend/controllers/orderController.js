import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { calculateOrderTotal, generateOrderNumber } from '../utils/helperUtils.js';
import { isValidOrderStatus } from '../utils/validationUtils.js';

/**
 * Create a new order (guest or authenticated)
 * POST /api/orders
 */
export const createOrder = asyncHandler(async (req, res) => {
  const { tableId, items = [], meta = {} } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Order must contain at least one item' });
  }

  const normalizedItems = items.map((it) => ({
    menuItemId: it.menuItemId,
    name: (it.name || '').toString().trim(),
    price: parseFloat(it.price),
    qty: parseInt(it.quantity || it.qty, 10) || 1,
    note: it.note || ''
  }));

  // Validate the normalized items
  const errors = [];
  normalizedItems.forEach((it, i) => {
    if (!it.name) {
      errors.push(`Item at index ${i} is missing a name`);
    }
    if (Number.isNaN(it.price) || it.price <= 0) {
      errors.push(`Item '${it.name || `at index ${i}`}' has an invalid price`);
    }
    if (Number.isNaN(it.qty) || it.qty < 1) {
      errors.push(`Item '${it.name || `at index ${i}`}' has an invalid quantity`);
    }
  });

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.map(msg => ({ msg }))
    });
  }

  const totals = calculateOrderTotal(normalizedItems);
  const normalizedTableId = typeof tableId === 'string' ? tableId.trim() : tableId || null;
  const customerId = req.user ? req.user._id : null;

  const order = new Order({
    tableId: normalizedTableId,
    customerId,
    orderNumber: generateOrderNumber(),
    items: normalizedItems,
    totals,
    status: 'placed',
    meta: meta || {}
  });

  try {
    await order.save();
    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        totals: order.totals,
        createdAt: order.createdAt
      }
    });
  } catch (err) {
    console.error('Error saving order:', err);
    return res.status(500).json({ success: false, message: 'Failed to place order' });
  }
});

/**
 * Update order status (staff/admin)
 * PATCH /api/orders/:id/status
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!isValidOrderStatus(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const updatedOrder = await Order.findByIdAndUpdate(
    id,
    { $set: { status } },
    { new: true, runValidators: false }
  );

  if (!updatedOrder) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.status(200).json({
    success: true,
    message: 'Order status updated',
    data: { id: updatedOrder._id, status: updatedOrder.status }
  });
});

/**
 * Update order payment status (staff/admin)
 * PATCH /api/orders/:id/payment
 */
export const updateOrderPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let { status, method } = req.body;

  // Normalize status
  status = status.toLowerCase().trim();
  
  // If method is provided, normalize it
  if (method) {
    method = method.toLowerCase().trim();
  }

  const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
  if (!validPaymentStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid payment status', 
      errors: [{ msg: `Payment status must be one of: ${validPaymentStatuses.join(', ')}` }] 
    });
  }

  try {
    const updateData = {
      'payment.status': status,
    };
    
    if (status === 'paid') {
      updateData['payment.paidAt'] = new Date();
    } else if (status === 'refunded') {
      updateData['payment.refundedAt'] = new Date();
    }
    
    if (method) {
      updateData['payment.method'] = method;
    }

    // Update order status to completed if payment is marked as paid and order is served
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (status === 'paid' && order.status === 'served') {
      updateData['status'] = 'completed';
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: id },
      { $set: updateData },
      { new: true, runValidators: false }
    );

    res.status(200).json({ 
      success: true, 
      message: 'Order payment updated successfully', 
      data: { 
        id: updatedOrder._id, 
        payment: updatedOrder.payment,
        status: updatedOrder.status 
      } 
    });
  } catch (err) {
    console.error('Error updating payment:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update payment',
      errors: [{ msg: err.message }]
    });
  }
});

/**
 * List orders
 * GET /api/orders
 */
export const listOrders = asyncHandler(async (req, res) => {
  const user = req.user;
  const query = {};

  if (user) {
    if (['staff', 'admin'].includes(user.role)) {
      if (req.query.tableId) query.tableId = req.query.tableId;
      if (req.query.status && isValidOrderStatus(req.query.status)) {
        query.status = req.query.status;
      }
    } else {
      query.customerId = user._id;
    }
  } else {
    return res.status(401).json({ success: false, message: 'Authentication required to list orders' });
  }

  try {
    // Parse pagination parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await Order.countDocuments(query);

    // Get paginated orders
    const orders = await Order.find(query)
      .populate({
        path: 'items.menuItemId',
        select: 'name description price categoryId availability tags popularity imageUrl'
      })
      .populate('tableId', 'tableNumber qrSlug')
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({ 
      success: true, 
      message: 'Orders retrieved', 
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching orders:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve orders' });
  }
});

/**
 * Get order by ID
 * GET /api/orders/:id
 */
export const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await Order.findById(id)
    .populate({
      path: 'items.menuItemId',
      select: 'name description price categoryId availability tags popularity imageUrl'
    })
    .populate('tableId', 'tableNumber qrSlug')
    .populate('customerId', 'name email');
    
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  // Authorization: staff/admin or owner
  if (req.user) {
    if (!(['staff', 'admin'].includes(req.user.role) || 
        (order.customerId && order.customerId.toString() === req.user._id.toString()))) {
      return res.status(403).json({ success: false, message: 'Access denied to this order' });
    }
  } else if (order.customerId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  res.status(200).json({ success: true, data: order });
});

/**
 * Cancel order (owner or staff)
 * POST /api/orders/:id/cancel
 */
export const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const updatedOrder = await Order.findOneAndUpdate(
    { 
      _id: id,
      status: { $nin: ['completed', 'canceled'] }
    },
    { $set: { status: 'canceled' } },
    { new: true, runValidators: false }
  );

  if (!updatedOrder) {
    return res.status(404).json({ success: false, message: 'Order not found or cannot be canceled' });
  }

  res.status(200).json({ success: true, message: 'Order canceled', data: { id: updatedOrder._id } });
});

export default {
  createOrder,
  listOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderPayment,
  cancelOrder
};