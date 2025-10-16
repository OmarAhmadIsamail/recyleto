const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
  refundNumber: {
    type: String,
    required: true,
    unique: true
  },
  receiptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Receipt',
    required: true
  },
  receiptNumber: {
    type: String,
    required: true
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true
  },
  transactionNumber: {
    type: String,
    required: true
  },
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerInfo: {
    name: String,
    phone: String,
    email: String
  },
  refundItems: [{
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine'
    },
    medicineName: {
      type: String,
      required: true
    },
    originalQuantity: Number,
    refundQuantity: {
      type: Number,
      required: true
    },
    unitPrice: {
      type: Number,
      required: true
    },
    totalRefundAmount: {
      type: Number,
      required: true
    },
    batchNumber: String,
    expiryDate: Date
  }],
  originalAmount: {
    type: Number,
    required: true
  },
  refundAmount: {
    type: Number,
    required: true
  },
  refundReason: {
    type: String,
    required: true
  },
  refundType: {
    type: String,
    enum: ['full', 'partial'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'mobile_money', 'bank_transfer', 'credit', 'original_method'],
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  completedAt: Date,
  rejectionReason: String,
  notes: String
}, {
  timestamps: true
});

// Generate refund number
refundSchema.statics.generateRefundNumber = async function() {
  const prefix = 'REF';
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const lastRefund = await this.findOne(
    { refundNumber: new RegExp(`^${prefix}${dateStr}`) },
    {},
    { sort: { refundNumber: -1 } }
  );

  let sequence = 1;
  if (lastRefund) {
    const lastSequence = parseInt(lastRefund.refundNumber.slice(-3));
    sequence = lastSequence + 1;
  }

  return `${prefix}${dateStr}${sequence.toString().padStart(3, '0')}`;
};

// Calculate refund amount before saving
refundSchema.pre('save', function(next) {
  if (this.isModified('refundItems')) {
    this.refundAmount = this.refundItems.reduce((total, item) => {
      return total + (item.totalRefundAmount || 0);
    }, 0);
  }
  next();
});

module.exports = mongoose.model('Refund', refundSchema);