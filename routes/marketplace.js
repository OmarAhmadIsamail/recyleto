// routes/marketplace.js
const express = require('express');
const router = express.Router();
const marketplaceController = require('../controllers/marketplaceController');
const { authenticate } = require('../middleware/auth'); 

// Marketplace browsing
router.get('/medicines', authenticate, marketplaceController.getMarketplaceMedicines);



// Purchase operations
router.post('/purchase/full', authenticate, marketplaceController.purchaseFromMarketplace);
router.post('/purchase/single', authenticate, marketplaceController.purchaseSingleFromMarketplace);

// Purchase history
router.get('/purchases', authenticate, marketplaceController.getMarketplacePurchases);

module.exports = router;