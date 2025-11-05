import { body, validationResult } from "express-validator";

// ✅ Validate new order creation
export const validateOrder = [
  // tableId is optional for guest orders (allows browsing/ordering without selecting a table)
  body("tableId")
    .optional()
    .isMongoId()
    .withMessage("Invalid table ID"),
  body("items")
    .isArray()
    .withMessage("Items must be an array"),
  body("items.*.menuItemId")
    .isMongoId()
    .withMessage("Invalid menu item ID"),
  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1")
];

// ✅ Validate order status values
export const validateOrderStatus = [
  body("status")
    .isIn(["placed", "preparing", "ready", "served", "canceled", "completed"])
    .withMessage("Invalid order status")
];

// ✅ Validate payment status values
export const validateOrderPayment = [
  body("status")
    .isIn(["pending", "paid", "failed", "refunded"])
    .withMessage("Invalid payment status")
];

// ✅ Common handler for validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array()
    });
  }
  next();
};
