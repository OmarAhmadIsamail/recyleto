// controllers/paymentMethodController.js
const PaymentMethod = require('../models/PaymentMethod');
const { validationResult } = require('express-validator');

const paymentMethodController = {
  // Get user's payment methods
  getPaymentMethods: async (req, res) => {
    try {
      const paymentMethods = await PaymentMethod.find({
        userId: req.user.id,
        isActive: true
      }).sort({ isDefault: -1, createdAt: -1 });

      res.json({
        success: true,
        data: paymentMethods
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching payment methods',
        error: error.message
      });
    }
  },

  // Create new payment method
  createPaymentMethod: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { type, name, isDefault, ...methodData } = req.body;

      // If setting as default, unset other defaults
      if (isDefault) {
        await PaymentMethod.updateMany(
          { userId: req.user.id, isDefault: true },
          { isDefault: false }
        );
      }

      // For security, only store last 4 digits of card number
      if (type === 'card' && methodData.cardNumber) {
        methodData.cardLastFour = methodData.cardNumber.slice(-4);
        // In production, you should encrypt the card number
      }

      const paymentMethod = new PaymentMethod({
        userId: req.user.id,
        type,
        name,
        isDefault: isDefault || false,
        ...methodData
      });

      await paymentMethod.save();

      res.status(201).json({
        success: true,
        message: 'Payment method added successfully',
        data: paymentMethod
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Cannot have multiple default payment methods'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating payment method',
        error: error.message
      });
    }
  },

  // Update payment method
  updatePaymentMethod: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { isDefault, ...updateData } = req.body;

      const paymentMethod = await PaymentMethod.findOne({
        _id: id,
        userId: req.user.id
      });

      if (!paymentMethod) {
        return res.status(404).json({
          success: false,
          message: 'Payment method not found'
        });
      }

      // Handle default payment method update
      if (isDefault && !paymentMethod.isDefault) {
        await PaymentMethod.updateMany(
          { userId: req.user.id, isDefault: true },
          { isDefault: false }
        );
        paymentMethod.isDefault = true;
      }

      Object.assign(paymentMethod, updateData);
      await paymentMethod.save();

      res.json({
        success: true,
        message: 'Payment method updated successfully',
        data: paymentMethod
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating payment method',
        error: error.message
      });
    }
  },

  // Delete payment method
  deletePaymentMethod: async (req, res) => {
    try {
      const { id } = req.params;

      const paymentMethod = await PaymentMethod.findOneAndUpdate(
        { _id: id, userId: req.user.id },
        { isActive: false },
        { new: true }
      );

      if (!paymentMethod) {
        return res.status(404).json({
          success: false,
          message: 'Payment method not found'
        });
      }

      res.json({
        success: true,
        message: 'Payment method deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting payment method',
        error: error.message
      });
    }
  },

  // Set default payment method
  setDefaultPaymentMethod: async (req, res) => {
    try {
      const { id } = req.params;

      // Unset all other default payment methods
      await PaymentMethod.updateMany(
        { userId: req.user.id, isDefault: true },
        { isDefault: false }
      );

      // Set new default
      const paymentMethod = await PaymentMethod.findOneAndUpdate(
        { _id: id, userId: req.user.id },
        { isDefault: true },
        { new: true }
      );

      if (!paymentMethod) {
        return res.status(404).json({
          success: false,
          message: 'Payment method not found'
        });
      }

      res.json({
        success: true,
        message: 'Default payment method updated successfully',
        data: paymentMethod
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error setting default payment method',
        error: error.message
      });
    }
  }
};

module.exports = paymentMethodController;