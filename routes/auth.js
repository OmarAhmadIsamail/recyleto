// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateResult } = require('../middleware/validateResult');
const { 
    loginValidator, 
    forgotPasswordValidator, 
    resetPasswordValidator,
    verifyOtpValidator // Make sure this is imported
} = require('../validators/authValidator');
const { registerPharmacyValidator } = require('../validators/pharmacyValidator');
const { pharmacyUpload, handleMulterError } = require('../middleware/upload');
const { authenticate } = require('../middleware/auth');

router.post('/login', loginValidator, validateResult, authController.login);
router.post('/forgot-password', forgotPasswordValidator, validateResult, authController.forgotPassword);
router.post('/verify-otp', verifyOtpValidator, validateResult, authController.verifyOtp); // This line was causing the error
router.post('/reset-password', resetPasswordValidator, validateResult, authController.resetPassword);

// Updated registration route with enhanced upload middleware
router.post('/register-pharmacy', 
    (req, res, next) => {
        pharmacyUpload(req, res, (err) => {
            if (err) return handleMulterError(err, req, res, next);
            next();
        });
    },
    registerPharmacyValidator,
    validateResult,
    authController.registerPharmacy
);

// 2FA routes
router.post('/2fa/enable', authenticate, authController.enable2FA);
router.post('/2fa/verify', authenticate, authController.verify2FA);
router.post('/2fa/disable', authenticate, authController.disable2FA);

module.exports = router;