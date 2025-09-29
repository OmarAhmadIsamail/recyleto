const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');
const { validateResult } = require('../middleware/validateResult');
const { 
  analyticsQueryValidator,
  medicineIdValidator 
} = require('../validators/analyticsValidator');

// Apply authentication middleware to all routes
router.use(protect);

// Sales Analytics Routes
router.get('/sales', analyticsQueryValidator, validateResult, analyticsController.getSalesAnalytics);

// Refunds Analytics Routes  
router.get('/refunds', analyticsQueryValidator, validateResult, analyticsController.getRefundsAnalytics);

// Overall Pharmacy Performance
router.get('/performance', analyticsQueryValidator, validateResult, analyticsController.getPharmacyPerformance);

// Medicine-specific Analytics
router.get('/medicine/:medicineId', medicineIdValidator, validateResult, analyticsController.getMedicineAnalytics);

module.exports = router;