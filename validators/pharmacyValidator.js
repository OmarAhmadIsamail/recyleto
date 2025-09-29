const { body } = require('express-validator');

exports.registerPharmacyValidator = [
    body('pharmacyName')
        .notEmpty()
        .withMessage('Pharmacy name is required'),
    body('businessEmail')
        .isEmail()
        .withMessage('Please provide a valid business email'),
    body('businessPhone')
        .isMobilePhone()
        .withMessage('Please provide a valid business phone number'),
    body('mobileNumber')
        .isMobilePhone()
        .withMessage('Please provide a valid mobile number'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Password confirmation does not match password');
            }
            return true;
        }),
    body('businessAddress.street')
        .notEmpty()
        .withMessage('Street address is required'),
    body('businessAddress.city')
        .notEmpty()
        .withMessage('City is required'),
    body('businessAddress.state')
        .notEmpty()
        .withMessage('State is required'),
    body('businessAddress.zipCode')
        .notEmpty()
        .withMessage('Zip code is required')
];