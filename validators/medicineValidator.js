const { body } = require('express-validator');

exports.addMedicineValidator = [
    body('name')
        .notEmpty()
        .withMessage('Medicine name is required')
        .isLength({ max: 100 })
        .withMessage('Medicine name must be less than 100 characters'),
    body('genericName')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Generic name must be less than 100 characters'),
    body('form')
        .isIn(['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Cream', 'Drops', 'Inhaler', 'Other'])
        .withMessage('Invalid medicine form'),
    body('packSize')
        .notEmpty()
        .withMessage('Pack size is required')
        .isLength({ max: 50 })
        .withMessage('Pack size must be less than 50 characters'),
    body('quantity')
        .isInt({ min: 0 })
        .withMessage('Quantity must be a positive integer'),
    body('price')
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
    body('expiryDate')
        .isISO8601()
        .withMessage('Invalid expiry date format')
        .custom((value) => {
            if (new Date(value) <= new Date()) {
                throw new Error('Expiry date must be in the future');
            }
            return true;
        }),
    body('manufacturer')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Manufacturer must be less than 100 characters'),
    body('batchNumber')
        .optional()
        .isLength({ max: 50 })
        .withMessage('Batch number must be less than 50 characters')
];

// NEW: Update Medicine Validator (all fields optional)
exports.updateMedicineValidator = [
    body('name')
        .optional()
        .notEmpty()
        .withMessage('Medicine name cannot be empty')
        .isLength({ max: 100 })
        .withMessage('Medicine name must be less than 100 characters'),
    body('genericName')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Generic name must be less than 100 characters'),
    body('form')
        .optional()
        .isIn(['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Cream', 'Drops', 'Inhaler', 'Other'])
        .withMessage('Invalid medicine form'),
    body('packSize')
        .optional()
        .notEmpty()
        .withMessage('Pack size cannot be empty')
        .isLength({ max: 50 })
        .withMessage('Pack size must be less than 50 characters'),
    body('quantity')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Quantity must be a positive integer'),
    body('price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
    body('expiryDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid expiry date format')
        .custom((value) => {
            if (value && new Date(value) <= new Date()) {
                throw new Error('Expiry date must be in the future');
            }
            return true;
        }),
    body('manufacturer')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Manufacturer must be less than 100 characters'),
    body('batchNumber')
        .optional()
        .isLength({ max: 50 })
        .withMessage('Batch number must be less than 50 characters'),
    body('requiresPrescription')
        .optional()
        .isBoolean()
        .withMessage('Requires prescription must be a boolean value')
];