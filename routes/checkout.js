const express = require('express');
const router = express.Router();
const checkoutController = require('../controllers/checkoutController');
const { authenticate } = require('../middleware/auth'); // ensure this is a function

// Checkout routes
router.post('/process', authenticate, checkoutController.processCheckout);
router.post('/quick', authenticate, checkoutController.quickCheckout);
router.post('/payment', authenticate, checkoutController.processPayment);
router.get('/summary', authenticate, checkoutController.getCheckoutSummary);

module.exports = router;