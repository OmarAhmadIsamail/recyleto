const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({

    pharmacyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    batchNumber: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    expiryDate: {
        type: Date,
        required: true
    },
    stockAlertThreshold: {
        type: Number,
        default: 10
    },
    status: {
        type: String,
        enum: ['in_stock', 'low_stock', 'out_of_stock', 'expired'],
        default: 'in_stock'
    }
}, {
    timestamps: true
});

// Update status based on quantity and expiry date
inventorySchema.pre('save', function(next) {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    if (this.quantity <= 0) {
        this.status = 'out_of_stock';
    } else if (this.quantity <= this.stockAlertThreshold) {
        this.status = 'low_stock';
    } else if (this.expiryDate <= today) {
        this.status = 'expired';
    } else if (this.expiryDate <= thirtyDaysFromNow) {
        this.status = 'low_stock'; // Consider expiring soon as low stock for alerts
    } else {
        this.status = 'in_stock';
    }
    next();
});

module.exports = mongoose.model('Inventory', inventorySchema);