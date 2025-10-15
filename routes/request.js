// routes/request.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validateResult } = require('../middleware/validateResult');
const { medicineRequestValidator } = require('../validators/requestValidator');
const { uploadMedicineRequest, handleMulterError } = require('../middleware/upload'); 
const {
  createMedicineRequest,
  getPharmacyMedicineRequests,
  getUserMedicineRequests,
  getMedicineRequestDetails
} = require('../controllers/requestController');

// Medicine request routes
router.post(
  '/medicine',
  authenticate,
  uploadMedicineRequest, // Use the pre-configured middleware directly
  handleMulterError, // Now this function is defined
  medicineRequestValidator,
  validateResult,
  createMedicineRequest
);

router.get('/medicine/user', authenticate, getUserMedicineRequests);
router.get('/medicine/:requestId', authenticate, getMedicineRequestDetails);

// Pharmacy staff routes for medicine requests (pharmacists, admins, assistants)
router.get(
  '/medicine/pharmacy/all',
  authenticate,
  authorize(['pharmacist', 'admin', 'assistant']),
  getPharmacyMedicineRequests
);

module.exports = router;