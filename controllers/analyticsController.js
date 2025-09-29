const Transaction = require('../models/Transaction');
const Medicine = require('../models/Medicine');
const Refund = require('../models/Refund');
const mongoose = require('mongoose');

// Get sales analytics with detailed breakdown
exports.getSalesAnalytics = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { 
      startDate, 
      endDate, 
      medicineId,
      groupBy = 'day', // day, week, month, medicine
      page = 1, 
      limit = 50 
    } = req.query;

    // Build date filter
    let dateFilter = { pharmacyId, transactionType: 'sale', status: 'completed' };
    if (startDate || endDate) {
      dateFilter.transactionDate = {};
      if (startDate) dateFilter.transactionDate.$gte = new Date(startDate);
      if (endDate) dateFilter.transactionDate.$lte = new Date(endDate);
    }

    if (medicineId) {
      dateFilter['items.medicineId'] = medicineId;
    }

    // Get total sales summary
    const salesSummary = await Transaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalItemsSold: { 
            $sum: { 
              $sum: '$items.quantity' 
            }
          },
          averageOrderValue: { $avg: '$totalAmount' },
          totalTax: { $sum: '$tax' },
          totalDiscount: { $sum: '$discount' }
        }
      }
    ]);

    // Get top selling medicines
    const topMedicines = await Transaction.aggregate([
      { $match: dateFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            medicineId: '$items.medicineId',
            medicineName: '$items.medicineName',
            genericName: '$items.genericName'
          },
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
          transactionCount: { $sum: 1 },
          averagePrice: { $avg: '$items.unitPrice' }
        }
      },
      { $sort: { totalQuantitySold: -1 } },
      { $limit: 10 }
    ]);

    // Get sales trend based on groupBy parameter
    let groupByFormat;
    switch (groupBy) {
      case 'week':
        groupByFormat = {
          year: { $year: '$transactionDate' },
          week: { $week: '$transactionDate' }
        };
        break;
      case 'month':
        groupByFormat = {
          year: { $year: '$transactionDate' },
          month: { $month: '$transactionDate' }
        };
        break;
      case 'medicine':
        groupByFormat = '$items.medicineName';
        break;
      default: // day
        groupByFormat = {
          year: { $year: '$transactionDate' },
          month: { $month: '$transactionDate' },
          day: { $dayOfMonth: '$transactionDate' }
        };
    }

    let salesTrend;
    if (groupBy === 'medicine') {
      salesTrend = await Transaction.aggregate([
        { $match: dateFilter },
        { $unwind: '$items' },
        {
          $group: {
            _id: {
              medicineName: '$items.medicineName',
              genericName: '$items.genericName'
            },
            totalSales: { $sum: '$items.totalPrice' },
            totalQuantity: { $sum: '$items.quantity' },
            transactionCount: { $sum: 1 }
          }
        },
        { $sort: { totalSales: -1 } }
      ]);
    } else {
      salesTrend = await Transaction.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: groupByFormat,
            totalSales: { $sum: '$totalAmount' },
            totalTransactions: { $sum: 1 },
            totalItemsSold: { $sum: { $sum: '$items.quantity' } }
          }
        },
        { $sort: { '_id': 1 } }
      ]);
    }

    // Get detailed transactions with pagination
    const skip = (page - 1) * limit;
    const detailedSales = await Transaction.find(dateFilter)
      .populate('items.medicineId', 'name genericName manufacturer')
      .select('transactionId transactionNumber items totalAmount tax discount customerInfo paymentMethod transactionDate')
      .sort({ transactionDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await Transaction.countDocuments(dateFilter);

    res.status(200).json({
      success: true,
      data: {
        summary: salesSummary[0] || {
          totalTransactions: 0,
          totalRevenue: 0,
          totalItemsSold: 0,
          averageOrderValue: 0,
          totalTax: 0,
          totalDiscount: 0
        },
        topMedicines,
        salesTrend,
        detailedSales,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('Sales analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sales analytics'
    });
  }
};

// Get refunds analytics
exports.getRefundsAnalytics = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { 
      startDate, 
      endDate, 
      status,
      medicineId,
      page = 1, 
      limit = 50 
    } = req.query;

    // Build filter
    let refundFilter = { pharmacyId };
    if (startDate || endDate) {
      refundFilter.requestDate = {};
      if (startDate) refundFilter.requestDate.$gte = new Date(startDate);
      if (endDate) refundFilter.requestDate.$lte = new Date(endDate);
    }

    if (status) refundFilter.status = status;

    // Get refunds summary
    const refundsSummary = await Refund.aggregate([
      { $match: refundFilter },
      {
        $group: {
          _id: null,
          totalRefunds: { $sum: 1 },
          totalRefundAmount: { $sum: '$refundAmount' },
          averageRefundAmount: { $avg: '$refundAmount' },
          pendingRefunds: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          approvedRefunds: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          rejectedRefunds: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          },
          completedRefunds: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get refund reasons breakdown
    const refundReasons = await Refund.aggregate([
      { $match: refundFilter },
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 },
          totalAmount: { $sum: '$refundAmount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get medicines with most refunds
    const medicinesWithRefunds = await Refund.aggregate([
      { $match: refundFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            medicineId: '$items.medicineId',
            medicineName: '$items.medicineName',
            genericName: '$items.genericName'
          },
          refundCount: { $sum: 1 },
          totalRefundAmount: { $sum: '$items.refundAmount' },
          totalQuantityRefunded: { $sum: '$items.quantity' }
        }
      },
      { $sort: { refundCount: -1 } },
      { $limit: 10 }
    ]);

    // Get refunds trend by month
    const refundsTrend = await Refund.aggregate([
      { $match: refundFilter },
      {
        $group: {
          _id: {
            year: { $year: '$requestDate' },
            month: { $month: '$requestDate' }
          },
          totalRefunds: { $sum: 1 },
          totalAmount: { $sum: '$refundAmount' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Get detailed refunds with pagination
    const skip = (page - 1) * limit;
    const detailedRefunds = await Refund.find(refundFilter)
      .populate('transactionId', 'transactionNumber transactionDate')
      .populate('items.medicineId', 'name genericName')
      .select('refundId reason refundAmount status requestDate processedDate items customerInfo')
      .sort({ requestDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalRefundCount = await Refund.countDocuments(refundFilter);

    res.status(200).json({
      success: true,
      data: {
        summary: refundsSummary[0] || {
          totalRefunds: 0,
          totalRefundAmount: 0,
          averageRefundAmount: 0,
          pendingRefunds: 0,
          approvedRefunds: 0,
          rejectedRefunds: 0,
          completedRefunds: 0
        },
        refundReasons,
        medicinesWithRefunds,
        refundsTrend,
        detailedRefunds,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalRefundCount,
          pages: Math.ceil(totalRefundCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('Refunds analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching refunds analytics'
    });
  }
};

// Get comprehensive pharmacy performance analytics
exports.getPharmacyPerformance = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { 
      startDate, 
      endDate,
      compareWithPrevious = false 
    } = req.query;

    // Build date filter
    let dateFilter = { pharmacyId };
    if (startDate || endDate) {
      dateFilter.transactionDate = {};
      if (startDate) dateFilter.transactionDate.$gte = new Date(startDate);
      if (endDate) dateFilter.transactionDate.$lte = new Date(endDate);
    }

    // Get sales performance
    const salesPerformance = await Transaction.aggregate([
      { 
        $match: { 
          ...dateFilter, 
          transactionType: 'sale', 
          status: 'completed' 
        } 
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' },
          totalTransactions: { $sum: 1 },
          totalItemsSold: { $sum: { $sum: '$items.quantity' } }
        }
      }
    ]);

    // Get refunds performance
    const refundsPerformance = await Refund.aggregate([
      { 
        $match: { 
          pharmacyId,
          ...(startDate || endDate ? { 
            requestDate: {
              ...(startDate ? { $gte: new Date(startDate) } : {}),
              ...(endDate ? { $lte: new Date(endDate) } : {})
            }
          } : {})
        } 
      },
      {
        $group: {
          _id: null,
          totalRefunds: { $sum: '$refundAmount' },
          totalRefundCount: { $sum: 1 }
        }
      }
    ]);

    // Calculate performance metrics
    const sales = salesPerformance[0] || { totalSales: 0, totalTransactions: 0, totalItemsSold: 0 };
    const refunds = refundsPerformance[0] || { totalRefunds: 0, totalRefundCount: 0 };

    const netRevenue = sales.totalSales - refunds.totalRefunds;
    const refundRate = sales.totalSales > 0 ? (refunds.totalRefunds / sales.totalSales * 100) : 0;
    const averageOrderValue = sales.totalTransactions > 0 ? (sales.totalSales / sales.totalTransactions) : 0;

    // Get inventory turnover (assuming you have inventory tracking)
    const lowStockMedicines = await Medicine.find({
      pharmacyId,
      $expr: { $lte: ['$quantity', '$lowStockThreshold'] }
    }).select('name genericName quantity lowStockThreshold');

    // Get payment method breakdown
    const paymentMethods = await Transaction.aggregate([
      { 
        $match: { 
          ...dateFilter, 
          transactionType: 'sale', 
          status: 'completed' 
        } 
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        performance: {
          totalSales: sales.totalSales,
          totalRefunds: refunds.totalRefunds,
          netRevenue,
          refundRate: Math.round(refundRate * 100) / 100,
          totalTransactions: sales.totalTransactions,
          totalRefundCount: refunds.totalRefundCount,
          averageOrderValue: Math.round(averageOrderValue * 100) / 100,
          totalItemsSold: sales.totalItemsSold
        },
        inventory: {
          lowStockCount: lowStockMedicines.length,
          lowStockMedicines
        },
        paymentMethods,
        dateRange: {
          startDate: startDate || 'All time',
          endDate: endDate || 'All time'
        }
      }
    });

  } catch (error) {
    console.error('Pharmacy performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pharmacy performance analytics'
    });
  }
};

// Get medicine-specific sales and refund analytics
exports.getMedicineAnalytics = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { medicineId } = req.params;
    const { startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(medicineId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid medicine ID' 
      });
    }

    // Get medicine details
    const medicine = await Medicine.findOne({ _id: medicineId, pharmacyId })
      .select('name genericName manufacturer price quantity lowStockThreshold');

    if (!medicine) {
      return res.status(404).json({ 
        success: false, 
        message: 'Medicine not found' 
      });
    }

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.transactionDate = {};
      if (startDate) dateFilter.transactionDate.$gte = new Date(startDate);
      if (endDate) dateFilter.transactionDate.$lte = new Date(endDate);
    }

    // Get sales data for this medicine
    const salesData = await Transaction.aggregate([
      { 
        $match: { 
          pharmacyId, 
          transactionType: 'sale', 
          status: 'completed',
          'items.medicineId': new mongoose.Types.ObjectId(medicineId),
          ...dateFilter
        } 
      },
      { $unwind: '$items' },
      { 
        $match: { 
          'items.medicineId': new mongoose.Types.ObjectId(medicineId)
        } 
      },
      {
        $group: {
          _id: null,
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
          transactionCount: { $sum: 1 },
          averagePrice: { $avg: '$items.unitPrice' },
          minPrice: { $min: '$items.unitPrice' },
          maxPrice: { $max: '$items.unitPrice' }
        }
      }
    ]);

    // Get refund data for this medicine
    const refundData = await Refund.aggregate([
      { 
        $match: { 
          pharmacyId,
          'items.medicineId': new mongoose.Types.ObjectId(medicineId),
          ...(startDate || endDate ? { 
            requestDate: {
              ...(startDate ? { $gte: new Date(startDate) } : {}),
              ...(endDate ? { $lte: new Date(endDate) } : {})
            }
          } : {})
        } 
      },
      { $unwind: '$items' },
      { 
        $match: { 
          'items.medicineId': new mongoose.Types.ObjectId(medicineId)
        } 
      },
      {
        $group: {
          _id: null,
          totalQuantityRefunded: { $sum: '$items.quantity' },
          totalRefundAmount: { $sum: '$items.refundAmount' },
          refundCount: { $sum: 1 }
        }
      }
    ]);

    // Get monthly sales trend
    const salesTrend = await Transaction.aggregate([
      { 
        $match: { 
          pharmacyId, 
          transactionType: 'sale', 
          status: 'completed',
          'items.medicineId': new mongoose.Types.ObjectId(medicineId),
          ...dateFilter
        } 
      },
      { $unwind: '$items' },
      { 
        $match: { 
          'items.medicineId': new mongoose.Types.ObjectId(medicineId)
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$transactionDate' },
            month: { $month: '$transactionDate' }
          },
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.totalPrice' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const sales = salesData[0] || {
      totalQuantitySold: 0,
      totalRevenue: 0,
      transactionCount: 0,
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0
    };

    const refunds = refundData[0] || {
      totalQuantityRefunded: 0,
      totalRefundAmount: 0,
      refundCount: 0
    };

    res.status(200).json({
      success: true,
      data: {
        medicine,
        analytics: {
          sales,
          refunds,
          netQuantitySold: sales.totalQuantitySold - refunds.totalQuantityRefunded,
          netRevenue: sales.totalRevenue - refunds.totalRefundAmount,
          refundRate: sales.totalRevenue > 0 ? 
            (refunds.totalRefundAmount / sales.totalRevenue * 100) : 0
        },
        salesTrend
      }
    });

  } catch (error) {
    console.error('Medicine analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medicine analytics'
    });
  }
};