const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({

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
    quantity: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },
    customerName: String,
    customerPhone: String,
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'mobile_money'],
        default: 'cash'
    },
    status: {
        type: String,
        enum: ['completed', 'pending', 'cancelled'],
        default: 'completed'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Sale', saleSchema);