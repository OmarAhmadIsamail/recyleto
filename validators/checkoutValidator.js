const { body } = require('express-validator');

const checkoutValidator = [
  body('paymentMethod')
    .isIn(['cash', 'card', 'bank_transfer', 'digital_wallet'])
    .withMessage('Invalid payment method'),
  body('customerInfo.name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Customer name must be between 2 and 50 characters'),
  body('customerInfo.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid phone number'),
  body('receiptOptions.print')
    .optional()
    .isBoolean()
    .withMessage('Print option must be a boolean'),
  body('receiptOptions.email')
    .optional()
    .isBoolean()
    .withMessage('Email option must be a boolean'),
  body('receiptOptions.sms')
    .optional()
    .isBoolean()
    .withMessage('SMS option must be a boolean'),
  body('transactionNotes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Transaction notes cannot exceed 500 characters')
];

module.exports = checkoutValidator;