const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    pharmacyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function() {
            return this.type === 'medicine_request';
        }
    },
    type: {
        type: String,
        enum: ['stock_request', 'refund', 'support', 'other', 'medicine_request'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    // Medicine-specific fields (only for medicine_request type)
    medicineDetails: {
        medicineName: String,
        genericName: String,
        form: {
            type: String,
            enum: ['Tablet', 'Syrup', 'Capsule', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Other']
        },
        packSize: String,
        image: String
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'rejected'],
        default: 'pending'
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    dueDate: Date,
    attachments: [String],
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        comment: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Virtual for pharmacy name (to avoid storing duplicate data)
requestSchema.virtual('pharmacyName').get(function() {
    return this.pharmacyId ? this.pharmacyId.pharmacyName : null;
});

// Ensure virtual fields are serialized
requestSchema.set('toJSON', { virtuals: true });
requestSchema.set('toObject', { virtuals: true });

// Add index for better query performance
requestSchema.index({ pharmacyId: 1, type: 1, status: 1 });
requestSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('Request', requestSchema);