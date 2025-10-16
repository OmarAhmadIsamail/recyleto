const mongoose = require('mongoose');
const Counter = require('./Counter');

const transactionItemSchema = new mongoose.Schema({
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
        required: true,
        trim: true
    },
    form: {
        type: String,
        trim: true
    },
    packSize: { 
        type: String, 
        required: true,
        trim: true
    },
    quantity: { 
        type: Number, 
        required: true, 
        min: 1
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
        type: Date
    },
    batchNumber: { 
        type: String,
        trim: true
    },
    manufacturer: {
        type: String,
        trim: true
    }
}, { 
    timestamps: true,
    _id: true
});

const transactionSchema = new mongoose.Schema({
    // Core Identifiers
    pharmacyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Transaction Type & Status
    transactionType: {
        type: String,
        required: true,
        enum: ['sale', 'purchase', 'return', 'adjustment'],
        default: 'sale',
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled', 'refunded'],
        default: 'pending'
    },
    
    // Unique Identifiers
    transactionNumber: { 
        type: String, 
        unique: true,
        index: true
    },
    transactionRef: { 
        type: String, 
        unique: true,
        index: true
    },
    
    // Transaction Details
    description: { 
        type: String, 
        trim: true,
        default: ''
    },
    items: [transactionItemSchema],
    
    // Financial Information
    subtotal: { 
        type: Number, 
        default: 0,
        min: 0
    },
    tax: { 
        type: Number, 
        default: 0,
        min: 0
    },
    discount: { 
        type: Number, 
        default: 0,
        min: 0
    },
    discountType: {
        type: String,
        enum: ['fixed', 'percentage'],
        default: 'fixed'
    },
    totalAmount: { 
        type: Number, 
        default: 0,
        min: 0
    },
    
    // Customer Information
    customerInfo: {
        name: { 
            type: String, 
            trim: true
        },
        phone: { 
            type: String, 
            trim: true
        },
        email: {
            type: String,
            trim: true,
            lowercase: true
        }
    },
    
    // Payment Information
    payment: {
        method: {
            type: String,
            enum: ['cash', 'card', 'bank_transfer', 'digital_wallet', 'mobile_money', 'credit'],
            default: 'cash'
        },
        details: {
            type: mongoose.Schema.Types.Mixed
        },
        amount: {
            type: Number,
            default: 0,
            min: 0
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'pending'
        },
        transactionId: String,
        processedAt: Date
    },
    
    // Delivery Information
    deliveryAddress: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliveryAddress'
    },
    deliveryOption: {
        type: String,
        enum: ['pickup', 'delivery'],
        default: 'pickup'
    },
    deliveryStatus: {
        type: String,
        enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', 'not_required'],
        default: 'not_required'
    },
    deliveryFee: {
        type: Number,
        default: 0,
        min: 0
    },
    estimatedDelivery: {
        type: Date
    },
    actualDelivery: {
        type: Date
    },
    deliveryNotes: {
        type: String,
        trim: true
    },
    
    // Timestamps
    transactionDate: { 
        type: Date, 
        default: Date.now,
        index: true 
    },
    checkoutDate: {
        type: Date
    },
    
    // Audit Fields
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Additional Info
    notes: {
        type: String,
        trim: true
    },
    
    // Source tracking for cart operations
    sourceTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },
    sourceTransactionNumber: String

}, { 
    timestamps: true,
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            // Ensure items array exists for virtuals
            if (!ret.items) {
                ret.items = [];
            }
            return ret;
        }
    },
    toObject: { 
        virtuals: true,
        transform: function(doc, ret) {
            // Ensure items array exists for virtuals
            if (!ret.items) {
                ret.items = [];
            }
            return ret;
        }
    }
});

// ===== VIRTUAL FIELDS =====
transactionSchema.virtual('itemCount').get(function() {
    return Array.isArray(this.items) ? this.items.length : 0;
});

transactionSchema.virtual('totalQuantity').get(function() {
    if (!Array.isArray(this.items)) return 0;
    return this.items.reduce((total, item) => total + (item.quantity || 0), 0);
});

transactionSchema.virtual('isPaid').get(function() {
    return this.payment && this.payment.status === 'completed';
});

transactionSchema.virtual('amountDue').get(function() {
    const total = this.totalAmount || 0;
    const paid = (this.payment && this.payment.amount) || 0;
    return Math.max(0, total - paid);
});

transactionSchema.virtual('ageInHours').get(function() {
    return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60));
});

// ===== STATIC METHODS =====
transactionSchema.statics.generateTransactionNumber = async function(transactionType = 'sale') {
    try {
        const prefix = transactionType.slice(0, 3).toUpperCase();
        const counter = await Counter.findByIdAndUpdate(
            { _id: `transaction_${transactionType}` },
            { $inc: { sequence_value: 1 } },
            { new: true, upsert: true }
        );
        
        return `${prefix}${String(counter.sequence_value).padStart(6, '0')}`;
    } catch (error) {
        // Fallback if counter fails
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}${timestamp}${random}`;
    }
};

transactionSchema.statics.findByStatus = function(pharmacyId, status) {
    return this.find({ pharmacyId, status }).sort({ transactionDate: -1 });
};

transactionSchema.statics.getDailySales = async function(pharmacyId, date = new Date()) {
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    return this.aggregate([
        {
            $match: {
                pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
                transactionType: 'sale',
                status: 'completed',
                transactionDate: { $gte: startOfDay, $lte: endOfDay }
            }
        },
        {
            $group: {
                _id: null,
                totalSales: { $sum: '$totalAmount' },
                transactionCount: { $sum: 1 },
                averageSale: { $avg: '$totalAmount' }
            }
        }
    ]);
};

// ===== INSTANCE METHODS =====
transactionSchema.methods.calculateTotals = function() {
    // Ensure items array exists
    if (!Array.isArray(this.items)) {
        this.items = [];
    }
    
    // Calculate item totals
    this.items.forEach(item => {
        if (item && typeof item.quantity === 'number' && typeof item.unitPrice === 'number') {
            item.totalPrice = item.quantity * item.unitPrice;
        }
    });
    
    // Calculate subtotal
    this.subtotal = this.items.reduce((total, item) => {
        return total + (item.totalPrice || 0);
    }, 0);
    
    // Calculate total amount
    let discountAmount = this.discount || 0;
    if (this.discountType === 'percentage') {
        discountAmount = (this.subtotal * (this.discount || 0)) / 100;
    }
    
    const taxAmount = this.tax || 0;
    const deliveryFee = this.deliveryFee || 0;
    
    this.totalAmount = Math.max(0, this.subtotal + taxAmount - discountAmount + deliveryFee);
    
    // Sync payment amount
    if (this.payment) {
        this.payment.amount = this.totalAmount;
    }
    
    return this;
};

transactionSchema.methods.canCheckout = function() {
    return this.status === 'pending' && 
           Array.isArray(this.items) && 
           this.items.length > 0 && 
           (this.totalAmount || 0) > 0;
};

transactionSchema.methods.completeCheckout = function(paymentData = {}) {
    if (!this.canCheckout()) {
        throw new Error('Transaction cannot be completed');
    }
    
    this.status = 'completed';
    this.checkoutDate = new Date();
    
    // Update payment information
    if (paymentData.method) {
        this.payment.method = paymentData.method;
    }
    if (paymentData.details) {
        this.payment.details = paymentData.details;
    }
    
    this.payment.status = 'completed';
    this.payment.processedAt = new Date();
    
    return this;
};

transactionSchema.methods.addItem = function(itemData) {
    // Ensure items array exists
    if (!Array.isArray(this.items)) {
        this.items = [];
    }
    
    const existingItemIndex = this.items.findIndex(
        item => item && item.medicineId && item.medicineId.toString() === itemData.medicineId.toString()
    );

    if (existingItemIndex >= 0) {
        // Update existing item
        this.items[existingItemIndex].quantity += itemData.quantity;
        this.items[existingItemIndex].totalPrice = 
            this.items[existingItemIndex].quantity * this.items[existingItemIndex].unitPrice;
    } else {
        // Add new item
        const newItem = {
            ...itemData,
            totalPrice: itemData.quantity * itemData.unitPrice
        };
        this.items.push(newItem);
    }
    
    this.calculateTotals();
    return this;
};

transactionSchema.methods.removeItem = function(itemId) {
    if (Array.isArray(this.items)) {
        this.items = this.items.filter(item => item && item._id && item._id.toString() !== itemId);
        this.calculateTotals();
    }
    return this;
};

transactionSchema.methods.updateItemQuantity = function(itemId, quantity) {
    if (Array.isArray(this.items)) {
        const item = this.items.id(itemId);
        if (item && quantity > 0) {
            item.quantity = quantity;
            item.totalPrice = quantity * item.unitPrice;
            this.calculateTotals();
        }
    }
    return this;
};

// ===== PRE-SAVE MIDDLEWARE =====
transactionSchema.pre('save', async function(next) {
    try {
        // Generate unique identifiers for new transactions
        if (this.isNew) {
            if (!this.transactionNumber) {
                this.transactionNumber = await this.constructor.generateTransactionNumber(this.transactionType);
            }
            if (!this.transactionRef) {
                this.transactionRef = `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }
        }
        
        // Ensure items array exists
        if (!Array.isArray(this.items)) {
            this.items = [];
        }
        
        // Calculate totals before saving
        this.calculateTotals();
        
        // Set updatedBy if not set
        if (this.isModified() && !this.updatedBy) {
            this.updatedBy = this.createdBy;
        }
        
        // Auto-update delivery status for pickup orders
        if (this.deliveryOption === 'pickup' && this.deliveryStatus === 'not_required' && this.status === 'completed') {
            this.deliveryStatus = 'delivered';
            this.actualDelivery = new Date();
        }
        
        next();
    } catch (error) {
        next(error);
    }
});

transactionSchema.pre('validate', function(next) {
    // Ensure payment amount matches total amount for completed transactions
    if (this.status === 'completed' && this.payment.status === 'completed') {
        if ((this.payment.amount || 0) < (this.totalAmount || 0)) {
            this.invalidate('payment.amount', 'Payment amount must equal total amount for completed transactions');
        }
    }
    next();
});

// ===== INDEXES =====
transactionSchema.index({ pharmacyId: 1, status: 1, transactionDate: -1 });
transactionSchema.index({ pharmacyId: 1, transactionType: 1, createdAt: -1 });
transactionSchema.index({ 'customerInfo.phone': 1 });
transactionSchema.index({ transactionDate: 1 });
transactionSchema.index({ 'payment.status': 1 });
transactionSchema.index({ deliveryStatus: 1 });

// Text search index
transactionSchema.index({
    transactionNumber: 'text',
    transactionRef: 'text',
    'customerInfo.name': 'text',
    'customerInfo.phone': 'text',
    description: 'text'
});

module.exports = mongoose.model('Transaction', transactionSchema);