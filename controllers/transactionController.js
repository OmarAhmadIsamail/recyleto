const Transaction = require('../models/Transaction');
const Medicine = require('../models/Medicine');
const Cart = require('../models/Cart');
const CartItem = require('../models/CartItem');
const mongoose = require('mongoose');
const { generateTransactionNumber } = require('../utils/helpers');

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
      return res.status(400).json({ success: false, message: 'Invalid transaction ID' });
    }

    const transaction = await Transaction.findOne({ _id: id, pharmacyId })
      .populate('items.medicineId', 'name genericName form price');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching transaction' });
  }
};

// Create a new transaction (without cart) - UPDATED TO FIX THE ERROR
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

    // ✅ FIXED: Create transaction with correct structure for the model
    const transactionData = {
      pharmacyId,
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
      // ✅ FIXED: Use the correct payment structure expected by the model
      payment: {
        method: paymentMethod,
        amount: totalAmount,
        status: status === 'completed' ? 'completed' : 'pending'
      },
      status,
      transactionDate: new Date(),
      // ✅ FIXED: Add required fields
      createdBy: req.user._id,
      updatedBy: req.user._id
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

// Update a transaction
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
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

    if (transaction.status === 'completed' && 
        Object.keys(updates).some(key => !['status'].includes(key))) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify completed transactions'
      });
    }

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

// Add medicine to cart - Creates/updates both transaction and cart
exports.addToCart = async (req, res) => {
  try {
    const { medicineId, quantity, transactionType = 'sale' } = req.body;
    const pharmacyId = req.user.pharmacyId || req.user._id;

    const medicine = await Medicine.findById(medicineId);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found' });

    if (transactionType === 'sale' && medicine.quantity < quantity) {
      return res.status(400).json({ success: false, message: `Insufficient stock. Available: ${medicine.quantity}` });
    }

    // Find or create active transaction
    let transaction = await Transaction.findOne({ 
      pharmacyId, 
      transactionType, 
      status: 'pending' 
    });

    // Find or create active cart
    let cart = await Cart.findOne({ 
      pharmacyId, 
      transactionType, 
      status: 'active' 
    });

    if (!transaction) {
      // Create new transaction with pending status
      const transactionNumber = await generateTransactionNumber(transactionType);
      const transactionRef = `REF-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      
      transaction = new Transaction({
        pharmacyId,
        transactionType,
        transactionNumber,
        transactionRef,
        description: 'Cart Transaction',
        items: [],
        subtotal: 0,
        tax: 0,
        discount: 0,
        totalAmount: 0,
        status: 'pending',
        transactionDate: new Date(),
        // ✅ FIXED: Add required fields
        createdBy: req.user._id,
        updatedBy: req.user._id,
        payment: {
          method: 'cash',
          amount: 0,
          status: 'pending'
        }
      });
    }

    if (!cart) {
      // Create new cart
      cart = new Cart({
        pharmacyId,
        transactionType,
        description: 'Active Cart',
        customerName: '',
        customerPhone: '',
        paymentMethod: 'cash',
        status: 'active'
      });
      await cart.save(); // Save cart first to get its ID
    }

    // Check if medicine already exists in transaction
    const existingItemIndex = transaction.items.findIndex(
      item => item.medicineId.toString() === medicineId
    );

    const newItem = {
      medicineId: medicine._id,
      medicineName: medicine.name,
      genericName: medicine.genericName,
      form: medicine.form,
      packSize: medicine.packSize,
      quantity: parseInt(quantity),
      unitPrice: medicine.price,
      totalPrice: parseInt(quantity) * medicine.price,
      expiryDate: medicine.expiryDate,
      batchNumber: medicine.batchNumber,
      manufacturer: medicine.manufacturer
    };

    if (existingItemIndex >= 0) {
      // Update existing item quantity in transaction
      const existingItem = transaction.items[existingItemIndex];
      const newQuantity = existingItem.quantity + parseInt(quantity);
      
      if (transactionType === 'sale' && medicine.quantity < newQuantity) {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock for ${medicine.name}. Available: ${medicine.quantity}, Requested: ${newQuantity}` 
        });
      }
      
      transaction.items[existingItemIndex].quantity = newQuantity;
      transaction.items[existingItemIndex].totalPrice = newQuantity * medicine.price;

      // Update existing item in cart using cart method
      await cart.addItem({
        medicineId: medicine._id,
        medicineName: medicine.name,
        genericName: medicine.genericName,
        form: medicine.form,
        packSize: medicine.packSize,
        quantity: parseInt(quantity),
        unitPrice: medicine.price,
        expiryDate: medicine.expiryDate,
        batchNumber: medicine.batchNumber,
        manufacturer: medicine.manufacturer
      });
    } else {
      // Add new item to transaction
      transaction.items.push(newItem);

      // Add new item to cart using cart method
      await cart.addItem({
        medicineId: medicine._id,
        medicineName: medicine.name,
        genericName: medicine.genericName,
        form: medicine.form,
        packSize: medicine.packSize,
        quantity: parseInt(quantity),
        unitPrice: medicine.price,
        expiryDate: medicine.expiryDate,
        batchNumber: medicine.batchNumber,
        manufacturer: medicine.manufacturer
      });
    }

    // Recalculate totals for transaction
    transaction.subtotal = transaction.items.reduce((sum, item) => sum + item.totalPrice, 0);
    transaction.totalAmount = transaction.subtotal + transaction.tax - transaction.discount;
    
    // ✅ FIXED: Update payment amount
    transaction.payment.amount = transaction.totalAmount;

    await transaction.save();

    // Populate the transaction for response
    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate('items.medicineId', 'name genericName form price')
      .select('pharmacyId transactionType transactionNumber transactionRef items subtotal tax discount totalAmount status');

    // Get populated cart for response
    const populatedCart = await cart.getPopulatedCart();

    res.status(200).json({ 
      success: true, 
      message: 'Medicine added to cart', 
      data: {
        transaction: populatedTransaction,
        cart: populatedCart
      }
    });

  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ success: false, message: 'Error adding to cart' });
  }
};

// Get cart - Returns both pending transaction and cart
exports.getCart = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { transactionType = 'sale' } = req.query;

    let transaction = await Transaction.findOne({ 
      pharmacyId, 
      transactionType, 
      status: 'pending' 
    }).populate('items.medicineId', 'name genericName form price');

    let cart = await Cart.findOne({ 
      pharmacyId, 
      transactionType, 
      status: 'active' 
    });

    if (!transaction && !cart) {
      return res.status(200).json({ 
        success: true, 
        data: { 
          transaction: {
            pharmacyId,
            transactionType,
            items: [], 
            subtotal: 0,
            tax: 0,
            discount: 0,
            totalAmount: 0,
            status: 'pending'
          },
          cart: {
            pharmacyId,
            transactionType,
            items: [],
            totalAmount: 0,
            totalItems: 0,
            totalQuantity: 0,
            status: 'active'
          }
        } 
      });
    }

    let populatedCart = null;
    if (cart) {
      populatedCart = await cart.getPopulatedCart();
    }

    res.status(200).json({ 
      success: true, 
      data: {
        transaction: transaction || null,
        cart: populatedCart || null
      }
    });

  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ success: false, message: 'Error fetching cart' });
  }
};

// Update cart item - Updates both transaction and cart item
exports.updateCartItem = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { itemId } = req.params;
    const { quantity, unitPrice } = req.body;

    // Find pending transaction
    const transaction = await Transaction.findOne({
      pharmacyId,
      status: 'pending',
      'items._id': itemId
    });

    // Find cart item
    const cartItem = await CartItem.findById(itemId);

    if (!transaction && !cartItem) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    // Update transaction item if exists
    if (transaction) {
      const itemIndex = transaction.items.findIndex(item => item._id.toString() === itemId);
      if (itemIndex !== -1) {
        const item = transaction.items[itemIndex];

        // Validate stock if updating quantity for sale
        if (quantity !== undefined && transaction.transactionType === 'sale') {
          const medicine = await Medicine.findById(item.medicineId);
          if (medicine.quantity < quantity) {
            return res.status(400).json({ 
              success: false, 
              message: `Insufficient stock. Available: ${medicine.quantity}` 
            });
          }
          transaction.items[itemIndex].quantity = parseInt(quantity);
        }

        if (unitPrice !== undefined) {
          transaction.items[itemIndex].unitPrice = parseFloat(unitPrice);
        }

        // Recalculate item total
        transaction.items[itemIndex].totalPrice = 
          transaction.items[itemIndex].quantity * transaction.items[itemIndex].unitPrice;

        // Recalculate transaction totals
        transaction.subtotal = transaction.items.reduce((sum, item) => sum + item.totalPrice, 0);
        transaction.totalAmount = transaction.subtotal + transaction.tax - transaction.discount;
        
        // ✅ FIXED: Update payment amount
        transaction.payment.amount = transaction.totalAmount;

        await transaction.save();
      }
    }

    // Update cart item if exists
    if (cartItem) {
      if (quantity !== undefined) {
        await cartItem.updateQuantity(parseInt(quantity));
      }
      if (unitPrice !== undefined) {
        await cartItem.updatePrice(parseFloat(unitPrice));
      }

      // Update cart totals
      const cart = await Cart.findById(cartItem.cartId);
      if (cart) {
        await cart.updateTotals();
      }
    }

    const populatedTransaction = transaction ? await Transaction.findById(transaction._id)
      .populate('items.medicineId', 'name genericName form price') : null;

    res.status(200).json({ 
      success: true, 
      message: 'Cart item updated', 
      data: populatedTransaction 
    });

  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ success: false, message: 'Error updating cart item' });
  }
};

// Remove item from cart - Removes from both transaction and cart
exports.removeFromCart = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { itemId } = req.params;

    // Find and remove from transaction
    const transaction = await Transaction.findOne({
      pharmacyId,
      status: 'pending',
      'items._id': itemId
    });

    // Find and remove from cart
    const cartItem = await CartItem.findById(itemId);
    let cart = null;
    if (cartItem) {
      cart = await Cart.findById(cartItem.cartId);
    }

    if (!transaction && !cartItem) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    // Remove from transaction
    if (transaction) {
      transaction.items = transaction.items.filter(item => item._id.toString() !== itemId);

      // Recalculate totals
      transaction.subtotal = transaction.items.reduce((sum, item) => sum + item.totalPrice, 0);
      transaction.totalAmount = transaction.subtotal + transaction.tax - transaction.discount;
      
      // ✅ FIXED: Update payment amount
      transaction.payment.amount = transaction.totalAmount;

      // If no items left, delete the transaction
      if (transaction.items.length === 0) {
        await Transaction.findByIdAndDelete(transaction._id);
      } else {
        await transaction.save();
      }
    }

    // Remove from cart
    if (cart && cartItem) {
      await cart.removeItem(itemId);
    }

    // Response data
    let responseData = null;
    if (transaction && transaction.items.length > 0) {
      const populatedTransaction = await Transaction.findById(transaction._id)
        .populate('items.medicineId', 'name genericName form price');
      responseData = populatedTransaction;
    }

    res.status(200).json({ 
      success: true, 
      message: 'Item removed from cart', 
      data: responseData
    });

  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ success: false, message: 'Error removing from cart' });
  }
};

// Clear cart - Deletes both pending transaction and cart
exports.clearCart = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { transactionType = 'sale' } = req.body;

    // Clear transaction
    const transaction = await Transaction.findOne({ 
      pharmacyId, 
      transactionType, 
      status: 'pending' 
    });

    if (transaction) {
      await Transaction.findByIdAndDelete(transaction._id);
    }

    // Clear cart
    const cart = await Cart.findOne({ 
      pharmacyId, 
      transactionType, 
      status: 'active' 
    });

    if (cart) {
      await cart.clearCart();
    }

    res.status(200).json({ success: true, message: 'Cart cleared successfully' });

  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ success: false, message: 'Error clearing cart' });
  }
};

// Checkout cart - Updates pending transaction to completed and marks cart as completed
exports.checkoutCart = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { 
      transactionType, 
      description, 
      customerName, 
      customerPhone, 
      paymentMethod, 
      tax = 0, 
      discount = 0 
    } = req.body;

    // Find pending transaction
    const transaction = await Transaction.findOne({ 
      pharmacyId, 
      transactionType: transactionType || 'sale', 
      status: 'pending' 
    });

    // Find active cart
    const cart = await Cart.findOne({ 
      pharmacyId, 
      transactionType: transactionType || 'sale', 
      status: 'active' 
    });

    if (!transaction) {
      return res.status(400).json({ success: false, message: 'No pending transaction found' });
    }

    if (!transaction.items || transaction.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Transaction is empty' });
    }

    // Update transaction details
    transaction.description = description || transaction.description;
    transaction.customerInfo = {
      name: customerName,
      phone: customerPhone
    };
    transaction.payment.method = paymentMethod; // ✅ FIXED: Update payment method correctly
    transaction.tax = tax;
    transaction.discount = discount;
    
    // Recalculate total
    transaction.totalAmount = Math.max(0, transaction.subtotal + tax - discount);
    transaction.status = 'completed';
    transaction.payment.amount = transaction.totalAmount; // ✅ FIXED: Update payment amount
    transaction.payment.status = 'completed'; // ✅ FIXED: Update payment status

    await transaction.save();

    // Update cart status
    if (cart) {
      cart.status = 'completed';
      cart.customerName = customerName;
      cart.customerPhone = customerPhone;
      cart.paymentMethod = paymentMethod;
      await cart.save();
    }

    // Update stock for sale transactions
    if (transaction.transactionType === 'sale') {
      for (const item of transaction.items) {
        await Medicine.findByIdAndUpdate(
          item.medicineId, 
          { $inc: { quantity: -item.quantity } }
        );
      }
    }

    res.status(200).json({ 
      success: true, 
      message: 'Checkout successful', 
      data: transaction 
    });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ success: false, message: 'Error during checkout' });
  }
};

// Purchase single medicine from cart - Remove only specific item
exports.purchaseSingleMedicine = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { itemId } = req.params;
    const { customerName, customerPhone, paymentMethod } = req.body;

    // Find pending transaction with the specific item
    const transaction = await Transaction.findOne({
      pharmacyId,
      status: 'pending',
      'items._id': itemId
    });

    // Find cart item
    const cartItem = await CartItem.findById(itemId);

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Item not found in transaction' });
    }

    const itemIndex = transaction.items.findIndex(item => item._id.toString() === itemId);
    const itemToPurchase = transaction.items[itemIndex];

    // Create new completed transaction for single item
    const transactionNumber = await generateTransactionNumber(transaction.transactionType);
    
    const completedTransaction = new Transaction({
      pharmacyId,
      transactionType: transaction.transactionType,
      transactionNumber,
      description: `Single item purchase: ${itemToPurchase.medicineName}`,
      items: [itemToPurchase],
      subtotal: itemToPurchase.totalPrice,
      tax: 0,
      discount: 0,
      totalAmount: itemToPurchase.totalPrice,
      customerInfo: {
        name: customerName,
        phone: customerPhone
      },
      // ✅ FIXED: Use correct payment structure
      payment: {
        method: paymentMethod,
        amount: itemToPurchase.totalPrice,
        status: 'completed'
      },
      status: 'completed',
      transactionDate: new Date(),
      // ✅ FIXED: Add required fields
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await completedTransaction.save();

    // Update stock for sale
    if (transaction.transactionType === 'sale') {
      await Medicine.findByIdAndUpdate(
        itemToPurchase.medicineId,
        { $inc: { quantity: -itemToPurchase.quantity } }
      );
    }

    // Remove item from pending transaction
    transaction.items.splice(itemIndex, 1);
    
    if (transaction.items.length === 0) {
      // Delete empty transaction
      await Transaction.findByIdAndDelete(transaction._id);
    } else {
      // Update remaining transaction totals
      transaction.subtotal = transaction.items.reduce((sum, item) => sum + item.totalPrice, 0);
      transaction.totalAmount = transaction.subtotal + transaction.tax - transaction.discount;
      transaction.payment.amount = transaction.totalAmount; // ✅ FIXED: Update payment amount
      await transaction.save();
    }

    // Remove item from cart
    if (cartItem) {
      const cart = await Cart.findById(cartItem.cartId);
      if (cart) {
        await cart.removeItem(itemId);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Single medicine purchased successfully',
      data: {
        completedTransaction,
        remainingTransaction: transaction.items.length > 0 ? transaction : null
      }
    });

  } catch (error) {
    console.error('Purchase single medicine error:', error);
    res.status(500).json({ success: false, message: 'Error purchasing single medicine' });
  }
};