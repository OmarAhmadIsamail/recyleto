// models/BusinessSettings.js
const mongoose = require('mongoose');

const businessHoursSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  open: {
    type: String,
    required: true
  },
  close: {
    type: String,
    required: true
  },
  closed: {
    type: Boolean,
    default: false
  }
});

const businessSettingsSchema = new mongoose.Schema({
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  businessName: {
    type: String,
    required: true
  },
  businessHours: [businessHoursSchema],
  taxRates: [{
    name: {
      type: String,
      required: true
    },
    rate: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  currency: {
    type: String,
    default: 'USD'
  },
  receiptTemplate: {
    header: String,
    footer: String,
    terms: String
  },
  defaultTransactionType: {
    type: String,
    enum: ['sale', 'return', 'exchange'],
    default: 'sale'
  },
  allowDrafts: {
    type: Boolean,
    default: true
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BusinessSettings', businessSettingsSchema);