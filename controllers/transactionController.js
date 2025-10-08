const Transaction = require('../models/Transaction');
const Medicine = require('../models/Medicine');
const mongoose = require('mongoose');
const { generateTransactionNumber } = require('../utils/helpers');

// Get all transactions with filtering and pagination
exports.getTransactions = async (req, res) => {
  try {
    const { 
      search, 
      startDate, 
      endDate, 
      status, 
      transactionType, 
      medicineId,
      page = 1, 
      limit = 10 
    } = req.query;
    
    const pharmacyId = req.user.pharmacyId || req.user._id;

    let query = { pharmacyId };

    // Enhanced search functionality
    if (search) {
      query.$or = [
        { transactionId: new RegExp(search, 'i') },
        { transactionNumber: new RegExp(search, 'i') },
        { transactionRef: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { 'customerInfo.name': new RegExp(search, 'i') },
        { 'items.medicineName': new RegExp(search, 'i') },
        { 'items.genericName': new RegExp(search, 'i') }
      ];
    }

    if (medicineId) {
      query['items.medicineId'] = medicineId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (status) query.status = status;
    if (transactionType) query.transactionType = transactionType;

    const skip = (page - 1) * limit;

    const transactions = await Transaction.find(query)
      .select('-__v')
      .populate('items.medicineId', 'name genericName form price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

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
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching transactions'
    });
  }
};

// Get transaction by ID with full details
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const pharmacyId = req.user.pharmacyId || req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid transaction ID' 
      });
    }

    const transaction = await Transaction.findOne({ _id: id, pharmacyId })
      .populate('items.medicineId', 'name genericName form price');

    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      data: transaction 
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching transaction' 
    });
  }
};

// Create a new transaction - UPDATED TO INCLUDE USER ID
exports.createTransaction = async (req, res) => {
  try {
    const {
      transactionType,
      description,
      items,
      customerName,
      customerPhone,
      paymentMethod,
      tax = 0,
      discount = 0,
      status = 'completed'
    } = req.body;
    
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const userId = req.user._id; // Get user ID from authenticated user

    // Generate transaction number
    const transactionNumber = await generateTransactionNumber(transactionType);

    // Validate and prepare items
    if (transactionType === 'sale') {
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
        
        // Add required fields for transaction items
        item.genericName = medicine.genericName;
        item.medicineName = medicine.name;
        item.form = medicine.form;
        item.packSize = medicine.packSize;
        item.unitPrice = item.unitPrice || medicine.price;
        item.totalPrice = item.quantity * item.unitPrice;
        item.expiryDate = medicine.expiryDate;
        item.batchNumber = medicine.batchNumber;
        item.manufacturer = medicine.manufacturer;
      }
    }

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalAmount = Math.max(0, subtotal + tax - discount);

    // ✅ FIXED: Include all required fields including userId
    const transactionData = {
      pharmacyId,
      userId, // Add userId
      transactionType,
      transactionNumber,
      description,
      items,
      subtotal,
      tax,
      discount,
      totalAmount,
      customerInfo: {
        name: customerName,
        phone: customerPhone
      },
      payment: {
        method: paymentMethod,
        amount: totalAmount,
        status: status === 'completed' ? 'completed' : 'pending'
      },
      status,
      transactionDate: new Date(),
      // ✅ FIXED: Add all required user fields
      createdBy: userId,
      updatedBy: userId
    };

    const transaction = new Transaction(transactionData);
    await transaction.save();

    // Update stock for completed sales
    if (transactionType === 'sale' && status === 'completed') {
      for (const item of items) {
        await Medicine.findByIdAndUpdate(
          item.medicineId, 
          { $inc: { quantity: -item.quantity } }
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction
    });

  } catch (error) {
    console.error('Create transaction error details:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating transaction',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update a transaction - UPDATED TO INCLUDE USER ID
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid transaction ID' 
      });
    }

    const transaction = await Transaction.findOne({ _id: id, pharmacyId });
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }

    if (transaction.status === 'completed' && 
        Object.keys(updates).some(key => !['status'].includes(key))) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify completed transactions'
      });
    }

    // Add updatedBy field
    updates.updatedBy = userId;

    const updatedTransaction = await Transaction.findByIdAndUpdate(
      id, 
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('items.medicineId', 'name genericName form price');

    res.status(200).json({
      success: true,
      message: 'Transaction updated successfully',
      data: updatedTransaction
    });

  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating transaction'
    });
  }
};

// Delete a transaction
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const pharmacyId = req.user.pharmacyId || req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid transaction ID' 
      });
    }

    const transaction = await Transaction.findOne({ _id: id, pharmacyId });
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }

    if (transaction.transactionType === 'sale' && transaction.status === 'completed') {
      for (const item of transaction.items) {
        await Medicine.findByIdAndUpdate(
          item.medicineId, 
          { $inc: { quantity: item.quantity } }
        );
      }
    }

    await Transaction.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully'
    });

  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting transaction'
    });
  }
};

// Get transaction statistics
exports.getTransactionStats = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const matchStage = { 
      pharmacyId, 
      status: 'completed',
      ...dateFilter
    };

    const stats = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$transactionType',
          totalTransactions: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          averageTransaction: { $avg: '$totalAmount' }
        }
      }
    ]);

    const totalStats = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          averageTransaction: { $avg: '$totalAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        byType: stats,
        overall: totalStats[0] || {
          totalTransactions: 0,
          totalRevenue: 0,
          averageTransaction: 0
        }
      }
    });

  } catch (error) {
    console.error('Get transaction stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching transaction statistics'
    });
  }
};

// Export transactions (basic implementation)
exports.exportTransactions = async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    const pharmacyId = req.user.pharmacyId || req.user._id;

    let query = { pharmacyId, status: 'completed' };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .populate('items.medicineId', 'name genericName form')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      // Basic CSV implementation
      const csvData = transactions.map(transaction => ({
        'Transaction Number': transaction.transactionNumber,
        'Date': transaction.transactionDate,
        'Type': transaction.transactionType,
        'Customer': transaction.customerInfo?.name || 'N/A',
        'Total Amount': transaction.totalAmount,
        'Status': transaction.status
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
      // Implement CSV string conversion here
      return res.send(JSON.stringify(csvData));
    }

    res.status(200).json({
      success: true,
      data: transactions,
      meta: {
        total: transactions.length,
        exportDate: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Export transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting transactions'
    });
  }
};

// Create a quick sale transaction (simplified version without cart)
exports.createQuickSale = async (req, res) => {
  try {
    const {
      items,
      customerName = 'Walk-in Customer',
      customerPhone = '',
      paymentMethod = 'cash'
    } = req.body;
    
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const userId = req.user._id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required and cannot be empty'
      });
    }

    // Generate transaction number
    const transactionNumber = await generateTransactionNumber('sale');

    // Validate items and prepare transaction items
    const transactionItems = [];
    let subtotal = 0;

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
        manufacturer: medicine.manufacturer,
        pharmacyId: pharmacyId
      });

      subtotal += totalPrice;
    }

    const totalAmount = Math.max(0, subtotal);

    // Create transaction
    const transactionData = {
      pharmacyId,
      userId,
      transactionType: 'sale',
      transactionNumber,
      description: 'Quick Sale',
      items: transactionItems,
      subtotal,
      tax: 0,
      discount: 0,
      totalAmount,
      customerInfo: {
        name: customerName,
        phone: customerPhone
      },
      payment: {
        method: paymentMethod,
        amount: totalAmount,
        status: 'completed'
      },
      status: 'completed',
      transactionDate: new Date(),
      createdBy: userId,
      updatedBy: userId
    };

    const transaction = new Transaction(transactionData);
    await transaction.save();

    // Update stock
    for (const item of items) {
      await Medicine.findByIdAndUpdate(
        item.medicineId, 
        { $inc: { quantity: -item.quantity } }
      );
    }

    // Populate the response
    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate('items.medicineId', 'name genericName form price');

    res.status(201).json({
      success: true,
      message: 'Quick sale completed successfully',
      data: populatedTransaction
    });

  } catch (error) {
    console.error('Quick sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing quick sale',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};