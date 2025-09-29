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

// Static method to calculate cart totals
cartItemSchema.statics.calculateCartTotal = async function(cartId) {
  const result = await this.aggregate([
    { $match: { cartId: cartId } },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$totalPrice' },
        totalItems: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' }
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : { totalAmount: 0, totalItems: 0, totalQuantity: 0 };
};

const cartSchema = new mongoose.Schema({
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  transactionType: {
    type: String,
    required: true,
    enum: ['sale', 'purchase', 'return', 'adjustment'],
    default: 'sale'
  },
  items: [cartItemSchema], // Embedded items for better performance
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
  
  next();
});

// Method to add item to cart
cartSchema.methods.addItem = async function(itemData) {
  const existingItemIndex = this.items.findIndex(
    item => item.medicineId.toString() === itemData.medicineId.toString()
  );

  if (existingItemIndex >= 0) {
    // Update existing item
    this.items[existingItemIndex].quantity += itemData.quantity;
    this.items[existingItemIndex].totalPrice = 
      this.items[existingItemIndex].quantity * this.items[existingItemIndex].unitPrice;
  } else {
    // Add new item
    this.items.push({
      ...itemData,
      totalPrice: itemData.quantity * itemData.unitPrice,
      pharmacyId: this.pharmacyId
    });
  }

  return this.save();
};

// Method to remove item from cart
cartSchema.methods.removeItem = async function(itemId) {
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
  this.status = 'completed';
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

// Method to get populated cart (populate medicine references if needed)
cartSchema.methods.getPopulatedCart = async function() {
  // If you need to populate medicine details, you can do it here
  const cart = await this.populate('items.medicineId', 'name genericName form price stockQuantity expiryDate batchNumber manufacturer');
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

// Indexes for better performance
cartSchema.index({ pharmacyId: 1, status: 1 });
cartSchema.index({ createdAt: 1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
cartSchema.index({ 'items.medicineId': 1 });
cartSchema.index({ lastActivity: 1 });

// Virtual for cart age in hours
cartSchema.virtual('ageInHours').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60));
});

// Set toJSON transform to include virtuals
cartSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Cart', cartSchema);