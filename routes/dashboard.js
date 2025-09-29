const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const { validateResult } = require('../middleware/validateResult');
const { dashboardFilterValidator, createRequestValidator } = require('../validators/dashboardValidator');

// All routes require authentication
router.use(protect);

router.get('/', dashboardFilterValidator, validateResult, dashboardController.getDashboardData);
router.get('/notifications', dashboardController.getNotifications);
router.post('/requests', createRequestValidator, validateResult, dashboardController.createRequest);

module.exports = router;