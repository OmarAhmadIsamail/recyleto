const { body } = require('express-validator');

const deliveryAddressValidator = {
  createAddress: [
    body('name')
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 100 })
      .withMessage('Name must be less than 100 characters'),
    
    body('address')
      .notEmpty()
      .withMessage('Address is required')
      .isLength({ max: 255 })
      .withMessage('Address must be less than 255 characters'),
    
    body('city')
      .notEmpty()
      .withMessage('City is required')
      .isLength({ max: 100 })
      .withMessage('City must be less than 100 characters'),
    
    body('state')
      .notEmpty()
      .withMessage('State is required')
      .isLength({ max: 100 })
      .withMessage('State must be less than 100 characters'),
    
    body('zipCode')
      .notEmpty()
      .withMessage('ZIP code is required')
      .isLength({ max: 20 })
      .withMessage('ZIP code must be less than 20 characters'),
    
    body('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .isMobilePhone()
      .withMessage('Valid phone number is required'),
    
    body('landmark')
      .optional()
      .isLength({ max: 255 })
      .withMessage('Landmark must be less than 255 characters'),
    
    body('isDefault')
      .optional()
      .isBoolean()
      .withMessage('isDefault must be a boolean')
  ],

  updateAddress: [
    body('name')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Name must be less than 100 characters'),
    
    body('address')
      .optional()
      .isLength({ max: 255 })
      .withMessage('Address must be less than 255 characters'),
    
    // ... similar for other fields ...
  ],

  deliveryOption: [
    body('deliveryOption')
      .isIn(['pickup', 'delivery'])
      .withMessage('Delivery option must be either pickup or delivery'),
    
    body('deliveryAddressId')
      .if(body('deliveryOption').equals('delivery'))
      .notEmpty()
      .withMessage('Delivery address is required for delivery option')
      .isMongoId()
      .withMessage('Valid delivery address ID is required')
  ]
};

module.exports = deliveryAddressValidator;