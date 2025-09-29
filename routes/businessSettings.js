// routes/businessSettings.js 
const express = require('express');
const router = express.Router();
const { getBusinessSettings, updateBusinessSettings } = require('../controllers/businessSettingsController');
const { authenticate, authorize } = require('../middleware/auth');

//Pass roles as individual arguments
router.get('/', authenticate, authorize('admin', 'pharmacy', 'pharmacist'), getBusinessSettings);
router.put('/', authenticate, authorize('admin', 'pharmacy', 'pharmacist'), updateBusinessSettings);



module.exports = router;