const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refundController');
const { refundValidator } = require('../validators/refundValidator');
const { authenticate } = require('../middleware/auth');  
const { validateResult } = require('../middleware/validateResult');

// Get eligible transactions for refund
router.get('/eligible-transactions', authenticate, refundController.getRefundEligibleTransactions);

// Request refund
router.post('/request', authenticate, refundValidator, validateResult, refundController.requestRefund);

// Get refund history
router.get('/history', authenticate, refundController.getRefundHistory);

module.exports = router;
