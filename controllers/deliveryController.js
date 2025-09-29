const DeliveryAddress = require('../models/DeliveryAddress');
const Transaction = require('../models/Transaction');

const deliveryController = {
  // Get all addresses for a user
  getAddresses: async (req, res) => {
    try {
      const addresses = await DeliveryAddress.find({ userId: req.user.id })
        .sort({ isDefault: -1, createdAt: -1 });
      
      res.json({
        success: true,
        data: addresses
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching addresses',
        error: error.message
      });
    }
  },

  // Create new address
  createAddress: async (req, res) => {
    try {
      const addressData = {
        userId: req.user.id,
        ...req.body
      };

      const address = new DeliveryAddress(addressData);
      await address.save();

      res.status(201).json({
        success: true,
        message: 'Address created successfully',
        data: address
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating address',
        error: error.message
      });
    }
  },

  // Update address
  updateAddress: async (req, res) => {
    try {
      const address = await DeliveryAddress.findOne({
        _id: req.params.id,
        userId: req.user.id
      });

      if (!address) {
        return res.status(404).json({
          success: false,
          message: 'Address not found'
        });
      }

      Object.assign(address, req.body);
      await address.save();

      res.json({
        success: true,
        message: 'Address updated successfully',
        data: address
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating address',
        error: error.message
      });
    }
  },

  // Delete address
  deleteAddress: async (req, res) => {
    try {
      const address = await DeliveryAddress.findOneAndDelete({
        _id: req.params.id,
        userId: req.user.id
      });

      if (!address) {
        return res.status(404).json({
          success: false,
          message: 'Address not found'
        });
      }

      res.json({
        success: true,
        message: 'Address deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting address',
        error: error.message
      });
    }
  },

  // Set delivery option for transaction
  setDeliveryOption: async (req, res) => {
    try {
      const { deliveryOption, deliveryAddressId } = req.body;
      const transaction = await Transaction.findOne({
        _id: req.params.transactionId,
        userId: req.user.id
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      if (deliveryOption === 'delivery') {
        const address = await DeliveryAddress.findOne({
          _id: deliveryAddressId,
          userId: req.user.id
        });

        if (!address) {
          return res.status(404).json({
            success: false,
            message: 'Delivery address not found'
          });
        }

        transaction.deliveryAddress = deliveryAddressId;
        transaction.deliveryFee = 5.00; // Example fixed fee
        transaction.estimatedDelivery = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
      }

      transaction.deliveryOption = deliveryOption;
      await transaction.save();

      res.json({
        success: true,
        message: 'Delivery option updated successfully',
        data: transaction
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error setting delivery option',
        error: error.message
      });
    }
  },

  // Update delivery status (for admin)
  updateDeliveryStatus: async (req, res) => {
    try {
      const { status, notes } = req.body;
      const transaction = await Transaction.findById(req.params.transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      transaction.deliveryStatus = status;
      if (notes) transaction.deliveryNotes = notes;
      
      if (status === 'delivered') {
        transaction.actualDelivery = new Date();
      }

      await transaction.save();

      res.json({
        success: true,
        message: 'Delivery status updated successfully',
        data: transaction
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating delivery status',
        error: error.message
      });
    }
  },

  // Get delivery tracking info
  trackDelivery: async (req, res) => {
    try {
      const transaction = await Transaction.findOne({
        _id: req.params.transactionId,
        userId: req.user.id
      }).populate('deliveryAddress');

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      res.json({
        success: true,
        data: {
          deliveryStatus: transaction.deliveryStatus,
          estimatedDelivery: transaction.estimatedDelivery,
          actualDelivery: transaction.actualDelivery,
          deliveryAddress: transaction.deliveryAddress,
          deliveryNotes: transaction.deliveryNotes
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching delivery tracking',
        error: error.message
      });
    }
  }
};

module.exports = deliveryController;