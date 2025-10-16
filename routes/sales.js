const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { protect } = require('../middleware/auth');

// GET /sales - Show all medicines, transactions, receipts, and purchases
router.get('/', protect, salesController.getAllSalesData);

// GET /sales/analysis - Show analysis of medicines, transactions, and refund requests
router.get('/analysis', protect, salesController.getSalesAnalysis);

// GET /sales/transaction - Show transactions and the most used ones
router.get('/transaction', protect, salesController.getTransactionsWithUsage);

// GET /sales/receipt - Show receipts and receipts in refund process
router.get('/receipt', protect, salesController.getReceiptsWithRefunds);

// GET /sales/medicine - Show medicines and the most wanted
router.get('/medicine', protect, salesController.getMedicinesWithPopularity);

// GET /sales/purchases - Show only what was purchased
router.get('/purchases', protect, salesController.getPurchases);

module.exports = router;