const Sale = require('../models/Sale');
const Transaction = require('../models/Transaction');
const Receipt = require('../models/Receipt');
const Refund = require('../models/Refund');
const Medicine = require('../models/Medicine');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * Sync all existing completed transactions to sales
 */
const syncAllCompletedTransactions = async (pharmacyId) => {
  try {
    console.log('🔄 Syncing all completed transactions to sales for pharmacy:', pharmacyId);

    const completedTransactions = await Transaction.find({
      pharmacyId,
      status: 'completed'
    })
    .populate('items.medicineId')
    .populate('pharmacyId', 'businessName');

    console.log(`📊 Found ${completedTransactions.length} completed transactions`);

    let createdCount = 0;
    let errorCount = 0;

    for (const transaction of completedTransactions) {
      try {
        // Use the existing syncTransactionToSales function for consistency
        const sale = await syncTransactionToSales(transaction._id);
        if (sale) {
          createdCount++;
          console.log(`✅ Created sale for transaction: ${transaction.transactionNumber}`);
        } else {
          console.log(`ℹ️ Sale already exists or transaction not completed: ${transaction.transactionNumber}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error creating sale for transaction ${transaction.transactionNumber}:`, error.message);
      }
    }

    console.log(`🎉 Sync completed: ${createdCount} sales created, ${errorCount} errors`);
    return { createdCount, errorCount, total: completedTransactions.length };

  } catch (error) {
    console.error('❌ Error syncing all transactions:', error);
    throw error;
  }
};

/**
 * Sync completed transaction to sales
 */
const syncTransactionToSales = async (transactionId) => {
  try {
    console.log('🔄 Syncing transaction to sales:', transactionId);

    const transaction = await Transaction.findById(transactionId)
      .populate('items.medicineId')
      .populate('pharmacyId', 'businessName');

    if (!transaction || transaction.status !== 'completed') {
      console.log('Transaction not found or not completed');
      return null;
    }

    // Check if sale already exists
    const existingSale = await Sale.findOne({ transactionId });
    if (existingSale) {
      console.log('Sale already exists for this transaction');
      return existingSale;
    }

    // Get receipt for this transaction
    const receipt = await Receipt.findOne({ transactionId });

    // Calculate profit for each item
    const saleItems = await Promise.all(
      transaction.items.map(async (item) => {
        const medicine = await Medicine.findById(item.medicineId);
        const costPrice = medicine?.costPrice || item.unitPrice * 0.7; // Default 30% margin
        const profit = (item.unitPrice - costPrice) * item.quantity;

        return {
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          genericName: item.genericName,
          form: item.form,
          packSize: item.packSize,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          manufacturer: item.manufacturer,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          costPrice: costPrice,
          profit: profit
        };
      })
    );

    const totalProfit = saleItems.reduce((sum, item) => sum + item.profit, 0);

    // Create sale record
    const sale = new Sale({
      pharmacyId: transaction.pharmacyId,
      pharmacyName: transaction.pharmacyId.businessName,
      transactionId: transaction._id,
      transactionNumber: transaction.transactionNumber,
      transactionType: transaction.transactionType,
      transactionDate: transaction.checkoutDate || transaction.createdAt,
      receiptId: receipt?._id,
      receiptNumber: receipt?.receiptNumber,
      customerInfo: transaction.customerInfo,
      items: saleItems,
      payment: transaction.payment,
      subtotal: transaction.subtotal,
      tax: transaction.tax,
      discount: transaction.discount,
      deliveryFee: transaction.deliveryFee || 0,
      totalAmount: transaction.totalAmount,
      totalProfit: totalProfit,
      deliveryOption: transaction.deliveryOption,
      deliveryStatus: transaction.deliveryStatus,
      isPrescription: transaction.isPrescription,
      prescriptionId: transaction.prescriptionId,
      saleType: transaction.saleType || 'walkin',
      status: 'completed'
    });

    await sale.save();
    console.log('✅ Sale record created:', sale._id);

    return sale;
  } catch (error) {
    console.error('❌ Error syncing transaction to sales:', error);
    throw error;
  }
};

/**
 * Sync refund to sales record
 */
const syncRefundToSales = async (refundId) => {
  try {
    console.log('🔄 Syncing refund to sales:', refundId);

    const refund = await Refund.findById(refundId)
      .populate('receiptId')
      .populate('transactionId');

    if (!refund) {
      console.log('Refund not found');
      return null;
    }

    // Find existing sale record
    const sale = await Sale.findOne({ transactionId: refund.transactionId });
    if (!sale) {
      console.log('Sale record not found for transaction');
      return null;
    }

    // Update sale with refund information
    sale.refundId = refund._id;
    sale.refundNumber = refund.refundNumber;
    sale.refundAmount = refund.refundAmount;

    // Determine refund status
    if (refund.status === 'completed') {
      if (refund.refundType === 'full') {
        sale.status = 'refunded';
        sale.refundStatus = 'completed';
      } else {
        sale.status = 'partially_refunded';
        sale.refundStatus = 'partial';
      }
    } else {
      sale.refundStatus = refund.status;
    }

    await sale.save();
    console.log('✅ Sale record updated with refund info');

    return sale;
  } catch (error) {
    console.error('❌ Error syncing refund to sales:', error);
    throw error;
  }
};

/**
 * Get comprehensive sales report
 */
const getSalesReport = async (pharmacyId, filters = {}) => {
  try {
    const {
      startDate,
      endDate,
      medicineId,
      paymentMethod,
      saleType,
      deliveryOption,
      status,
      refundStatus,
      page = 1,
      limit = 50
    } = filters;

    // Convert to ObjectId properly
    const pharmacyObjectId = new mongoose.Types.ObjectId(pharmacyId);

    const query = { 
      pharmacyId: pharmacyObjectId,
      status: { $ne: 'cancelled' } // Exclude cancelled sales by default
    };

    // Date filter - using transactionDate from Sale model
    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) query.transactionDate.$gte = new Date(startDate);
      if (endDate) query.transactionDate.$lte = new Date(endDate);
    }

    // Other filters
    if (medicineId) {
      query['items.medicineId'] = new mongoose.Types.ObjectId(medicineId);
    }
    if (paymentMethod) {
      query['payment.method'] = paymentMethod;
    }
    if (saleType) {
      query.saleType = saleType;
    }
    if (deliveryOption) {
      query.deliveryOption = deliveryOption;
    }
    if (status) {
      query.status = status;
    }
    if (refundStatus) {
      query.refundStatus = refundStatus;
    }

    // Get sales with relevant population
    const sales = await Sale.find(query)
      .populate('items.medicineId', 'name genericName form strength manufacturer')
      .populate('customerInfo.customerId', 'name phone email')
      .populate('prescriptionId', 'prescriptionNumber status')
      .populate('refundId', 'refundNumber refundAmount status')
      .sort({ transactionDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Sale.countDocuments(query);

    // Get summary statistics using aggregation - optimized for Sale model
    const summary = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$totalProfit' },
          totalTax: { $sum: '$tax' },
          totalDiscount: { $sum: '$discount' },
          totalDeliveryFee: { $sum: '$deliveryFee' },
          totalRefundAmount: { $sum: { $ifNull: ['$refundAmount', 0] } },
          averageOrderValue: { $avg: '$totalAmount' },
          // Additional metrics for better insights
          totalItemsSold: { $sum: { $size: '$items' } },
          totalQuantitySold: {
            $sum: {
              $reduce: {
                input: '$items',
                initialValue: 0,
                in: { $add: ['$$value', '$$this.quantity'] }
              }
            }
          }
        }
      }
    ]);

    // Get top medicines with enhanced metrics
    const topMedicines = await Sale.aggregate([
      { $match: query },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.medicineId',
          medicineName: { $first: '$items.medicineName' },
          genericName: { $first: '$items.genericName' },
          form: { $first: '$items.form' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
          totalProfit: { $sum: '$items.profit' },
          totalCost: { $sum: { $multiply: ['$items.costPrice', '$items.quantity'] } },
          saleCount: { $sum: 1 },
          averagePrice: { $avg: '$items.unitPrice' }
        }
      },
      {
        $addFields: {
          profitMargin: {
            $cond: [
              { $eq: ['$totalRevenue', 0] },
              0,
              { $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] }
            ]
          }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    // Get sales trends by date
    const salesTrends = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$transactionDate"
            }
          },
          dailySales: { $sum: 1 },
          dailyRevenue: { $sum: '$totalAmount' },
          dailyProfit: { $sum: '$totalProfit' }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 } // Last 30 days
    ]);

    // Get payment method breakdown
    const paymentBreakdown = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$payment.method',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Get delivery status breakdown
    const deliveryBreakdown = await Sale.aggregate([
      { $match: { ...query, deliveryOption: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$deliveryStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const summaryData = summary[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalTax: 0,
      totalDiscount: 0,
      totalDeliveryFee: 0,
      totalRefundAmount: 0,
      averageOrderValue: 0,
      totalItemsSold: 0,
      totalQuantitySold: 0
    };

    // Calculate net revenue after refunds
    const netRevenue = summaryData.totalRevenue - summaryData.totalRefundAmount;

    return {
      sales,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      summary: {
        ...summaryData,
        netRevenue,
        profitMargin: summaryData.totalRevenue > 0 
          ? (summaryData.totalProfit / summaryData.totalRevenue) * 100 
          : 0
      },
      topMedicines,
      trends: {
        salesTrends,
        paymentBreakdown,
        deliveryBreakdown
      },
      analytics: {
        averageItemsPerOrder: total > 0 ? summaryData.totalItemsSold / total : 0,
        conversionRate: 0, // This would need additional data from visits/transactions
        refundRate: summaryData.totalRevenue > 0 
          ? (summaryData.totalRefundAmount / summaryData.totalRevenue) * 100 
          : 0
      }
    };
  } catch (error) {
    console.error('❌ Error generating sales report:', error);
    throw error;
  }
};

// Export all functions
module.exports = {
  syncTransactionToSales,
  syncRefundToSales,
  syncAllCompletedTransactions,
  getSalesReport
};