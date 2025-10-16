const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  medicineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true
  },
  medicineName: {
    type: String,
    required: true
  },
  genericName: String,
  form: String,
  packSize: String,
  batchNumber: String,
  expiryDate: Date,
  manufacturer: String,
  quantity: {
    type: Number,
    required: true
  },
  unitPrice: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  costPrice: Number, // For profit calculation
  profit: Number // Selling price - cost price
});

const saleSchema = new mongoose.Schema({
  // Pharmacy Information
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pharmacyName: String,

  // Transaction Information
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true
  },
  transactionNumber: {
    type: String,
    required: true
  },
  transactionType: {
    type: String,
    enum: ['sale', 'purchase', 'return', 'adjustment'],
    default: 'sale'
  },
  transactionDate: {
    type: Date,
    required: true
  },

  // Receipt Information
  receiptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Receipt'
  },
  receiptNumber: {
    type: String
  },

  // Refund Information (if applicable)
  refundId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Refund'
  },
  refundNumber: String,
  refundStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected', 'completed', 'partial'],
    default: 'none'
  },
  refundAmount: {
    type: Number,
    default: 0
  },

  // Customer Information
  customerInfo: {
    name: String,
    phone: String,
    email: String,
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
    }
  },

  // Sales Items
  items: [saleItemSchema],

  // Payment Information
  payment: {
    method: {
      type: String,
      enum: ['cash', 'card', 'mobile_money', 'bank_transfer', 'digital_wallet', 'credit'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'completed'
    },
    transactionId: String
  },

  // Financial Summary
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  deliveryFee: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  totalProfit: {
    type: Number,
    default: 0
  },

  // Delivery Information
  deliveryOption: {
    type: String,
    enum: ['pickup', 'delivery'],
    default: 'pickup'
  },
  deliveryStatus: {
    type: String,
    enum: ['pending', 'shipped', 'delivered', 'cancelled', 'not_required'],
    default: 'not_required'
  },

  // Status and Metadata
  status: {
    type: String,
    enum: ['completed', 'refunded', 'partially_refunded', 'cancelled'],
    default: 'completed'
  },
  saleType: {
    type: String,
    enum: ['walkin', 'online', 'wholesale', 'prescription'],
    default: 'walkin'
  },
  isPrescription: {
    type: Boolean,
    default: false
  },
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  },

  // Analytics Fields
  monthYear: String, // Format: "2024-12" for easy aggregation
  dayOfWeek: Number, // 0-6 (Sunday-Saturday)
  hourOfDay: Number, // 0-23
  season: String, // "spring", "summer", "fall", "winter"

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
saleSchema.index({ pharmacyId: 1, transactionDate: -1 });
saleSchema.index({ pharmacyId: 1, monthYear: 1 });
saleSchema.index({ pharmacyId: 1, medicineId: 1 });
saleSchema.index({ transactionNumber: 1 });
saleSchema.index({ receiptNumber: 1 });
saleSchema.index({ 'customerInfo.phone': 1 });

// Pre-save middleware to calculate analytics fields
saleSchema.pre('save', function(next) {
  if (this.transactionDate) {
    const date = new Date(this.transactionDate);
    
    // Set monthYear (format: "2024-12")
    this.monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Set day of week (0-6)
    this.dayOfWeek = date.getDay();
    
    // Set hour of day (0-23)
    this.hourOfDay = date.getHours();
    
    // Set season
    this.season = getSeason(date);
  }

  // Calculate total profit
  if (this.items && this.items.length > 0) {
    this.totalProfit = this.items.reduce((sum, item) => sum + (item.profit || 0), 0);
  }

  this.updatedAt = new Date();
  next();
});

// Static method to get sales summary
saleSchema.statics.getSalesSummary = async function(pharmacyId, startDate, endDate) {
  const matchStage = {
    pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
    status: { $in: ['completed', 'partially_refunded'] }
  };

  if (startDate || endDate) {
    matchStage.transactionDate = {};
    if (startDate) matchStage.transactionDate.$gte = new Date(startDate);
    if (endDate) matchStage.transactionDate.$lte = new Date(endDate);
  }

  const summary = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        totalProfit: { $sum: '$totalProfit' },
        totalTax: { $sum: '$tax' },
        totalDiscount: { $sum: '$discount' },
        totalDeliveryFee: { $sum: '$deliveryFee' },
        averageOrderValue: { $avg: '$totalAmount' }
      }
    }
  ]);

  return summary[0] || {
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalTax: 0,
    totalDiscount: 0,
    totalDeliveryFee: 0,
    averageOrderValue: 0
  };
};

// Static method to get top selling medicines
saleSchema.statics.getTopSellingMedicines = async function(pharmacyId, limit = 10, startDate, endDate) {
  const matchStage = {
    pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
    status: { $in: ['completed', 'partially_refunded'] }
  };

  if (startDate || endDate) {
    matchStage.transactionDate = {};
    if (startDate) matchStage.transactionDate.$gte = new Date(startDate);
    if (endDate) matchStage.transactionDate.$lte = new Date(endDate);
  }

  return await this.aggregate([
    { $match: matchStage },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.medicineId',
        medicineName: { $first: '$items.medicineName' },
        totalQuantity: { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.totalPrice' },
        totalProfit: { $sum: '$items.profit' },
        saleCount: { $sum: 1 }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: limit }
  ]);
};

// Static method to get sales by time period
saleSchema.statics.getSalesByTimePeriod = async function(pharmacyId, period = 'daily', startDate, endDate) {
  const matchStage = {
    pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
    status: { $in: ['completed', 'partially_refunded'] }
  };

  if (startDate || endDate) {
    matchStage.transactionDate = {};
    if (startDate) matchStage.transactionDate.$gte = new Date(startDate);
    if (endDate) matchStage.transactionDate.$lte = new Date(endDate);
  }

  let groupId;
  switch (period) {
    case 'hourly':
      groupId = {
        year: { $year: '$transactionDate' },
        month: { $month: '$transactionDate' },
        day: { $dayOfMonth: '$transactionDate' },
        hour: { $hour: '$transactionDate' }
      };
      break;
    case 'weekly':
      groupId = {
        year: { $year: '$transactionDate' },
        week: { $week: '$transactionDate' }
      };
      break;
    case 'monthly':
      groupId = {
        year: { $year: '$transactionDate' },
        month: { $month: '$transactionDate' }
      };
      break;
    case 'daily':
    default:
      groupId = {
        year: { $year: '$transactionDate' },
        month: { $month: '$transactionDate' },
        day: { $dayOfMonth: '$transactionDate' }
      };
  }

  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: groupId,
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        totalProfit: { $sum: '$totalProfit' },
        averageOrderValue: { $avg: '$totalAmount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
  ]);
};

// Helper function to determine season
function getSeason(date) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

module.exports = mongoose.model('Sale', saleSchema);