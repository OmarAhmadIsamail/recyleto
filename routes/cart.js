const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticate } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authenticate);

// Cart operations
router.post('/transaction/add', cartController.addToCartFromTransaction);
router.get('/', cartController.getCart);
router.delete('/item/:itemId', cartController.removeFromCart);
router.put('/item/:itemId', cartController.updateCartItem);
router.delete('/clear', cartController.clearCart);

module.exports = router;