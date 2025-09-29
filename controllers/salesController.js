const Transaction = require('../models/Transaction');
const Medicine = require('../models/Medicine');
const Cart = require('../models/Cart');
const mongoose = require('mongoose');
const { generateTransactionNumber } = require('../utils/helpers');

const salesController = {
  // Get sales dashboard data
  getSalesDashboard: async (req, res) => {
    try {
      const pharmacyId = req.user.pharmacyId || req.user._id;
      const { period = 'today', startDate, endDate } = req.query;

      // Date range calculation
      let dateFilter = {};
      const now = new Date();
      
      switch (period) {
        case 'today':
          dateFilter = {
            createdAt: {
              $gte: new Date(now.setHours(0, 0, 0, 0)),
              $lte: new Date(now.setHours(23, 59, 59, 999))
            }
          };
          break;
        case 'week':
          const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
          dateFilter = {
            createdAt: {
              $gte: new Date(weekStart.setHours(0, 0, 0, 0)),
              $lte: new Date()
            }
          };
          break;
        case 'month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          dateFilter = {
            createdAt: {
              $gte: monthStart,
              $lte: new Date()
            }
          };
          break;
        case 'custom':
          if (startDate && endDate) {
            dateFilter = {
              createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
              }
            };
          }
          break;
      }

      // Sales statistics
      const salesStats = await Transaction.aggregate([
        {
          $match: {
            pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
            transactionType: 'sale',
            status: 'completed',
            ...dateFilter
          }
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$totalAmount' },
            totalTransactions: { $sum: 1 },
            averageSale: { $avg: '$totalAmount' },
            totalItemsSold: { $sum: { $sum: '$items.quantity' } }
          }
        }
      ]);

      // Recent transactions
      const recentTransactions = await Transaction.find({
        pharmacyId,
        transactionType: 'sale',
        status: 'completed'
      })
      .populate('items.medicineId', 'name genericName')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('transactionNumber totalAmount items customerInfo createdAt');

      // Top selling medicines
      const topMedicines = await Transaction.aggregate([
        {
          $match: {
            pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
            transactionType: 'sale',
            status: 'completed',
            ...dateFilter
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.medicineId',
            medicineName: { $first: '$items.medicineName' },
            totalSold: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.totalPrice' }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 5 }
      ]);

      // Sales by hour (for today)
      const salesByHour = await Transaction.aggregate([
        {
          $match: {
            pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
            transactionType: 'sale',
            status: 'completed',
            createdAt: {
              $gte: new Date(new Date().setHours(0, 0, 0, 0)),
              $lte: new Date()
            }
          }
        },
        {
          $group: {
            _id: { $hour: '$createdAt' },
            totalSales: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const stats = salesStats[0] || {
        totalSales: 0,
        totalTransactions: 0,
        averageSale: 0,
        totalItemsSold: 0
      };

      res.status(200).json({
        success: true,
        data: {
          overview: {
            totalSales: stats.totalSales,
            totalTransactions: stats.totalTransactions,
            averageSale: Math.round(stats.averageSale * 100) / 100,
            totalItemsSold: stats.totalItemsSold
          },
          recentTransactions,
          topMedicines,
          salesByHour,
          period
        }
      });

    } catch (error) {
      console.error('Sales dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching sales dashboard data'
      });
    }
  },

  // Process full sale (entire cart)
  processFullSale: async (req, res) => {
    try {
      if (!req.user || !req.user._id) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const pharmacyId = req.user.pharmacyId || req.user._id;
      const {
        customerName,
        customerPhone,
        paymentMethod,
        tax = 0,
        discount = 0,
        deliveryOption = 'pickup',
        deliveryAddressId,
        description = 'Full sale transaction'
      } = req.body;

      // Get active cart
      const cart = await Cart.findOne({
        pharmacyId,
        status: 'active'
      });

      if (!cart || !cart.items.length) {
        return res.status(400).json({
          success: false,
          message: 'Cart is empty'
        });
      }

      // Validate stock and prepare transaction items
      const transactionItems = [];
      for (const cartItem of cart.items) {
        const medicine = await Medicine.findById(cartItem.medicineId);
        if (!medicine) {
          return res.status(404).json({
            success: false,
            message: `Medicine ${cartItem.medicineName} not found`
          });
        }

        if (medicine.quantity < cartItem.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${medicine.name}. Available: ${medicine.quantity}`
          });
        }

        transactionItems.push({
          medicineId: medicine._id,
          medicineName: medicine.name,
          genericName: medicine.genericName,
          form: medicine.form,
          packSize: medicine.packSize,
          quantity: cartItem.quantity,
          unitPrice: cartItem.unitPrice,
          totalPrice: cartItem.totalPrice,
          expiryDate: medicine.expiryDate,
          batchNumber: medicine.batchNumber,
          manufacturer: medicine.manufacturer
        });
      }

      // Calculate totals
      const subtotal = transactionItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const deliveryFee = deliveryOption === 'delivery' ? 5.00 : 0;
      const totalAmount = Math.max(0, subtotal + tax + deliveryFee - discount);

      // Generate transaction numbers
      const transactionNumber = await generateTransactionNumber('sale');
      const transactionRef = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();

      // Create transaction (full sale)
      const paymentStatusFull = 'pending'; // mark pending by default; update later when payment confirmed

      const transactionDataFull = {
        pharmacyId,
        transactionType: 'sale',
        transactionNumber,
        transactionRef,
        description,
        items: transactionItems,
        subtotal,
        tax,
        discount,
        deliveryFee,
        totalAmount,
        // audit / required fields
        createdBy: req.user && req.user._id ? req.user._id : undefined,
        // payment object
        payment: {
          method: paymentMethod || 'cash',
          amount: totalAmount,
          status: paymentStatusFull
        },
        customerInfo: {
          name: customerName,
          phone: customerPhone
        },
        paymentMethod,
        deliveryOption,
        status: 'completed',
        saleType: 'full',
        transactionDate: new Date()
      };

      // Only set deliveryStatus/deliveryAddress if delivery option
      if (deliveryOption === 'delivery') {
        transactionDataFull.deliveryStatus = 'pending';
        if (deliveryAddressId) transactionDataFull.deliveryAddress = deliveryAddressId;
      }

      const transaction = new Transaction(transactionDataFull);

      await transaction.save();

      // Update stock
      for (const item of transactionItems) {
        await Medicine.findByIdAndUpdate(
          item.medicineId,
          { $inc: { quantity: -item.quantity } }
        );
      }

      // Clear cart
      await cart.clearCart();

      // Populate response
      const populatedTransaction = await Transaction.findById(transaction._id)
        .populate('items.medicineId', 'name genericName form price')
        .populate('deliveryAddress');

      res.status(201).json({
        success: true,
        message: 'Full sale completed successfully',
        data: populatedTransaction
      });

    } catch (error) {
      console.error('Full sale error:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing full sale'
      });
    }
  },

  // Process per-medicine sale (individual items)
  processPerMedicineSale: async (req, res) => {
    try {
      if (!req.user || !req.user._id) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const pharmacyId = req.user.pharmacyId || req.user._id;
      const {
        items, // Array of { medicineId, quantity, unitPrice (optional) }
        customerName,
        customerPhone,
        paymentMethod,
        tax = 0,
        discount = 0,
        deliveryOption = 'pickup',
        deliveryAddressId,
        description = 'Per medicine sale'
      } = req.body;

      if (!items || !items.length) {
        return res.status(400).json({
          success: false,
          message: 'No items provided for sale'
        });
      }

      // Validate items and prepare transaction items
      const transactionItems = [];
      for (const item of items) {
        const medicine = await Medicine.findById(item.medicineId);
        if (!medicine) {
          return res.status(404).json({
            success: false,
            message: `Medicine with ID ${item.medicineId} not found`
          });
        }

        if (medicine.quantity < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${medicine.name}. Available: ${medicine.quantity}`
          });
        }

        const unitPrice = item.unitPrice || medicine.price;
        const totalPrice = item.quantity * unitPrice;

        transactionItems.push({
          medicineId: medicine._id,
          medicineName: medicine.name,
          genericName: medicine.genericName,
          form: medicine.form,
          packSize: medicine.packSize,
          quantity: item.quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
          expiryDate: medicine.expiryDate,
          batchNumber: medicine.batchNumber,
          manufacturer: medicine.manufacturer
        });
      }

      // Calculate totals
      const subtotal = transactionItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const deliveryFee = deliveryOption === 'delivery' ? 5.00 : 0;
      const totalAmount = Math.max(0, subtotal + tax + deliveryFee - discount);

      // Generate transaction numbers
      const transactionNumber = await generateTransactionNumber('sale');
      const transactionRef = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();

      // Create transaction (per-medicine) — ensure required fields exist
      const paymentStatus = 'pending'; // mark pending by default; update later when payment confirmed

      const transactionData = {
        pharmacyId,
        transactionType: 'sale',
        transactionNumber,
        transactionRef,
        description,
        items: transactionItems,
        subtotal,
        tax,
        discount,
        deliveryFee,
        totalAmount,
        // audit / required fields
        createdBy: req.user && req.user._id ? req.user._id : undefined,
        // payment object to satisfy schema requirement
        payment: {
          method: paymentMethod || 'cash',
          amount: totalAmount,
          status: paymentStatus
        },
        customerInfo: {
          name: customerName,
          phone: customerPhone
        },
        paymentMethod,
        deliveryOption,
        status: 'completed',
        saleType: 'per_medicine',
        transactionDate: new Date()
      };

      // Only set deliveryStatus/deliveryAddress if delivery option
      if (deliveryOption === 'delivery') {
        transactionData.deliveryStatus = 'pending';
        if (deliveryAddressId) transactionData.deliveryAddress = deliveryAddressId;
      }

      const transaction = new Transaction(transactionData);

      await transaction.save();

      // Update stock
      for (const item of transactionItems) {
        await Medicine.findByIdAndUpdate(
          item.medicineId,
          { $inc: { quantity: -item.quantity } }
        );
      }

      // Populate response
      const populatedTransaction = await Transaction.findById(transaction._id)
        .populate('items.medicineId', 'name genericName form price')
        .populate('deliveryAddress');

      res.status(201).json({
        success: true,
        message: 'Per-medicine sale completed successfully',
        data: populatedTransaction
      });

    } catch (error) {
      console.error('Per medicine sale error:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing per-medicine sale'
      });
    }
  },

  // Get sales transactions with filtering
  getSalesTransactions: async (req, res) => {
    try {
      const pharmacyId = req.user.pharmacyId || req.user._id;
      const {
        search,
        startDate,
        endDate,
        status,
        saleType,
        paymentMethod,
        page = 1,
        limit = 10
      } = req.query;

      let query = {
        pharmacyId,
        transactionType: 'sale'
      };

      // Search functionality
      if (search) {
        query.$or = [
          { transactionNumber: new RegExp(search, 'i') },
          { transactionRef: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') },
          { 'customerInfo.name': new RegExp(search, 'i') },
          { 'customerInfo.phone': new RegExp(search, 'i') },
          { 'items.medicineName': new RegExp(search, 'i') }
        ];
      }

      // Date filter
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      // Additional filters
      if (status) query.status = status;
      if (saleType) query.saleType = saleType;
      if (paymentMethod) query.paymentMethod = paymentMethod;

      const skip = (page - 1) * limit;

      const transactions = await Transaction.find(query)
        .populate('items.medicineId', 'name genericName form')
        .populate('deliveryAddress')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v');

      const total = await Transaction.countDocuments(query);

      res.status(200).json({
        success: true,
        data: transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Get sales transactions error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching sales transactions'
      });
    }
  },

  // Get sale statistics
  getSaleStatistics: async (req, res) => {
    try {
      const pharmacyId = req.user.pharmacyId || req.user._id;
      const { period = 'month' } = req.query;

      // Calculate date range
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
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.setDate(now.getDate() - 30)); // Default to 30 days
      }

      // Sales trend data
      const salesTrend = await Transaction.aggregate([
        {
          $match: {
            pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
            transactionType: 'sale',
            status: 'completed',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            totalSales: { $sum: '$totalAmount' },
            transactionCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Payment method distribution
      const paymentDistribution = await Transaction.aggregate([
        {
          $match: {
            pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
            transactionType: 'sale',
            status: 'completed',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$paymentMethod',
            totalAmount: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        }
      ]);

      // Sale type distribution
      const saleTypeDistribution = await Transaction.aggregate([
        {
          $match: {
            pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
            transactionType: 'sale',
            status: 'completed',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$saleType',
            totalAmount: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          salesTrend,
          paymentDistribution,
          saleTypeDistribution,
          period
        }
      });

    } catch (error) {
      console.error('Sale statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching sale statistics'
      });
    }
  }
};

module.exports = salesController;
