const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { updateProfileValidator, changePasswordValidator } = require('../validators/profileValidator');
const { validateResult } = require('../middleware/validateResult');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload'); // ✅ FIXED (destructure upload)

// Apply authentication to all routes
router.use(authenticate);

// Get current user profile
router.get('/', profileController.getProfile);

// Update profile information
router.put(
  '/',
  upload.single('licenseImage'), // ✅ now works
  updateProfileValidator,
  validateResult,
  profileController.updateProfile
);

// Change password
router.post(
  '/change-password',
  changePasswordValidator,
  validateResult,
  profileController.changePassword
);

module.exports = router;
