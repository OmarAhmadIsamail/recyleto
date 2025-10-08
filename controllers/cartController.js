const Cart = require('../models/Cart');
const Transaction = require('../models/Transaction');
const Medicine = require('../models/Medicine');
const mongoose = require('mongoose');
const { generateTransactionNumber } = require('../utils/helpers');

/**
 * Utility functions for common operations
 */
const CartUtils = {
  /**
   * Validate medicine stock
   */
  validateStock: async (medicineId, requestedQuantity, transactionType) => {
    if (transactionType !== 'sale') return true;
    
    const medicine = await Medicine.findById(medicineId);
    return medicine && medicine.quantity >= requestedQuantity;
  },

  /**
   * Calculate item totals
   */
  calculateItemTotals: (quantity, unitPrice) => ({
    quantity: parseInt(quantity),
    unitPrice: parseFloat(unitPrice),
    totalPrice: quantity * unitPrice
  }),

  /**
   * Recalculate transaction totals
   */
  recalculateTransactionTotals: (transaction) => {
    transaction.subtotal = transaction.items.reduce((sum, item) => sum + item.totalPrice, 0);
    transaction.totalAmount = transaction.subtotal + (transaction.tax || 0) - (transaction.discount || 0);
    
    if (transaction.payment) {
      transaction.payment.amount = transaction.totalAmount;
    }
    
    return transaction;
  },

  /**
   * Create cart item structure
   */
  createCartItem: (itemData, sourceTransaction, transactionId) => ({
    medicineId: itemData.medicineId._id || itemData.medicineId,
    medicineName: itemData.medicineName,
    genericName: itemData.genericName,
    form: itemData.form,
    packSize: itemData.packSize,
    quantity: itemData.quantity,
    unitPrice: itemData.unitPrice,
    totalPrice: itemData.quantity * itemData.unitPrice,
    expiryDate: itemData.expiryDate,
    batchNumber: itemData.batchNumber,
    manufacturer: itemData.manufacturer,
    sourceTransactionId: transactionId,
    sourceTransactionNumber: sourceTransaction.transactionNumber
  })
};

/**
 * Add items to cart with transaction selection options
 */
exports.addToCartFromTransaction = async (req, res) => {
  try {
    const {
      selectionType,
      selectedItems = [],
      transactionId,
      transactionType = 'sale'
    } = req.body;

    const pharmacyId = req.user.pharmacyId || req.user._id;
    const userId = req.user._id;

    console.log('🛒 Add to Cart from Transaction:', {
      selectionType, selectedItems, transactionId, transactionType, userId, pharmacyId
    });

    // Validation
    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction ID'
      });
    }

    // Find source transaction
    const sourceTransaction = await Transaction.findOne({
      _id: transactionId,
      pharmacyId
    }).populate('items.medicineId', 'name genericName form price quantity');

    if (!sourceTransaction) {
      return res.status(404).json({
        success: false,
        message: 'Source transaction not found'
      });
    }

    console.log('📋 Found source transaction:', sourceTransaction.transactionNumber);

    // Filter items based on selection type
    let itemsToAdd = [];
    if (selectionType === 'full') {
      itemsToAdd = sourceTransaction.items.map(item => ({
        ...item.toObject(),
        sourceTransactionId: transactionId,
        sourceTransactionNumber: sourceTransaction.transactionNumber
      }));
    } else if (selectionType === 'partial') {
      if (!selectedItems.length) {
        return res.status(400).json({
          success: false,
          message: 'Selected items are required for partial selection'
        });
      }

      itemsToAdd = sourceTransaction.items
        .filter(item => selectedItems.includes(item.medicineId._id.toString()))
        .map(item => ({
          ...item.toObject(),
          sourceTransactionId: transactionId,
          sourceTransactionNumber: sourceTransaction.transactionNumber
        }));
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid selection type. Use "full" or "partial"'
      });
    }

    if (!itemsToAdd.length) {
      return res.status(400).json({
        success: false,
        message: 'No items to add to cart'
      });
    }

    console.log(`📦 Items to add: ${itemsToAdd.length}`);

    // Find or create cart and transaction
    const [cart, existingTransaction] = await Promise.all([
      Cart.findOne({ pharmacyId, transactionType, status: 'active' }),
      Transaction.findOne({ pharmacyId, transactionType, status: 'pending' })
    ]);

    let finalCart = cart;
    let transaction = existingTransaction;

    // Create cart if doesn't exist
    if (!finalCart) {
      finalCart = new Cart({
        pharmacyId,
        userId,
        transactionType,
        status: 'active',
        sourceTransactionCount: 0,
        sourceTransactions: [],
        items: []
      });
      console.log('🆕 Created new cart');
    }

    // Create transaction if doesn't exist
    if (!transaction) {
      const transactionNumber = await generateTransactionNumber(transactionType);
      
      // Create transaction with all required fields
      transaction = new Transaction({
        pharmacyId,
        userId,
        transactionType,
        transactionNumber,
        description: `Cart from transaction ${sourceTransaction.transactionNumber}`,
        items: [],
        subtotal: 0,
        tax: 0,
        discount: 0,
        totalAmount: 0,
        status: 'pending',
        sourceTransactionId: transactionId,
        sourceTransactionNumber: sourceTransaction.transactionNumber,
        payment: { 
          method: 'cash', 
          amount: 0, 
          status: 'pending' 
        },
        // Add required fields
        createdBy: userId,
        updatedBy: userId,
        transactionDate: new Date(),
        customerInfo: {
          name: '',
          phone: '',
          loyaltyPointsEarned: 0,
          loyaltyPointsRedeemed: 0
        },
        deliveryOption: 'pickup',
        deliveryStatus: 'pending',
        deliveryFee: 0,
        isPrescription: false,
        marketplace: {
          isMarketplace: false,
          commission: 0,
          platformFee: 0
        }
      });
      console.log('🆕 Created new pending transaction');
    }

    // Process items
    const addedItems = [];
    const conflicts = [];

    for (const itemData of itemsToAdd) {
      try {
        const medicineId = itemData.medicineId._id || itemData.medicineId;
        
        // Validate stock
        const hasStock = await CartUtils.validateStock(medicineId, itemData.quantity, transactionType);
        if (!hasStock) {
          const medicine = await Medicine.findById(medicineId);
          conflicts.push({
            medicineId,
            medicineName: itemData.medicineName,
            reason: `Insufficient stock. Available: ${medicine?.quantity || 0}, Requested: ${itemData.quantity}`
          });
          continue;
        }

        const cartItem = CartUtils.createCartItem(itemData, sourceTransaction, transactionId);
        
        // Update or add to cart
        const existingCartItemIndex = finalCart.items.findIndex(
          item => item.medicineId.toString() === medicineId.toString()
        );

        if (existingCartItemIndex >= 0) {
          // Update existing item
          const existingItem = finalCart.items[existingCartItemIndex];
          const newQuantity = existingItem.quantity + itemData.quantity;
          
          // Re-validate stock for updated quantity
          const hasUpdatedStock = await CartUtils.validateStock(medicineId, newQuantity, transactionType);
          if (!hasUpdatedStock) {
            const medicine = await Medicine.findById(medicineId);
            conflicts.push({
              medicineId,
              medicineName: itemData.medicineName,
              reason: `Insufficient stock for combined quantity. Available: ${medicine?.quantity || 0}, Requested: ${newQuantity}`
            });
            continue;
          }
          
          finalCart.items[existingCartItemIndex].quantity = newQuantity;
          finalCart.items[existingCartItemIndex].totalPrice = newQuantity * existingItem.unitPrice;
        } else {
          // Add new item
          finalCart.items.push(cartItem);
        }

        // Update or add to transaction
        const existingTransactionItemIndex = transaction.items.findIndex(
          item => item.medicineId && item.medicineId.toString() === medicineId.toString()
        );

        if (existingTransactionItemIndex >= 0) {
          transaction.items[existingTransactionItemIndex].quantity += itemData.quantity;
          transaction.items[existingTransactionItemIndex].totalPrice = 
            transaction.items[existingTransactionItemIndex].quantity * transaction.items[existingTransactionItemIndex].unitPrice;
        } else {
          transaction.items.push(cartItem);
        }

        addedItems.push({
          medicineId,
          medicineName: itemData.medicineName,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          totalPrice: itemData.quantity * itemData.unitPrice
        });

        console.log(`✅ Added item: ${itemData.medicineName} (${itemData.quantity})`);

      } catch (error) {
        console.error(`❌ Error processing item ${itemData.medicineId}:`, error);
        conflicts.push({
          medicineId: itemData.medicineId,
          medicineName: itemData.medicineName,
          reason: 'Processing error'
        });
      }
    }

    // Update source transactions tracking
    if (!finalCart.sourceTransactions.includes(transactionId)) {
      finalCart.sourceTransactions.push(transactionId);
      finalCart.sourceTransactionCount = finalCart.sourceTransactions.length;
    }

    // Recalculate totals and save
    CartUtils.recalculateTransactionTotals(transaction);
    
    // Update transaction timestamps
    transaction.updatedBy = userId;
    transaction.updatedAt = new Date();
    
    await finalCart.save();
    await transaction.save();

    console.log('✅ Cart updated successfully:', {
      added: addedItems.length,
      conflicts: conflicts.length
    });

    // Populate for response
    const [populatedTransaction, populatedCart] = await Promise.all([
      Transaction.findById(transaction._id)
        .populate('items.medicineId', 'name genericName form price'),
      finalCart.getPopulatedCart()
    ]);

    res.status(200).json({
      success: true,
      message: `Added ${addedItems.length} items to cart successfully`,
      data: {
        transaction: populatedTransaction,
        cart: populatedCart,
        summary: {
          added: addedItems.length,
          conflicts: conflicts.length,
          addedItems,
          conflicts
        }
      }
    });

  } catch (error) {
    console.error('❌ Add to cart from transaction error:', error);
    console.error('❌ Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Error adding items to cart from transaction',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get cart with transaction information - SUPER SAFE VERSION
 */
exports.getCart = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { transactionType = 'sale' } = req.query;

    console.log('🛒 GET Cart - Safe version');

    // Always return a valid cart structure
    const safeCart = {
      _id: null,
      pharmacyId: pharmacyId,
      userId: req.user._id,
      transactionType: transactionType,
      status: 'active',
      items: [],
      totalAmount: 0,
      sourceTransactions: [],
      sourceTransactionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Try to find actual cart data
    try {
      const cart = await Cart.findOne({ 
        pharmacyId, 
        transactionType, 
        status: 'active' 
      });

      if (cart) {
        safeCart._id = cart._id;
        safeCart.items = Array.isArray(cart.items) ? cart.items : [];
        safeCart.sourceTransactions = Array.isArray(cart.sourceTransactions) ? cart.sourceTransactions : [];
        safeCart.sourceTransactionCount = cart.sourceTransactionCount || 0;
        safeCart.createdAt = cart.createdAt;
        safeCart.updatedAt = cart.updatedAt;
        
        // Calculate total amount safely
        safeCart.totalAmount = safeCart.items.reduce((sum, item) => {
          return sum + (Number(item.totalPrice) || 0);
        }, 0);
      }
    } catch (dbError) {
      console.error('Database error fetching cart:', dbError);
      // Continue with safeCart structure
    }

    // Try to find transaction
    let transaction = null;
    try {
      transaction = await Transaction.findOne({ 
        pharmacyId, 
        transactionType, 
        status: 'pending' 
      }).populate('items.medicineId', 'name genericName form price quantity');
    } catch (txError) {
      console.error('Database error fetching transaction:', txError);
    }

    const summary = {
      totalItems: safeCart.items.length,
      totalQuantity: safeCart.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
      totalAmount: safeCart.totalAmount,
      sourceTransactionCount: safeCart.sourceTransactionCount
    };

    console.log('✅ Cart fetched successfully');

    res.status(200).json({
      success: true,
      data: { 
        cart: safeCart, 
        transaction, 
        sourceTransactions: [], 
        summary 
      }
    });

  } catch (error) {
    console.error('❌ Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cart',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Remove item from cart
 */
exports.removeFromCart = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { itemId } = req.params;

    const [cart, transaction] = await Promise.all([
      Cart.findOne({ pharmacyId, status: 'active' }),
      Transaction.findOne({
        pharmacyId,
        status: 'pending',
        'items._id': itemId
      })
    ]);

    if (!cart && !transaction) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    let removedItem = null;

    // Remove from cart
    if (cart) {
      const cartItemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
      if (cartItemIndex !== -1) {
        removedItem = cart.items[cartItemIndex];
        cart.items.splice(cartItemIndex, 1);
        await cart.save();
      }
    }

    // Remove from transaction
    if (transaction) {
      const transactionItemIndex = transaction.items.findIndex(item => item._id.toString() === itemId);
      if (transactionItemIndex !== -1) {
        transaction.items.splice(transactionItemIndex, 1);
        
        if (transaction.items.length === 0) {
          await Transaction.findByIdAndDelete(transaction._id);
        } else {
          CartUtils.recalculateTransactionTotals(transaction);
          await transaction.save();
        }
      }
    }

    const [updatedCart, updatedTransaction] = await Promise.all([
      cart ? Cart.findById(cart._id) : null,
      transaction && transaction.items && transaction.items.length > 0 ? 
        Transaction.findById(transaction._id).populate('items.medicineId', 'name genericName form price') : null
    ]);

    let populatedCart = null;
    if (updatedCart) {
      populatedCart = await updatedCart.getPopulatedCart();
    }

    res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      data: {
        removedItem,
        cart: populatedCart,
        transaction: updatedTransaction
      }
    });

  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing item from cart'
    });
  }
};

/**
 * Update cart item quantity
 */
exports.updateCartItem = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { itemId } = req.params;
    const { quantity, unitPrice } = req.body;

    const [cart, transaction] = await Promise.all([
      Cart.findOne({ pharmacyId, status: 'active' }),
      Transaction.findOne({
        pharmacyId,
        status: 'pending',
        'items._id': itemId
      })
    ]);

    if (!cart && !transaction) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    // Validate quantity for sale transactions
    if (quantity !== undefined && transaction?.transactionType === 'sale') {
      const medicineId = cart?.items.find(item => item._id.toString() === itemId)?.medicineId;
      if (medicineId) {
        const medicine = await Medicine.findById(medicineId);
        if (medicine && medicine.quantity < quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock. Available: ${medicine.quantity}`
          });
        }
      }
    }

    // Update cart
    if (cart) {
      const cartItemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
      if (cartItemIndex !== -1) {
        if (quantity !== undefined) {
          cart.items[cartItemIndex].quantity = parseInt(quantity);
        }
        if (unitPrice !== undefined) {
          cart.items[cartItemIndex].unitPrice = parseFloat(unitPrice);
        }
        cart.items[cartItemIndex].totalPrice = 
          cart.items[cartItemIndex].quantity * cart.items[cartItemIndex].unitPrice;
        
        await cart.save();
      }
    }

    // Update transaction
    if (transaction) {
      const transactionItemIndex = transaction.items.findIndex(item => item._id.toString() === itemId);
      if (transactionItemIndex !== -1) {
        if (quantity !== undefined) {
          transaction.items[transactionItemIndex].quantity = parseInt(quantity);
        }
        if (unitPrice !== undefined) {
          transaction.items[transactionItemIndex].unitPrice = parseFloat(unitPrice);
        }
        transaction.items[transactionItemIndex].totalPrice = 
          transaction.items[transactionItemIndex].quantity * transaction.items[transactionItemIndex].unitPrice;

        CartUtils.recalculateTransactionTotals(transaction);
        await transaction.save();
      }
    }

    const [populatedCart, populatedTransaction] = await Promise.all([
      cart ? Cart.findById(cart._id).then(c => c.getPopulatedCart()) : null,
      transaction ? Transaction.findById(transaction._id)
        .populate('items.medicineId', 'name genericName form price') : null
    ]);

    res.status(200).json({
      success: true,
      message: 'Cart item updated successfully',
      data: {
        cart: populatedCart,
        transaction: populatedTransaction
      }
    });

  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating cart item'
    });
  }
};

/**
 * Clear entire cart
 */
exports.clearCart = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const { transactionType = 'sale' } = req.body;

    await Promise.all([
      Cart.findOneAndUpdate(
        { pharmacyId, transactionType, status: 'active' },
        { $set: { items: [], sourceTransactions: [], sourceTransactionCount: 0 } }
      ),
      Transaction.findOneAndDelete(
        { pharmacyId, transactionType, status: 'pending' }
      )
    ]);

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: { cart: null, transaction: null }
    });

  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing cart'
    });
  }
};
