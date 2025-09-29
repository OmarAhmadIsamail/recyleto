const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({

    pharmacyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    genericName: String,
    category: {
        type: String,
        required: true
    },
    description: String,
    price: {
        type: Number,
        required: true
    },
    costPrice: Number,
    barcode: String,
    manufacturer: String,
    requiresPrescription: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Product', productSchema);