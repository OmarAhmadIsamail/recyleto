const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Refund = require('../models/Refund');
const Medicine = require('../models/Medicine');
const { validationResult } = require('express-validator');
const mailer = require('../utils/mailer');

const refundController = {
  // Get transactions eligible for refund
  getRefundEligibleTransactions: async (req, res) => {
    try {
      const pharmacyId = req.user.pharmacyId || req.user._id;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const transactions = await Transaction.find({
        pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
        createdAt: { $gte: thirtyDaysAgo },
        status: { $in: ['completed', 'partially_refunded'] }
      })
        .select('transactionRef totalAmount createdAt items')
        .sort({ createdAt: -1 })
        .limit(50);

      res.json({ success: true, transactions });
    } catch (error) {
      console.error('Get refund eligible transactions error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching transactions'
      });
    }
  },

  // Request refund
  requestRefund: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { transactionReference, reason, items } = req.body;
      const userId = req.user._id;
      const pharmacyId = req.user.pharmacyId || req.user._id;

      console.log('Refund request:', { transactionReference, reason, items, userId, pharmacyId });

      // Convert pharmacyId to ObjectId safely
      const pharmacyObjectId = new mongoose.Types.ObjectId(pharmacyId);

      // Find transaction
      const transaction = await Transaction.findOne({
        transactionRef: transactionReference,
        pharmacyId: pharmacyObjectId
      });

      if (!transaction) {
        console.log('Transaction not found in DB');
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      if (!['completed', 'partially_refunded'].includes(transaction.status)) {
        return res.status(400).json({
          success: false,
          message: 'Transaction is not eligible for refund'
        });
      }

      let refundAmount = 0;
      let refundItems = [];

      if (items?.length) {
        // Partial refund
        for (const item of items) {
          const transactionItem = transaction.items.find(
            ti => ti.medicineId.toString() === item.medicineId
          );

          if (!transactionItem) {
            return res.status(400).json({
              success: false,
              message: `Item not found in transaction: ${item.medicineId}`
            });
          }

          // Already refunded quantity
          const totalRefundedQty = transaction.refunds.reduce((sum, r) => {
            const refundedItem = r.items.find(i => i.medicineId.toString() === item.medicineId);
            return refundedItem ? sum + refundedItem.quantity : sum;
          }, 0);

          const availableQty = transactionItem.quantity - totalRefundedQty;
          if (item.quantity > availableQty) {
            return res.status(400).json({
              success: false,
              message: `Refund quantity exceeds remaining quantity for item: ${transactionItem.medicineName}`
            });
          }

          const itemTotal = item.quantity * transactionItem.unitPrice;
          refundAmount += itemTotal;
          refundItems.push({
            medicineId: new mongoose.Types.ObjectId(item.medicineId),
            name: transactionItem.medicineName,
            quantity: item.quantity,
            price: transactionItem.unitPrice,
            total: itemTotal
          });
        }
      } else {
        // Full refund
        refundItems = transaction.items.map(item => {
          const totalRefundedQty = transaction.refunds.reduce((sum, r) => {
            const refundedItem = r.items.find(i => i.medicineId.toString() === item.medicineId.toString());
            return refundedItem ? sum + refundedItem.quantity : sum;
          }, 0);

          const remainingQty = item.quantity - totalRefundedQty;
          return {
            medicineId: new mongoose.Types.ObjectId(item.medicineId),
            name: item.medicineName,
            quantity: remainingQty,
            price: item.unitPrice,
            total: remainingQty * item.unitPrice
          };
        });

        refundAmount = refundItems.reduce((sum, i) => sum + i.total, 0);
      }

      // Create refund record
      const refund = new Refund({
        transactionId: transaction._id,
        reference: `REF-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        reason,
        amount: refundAmount,
        items: refundItems,
        processedBy: userId,
        status: 'pending'
      });

      await refund.save();

      // Update transaction
      const allItemsRefunded = transaction.items.every(item => {
        const refundedQty = transaction.refunds.reduce((sum, r) => {
          const refundedItem = r.items.find(i => i.medicineId.toString() === item.medicineId.toString());
          return refundedItem ? sum + refundedItem.quantity : sum;
        }, 0) + (refundItems.find(i => i.medicineId.toString() === item.medicineId.toString())?.quantity || 0);

        return refundedQty >= item.quantity;
      });

      transaction.status = allItemsRefunded ? 'refunded' : 'partially_refunded';
      transaction.refunds.push({
        refundId: refund._id,
        amount: refundAmount,
        date: new Date(),
        reason
      });
      await transaction.save();

      // Restock medicines
      for (const item of refundItems) {
        await Medicine.findByIdAndUpdate(item.medicineId, { $inc: { quantity: item.quantity } });
      }

      // Send email
      try {
        await mailer.sendRefundConfirmation(req.user.email, {
          reference: refund.reference,
          transactionReference: transaction.transactionRef,
          amount: refundAmount,
          reason,
          status: 'pending',
          createdAt: new Date(),
          items: refundItems
        });
      } catch (emailError) {
        console.error('Failed to send refund confirmation email:', emailError);
      }

      res.status(201).json({
        success: true,
        message: 'Refund request submitted successfully',
        refund: {
          id: refund._id,
          reference: refund.reference,
          amount: refund.amount,
          status: refund.status
        }
      });

    } catch (error) {
      console.error('Request refund error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while processing refund',
        error: error.message
      });
    }
  },

  getRefundHistory: async (req, res) => {
    try {
      const pharmacyId = req.user.pharmacyId || req.user._id;
      const { page = 1, limit = 10 } = req.query;

      const refunds = await Refund.find({})
        .populate({
          path: 'transactionId',
          match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId) },
          select: 'transactionRef totalAmount'
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const filteredRefunds = refunds.filter(r => r.transactionId);
      const total = await Refund.countDocuments({});

      res.json({
        success: true,
        refunds: filteredRefunds,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page)
      });
    } catch (error) {
      console.error('Get refund history error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching refund history'
      });
    }
  }
};

module.exports = refundController;
