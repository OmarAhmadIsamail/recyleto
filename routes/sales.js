// routes/sales.js
const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authenticate } = require('../middleware/auth'); 

// Sales dashboard and transactions
router.get('/transactions', authenticate, salesController.getSalesTransactions);
router.get('/statistics', authenticate, salesController.getSaleStatistics);

// Sales processing
router.post('/full-sale', authenticate, salesController.processFullSale);
router.post('/per-medicine-sale', authenticate, salesController.processPerMedicineSale);

module.exports = router;