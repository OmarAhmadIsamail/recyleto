const { body } = require('express-validator');

exports.registerPharmacyValidator = [
    body('pharmacyName')
        .notEmpty()
        .withMessage('Pharmacy name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Pharmacy name must be between 2 and 100 characters'),
    
    body('businessEmail')
        .isEmail()
        .withMessage('Please provide a valid business email'),
    
    body('businessPhone')
        .notEmpty()
        .withMessage('Business phone is required'),
    
    body('mobileNumber')
        .optional()
        .isMobilePhone()
        .withMessage('Please provide a valid mobile number'),
    
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    
    body('businessAddress')
        .optional()
        .custom((value) => {
            try {
                const address = typeof value === 'string' ? JSON.parse(value) : value;
                if (!address.street || !address.city || !address.state || !address.zipCode) {
                    throw new Error('Address must include street, city, state, and zip code');
                }
                return true;
            } catch {
                throw new Error('Invalid address format');
            }
        }),
    
    body('latitude')
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage('Invalid latitude'),
    
    body('longitude')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Invalid longitude')
];

exports.loginValidator = [
    body('email').optional().isEmail().withMessage('Please provide a valid email'),
    body('username').optional().isString(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    // ensure at least email or username present
    body().custom(value => {
        if (!value.email && !value.username) {
            throw new Error('Please provide email or username');
        }
        return true;
    })
];

exports.forgotPasswordValidator = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email')
];

exports.resetPasswordValidator = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email'),
    body('code')
        .notEmpty()
        .withMessage('Reset code is required'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters')
];