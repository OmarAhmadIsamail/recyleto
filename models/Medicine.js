const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
    pharmacyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
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
        required: true,
        enum: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Cream', 'Drops', 'Inhaler', 'Other'],
        default: 'Tablet'
    },
    packSize: {
        type: String,
        required: true,
        trim: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    expiryDate: {
        type: Date,
        required: true
    },
    manufacturer: {
        type: String,
        trim: true
    },
    batchNumber: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    requiresPrescription: {
        type: Boolean,
        default: false
    },
    stockAlert: {
        type: Number,
        default: 10
    },
    lowStockThreshold: {
        type: Number,
        default: 10
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'discontinued'],
        default: 'active'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Transaction tracking fields
    inTransaction: {
        type: Boolean,
        default: false
    },
    transactionNumber: {
        type: String,
        trim: true
    },
    currentTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },
    lastTransactionDate: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for search functionality
medicineSchema.index({
    name: 'text',
    genericName: 'text',
    manufacturer: 'text',
    category: 'text'
});

// Index for expiring medicines query
medicineSchema.index({ pharmacyId: 1, expiryDate: 1 });

// Index for transaction queries
medicineSchema.index({ pharmacyId: 1, inTransaction: 1 });
medicineSchema.index({ pharmacyId: 1, transactionNumber: 1 });

// Virtual for stock status
medicineSchema.virtual('stockStatus').get(function() {
    if (this.quantity === 0) return 'out_of_stock';
    if (this.quantity <= this.lowStockThreshold) return 'low_stock';
    return 'in_stock';
});

// Check if medicine is expired
medicineSchema.virtual('isExpired').get(function() {
    return new Date() > this.expiryDate;
});

// Check if medicine will expire soon (within specified days)
medicineSchema.virtual('expiresSoon').get(function() {
    const daysFromNow = new Date();
    daysFromNow.setDate(daysFromNow.getDate() + 30);
    return this.expiryDate <= daysFromNow && this.expiryDate > new Date();
});

// Method to check if medicine expires within specific days
medicineSchema.methods.expiresWithinDays = function(days) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    return this.expiryDate <= targetDate && this.expiryDate > new Date();
};

// Method to mark medicine as in transaction
medicineSchema.methods.markInTransaction = function(transactionNumber, transactionId) {
    this.inTransaction = true;
    this.transactionNumber = transactionNumber;
    this.currentTransactionId = transactionId;
    this.lastTransactionDate = new Date();
    return this.save();
};

// Method to mark medicine as not in transaction
medicineSchema.methods.markNotInTransaction = function() {
    this.inTransaction = false;
    this.transactionNumber = undefined;
    this.currentTransactionId = undefined;
    return this.save();
};

// Static method to find medicines in transaction
medicineSchema.statics.findInTransaction = function(pharmacyId, transactionNumber = null) {
    const query = { pharmacyId, inTransaction: true };
    if (transactionNumber) {
        query.transactionNumber = transactionNumber;
    }
    return this.find(query);
};

module.exports = mongoose.model('Medicine', medicineSchema);