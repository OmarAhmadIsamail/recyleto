const { body } = require('express-validator');

const validatePaymentMethod = {
  createPaymentMethod: [
    body('type')
      .isIn(['cash', 'card', 'bank_transfer', 'digital_wallet'])
      .withMessage('Invalid payment method type'),
    
    body('name')
      .notEmpty()
      .withMessage('Payment method name is required'),
    
    // Card validation
    body('cardNumber')
      .if(body('type').equals('card'))
      .isLength({ min: 16, max: 19 })
      .withMessage('Card number must be between 16 and 19 digits'),
    
    body('cardholderName')
      .if(body('type').equals('card'))
      .notEmpty()
      .withMessage('Cardholder name is required for cards'),
    
    body('expiryDate')
      .if(body('type').equals('card'))
      .matches(/^(0[1-9]|1[0-2])\/?([0-9]{4}|[0-9]{2})$/)
      .withMessage('Invalid expiry date format (MM/YY or MM/YYYY)'),
    
    body('cvv')
      .if(body('type').equals('card'))
      .isLength({ min: 3, max: 4 })
      .withMessage('CVV must be 3 or 4 digits'),
    
    // Bank transfer validation
    body('bankName')
      .if(body('type').equals('bank_transfer'))
      .notEmpty()
      .withMessage('Bank name is required'),
    
    body('accountNumber')
      .if(body('type').equals('bank_transfer'))
      .notEmpty()
      .withMessage('Account number is required'),
    
    body('routingNumber')
      .if(body('type').equals('bank_transfer'))
      .notEmpty()
      .withMessage('Routing number is required'),
    
    // Digital wallet validation
    body('walletProvider')
      .if(body('type').equals('digital_wallet'))
      .isIn(['vodafone_cash', 'orange_money', 'etsalate_cash', 'other'])
      .withMessage('Invalid wallet provider'),
    
    body('phoneNumber')
      .if(body('type').equals('digital_wallet'))
      .isMobilePhone()
      .withMessage('Valid phone number is required for digital wallet'),
    
    body('walletId')
      .if(body('type').equals('digital_wallet'))
      .notEmpty()
      .withMessage('Wallet ID is required')
  ],

  processPayment: [
    body('paymentMethodId')
      .optional()
      .isMongoId()
      .withMessage('Invalid payment method ID'),
    
    body('paymentType')
      .isIn(['cash', 'card', 'bank_transfer', 'digital_wallet'])
      .withMessage('Invalid payment type'),
    
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Valid payment amount is required')
  ]
};

module.exports = validatePaymentMethod;