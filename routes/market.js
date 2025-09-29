const express = require('express');
const router = express.Router();
const marketController = require('../controllers/marketController');
const { searchValidator } = require('../validators/searchValidator');
const { validateResult } = require('../middleware/validateResult');
const { authenticate } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticate);

// Search and filter medicines
router.get('/search', searchValidator, validateResult, marketController.searchMedicines);

// Get medicine by ID
router.get('/:id', marketController.getMedicineById);

module.exports = router;