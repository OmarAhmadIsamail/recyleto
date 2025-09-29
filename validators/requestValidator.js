const { body } = require('express-validator');

const medicineRequestValidator = [
  body('medicineName')
    .notEmpty()
    .withMessage('Medicine name is required')
    .isLength({ max: 100 })
    .withMessage('Medicine name must be less than 100 characters'),
  
  body('genericName')
    .notEmpty()
    .withMessage('Generic name is required')
    .isLength({ max: 100 })
    .withMessage('Generic name must be less than 100 characters'),
  
  body('form')
    .isIn(['Tablet', 'Syrup', 'Capsule', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Other'])
    .withMessage('Please select a valid form'),
  
  body('packSize')
    .notEmpty()
    .withMessage('Pack size is required')
    .isLength({ max: 50 })
    .withMessage('Pack size must be less than 50 characters'),
  
  body('additionalNotes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Additional notes must be less than 500 characters'),
  
  body('urgencyLevel')
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Please select a valid urgency level')
];

module.exports = {
  medicineRequestValidator
};