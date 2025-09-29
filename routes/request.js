// routes/request.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validateResult } = require('../middleware/validateResult');
const { medicineRequestValidator } = require('../validators/requestValidator');
const { uploadMedicineRequest } = require('../middleware/upload'); // Correct import
const {
  createMedicineRequest,
  getPharmacyMedicineRequests,
  getUserMedicineRequests,
  getMedicineRequestDetails
} = require('../controllers/requestController');

// Handle file upload errors
const handleUploadError = (error, req, res, next) => {
    if (error) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 5MB.'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files uploaded.'
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
    next();
};

// Medicine request routes
router.post(
  '/medicine',
  authenticate,
  (req, res, next) => {
      uploadMedicineRequest.single('image')(req, res, (err) => {
          if (err) return handleUploadError(err, req, res, next);
          next();
      });
  },
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