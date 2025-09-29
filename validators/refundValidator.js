const { body } = require('express-validator');

const refundValidator = [
    body('transactionReference')
        .notEmpty()
        .withMessage('Transaction reference is required')
        .isString()
        .withMessage('Transaction reference must be a string'),
    
    body('reason')
        .notEmpty()
        .withMessage('Reason for refund is required')
        .isLength({ min: 10, max: 500 })
        .withMessage('Reason must be between 10 and 500 characters')
        .trim(),
    
    body('items')
        .optional()
        .isArray()
        .withMessage('Items must be an array'),
    
    body('items.*.medicineId')
        .optional()
        .isMongoId()
        .withMessage('Invalid medicine ID'),
    
    body('items.*.quantity')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Quantity must be a positive integer')
];

module.exports = { refundValidator };