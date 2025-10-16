const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refundController');
const { protect } = require('../middleware/auth');

// Create refund request
router.post('/', protect, refundController.createRefund);

// Get all refunds
router.get('/', protect, refundController.getRefunds);

// Get refund by ID
router.get('/:id', protect, refundController.getRefundById);

// Get refund by number
router.get('/number/:refundNumber', protect, refundController.getRefundByNumber);

// Approve refund
router.patch('/:id/approve', protect, refundController.approveRefund);

// Reject refund
router.patch('/:id/reject', protect, refundController.rejectRefund);

// Complete refund
router.patch('/:id/complete', protect, refundController.completeRefund);

module.exports = router;