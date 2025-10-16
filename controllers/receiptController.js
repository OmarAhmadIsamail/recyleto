const Receipt = require('../models/Receipt');
const Transaction = require('../models/Transaction');

/**
 * Get all receipts for pharmacy
 */
const getReceipts = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { page = 1, limit = 10, startDate, endDate } = req.query;

    const query = { pharmacyId };
    
    // Date range filter
    if (startDate || endDate) {
      query.receiptDate = {};
      if (startDate) query.receiptDate.$gte = new Date(startDate);
      if (endDate) query.receiptDate.$lte = new Date(endDate);
    }

    const receipts = await Receipt.find(query)
      .populate({
        path: 'transactionId',
        select: 'transactionNumber checkoutDate',
        // Add safe transformation to handle virtual fields
        transform: (doc) => {
          if (doc) {
            return {
              _id: doc._id,
              transactionNumber: doc.transactionNumber,
              checkoutDate: doc.checkoutDate,
              // Explicitly include any other fields you need
              itemCount: doc.items ? doc.items.length : 0
            };
          }
          return doc;
        }
      })
      .sort({ receiptDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean(); // Use lean() to get plain objects and avoid virtuals

    const total = await Receipt.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        receipts,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching receipts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get receipt by ID
 */
const getReceiptById = async (req, res) => {
  try {
    const { id } = req.params;
    const pharmacyId = req.user.pharmacyId || req.user._id;

    const receipt = await Receipt.findOne({
      _id: id,
      pharmacyId
    }).populate({
      path: 'transactionId',
      select: 'transactionNumber checkoutDate deliveryOption',
      transform: (doc) => {
        if (doc) {
          return {
            _id: doc._id,
            transactionNumber: doc.transactionNumber,
            checkoutDate: doc.checkoutDate,
            deliveryOption: doc.deliveryOption,
            itemCount: doc.items ? doc.items.length : 0
          };
        }
        return doc;
      }
    }).lean();

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { receipt }
    });
  } catch (error) {
    console.error('Get receipt by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching receipt',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get receipt by receipt number
 */
const getReceiptByNumber = async (req, res) => {
  try {
    const { receiptNumber } = req.params;
    const pharmacyId = req.user.pharmacyId || req.user._id;

    const receipt = await Receipt.findOne({
      receiptNumber,
      pharmacyId
    }).populate({
      path: 'transactionId',
      select: 'transactionNumber checkoutDate deliveryOption',
      transform: (doc) => {
        if (doc) {
          return {
            _id: doc._id,
            transactionNumber: doc.transactionNumber,
            checkoutDate: doc.checkoutDate,
            deliveryOption: doc.deliveryOption,
            itemCount: doc.items ? doc.items.length : 0
          };
        }
        return doc;
      }
    }).lean();

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { receipt }
    });
  } catch (error) {
    console.error('Get receipt by number error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching receipt',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get receipts by transaction ID
 */
const getReceiptsByTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const pharmacyId = req.user.pharmacyId || req.user._id;

    const receipts = await Receipt.find({
      transactionId,
      pharmacyId
    }).populate({
      path: 'transactionId',
      select: 'transactionNumber checkoutDate',
      transform: (doc) => {
        if (doc) {
          return {
            _id: doc._id,
            transactionNumber: doc.transactionNumber,
            checkoutDate: doc.checkoutDate,
            itemCount: doc.items ? doc.items.length : 0
          };
        }
        return doc;
      }
    }).lean();

    res.status(200).json({
      success: true,
      data: { receipts }
    });
  } catch (error) {
    console.error('Get receipts by transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching receipts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Export all functions
module.exports = {
  getReceipts,
  getReceiptById,
  getReceiptByNumber,
  getReceiptsByTransaction
};