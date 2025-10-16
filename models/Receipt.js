const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  receiptNumber: {
    type: String,
    required: true,
    unique: true
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
  items: [{
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine'
    },
    medicineName: {
      type: String,
      required: true
    },
    genericName: String,
    form: String,
    packSize: String,
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
    batchNumber: String,
    expiryDate: Date,
    manufacturer: String
  }],
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
  payment: {
    method: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      default: 'completed'
    },
    transactionId: String
  },
  customerInfo: {
    name: String,
    phone: String,
    email: String
  },
  receiptDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    default: 'active'
  }
}, {
  timestamps: true
});

// Generate receipt number
receiptSchema.statics.generateReceiptNumber = async function() {
  const prefix = 'RCP';
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const lastReceipt = await this.findOne(
    { receiptNumber: new RegExp(`^${prefix}${dateStr}`) },
    {},
    { sort: { receiptNumber: -1 } }
  );

  let sequence = 1;
  if (lastReceipt) {
    const lastSequence = parseInt(lastReceipt.receiptNumber.slice(-3));
    sequence = lastSequence + 1;
  }

  return `${prefix}${dateStr}${sequence.toString().padStart(3, '0')}`;
};

module.exports = mongoose.model('Receipt', receiptSchema);