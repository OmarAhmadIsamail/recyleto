const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');
const { protect } = require('../middleware/auth');

// Get all receipts for pharmacy
router.get('/', protect, receiptController.getReceipts);

// Get receipt by ID
router.get('/:id', protect, receiptController.getReceiptById);

// Get receipt by receipt number
router.get('/number/:receiptNumber', protect, receiptController.getReceiptByNumber);

// Get receipts by transaction ID
router.get('/transaction/:transactionId', protect, receiptController.getReceiptsByTransaction);

module.exports = router;