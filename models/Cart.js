const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  medicineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true
  },
  medicineName: {
    type: String,
    required: true,
    trim: true
  },
  genericName: {
    type: String,
    required: true,
    trim: true
  },
  form: {
    type: String,
    trim: true
  },
  packSize: {
    type: String,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Quantity must be an integer'
    }
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  expiryDate: {
    type: Date,
    validate: {
      validator: function(date) {
        return !date || date > new Date();
      },
      message: 'Expiry date must be in the future'
    }
  },
  batchNumber: {
    type: String,
    trim: true
  },
  manufacturer: {
    type: String,
    trim: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // NEW FIELDS FOR TRANSACTION SELECTION
  sourceTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  sourceTransactionNumber: {
    type: String,
    trim: true
  },
  selectionType: {
    type: String,
    enum: ['full', 'partial'],
    default: 'full'
  },
  isFromTransaction: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Pre-save middleware for cart item
cartItemSchema.pre('save', function(next) {
  // Calculate total price before saving
  this.totalPrice = this.quantity * this.unitPrice;
  
  // Validate that expiry date is in the future if provided
  if (this.expiryDate && this.expiryDate <= new Date()) {
    return next(new Error('Expiry date must be in the future'));
  }
  
  next();
});

const cartSchema = new mongoose.Schema({
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  transactionType: {
    type: String,
    required: true,
    enum: ['sale', 'purchase', 'return', 'adjustment'],
    default: 'sale'
  },
  items: [cartItemSchema],
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalItems: {
    type: Number,
    default: 0,
    min: 0
  },
  totalQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  customerName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  customerPhone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number']
  },
  customerEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'mobile_money', 'bank_transfer', 'credit', 'digital_wallet'],
    default: 'cash'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned', 'cancelled'],
    default: 'active'
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  discount: {
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed'
    },
    reason: String
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  finalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // NEW FIELDS FOR TRANSACTION TRACKING
  sourceTransactionCount: {
    type: Number,
    default: 0
  },
  sourceTransactions: [{
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    },
    transactionNumber: String,
    transactionDate: Date,
    selectionType: String, // 'full' or 'partial'
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  transactionSummary: {
    totalSourceTransactions: {
      type: Number,
      default: 0
    },
    itemsFromTransactions: {
      type: Number,
      default: 0
    },
    lastTransactionAdded: Date
  }
}, {
  timestamps: true
});

// Update totals before saving
cartSchema.pre('save', function(next) {
  this.totalAmount = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.totalItems = this.items.length;
  this.totalQuantity = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.lastActivity = new Date();
  
  // Calculate final amount with discount and tax
  let discountValue = this.discount.amount;
  if (this.discount.type === 'percentage') {
    discountValue = (this.totalAmount * this.discount.amount) / 100;
  }
  
  this.finalAmount = this.totalAmount - discountValue + this.taxAmount;

  // Update transaction summary
  this.transactionSummary.totalSourceTransactions = this.sourceTransactions.length;
  this.transactionSummary.itemsFromTransactions = this.items.filter(item => item.isFromTransaction).length;
  this.transactionSummary.lastTransactionAdded = this.sourceTransactions.length > 0 
    ? this.sourceTransactions[this.sourceTransactions.length - 1].addedAt 
    : null;
  
  next();
});

// Method to add item to cart with transaction info
cartSchema.methods.addItem = async function(itemData) {
  const existingItemIndex = this.items.findIndex(
    item => item.medicineId.toString() === itemData.medicineId.toString()
  );

  if (existingItemIndex >= 0) {
    // Update existing item
    this.items[existingItemIndex].quantity += itemData.quantity;
    this.items[existingItemIndex].totalPrice = 
      this.items[existingItemIndex].quantity * this.items[existingItemIndex].unitPrice;
    
    // Update transaction info if provided
    if (itemData.sourceTransactionId) {
      this.items[existingItemIndex].sourceTransactionId = itemData.sourceTransactionId;
      this.items[existingItemIndex].sourceTransactionNumber = itemData.sourceTransactionNumber;
      this.items[existingItemIndex].selectionType = itemData.selectionType;
      this.items[existingItemIndex].isFromTransaction = true;
    }
  } else {
    // Add new item
    const newItem = {
      ...itemData,
      totalPrice: itemData.quantity * itemData.unitPrice,
      pharmacyId: this.pharmacyId
    };

    // Set transaction flags
    if (itemData.sourceTransactionId) {
      newItem.isFromTransaction = true;
    }

    this.items.push(newItem);
  }

  return this.save();
};

// Method to add items from transaction (full or partial)
cartSchema.methods.addItemsFromTransaction = async function(transactionData, selectionType, selectedItems = []) {
  const { transactionId, transactionNumber, items } = transactionData;
  
  let itemsToAdd = [];
  
  if (selectionType === 'full') {
    // Add all items from transaction
    itemsToAdd = items.map(item => ({
      ...item.toObject ? item.toObject() : item,
      sourceTransactionId: transactionId,
      sourceTransactionNumber: transactionNumber,
      selectionType: 'full',
      isFromTransaction: true
    }));
  } else if (selectionType === 'partial') {
    // Add only selected items
    itemsToAdd = items
      .filter(item => selectedItems.includes(item.medicineId.toString()))
      .map(item => ({
        ...item.toObject ? item.toObject() : item,
        sourceTransactionId: transactionId,
        sourceTransactionNumber: transactionNumber,
        selectionType: 'partial',
        isFromTransaction: true
      }));
  }

  // Add items to cart
  for (const itemData of itemsToAdd) {
    await this.addItem(itemData);
  }

  // Record the source transaction
  const existingSourceIndex = this.sourceTransactions.findIndex(
    st => st.transactionId.toString() === transactionId
  );

  if (existingSourceIndex === -1) {
    this.sourceTransactions.push({
      transactionId,
      transactionNumber,
      transactionDate: new Date(),
      selectionType,
      addedAt: new Date()
    });
    this.sourceTransactionCount = this.sourceTransactions.length;
  }

  return this.save();
};

// Method to remove item from cart
cartSchema.methods.removeItem = async function(itemId) {
  const itemToRemove = this.items.id(itemId);
  
  if (itemToRemove && itemToRemove.isFromTransaction) {
    // Check if this was the last item from a transaction
    const transactionId = itemToRemove.sourceTransactionId;
    const remainingItemsFromTransaction = this.items.filter(
      item => item.sourceTransactionId && item.sourceTransactionId.toString() === transactionId.toString()
    ).length;

    if (remainingItemsFromTransaction === 1) { // This is the last item
      // Remove from source transactions
      this.sourceTransactions = this.sourceTransactions.filter(
        st => st.transactionId.toString() !== transactionId.toString()
      );
      this.sourceTransactionCount = this.sourceTransactions.length;
    }
  }

  this.items = this.items.filter(item => item._id.toString() !== itemId);
  return this.save();
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = async function(itemId, quantity) {
  if (quantity < 1) {
    throw new Error('Quantity must be at least 1');
  }

  const item = this.items.id(itemId);
  if (item) {
    item.quantity = quantity;
    item.totalPrice = quantity * item.unitPrice;
    return this.save();
  }
  throw new Error('Item not found in cart');
};

// Method to clear cart
cartSchema.methods.clearCart = async function() {
  this.items = [];
  this.totalAmount = 0;
  this.totalItems = 0;
  this.totalQuantity = 0;
  this.sourceTransactions = [];
  this.sourceTransactionCount = 0;
  this.transactionSummary = {
    totalSourceTransactions: 0,
    itemsFromTransactions: 0,
    lastTransactionAdded: null
  };
  this.status = 'completed';
  return this.save();
};

// Method to clear only transaction items
cartSchema.methods.clearTransactionItems = async function() {
  this.items = this.items.filter(item => !item.isFromTransaction);
  
  // Clear source transactions
  this.sourceTransactions = [];
  this.sourceTransactionCount = 0;
  this.transactionSummary.itemsFromTransactions = 0;
  this.transactionSummary.totalSourceTransactions = 0;
  this.transactionSummary.lastTransactionAdded = null;
  
  return this.save();
};

// Method to get items by source transaction
cartSchema.methods.getItemsByTransaction = function(transactionId) {
  return this.items.filter(item => 
    item.sourceTransactionId && item.sourceTransactionId.toString() === transactionId.toString()
  );
};

// Method to remove all items from a specific transaction
cartSchema.methods.removeTransactionItems = async function(transactionId) {
  this.items = this.items.filter(item => 
    !item.sourceTransactionId || item.sourceTransactionId.toString() !== transactionId.toString()
  );
  
  // Remove from source transactions
  this.sourceTransactions = this.sourceTransactions.filter(
    st => st.transactionId.toString() !== transactionId.toString()
  );
  this.sourceTransactionCount = this.sourceTransactions.length;
  
  return this.save();
};

// Method to apply discount
cartSchema.methods.applyDiscount = async function(amount, type = 'fixed', reason = '') {
  this.discount = { amount, type, reason };
  return this.save();
};

// Method to set tax
cartSchema.methods.setTax = async function(taxAmount) {
  this.taxAmount = taxAmount;
  return this.save();
};

// Method to get populated cart
cartSchema.methods.getPopulatedCart = async function() {
  const cart = await this.populate([
    {
      path: 'items.medicineId',
      select: 'name genericName form price stockQuantity expiryDate batchNumber manufacturer'
    },
    {
      path: 'sourceTransactions.transactionId',
      select: 'transactionNumber transactionDate totalAmount items'
    }
  ]);
  return cart;
};

// Method to check if cart is expired
cartSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Method to abandon cart
cartSchema.methods.abandonCart = async function() {
  this.status = 'abandoned';
  return this.save();
};

// Method to complete cart
cartSchema.methods.completeCart = async function(paymentMethod = null) {
  if (paymentMethod) {
    this.paymentMethod = paymentMethod;
  }
  this.status = 'completed';
  return this.save();
};

// Static method to find abandoned carts
cartSchema.statics.findAbandonedCarts = function(days = 1) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.find({
    status: 'active',
    lastActivity: { $lt: cutoffDate }
  });
};

// Static method to find cart by user and transaction type
cartSchema.statics.findActiveCart = function(userId, pharmacyId, transactionType = 'sale') {
  return this.findOne({
    userId,
    pharmacyId,
    transactionType,
    status: 'active'
  });
};

// Static method to get cart summary
cartSchema.statics.getCartSummary = async function(userId, pharmacyId) {
  const cart = await this.findOne({
    userId,
    pharmacyId,
    status: 'active'
  });

  if (!cart) {
    return {
      totalItems: 0,
      totalQuantity: 0,
      totalAmount: 0,
      sourceTransactionCount: 0
    };
  }

  return {
    totalItems: cart.totalItems,
    totalQuantity: cart.totalQuantity,
    totalAmount: cart.totalAmount,
    sourceTransactionCount: cart.sourceTransactionCount,
    transactionSummary: cart.transactionSummary
  };
};

// Indexes for better performance
cartSchema.index({ pharmacyId: 1, status: 1 });
cartSchema.index({ userId: 1, status: 1 });
cartSchema.index({ createdAt: 1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
cartSchema.index({ 'items.medicineId': 1 });
cartSchema.index({ lastActivity: 1 });
cartSchema.index({ 'sourceTransactions.transactionId': 1 });

// Virtual for cart age in hours
cartSchema.virtual('ageInHours').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60));
});

// Virtual for transaction items count
cartSchema.virtual('transactionItemsCount').get(function() {
  return this.items.filter(item => item.isFromTransaction).length;
});

// Virtual for regular items count
cartSchema.virtual('regularItemsCount').get(function() {
  return this.items.filter(item => !item.isFromTransaction).length;
});

// Set toJSON transform to include virtuals
cartSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Cart', cartSchema);