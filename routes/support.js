// routes/support.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const supportController = require('../controllers/supportController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadSupport } = require('../middleware/upload');
const {
  createSupportTicketValidator,
  addMessageValidator,
  updateTicketStatusValidator
} = require('../validators/supportValidator');
const { validateResult } = require('../middleware/validateResult');

// Handle file upload errors
const handleUploadError = (error, req, res, next) => {
    if (error) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 10MB.'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files uploaded. Maximum 3 files allowed.'
            });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                message: 'Unexpected field name for file upload.'
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
    next();
};

// Test route to check if Counter works - remove after testing
router.get('/test-counter', async (req, res) => {
  try {
    const Counter = mongoose.model('Counter');
    const counter = await Counter.findOneAndUpdate(
      { name: 'testCounter' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    res.json({ 
      success: true, 
      message: 'Counter test successful',
      counter 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Counter test failed',
      error: error.message 
    });
  }
});

// User routes
router.post(
  '/tickets',
  authenticate,
  (req, res, next) => {
      uploadSupport.array('attachments', 3)(req, res, (err) => {
          if (err) return handleUploadError(err, req, res, next);
          next();
      });
  },
  ...createSupportTicketValidator,
  validateResult,
  supportController.createTicket
);

router.get(
  '/tickets',
  authenticate,
  supportController.getUserTickets
);

router.get(
  '/tickets/:ticketId',
  authenticate,
  supportController.getTicket
);

router.post(
  '/tickets/:ticketId/messages',
  authenticate,
  (req, res, next) => {
      uploadSupport.array('attachments', 3)(req, res, (err) => {
          if (err) return handleUploadError(err, req, res, next);
          next();
      });
  },
  ...addMessageValidator,
  validateResult,
  supportController.addMessage
);

// Admin routes
router.get(
  '/admin/tickets',
  authenticate,
  authorize(['admin']),
  supportController.getAllTickets
);

router.patch(
  '/admin/tickets/:ticketId/status',
  authenticate,
  authorize(['admin']),
  ...updateTicketStatusValidator,
  validateResult,
  supportController.updateTicketStatus
);

router.post(
  '/admin/tickets/:ticketId/messages',
  authenticate,
  authorize(['admin']),
  (req, res, next) => {
      uploadSupport.array('attachments', 3)(req, res, (err) => {
          if (err) return handleUploadError(err, req, res, next);
          next();
      });
  },
  ...addMessageValidator,
  validateResult,
  supportController.addAdminResponse
);

router.get(
  '/admin/support-stats',
  authenticate,
  authorize(['admin']),
  supportController.getSupportStats
);

module.exports = router;