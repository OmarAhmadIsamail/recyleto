const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');
const { validateResult } = require('../middleware/validateResult');
const { 
  createTransactionValidator, 
  cartValidator,
  updateCartItemValidator,
  checkoutValidator,
  purchaseSingleValidator,
  transactionQueryValidator,
  transactionIdValidator,
  updateTransactionValidator
} = require('../validators/transactionValidator');

router.use(protect);

// Cart management endpoints (now using transactions with pending status)
router.post('/item', cartValidator, validateResult, transactionController.addToCart);
router.get('/items', transactionController.getCart);
router.put('/item/:itemId', updateCartItemValidator, validateResult, transactionController.updateCartItem);
router.delete('/item/:itemId', transactionIdValidator, validateResult, transactionController.removeFromCart);
router.delete('/items', transactionController.clearCart);

// Purchase single medicine from cart
router.post('/purchase/:itemId', purchaseSingleValidator, validateResult, transactionController.purchaseSingleMedicine);

// Checkout and transaction endpoints
router.post('/checkout', checkoutValidator, validateResult, transactionController.checkoutCart);
router.post('/', createTransactionValidator, validateResult, transactionController.createTransaction); 

// Transaction query endpoints
router.get('/', transactionQueryValidator, validateResult, transactionController.getTransactions);
router.get('/:id', transactionIdValidator, validateResult, transactionController.getTransactionById);

// Update and delete transactions
router.put('/:id', updateTransactionValidator, validateResult, transactionController.updateTransaction);
router.delete('/:id', transactionIdValidator, validateResult, transactionController.deleteTransaction);

module.exports = router;