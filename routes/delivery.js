const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const deliveryValidator = require('../validators/deliveryValidator');
const { authenticate: auth, authorize } = require('../middleware/auth'); // <-- fixed
const { validateResult } = require('../middleware/validateResult');

// User routes
router.get('/addresses', auth, deliveryController.getAddresses);
router.post('/addresses', auth, deliveryValidator.createAddress, validateResult, deliveryController.createAddress);
router.put('/addresses/:id', auth, deliveryValidator.updateAddress, validateResult, deliveryController.updateAddress);
router.delete('/addresses/:id', auth, deliveryController.deleteAddress);

// Delivery options for transactions
router.post('/transactions/:transactionId/delivery-option', auth, deliveryValidator.deliveryOption, validateResult, deliveryController.setDeliveryOption);
router.get('/transactions/:transactionId/tracking', auth, deliveryController.trackDelivery);

// Admin routes for delivery management
router.put('/admin/transactions/:transactionId/delivery-status', auth, authorize('admin'), deliveryController.updateDeliveryStatus);

module.exports = router;
