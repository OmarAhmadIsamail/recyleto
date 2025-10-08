const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');
const { validateResult } = require('../middleware/validateResult');
const { 
  createTransactionValidator,
  transactionQueryValidator,
  transactionIdValidator,
  updateTransactionValidator
} = require('../validators/transactionValidator');

router.use(protect);

// Transaction endpoints only
router.post('/', createTransactionValidator, validateResult, transactionController.createTransaction); 
router.get('/', transactionQueryValidator, validateResult, transactionController.getTransactions);
router.get('/:id', transactionIdValidator, validateResult, transactionController.getTransactionById);
router.put('/:id', updateTransactionValidator, validateResult, transactionController.updateTransaction);
router.delete('/:id', transactionIdValidator, validateResult, transactionController.deleteTransaction);

// Transaction statistics and export
router.get('/stats/statistics', transactionController.getTransactionStats);
router.get('/export/transactions', transactionController.exportTransactions);

module.exports = router;