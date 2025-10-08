const express = require('express');
const router = express.Router();
const checkoutController = require('../controllers/checkoutController');
const { authenticate } = require('../middleware/auth'); 

// Apply auth middleware to all routes
router.use(authenticate); // Change from 'auth' to 'authenticate'

// Checkout routes
router.post('/process', checkoutController.processCheckout);
router.get('/summary', checkoutController.getCheckoutSummary);
router.post('/apply-discount', checkoutController.applyDiscount);
router.post('/set-tax', checkoutController.setTax);

module.exports = router;