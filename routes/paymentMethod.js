const express = require('express');
const router = express.Router();
const paymentMethodController = require('../controllers/paymentMethodController');
const validatePaymentMethod = require('../validators/paymentMethodValidator');
const { protect } = require('../middleware/auth'); 

// All routes require authentication
router.use(protect);

// Get user's payment methods
router.get('/', paymentMethodController.getPaymentMethods);

// Create new payment method
router.post(
  '/',
  validatePaymentMethod.createPaymentMethod,
  paymentMethodController.createPaymentMethod
);

// Update payment method
router.put(
  '/:id',
  validatePaymentMethod.createPaymentMethod,
  paymentMethodController.updatePaymentMethod
);

// Delete payment method
router.delete('/:id', paymentMethodController.deletePaymentMethod);

// Set default payment method
router.patch('/:id/default', paymentMethodController.setDefaultPaymentMethod);

module.exports = router;
