const { body } = require('express-validator');

exports.createRequestValidator = [
    body('type')
        .isIn(['stock_request', 'refund', 'support', 'other'])
        .withMessage('Invalid request type'),
    body('title')
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ max: 100 })
        .withMessage('Title must be less than 100 characters'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters'),
    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent'])
        .withMessage('Invalid priority level'),
    body('dueDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format')
];

exports.dashboardFilterValidator = [
    body('startDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid start date format'),
    body('endDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid end date format')
];