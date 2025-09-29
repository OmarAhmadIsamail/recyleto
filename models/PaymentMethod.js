// models/PaymentMethod.js
const mongoose = require('mongoose');
const encryptionService = require('../utils/encryption');

const paymentMethodSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['cash', 'card', 'bank_transfer', 'digital_wallet']
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Secure card storage
  cardData: {
    encryptedCardNumber: {
      type: String,
      required: function() { return this.type === 'card'; }
    },
    cardLastFour: {
      type: String,
      required: function() { return this.type === 'card'; }
    },
    cardholderName: {
      type: String,
      required: function() { return this.type === 'card'; }
    },
    expiryDate: {
      type: String,
      required: function() { return this.type === 'card'; }
    },
    hashedCvv: {
      type: String,
      required: function() { return this.type === 'card'; }
    },
    brand: {
      type: String,
      enum: ['visa', 'mastercard', 'amex', 'discover', 'other']
    }
  },
  
  // Bank transfer fields (also encrypted)
  bankData: {
    encryptedAccountNumber: {
      type: String,
      required: function() { return this.type === 'bank_transfer'; }
    },
    accountLastFour: {
      type: String,
      required: function() { return this.type === 'bank_transfer'; }
    },
    bankName: {
      type: String,
      required: function() { return this.type === 'bank_transfer'; }
    },
    routingNumber: {
      type: String,
      required: function() { return this.type === 'bank_transfer'; }
    },
    iban: String
  },
  
  // Digital wallet fields
  walletProvider: {
    type: String,
    enum: ['vodafone_cash', 'orange_money', 'etsalate_cash', 'other'],
    required: function() { return this.type === 'digital_wallet'; }
  },
  phoneNumber: {
    type: String,
    required: function() { return this.type === 'digital_wallet'; }
  },
  walletId: {
    type: String,
    required: function() { return this.type === 'digital_wallet'; }
  }
}, {
  timestamps: true
});

// Pre-save middleware to encrypt sensitive data
paymentMethodSchema.pre('save', async function(next) {
  if (this.type === 'card' && this.isModified('cardData')) {
    try {
      // Encrypt card number
      if (this.cardData.encryptedCardNumber) {
        const encrypted = encryptionService.encrypt(this.cardData.encryptedCardNumber);
        this.cardData.encryptedCardNumber = JSON.stringify(encrypted);
      }
      
      // Hash CVV (one-way hash, cannot be retrieved)
      if (this.cardData.hashedCvv) {
        this.cardData.hashedCvv = await encryptionService.hashData(this.cardData.hashedCvv);
      }
      
    } catch (error) {
      return next(error);
    }
  }
  
  if (this.type === 'bank_transfer' && this.isModified('bankData')) {
    try {
      if (this.bankData.encryptedAccountNumber) {
        const encrypted = encryptionService.encrypt(this.bankData.encryptedAccountNumber);
        this.bankData.encryptedAccountNumber = JSON.stringify(encrypted);
      }
    } catch (error) {
      return next(error);
    }
  }
  
  next();
});

// Instance method to decrypt card number (only when needed)
paymentMethodSchema.methods.getDecryptedCardNumber = function() {
  if (this.type !== 'card' || !this.cardData.encryptedCardNumber) {
    return null;
  }
  
  try {
    const encryptedData = JSON.parse(this.cardData.encryptedCardNumber);
    return encryptionService.decrypt(encryptedData);
  } catch (error) {
    throw new Error('Failed to decrypt card number');
  }
};

// Instance method to verify CVV (without storing it)
paymentMethodSchema.methods.verifyCvv = async function(cvv) {
  if (this.type !== 'card' || !this.cardData.hashedCvv) {
    return false;
  }
  
  return await encryptionService.verifyHash(cvv, this.cardData.hashedCvv);
};

// Virtual for masked card number display
paymentMethodSchema.virtual('displayCardNumber').get(function() {
  if (this.type !== 'card' || !this.cardData.cardLastFour) {
    return null;
  }
  return encryptionService.maskCardNumber(this.cardData.cardLastFour);
});

// Static method to validate before saving
paymentMethodSchema.statics.validateCard = function(cardNumber, cvv) {
  return encryptionService.validateCardNumber(cardNumber);
};

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);