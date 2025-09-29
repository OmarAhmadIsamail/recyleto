const { body } = require('express-validator');

const createSupportTicketValidator = [
  body('subject')
    .isIn(['Technical Issue', 'Billing', 'Account', 'Feature Request', 'General Inquiry', 'Other'])
    .withMessage('Please select a valid subject'),
  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Urgent'])
    .withMessage('Please select a valid priority level'),
  body('message')
    .isLength({ min: 10 })
    .withMessage('Message must be at least 10 characters long'),
  body('appVersion')
    .optional()
    .isString(),
  body('deviceInfo')
    .optional()
    .isString()
];

const addMessageValidator = [
  body('content')
    .isLength({ min: 1 })
    .withMessage('Message content is required')
];

const updateTicketStatusValidator = [
  body('status')
    .isIn(['Open', 'In Progress', 'Resolved', 'Closed'])
    .withMessage('Please select a valid status')
];

module.exports = {
  createSupportTicketValidator,
  addMessageValidator,
  updateTicketStatusValidator
};