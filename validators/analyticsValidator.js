const { body, query, param } = require('express-validator');

// Validator for analytics query parameters
const analyticsQueryValidator = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
    
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((endDate, { req }) => {
      if (req.query.startDate && endDate) {
        const start = new Date(req.query.startDate);
        const end = new Date(endDate);
        if (end < start) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    }),
    
  query('medicineId')
    .optional()
    .isMongoId()
    .withMessage('Medicine ID must be a valid MongoDB ObjectId'),
    
  query('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected', 'completed', 'cancelled'])
    .withMessage('Status must be one of: pending, approved, rejected, completed, cancelled'),
    
  query('groupBy')
    .optional()
    .isIn(['day', 'week', 'month', 'medicine'])
    .withMessage('Group by must be one of: day, week, month, medicine'),
    
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
    
  query('compareWithPrevious')
    .optional()
    .isBoolean()
    .withMessage('Compare with previous must be a boolean')
    .toBoolean()
];

// Validator for medicine ID parameter
const medicineIdValidator = [
  param('medicineId')
    .isMongoId()
    .withMessage('Medicine ID must be a valid MongoDB ObjectId')
];

module.exports = {
  analyticsQueryValidator,
  medicineIdValidator
};