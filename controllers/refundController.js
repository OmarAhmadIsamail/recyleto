const Refund = require('../models/Refund');
const Receipt = require('../models/Receipt');
const Transaction = require('../models/Transaction');
const Medicine = require('../models/Medicine');
const { syncRefundToSales } = require('../services/salesService');

/**
 * Create a refund request
 */
const createRefund = async (req, res) => {
  try {
    const { receiptNumber, refundReason, refundItems, notes } = req.body;
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const userId = req.user._id;

    console.log('🔄 Creating refund for receipt:', receiptNumber);

    // Validate required fields
    if (!receiptNumber || !refundReason) {
      return res.status(400).json({
        success: false,
        message: 'Receipt number and refund reason are required'
      });
    }

    // Find receipt with transaction details
    const receipt = await Receipt.findOne({
      receiptNumber,
      pharmacyId
    }).populate('transactionId');

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    console.log('📋 Found receipt:', receipt.receiptNumber);

    // Check if receipt is eligible for refund (within 30 days)
    const receiptDate = new Date(receipt.receiptDate);
    const daysSincePurchase = Math.floor((new Date() - receiptDate) / (1000 * 60 * 60 * 24));
    
    if (daysSincePurchase > 30) {
      return res.status(400).json({
        success: false,
        message: 'Refund period has expired (30 days from purchase)'
      });
    }

    // Check for existing pending refund for this receipt
    const existingRefund = await Refund.findOne({
      receiptId: receipt._id,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingRefund) {
      return res.status(400).json({
        success: false,
        message: `There is already a ${existingRefund.status} refund for this receipt (${existingRefund.refundNumber})`
      });
    }

    let refundItemsData = [];
    let refundType = 'full';

    // If specific items are provided for partial refund
    if (refundItems && refundItems.length > 0) {
      refundType = 'partial';
      
      for (const refundItem of refundItems) {
        const originalItem = receipt.items.find(item => 
          item.medicineId.toString() === refundItem.medicineId
        );

        if (!originalItem) {
          return res.status(400).json({
            success: false,
            message: `Item not found in receipt: ${refundItem.medicineId}`
          });
        }

        if (refundItem.quantity > originalItem.quantity) {
          return res.status(400).json({
            success: false,
            message: `Refund quantity (${refundItem.quantity}) exceeds purchased quantity (${originalItem.quantity}) for ${originalItem.medicineName}`
          });
        }

        refundItemsData.push({
          medicineId: originalItem.medicineId,
          medicineName: originalItem.medicineName,
          originalQuantity: originalItem.quantity,
          refundQuantity: refundItem.quantity,
          unitPrice: originalItem.unitPrice,
          totalRefundAmount: refundItem.quantity * originalItem.unitPrice,
          batchNumber: originalItem.batchNumber,
          expiryDate: originalItem.expiryDate
        });
      }
    } else {
      // Full refund - all items
      refundItemsData = receipt.items.map(item => ({
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        originalQuantity: item.quantity,
        refundQuantity: item.quantity,
        unitPrice: item.unitPrice,
        totalRefundAmount: item.quantity * item.unitPrice,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate
      }));
    }

    // Calculate refund amount
    const refundAmount = refundItemsData.reduce((total, item) => total + item.totalRefundAmount, 0);

    // Generate refund number
    const refundNumber = await Refund.generateRefundNumber();

    // Create refund
    const refund = new Refund({
      refundNumber,
      receiptId: receipt._id,
      receiptNumber: receipt.receiptNumber,
      transactionId: receipt.transactionId._id,
      transactionNumber: receipt.transactionId.transactionNumber,
      pharmacyId,
      userId,
      customerInfo: receipt.customerInfo,
      refundItems: refundItemsData,
      originalAmount: receipt.totalAmount,
      refundAmount,
      refundReason,
      refundType,
      paymentMethod: 'original_method', // Default to original payment method
      status: 'pending',
      notes
    });

    await refund.save();

    console.log('✅ Refund created:', refundNumber);

    // Populate the refund for response
    const populatedRefund = await Refund.findById(refund._id)
      .populate('receiptId', 'receiptNumber receiptDate')
      .populate('transactionId', 'transactionNumber checkoutDate');

    res.status(201).json({
      success: true,
      message: 'Refund request created successfully',
      data: {
        refund: populatedRefund,
        summary: {
          refundAmount,
          refundType,
          itemsCount: refundItemsData.length,
          daysSincePurchase
        }
      }
    });

  } catch (error) {
    console.error('❌ Create refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating refund request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all refunds for pharmacy
 */
const getRefunds = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;

    const query = { pharmacyId };
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const refunds = await Refund.find(query)
      .populate('receiptId', 'receiptNumber receiptDate')
      .populate('transactionId', 'transactionNumber checkoutDate')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Refund.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        refunds,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get refunds error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching refunds',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get refund by ID
 */
const getRefundById = async (req, res) => {
  try {
    const { id } = req.params;
    const pharmacyId = req.user.pharmacyId || req.user._id;

    const refund = await Refund.findOne({
      _id: id,
      pharmacyId
    })
    .populate('receiptId')
    .populate('transactionId')
    .populate('approvedBy', 'name email')
    .lean();

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Refund not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { refund }
    });
  } catch (error) {
    console.error('Get refund by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching refund',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get refund by refund number
 */
const getRefundByNumber = async (req, res) => {
  try {
    const { refundNumber } = req.params;
    const pharmacyId = req.user.pharmacyId || req.user._id;

    const refund = await Refund.findOne({
      refundNumber,
      pharmacyId
    })
    .populate('receiptId')
    .populate('transactionId')
    .populate('approvedBy', 'name email')
    .lean();

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Refund not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { refund }
    });
  } catch (error) {
    console.error('Get refund by number error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching refund',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Approve refund
 */
const approveRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, notes } = req.body;
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const userId = req.user._id;

    const refund = await Refund.findOne({
      _id: id,
      pharmacyId,
      status: 'pending'
    }).populate('receiptId').populate('transactionId');

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Pending refund not found'
      });
    }

    // Update stock for refunded items
    for (const item of refund.refundItems) {
      await Medicine.findByIdAndUpdate(
        item.medicineId,
        { $inc: { quantity: item.refundQuantity } }
      );
    }

    // Update refund status
    refund.status = 'approved';
    refund.approvedBy = userId;
    refund.approvedAt = new Date();
    refund.paymentMethod = paymentMethod || refund.paymentMethod;
    if (notes) refund.notes = notes;

    await refund.save();

    console.log('✅ Refund approved:', refund.refundNumber);

    // Sync refund data to sales
    await syncRefundToSales(refund._id);

    res.status(200).json({
      success: true,
      message: 'Refund approved successfully',
      data: { refund }
    });

  } catch (error) {
    console.error('Approve refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving refund',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Reject refund
 */
const rejectRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const pharmacyId = req.user.pharmacyId || req.user._id;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const refund = await Refund.findOne({
      _id: id,
      pharmacyId,
      status: 'pending'
    });

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Pending refund not found'
      });
    }

    refund.status = 'rejected';
    refund.rejectionReason = rejectionReason;
    await refund.save();

    console.log('❌ Refund rejected:', refund.refundNumber);

    res.status(200).json({
      success: true,
      message: 'Refund rejected successfully',
      data: { refund }
    });

  } catch (error) {
    console.error('Reject refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting refund',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Complete refund (mark as paid)
 */
const completeRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const pharmacyId = req.user.pharmacyId || req.user._id;

    const refund = await Refund.findOne({
      _id: id,
      pharmacyId,
      status: 'approved'
    });

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Approved refund not found'
      });
    }

    refund.status = 'completed';
    refund.completedAt = new Date();
    await refund.save();

    console.log('💰 Refund completed:', refund.refundNumber);

    // Sync refund data to sales
    await syncRefundToSales(refund._id);

    res.status(200).json({
      success: true,
      message: 'Refund marked as completed',
      data: { refund }
    });

  } catch (error) {
    console.error('Complete refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing refund',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createRefund,
  getRefunds,
  getRefundById,
  getRefundByNumber,
  approveRefund,
  rejectRefund,
  completeRefund
};