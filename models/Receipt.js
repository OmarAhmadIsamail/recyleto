const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true
  },
  receiptNumber: {
    type: String,
    unique: true,
    required: true
  },
  customerInfo: {
    name: String,
    phone: String
  },
  receiptOptions: {
    print: { type: Boolean, default: false },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false }
  },
  transactionNotes: String,
  generatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Receipt', receiptSchema);