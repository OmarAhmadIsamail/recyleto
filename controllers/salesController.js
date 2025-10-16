const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Medicine = require('../models/Medicine');
const Transaction = require('../models/Transaction');
const Receipt = require('../models/Receipt');
const Refund = require('../models/Refund');

/**
 * GET /sales - Show all medicines, transactions, receipts, and purchases
 */
const getAllSalesData = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const pharmacyObjectId = new mongoose.Types.ObjectId(pharmacyId);

    // Get all data in parallel
    const [
      medicines,
      transactions,
      receipts,
      sales,
      refunds
    ] = await Promise.all([
      // All medicines
      Medicine.find({ pharmacyId: pharmacyObjectId })
        .select('name _id quantity price costPrice manufacturer form')
        .lean(),

      // All transactions
      Transaction.find({ pharmacyId: pharmacyObjectId })
        .select('transactionNumber _id transactionType status totalAmount checkoutDate')
        .sort({ checkoutDate: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean(),

      // All receipts
      Receipt.find({ pharmacyId: pharmacyObjectId })
        .select('receiptNumber _id receiptDate transactionId totalAmount customerInfo')
        .sort({ receiptDate: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean(),

      // All sales with purchases
      Sale.find({ pharmacyId: pharmacyObjectId })
        .select('transactionId transactionNumber receiptNumber items totalAmount transactionDate status')
        .sort({ transactionDate: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean(),

      // All refunds
      Refund.find({ pharmacyId: pharmacyObjectId })
        .select('refundNumber receiptNumber transactionNumber refundAmount status refundReason createdAt')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    // Format the data
    const formattedData = {
      medicines: medicines.map(med => ({
        medicineId: med._id,
        medicineName: med.name,
        quantity: med.quantity,
        price: med.price,
        costPrice: med.costPrice,
        manufacturer: med.manufacturer,
        form: med.form
      })),

      transactions: transactions.map(trans => ({
        transactionId: trans._id,
        transactionNumber: trans.transactionNumber,
        transactionType: trans.transactionType,
        status: trans.status,
        totalAmount: trans.totalAmount,
        checkoutDate: trans.checkoutDate
      })),

      receipts: receipts.map(receipt => ({
        receiptId: receipt._id,
        receiptNumber: receipt.receiptNumber,
        transactionId: receipt.transactionId,
        receiptDate: receipt.receiptDate,
        totalAmount: receipt.totalAmount,
        customerName: receipt.customerInfo?.name || 'N/A'
      })),

      purchases: sales.flatMap(sale => 
        sale.items.map(item => ({
          transactionNumber: sale.transactionNumber,
          receiptNumber: sale.receiptNumber,
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          purchaseDate: sale.transactionDate,
          status: sale.status
        }))
      ),

      refunds: refunds.map(refund => ({
        refundNumber: refund.refundNumber,
        receiptNumber: refund.receiptNumber,
        transactionNumber: refund.transactionNumber,
        refundAmount: refund.refundAmount,
        status: refund.status,
        refundReason: refund.refundReason,
        createdAt: refund.createdAt
      }))
    };

    // Get counts for pagination
    const [
      medicinesCount,
      transactionsCount,
      receiptsCount,
      salesCount,
      refundsCount
    ] = await Promise.all([
      Medicine.countDocuments({ pharmacyId: pharmacyObjectId }),
      Transaction.countDocuments({ pharmacyId: pharmacyObjectId }),
      Receipt.countDocuments({ pharmacyId: pharmacyObjectId }),
      Sale.countDocuments({ pharmacyId: pharmacyObjectId }),
      Refund.countDocuments({ pharmacyId: pharmacyObjectId })
    ]);

    res.status(200).json({
      success: true,
      data: formattedData,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(Math.max(medicinesCount, transactionsCount, receiptsCount, salesCount) / limit),
        totals: {
          medicines: medicinesCount,
          transactions: transactionsCount,
          receipts: receiptsCount,
          sales: salesCount,
          refunds: refundsCount
        }
      }
    });
  } catch (error) {
    console.error('Get all sales data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sales data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /sales/analysis - Show analysis of medicines, transactions, and refund requests
 */
const getSalesAnalysis = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { period = 'all' } = req.query; // all, today, week, month, year

    const pharmacyObjectId = new mongoose.Types.ObjectId(pharmacyId);

    // Date filters based on period
    const dateFilter = getDateFilter(period);

    // Get all analysis data in parallel
    const [
      medicineAnalysis,
      transactionAnalysis,
      refundAnalysis,
      salesTrend,
      topMedicines,
      revenueAnalysis
    ] = await Promise.all([
      // Medicine Analysis
      Medicine.aggregate([
        { $match: { pharmacyId: pharmacyObjectId } },
        {
          $group: {
            _id: null,
            totalMedicines: { $sum: 1 },
            totalStock: { $sum: '$quantity' },
            lowStock: {
              $sum: {
                $cond: [{ $lte: ['$quantity', 10] }, 1, 0]
              }
            },
            outOfStock: {
              $sum: {
                $cond: [{ $eq: ['$quantity', 0] }, 1, 0]
              }
            },
            averagePrice: { $avg: '$price' },
            totalInventoryValue: {
              $sum: { $multiply: ['$quantity', '$price'] }
            }
          }
        }
      ]),

      // Transaction Analysis
      Transaction.aggregate([
        {
          $match: {
            pharmacyId: pharmacyObjectId,
            ...(dateFilter && { checkoutDate: dateFilter })
          }
        },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            completedTransactions: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            pendingTransactions: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            totalRevenue: { $sum: '$totalAmount' },
            averageTransactionValue: { $avg: '$totalAmount' }
          }
        }
      ]),

      // Refund Analysis
      Refund.aggregate([
        {
          $match: {
            pharmacyId: pharmacyObjectId,
            ...(dateFilter && { createdAt: dateFilter })
          }
        },
        {
          $group: {
            _id: null,
            totalRefundRequests: { $sum: 1 },
            pendingRefunds: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            approvedRefunds: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
            },
            completedRefunds: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            rejectedRefunds: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            },
            totalRefundAmount: { $sum: '$refundAmount' },
            averageRefundAmount: { $avg: '$refundAmount' }
          }
        }
      ]),

      // Sales Trend
      Sale.aggregate([
        {
          $match: {
            pharmacyId: pharmacyObjectId,
            ...(dateFilter && { transactionDate: dateFilter })
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$transactionDate' },
              month: { $month: '$transactionDate' },
              day: { $dayOfMonth: '$transactionDate' }
            },
            dailySales: { $sum: 1 },
            dailyRevenue: { $sum: '$totalAmount' },
            date: { $first: '$transactionDate' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        { $limit: 30 }
      ]),

      // Top Medicines
      Sale.aggregate([
        {
          $match: {
            pharmacyId: pharmacyObjectId,
            ...(dateFilter && { transactionDate: dateFilter })
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.medicineId',
            medicineName: { $first: '$items.medicineName' },
            totalSold: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.totalPrice' },
            saleCount: { $sum: 1 }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]),

      // Revenue Analysis by Payment Method
      Transaction.aggregate([
        {
          $match: {
            pharmacyId: pharmacyObjectId,
            status: 'completed',
            ...(dateFilter && { checkoutDate: dateFilter })
          }
        },
        {
          $group: {
            _id: '$payment.method',
            totalRevenue: { $sum: '$totalAmount' },
            transactionCount: { $sum: 1 },
            averageValue: { $avg: '$totalAmount' }
          }
        },
        { $sort: { totalRevenue: -1 } }
      ])
    ]);

    // Format the analysis data
    const analysisData = {
      period: period,
      dateRange: dateFilter,
      
      medicines: {
        total: medicineAnalysis[0]?.totalMedicines || 0,
        totalStock: medicineAnalysis[0]?.totalStock || 0,
        lowStock: medicineAnalysis[0]?.lowStock || 0,
        outOfStock: medicineAnalysis[0]?.outOfStock || 0,
        averagePrice: Math.round(medicineAnalysis[0]?.averagePrice || 0),
        inventoryValue: Math.round(medicineAnalysis[0]?.totalInventoryValue || 0)
      },

      transactions: {
        total: transactionAnalysis[0]?.totalTransactions || 0,
        completed: transactionAnalysis[0]?.completedTransactions || 0,
        pending: transactionAnalysis[0]?.pendingTransactions || 0,
        totalRevenue: Math.round(transactionAnalysis[0]?.totalRevenue || 0),
        averageValue: Math.round(transactionAnalysis[0]?.averageTransactionValue || 0)
      },

      refunds: {
        totalRequests: refundAnalysis[0]?.totalRefundRequests || 0,
        pending: refundAnalysis[0]?.pendingRefunds || 0,
        approved: refundAnalysis[0]?.approvedRefunds || 0,
        completed: refundAnalysis[0]?.completedRefunds || 0,
        rejected: refundAnalysis[0]?.rejectedRefunds || 0,
        totalAmount: Math.round(refundAnalysis[0]?.totalRefundAmount || 0),
        averageAmount: Math.round(refundAnalysis[0]?.averageRefundAmount || 0)
      },

      performance: {
        conversionRate: transactionAnalysis[0]?.totalTransactions ? 
          (transactionAnalysis[0].completedTransactions / transactionAnalysis[0].totalTransactions * 100).toFixed(1) : 0,
        refundRate: transactionAnalysis[0]?.totalRevenue ? 
          (refundAnalysis[0]?.totalRefundAmount / transactionAnalysis[0].totalRevenue * 100).toFixed(1) : 0,
        stockHealth: medicineAnalysis[0]?.totalMedicines ? 
          ((medicineAnalysis[0].totalMedicines - medicineAnalysis[0].outOfStock) / medicineAnalysis[0].totalMedicines * 100).toFixed(1) : 0
      },

      insights: {
        salesTrend: salesTrend,
        topMedicines: topMedicines,
        revenueByPayment: revenueAnalysis
      }
    };

    res.status(200).json({
      success: true,
      data: analysisData
    });
  } catch (error) {
    console.error('Get sales analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sales analysis',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /sales/transaction - Show transactions and the most used ones
 */
const getTransactionsWithUsage = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const pharmacyObjectId = new mongoose.Types.ObjectId(pharmacyId);

    // Get all transactions
    const transactions = await Transaction.find({ pharmacyId: pharmacyObjectId })
      .select('transactionNumber _id transactionType status totalAmount checkoutDate payment customerInfo')
      .sort({ checkoutDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get most used transactions (by frequency and value)
    const mostUsedByValue = await Transaction.aggregate([
      {
        $match: {
          pharmacyId: pharmacyObjectId,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$transactionNumber',
          transactionId: { $first: '$_id' },
          totalAmount: { $first: '$totalAmount' },
          checkoutDate: { $first: '$checkoutDate' },
          customerName: { $first: '$customerInfo.name' },
          paymentMethod: { $first: '$payment.method' },
          usageCount: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 }
    ]);

    const mostUsedByFrequency = await Transaction.aggregate([
      {
        $match: {
          pharmacyId: pharmacyObjectId
        }
      },
      {
        $group: {
          _id: '$transactionNumber',
          transactionId: { $first: '$_id' },
          totalAmount: { $first: '$totalAmount' },
          checkoutDate: { $first: '$checkoutDate' },
          customerName: { $first: '$customerInfo.name' },
          usageCount: { $sum: 1 }
        }
      },
      { $sort: { usageCount: -1 } },
      { $limit: 10 }
    ]);

    // Get transaction statistics
    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          pharmacyId: pharmacyObjectId
        }
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          averageTransactionValue: { $avg: '$totalAmount' },
          completedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          pendingTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          }
        }
      }
    ]);

    const total = await Transaction.countDocuments({ pharmacyId: pharmacyObjectId });

    res.status(200).json({
      success: true,
      data: {
        allTransactions: transactions.map(trans => ({
          transactionId: trans._id,
          transactionNumber: trans.transactionNumber,
          transactionType: trans.transactionType,
          status: trans.status,
          totalAmount: trans.totalAmount,
          checkoutDate: trans.checkoutDate,
          paymentMethod: trans.payment?.method,
          customerName: trans.customerInfo?.name || 'Walk-in Customer'
        })),
        mostUsedByValue: mostUsedByValue,
        mostUsedByFrequency: mostUsedByFrequency,
        statistics: transactionStats[0] || {
          totalTransactions: 0,
          totalRevenue: 0,
          averageTransactionValue: 0,
          completedTransactions: 0,
          pendingTransactions: 0
        },
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get transactions with usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /sales/receipt - Show receipts and receipts in refund process
 */
const getReceiptsWithRefunds = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const pharmacyObjectId = new mongoose.Types.ObjectId(pharmacyId);

    // Get all receipts
    const receipts = await Receipt.find({ pharmacyId: pharmacyObjectId })
      .sort({ receiptDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('receiptNumber receiptDate transactionId customerInfo totalAmount items')
      .lean();

    // Get receipts that are in refund process
    const receiptsInRefundProcess = await Refund.aggregate([
      {
        $match: {
          pharmacyId: pharmacyObjectId,
          status: { $in: ['pending', 'approved'] }
        }
      },
      {
        $lookup: {
          from: 'receipts',
          localField: 'receiptId',
          foreignField: '_id',
          as: 'receipt'
        }
      },
      { $unwind: '$receipt' },
      {
        $project: {
          receiptNumber: '$receipt.receiptNumber',
          receiptDate: '$receipt.receiptDate',
          transactionNumber: '$transactionNumber',
          refundNumber: '$refundNumber',
          refundStatus: '$status',
          refundAmount: '$refundAmount',
          refundReason: '$refundReason',
          customerName: '$receipt.customerInfo.name',
          totalAmount: '$receipt.totalAmount'
        }
      },
      { $sort: { receiptDate: -1 } }
    ]);

    // Get receipt statistics
    const receiptStats = await Receipt.aggregate([
      {
        $match: {
          pharmacyId: pharmacyObjectId
        }
      },
      {
        $group: {
          _id: null,
          totalReceipts: { $sum: 1 },
          totalReceiptAmount: { $sum: '$totalAmount' },
          averageReceiptValue: { $avg: '$totalAmount' }
        }
      }
    ]);

    const totalReceipts = await Receipt.countDocuments({ pharmacyId: pharmacyObjectId });

    res.status(200).json({
      success: true,
      data: {
        allReceipts: receipts.map(receipt => ({
          receiptId: receipt._id,
          receiptNumber: receipt.receiptNumber,
          transactionId: receipt.transactionId,
          receiptDate: receipt.receiptDate,
          totalAmount: receipt.totalAmount,
          customerName: receipt.customerInfo?.name || 'N/A',
          itemsCount: receipt.items?.length || 0
        })),
        receiptsInRefundProcess: receiptsInRefundProcess,
        statistics: receiptStats[0] || {
          totalReceipts: 0,
          totalReceiptAmount: 0,
          averageReceiptValue: 0
        },
        summary: {
          totalReceipts: totalReceipts,
          inRefundProcess: receiptsInRefundProcess.length,
          refundRate: totalReceipts > 0 ? 
            (receiptsInRefundProcess.length / totalReceipts * 100).toFixed(1) + '%' : '0%'
        },
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(totalReceipts / limit),
          total: totalReceipts
        }
      }
    });
  } catch (error) {
    console.error('Get receipts with refunds error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching receipts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /sales/medicine - Show medicines and the most wanted
 */
const getMedicinesWithPopularity = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { limit = 20 } = req.query;

    const pharmacyObjectId = new mongoose.Types.ObjectId(pharmacyId);

    // Get all medicines
    const medicines = await Medicine.find({ pharmacyId: pharmacyObjectId })
      .select('name _id quantity price costPrice')
      .lean();

    // Get sales data to calculate popularity
    const salesData = await Sale.aggregate([
      {
        $match: {
          pharmacyId: pharmacyObjectId,
          status: { $in: ['completed', 'partially_refunded'] }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.medicineId',
          medicineName: { $first: '$items.medicineName' },
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
          saleCount: { $sum: 1 }
        }
      },
      { $sort: { totalQuantitySold: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Create a map of sales data for quick lookup
    const salesMap = new Map();
    salesData.forEach(item => {
      salesMap.set(item._id.toString(), item);
    });

    // Combine medicine data with popularity
    const medicinesWithPopularity = medicines.map(medicine => {
      const salesInfo = salesMap.get(medicine._id.toString());
      return {
        medicineId: medicine._id,
        medicineName: medicine.name,
        currentQuantity: medicine.quantity,
        price: medicine.price,
        costPrice: medicine.costPrice,
        popularity: salesInfo ? {
          totalSold: salesInfo.totalQuantitySold,
          totalRevenue: salesInfo.totalRevenue,
          saleCount: salesInfo.saleCount,
          rank: salesData.findIndex(item => item._id.toString() === medicine._id.toString()) + 1
        } : {
          totalSold: 0,
          totalRevenue: 0,
          saleCount: 0,
          rank: null
        }
      };
    });

    // Sort by popularity (most wanted first)
    medicinesWithPopularity.sort((a, b) => {
      const aSold = a.popularity.totalSold;
      const bSold = b.popularity.totalSold;
      return bSold - aSold;
    });

    // Get top 10 most wanted medicines
    const mostWanted = medicinesWithPopularity.slice(0, 10);

    res.status(200).json({
      success: true,
      data: {
        allMedicines: medicinesWithPopularity,
        mostWanted: mostWanted,
        summary: {
          totalMedicines: medicines.length,
          topSelling: mostWanted.length
        }
      }
    });
  } catch (error) {
    console.error('Get medicines with popularity error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medicines',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /sales/purchases - Show only what was purchased
 */
const getPurchases = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { page = 1, limit = 20, medicineName } = req.query;

    const pharmacyObjectId = new mongoose.Types.ObjectId(pharmacyId);

    let matchStage = { pharmacyId: pharmacyObjectId };
    
    // Filter by medicine name if provided
    if (medicineName) {
      matchStage['items.medicineName'] = { $regex: medicineName, $options: 'i' };
    }

    const purchases = await Sale.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $project: {
          transactionNumber: 1,
          receiptNumber: 1,
          transactionDate: 1,
          medicineId: '$items.medicineId',
          medicineName: '$items.medicineName',
          quantity: '$items.quantity',
          unitPrice: '$items.unitPrice',
          totalPrice: '$items.totalPrice',
          batchNumber: '$items.batchNumber',
          expiryDate: '$items.expiryDate'
        }
      },
      { $sort: { transactionDate: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    ]);

    const total = await Sale.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      { $count: 'total' }
    ]);

    const totalCount = total[0]?.total || 0;

    // Get purchase summary
    const purchaseSummary = await Sale.aggregate([
      { $match: { pharmacyId: pharmacyObjectId } },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          totalItemsPurchased: { $sum: '$items.quantity' },
          totalPurchaseValue: { $sum: '$items.totalPrice' },
          uniqueMedicines: { $addToSet: '$items.medicineId' }
        }
      },
      {
        $project: {
          totalItemsPurchased: 1,
          totalPurchaseValue: 1,
          uniqueMedicinesCount: { $size: '$uniqueMedicines' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        purchases: purchases,
        summary: purchaseSummary[0] || {
          totalItemsPurchased: 0,
          totalPurchaseValue: 0,
          uniqueMedicinesCount: 0
        },
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(totalCount / limit),
          total: totalCount
        }
      }
    });
  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchases',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Helper function to get date filter based on period
 */
function getDateFilter(period) {
  const now = new Date();
  let startDate;

  switch (period) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case 'year':
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
    case 'all':
    default:
      return null;
  }

  return {
    $gte: startDate,
    $lte: new Date()
  };
}

module.exports = {
  getAllSalesData,           
  getSalesAnalysis,          
  getTransactionsWithUsage,  
  getReceiptsWithRefunds,    
  getMedicinesWithPopularity, 
  getPurchases               
};