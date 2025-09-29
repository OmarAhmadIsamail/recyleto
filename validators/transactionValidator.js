const { body, query, param } = require('express-validator');

// Query validation for transaction listing/filtering
exports.transactionQueryValidator = [
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query cannot exceed 100 characters'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (req.query.startDate && new Date(value) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  query('status')
    .optional()
    .isIn(['draft', 'pending', 'completed', 'cancelled', 'refunded', 'partially_refunded'])
    .withMessage('Status must be one of: draft, pending, completed, cancelled, refunded, partially_refunded'),
  
  query('transactionType')
    .optional()
    .isIn(['sale', 'purchase', 'return', 'adjustment', 'transfer'])
    .withMessage('Transaction type must be one of: sale, purchase, return, adjustment, transfer'),
  
  query('medicineId')
    .optional()
    .isMongoId()
    .withMessage('Medicine ID must be a valid MongoDB ObjectId'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Validation for creating transactions directly (not through cart)
exports.createTransactionValidator = [
  body('transactionType')
    .notEmpty()
    .withMessage('Transaction type is required')
    .isIn(['sale', 'purchase', 'return', 'adjustment', 'transfer'])
    .withMessage('Invalid transaction type. Must be one of: sale, purchase, return, adjustment, transfer'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('customerName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Customer name must be less than 100 characters')
    .custom((value) => {
      if (value && !/^[a-zA-Z\s'-]+$/.test(value)) {
        throw new Error('Customer name can only contain letters, spaces, hyphens, and apostrophes');
      }
      return true;
    }),
  
  body('customerPhone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Customer phone must be less than 20 characters')
    .matches(/^[+\d\s\-()]+$/)
    .withMessage('Customer phone must contain only numbers, spaces, hyphens, parentheses, and plus sign'),
  
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'mobile_money', 'bank_transfer', 'credit', 'digital_wallet'])
    .withMessage('Invalid payment method. Must be one of: cash, card, mobile_money, bank_transfer, credit, digital_wallet'),
  
  body('items')
    .isArray({ min: 1 })
    .withMessage('Transaction must contain at least one item'),
  
  body('items.*.medicineId')
    .notEmpty()
    .withMessage('Medicine ID is required for all items')
    .isMongoId()
    .withMessage('Medicine ID must be a valid MongoDB ObjectId'),
  
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1 for all items'),
  
  body('items.*.unitPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a non-negative number'),
  
  body('tax')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tax must be a non-negative number'),
  
  body('discount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount must be a non-negative number'),
  
  body('status')
    .optional()
    .isIn(['draft', 'pending', 'completed', 'cancelled'])
    .withMessage('Status must be one of: draft, pending, completed, cancelled')
];

// Validation for cart operations
exports.cartValidator = [
  body('medicineId')
    .notEmpty()
    .withMessage('Medicine ID is required')
    .isMongoId()
    .withMessage('Medicine ID must be a valid MongoDB ObjectId'),
  
  body('quantity')
    .isInt({ min: 1, max: 10000 })
    .withMessage('Quantity must be between 1 and 10000'),
  
  body('transactionType')
    .optional()
    .isIn(['sale', 'purchase', 'return', 'adjustment', 'transfer'])
    .withMessage('Invalid transaction type. Must be one of: sale, purchase, return, adjustment, transfer'),
  
  body('unitPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a non-negative number')
];

// Validation for updating cart items
exports.updateCartItemValidator = [
  param('itemId')
    .isMongoId()
    .withMessage('Item ID must be a valid MongoDB ObjectId'),
  
  body('quantity')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Quantity must be between 1 and 10000'),
  
  body('unitPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a non-negative number')
];

// Validation for checkout
exports.checkoutValidator = [
  body('transactionType')
    .optional()
    .isIn(['sale', 'purchase', 'return', 'adjustment', 'transfer'])
    .withMessage('Invalid transaction type. Must be one of: sale, purchase, return, adjustment, transfer'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('customerName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Customer name must be less than 100 characters'),
  
  body('customerPhone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Customer phone must be less than 20 characters')
    .matches(/^[+\d\s\-()]+$/)
    .withMessage('Customer phone must contain only numbers, spaces, hyphens, parentheses, and plus sign'),
  
  body('paymentMethod')
    .isIn(['cash', 'card', 'mobile_money', 'bank_transfer', 'credit', 'digital_wallet'])
    .withMessage('Payment method is required and must be one of: cash, card, mobile_money, bank_transfer, credit, digital_wallet'),
  
  body('tax')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tax must be a non-negative number'),
  
  body('discount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount must be a non-negative number')
];

// Validation for single medicine purchase
exports.purchaseSingleValidator = [
  param('itemId')
    .isMongoId()
    .withMessage('Item ID must be a valid MongoDB ObjectId'),
  
  body('customerName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Customer name must be less than 100 characters'),
  
  body('customerPhone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Customer phone must be less than 20 characters')
    .matches(/^[+\d\s\-()]+$/)
    .withMessage('Customer phone must contain only numbers, spaces, hyphens, parentheses, and plus sign'),
  
  body('paymentMethod')
    .isIn(['cash', 'card', 'mobile_money', 'bank_transfer', 'credit', 'digital_wallet'])
    .withMessage('Payment method is required and must be one of: cash, card, mobile_money, bank_transfer, credit, digital_wallet')
];

// Validation for transaction ID parameter
exports.transactionIdValidator = [
  param('id')
    .isMongoId()
    .withMessage('Transaction ID must be a valid MongoDB ObjectId')
];

// Validation for updating transactions
exports.updateTransactionValidator = [
  param('id')
    .isMongoId()
    .withMessage('Transaction ID must be a valid MongoDB ObjectId'),
  
  body('status')
    .optional()
    .isIn(['draft', 'pending', 'completed', 'cancelled', 'refunded', 'partially_refunded'])
    .withMessage('Status must be one of: draft, pending, completed, cancelled, refunded, partially_refunded'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('customerInfo.name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Customer name must be less than 100 characters'),
  
  body('customerInfo.phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Customer phone must be less than 20 characters')
    .matches(/^[+\d\s\-()]+$/)
    .withMessage('Customer phone must contain only numbers, spaces, hyphens, parentheses, and plus sign'),
  
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'mobile_money', 'bank_transfer', 'credit', 'digital_wallet'])
    .withMessage('Invalid payment method. Must be one of: cash, card, mobile_money, bank_transfer, credit, digital_wallet'),
  
  body('tax')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tax must be a non-negative number'),
  
  body('discount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount must be a non-negative number')
];

module.exports = exports;