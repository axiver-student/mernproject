import express from 'express';
import {
  createOrder,
  getOrderById,
  listOrders,
  updateOrderStatus,
  updateOrderPayment,
  cancelOrder
} from '../controllers/orderController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  validateOrder,
  validateOrderStatus,
  validateOrderPayment,
  handleValidationErrors
} from '../middleware/valdation.js';
import { requireOrderAccess, requireStaff, requireAdmin, requireOrderPlacement } from '../middleware/roleMiddleware.js';
import { param } from 'express-validator';


const router = express.Router();

/**
 * Order routes
 * Base: /api/orders
 */

// Create order (public or authenticated)
router.post('/',
  validateOrder,
  handleValidationErrors,
  createOrder
);

// List orders - staff/admin can list all, customers can list their orders
router.get('/',
  authenticate,
  listOrders
);

// Get order by id
router.get('/:id',
  authenticate,
  [param('id').isMongoId().withMessage('Invalid order ID')],
  handleValidationErrors,
  getOrderById
);

// Update order status (staff or admin)
router.patch('/:id/status',
  authenticate,
  requireStaff,
  validateOrderStatus,
  handleValidationErrors,
  updateOrderStatus
);

// Update order payment status (staff or admin)
// Update order payment status (staff or admin)
// Update order payment status (staff or admin)
router.patch('/:id/payment',
  authenticate,
  requireStaff,
  validateOrderPayment,
  handleValidationErrors,
  updateOrderPayment
);



// Cancel order (customer who owns it or staff/admin)
router.post('/:id/cancel',
  authenticate,
  [param('id').isMongoId().withMessage('Invalid order ID')],
  handleValidationErrors,
  cancelOrder
);

export default router;
