const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    cartId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart',
        required: true
    },
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
        trim: true
    },
    form: {
        type: String,
        required: true
    },
    packSize: {
        type: String,
        required: true,
        trim: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
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
        required: true
    },
    batchNumber: {
        type: String,
        trim: true
    },
    manufacturer: {
        type: String,
        trim: true
    },
    pharmacyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    addedAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true }, // ✅ Include virtuals in JSON
    toObject: { virtuals: true } // ✅ Include virtuals in object
});

// Update total price before save
cartItemSchema.pre('save', function(next) {
    this.totalPrice = this.quantity * this.unitPrice;
    this.updatedAt = new Date();
    next();
});

// Index for better query performance
cartItemSchema.index({ cartId: 1, medicineId: 1 });
cartItemSchema.index({ pharmacyId: 1 });
cartItemSchema.index({ expiryDate: 1 });

// Virtual for checking if item is expired
cartItemSchema.virtual('isExpired').get(function() {
    return new Date() > this.expiryDate;
});

// Virtual for checking if item expires soon (within 30 days)
cartItemSchema.virtual('expiresSoon').get(function() {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return this.expiryDate <= thirtyDaysFromNow && this.expiryDate > new Date();
});

// Static method to calculate cart total
cartItemSchema.statics.calculateCartTotal = async function(cartId) {
    const result = await this.aggregate([
        { $match: { cartId: new mongoose.Types.ObjectId(cartId) } },
        { $group: {
            _id: null,
            totalAmount: { $sum: '$totalPrice' },
            totalItems: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' }
        }}
    ]);

    return {
        totalAmount: result[0]?.totalAmount || 0,
        totalItems: result[0]?.totalItems || 0,
        totalQuantity: result[0]?.totalQuantity || 0
    };
};

// Instance method to update quantity
cartItemSchema.methods.updateQuantity = async function(newQuantity) {
    if (newQuantity < 1) throw new Error('Quantity must be at least 1');

    this.quantity = newQuantity;
    this.totalPrice = this.quantity * this.unitPrice;
    this.updatedAt = new Date();
    return this.save();
};

// Instance method to update price
cartItemSchema.methods.updatePrice = async function(newPrice) {
    if (newPrice < 0) throw new Error('Price cannot be negative');

    this.unitPrice = newPrice;
    this.totalPrice = this.quantity * this.unitPrice;
    this.updatedAt = new Date();
    return this.save();
};

module.exports = mongoose.model('CartItem', cartItemSchema);
