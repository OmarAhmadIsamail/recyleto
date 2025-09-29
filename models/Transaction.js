const mongoose = require('mongoose');
const Counter = require('./Counter');

const transactionItemSchema = new mongoose.Schema({
    medicineId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Medicine', 
        required: true,
        index: true
    },
    medicineName: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 200
    },
    genericName: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 200
    },
    form: {
        type: String,
        trim: true,
        maxlength: 50
    },
    packSize: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 50
    },
    quantity: { 
        type: Number, 
        required: true, 
        min: 1,
        validate: {
            validator: Number.isInteger,
            message: 'Quantity must be an integer'
        }
    },
    unitPrice: { 
        type: Number, 
        required: true, 
        min: 0,
        max: 1000000 // Reasonable upper limit
    },
    totalPrice: { 
        type: Number, 
        required: true, 
        min: 0,
        validate: {
            validator: function(value) {
                return value === this.quantity * this.unitPrice;
            },
            message: 'Total price must equal quantity × unit price'
        }
    },
    expiryDate: { 
        type: Date,
        validate: {
            validator: function(date) {
                return !date || date > new Date();
            },
            message: 'Expiry date must be in the future'
        }
    },
    batchNumber: { 
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 50
    },
    manufacturer: {
        type: String,
        trim: true,
        maxlength: 100
    },
    costPrice: { // For profit calculation
        type: Number,
        min: 0
    },
    profitMargin: { // Calculated field
        type: Number,
        min: -100,
        max: 1000
    }
}, { _id: false }); // Prevents unnecessary _id for subdocuments

const refundSchema = new mongoose.Schema({
    refundId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Refund',
        required: true
    },
    amount: { 
        type: Number, 
        required: true, 
        min: 0,
        max: 1000000
    },
    date: { 
        type: Date, 
        default: Date.now,
        index: true
    },
    reason: { 
        type: String, 
        trim: true,
        maxlength: 500
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'bank_transfer', 'digital_wallet', 'credit_note'],
        required: true
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 500
    }
}, { _id: false });

const transactionSchema = new mongoose.Schema({
    pharmacyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true
    },
    branchId: { // Multi-branch support
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        index: true
    },
    transactionType: {
        type: String,
        required: true,
        enum: ['sale', 'purchase', 'return', 'adjustment', 'transfer'],
        default: 'sale',
        index: true
    },
    
    // Unique Identifiers
    transactionId: { 
        type: String, 
        unique: true, 
        sparse: true,
        index: true,
        immutable: true // Cannot be changed once set
    },
    transactionNumber: { 
        type: String, 
        unique: true, 
        sparse: true,
        index: true,
        immutable: true
    },
    transactionRef: { 
        type: String, 
        unique: true, 
        sparse: true,
        index: true,
        immutable: true
    },
    
    // Core Transaction Details
    description: { 
        type: String, 
        trim: true, 
        maxlength: 1000 
    },
    items: {
        type: [transactionItemSchema],
        validate: {
            validator: function(items) {
                return items && items.length > 0;
            },
            message: 'Transaction must have at least one item'
        }
    },
    
    // Financial Calculations
    subtotal: { 
        type: Number, 
        required: true, 
        default: 0,
        min: 0,
        max: 10000000
    },
    taxRate: { // Store tax rate for reporting
        type: Number,
        default: 0,
        min: 0,
        max: 100
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
    totalAmount: { 
        type: Number, 
        required: true, 
        min: 0,
        max: 10000000,
        default: 0
    },
    
    // Customer Information
    customerInfo: {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer'
        },
        name: { 
            type: String, 
            trim: true,
            maxlength: 100
        },
        phone: { 
            type: String, 
            trim: true,
            match: [/^\+?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number']
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
        },
        loyaltyPointsEarned: {
            type: Number,
            default: 0,
            min: 0
        },
        loyaltyPointsRedeemed: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    
    // Enhanced Payment Section
    payment: {
        method: {
            type: String,
            required: true,
            enum: ['cash', 'card', 'bank_transfer', 'digital_wallet', 'mobile_money', 'credit', 'loyalty_points'],
            default: 'cash'
        },
        paymentMethodId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PaymentMethod'
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
            validate: {
                validator: function(value) {
                    return value <= this.ownerDocument().totalAmount;
                },
                message: 'Payment amount cannot exceed total amount'
            }
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded', 'authorized'],
            default: 'pending'
        },
        
        // Digital wallet specific
        walletProvider: String,
        phoneNumber: String,
        transactionId: String,
        
        // Card specific
        cardLastFour: String,
        cardBrand: String,
        authorizationCode: String,
        
        // Bank transfer specific
        bankReference: String,
        bankName: String,
        accountLastFour: String,
        
        // Credit specific
        creditTerms: String,
        dueDate: Date,
        creditLimitUsed: Number,
        
        // Timestamps
        paidAt: Date,
        failedAt: Date,
        refundedAt: Date,
        authorizedAt: Date
    },
    
    // Transaction Status
    status: {
        type: String,
        enum: ['draft', 'pending', 'completed', 'cancelled', 'refunded', 'partially_refunded', 'on_hold'],
        default: 'draft'
    },
    
    transactionDate: { 
        type: Date, 
        default: Date.now,
        index: true 
    },
    
    // Refunds Tracking
    refunds: [refundSchema],
    
    // Enhanced Delivery Section
    deliveryAddress: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliveryAddress'
    },
    deliveryOption: {
        type: String,
        enum: ['pickup', 'delivery', 'shipping'],
        default: 'pickup'
    },
    deliveryStatus: {
        type: String,
        enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', 'failed'],
        default: 'pending'
    },
    deliveryFee: {
        type: Number,
        default: 0,
        min: 0
    },
    estimatedDelivery: {
        type: Date,
        validate: {
            validator: function(date) {
                return !date || date > this.transactionDate;
            },
            message: 'Estimated delivery must be after transaction date'
        }
    },
    actualDelivery: {
        type: Date,
        validate: {
            validator: function(date) {
                return !date || date >= this.transactionDate;
            },
            message: 'Actual delivery cannot be before transaction date'
        }
    },
    deliveryNotes: {
        type: String,
        maxlength: 1000
    },
    deliveryPerson: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
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
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    cancellationReason: {
        type: String,
        trim: true,
        maxlength: 500
    },
    
    // Additional Features
    isPrescription: {
        type: Boolean,
        default: false
    },
    prescriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prescription'
    },
    marketplace: {
        isMarketplace: {
            type: Boolean,
            default: false
        },
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        commission: {
            type: Number,
            default: 0
        },
        platformFee: {
            type: Number,
            default: 0
        }
    },
    
    // Analytics and Reporting
    profit: { // Calculated profit
        type: Number,
        default: 0
    },
    marginPercentage: { // Profit margin percentage
        type: Number,
        default: 0,
        min: -100,
        max: 1000
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ===== VIRTUAL FIELDS =====
transactionSchema.virtual('totalRefunded').get(function() {
    return this.refunds.reduce((total, refund) => total + (refund.amount || 0), 0);
});

transactionSchema.virtual('amountDue').get(function() {
    return Math.max(0, this.totalAmount - (this.payment.amount || 0));
});

transactionSchema.virtual('isPaid').get(function() {
    return this.payment.status === 'completed' && this.payment.amount >= this.totalAmount;
});

transactionSchema.virtual('isOverdue').get(function() {
    if (this.payment.method !== 'credit') return false;
    return this.payment.dueDate && this.payment.dueDate < new Date() && !this.isPaid;
});

transactionSchema.virtual('ageInDays').get(function() {
    return Math.floor((new Date() - this.transactionDate) / (1000 * 60 * 60 * 24));
});

// ===== STATIC METHODS =====
transactionSchema.statics.generateUniqueId = async function(prefix = 'TXN') {
    const retryCount = 3;
    
    for (let attempt = 0; attempt < retryCount; attempt++) {
        try {
            const timestamp = Date.now().toString(36).toUpperCase();
            const random = Math.random().toString(36).substring(2, 8).toUpperCase();
            const uniqueId = `${prefix}-${timestamp}-${random}`;
            
            const exists = await this.findOne({ transactionId: uniqueId });
            if (!exists) return uniqueId;
        } catch (error) {
            if (attempt === retryCount - 1) throw error;
        }
    }
    
    throw new Error('Failed to generate unique transaction ID');
};

transactionSchema.statics.findByStatus = function(pharmacyId, status) {
    return this.find({ pharmacyId, status }).sort({ transactionDate: -1 });
};

transactionSchema.statics.getSalesReport = async function(pharmacyId, startDate, endDate) {
    const matchStage = {
        pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
        transactionType: 'sale',
        status: 'completed',
        transactionDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
    };
    
    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalSales: { $sum: '$totalAmount' },
                totalTransactions: { $sum: 1 },
                averageTransaction: { $avg: '$totalAmount' },
                totalTax: { $sum: '$tax' },
                totalDiscount: { $sum: '$discount' },
                totalProfit: { $sum: '$profit' }
            }
        }
    ]);
};

// ===== INSTANCE METHODS =====
transactionSchema.methods.calculateProfit = function() {
    this.profit = this.items.reduce((total, item) => {
        const cost = item.costPrice || 0;
        return total + ((item.unitPrice - cost) * item.quantity);
    }, 0);
    
    this.marginPercentage = this.subtotal > 0 ? (this.profit / this.subtotal) * 100 : 0;
    return this;
};

transactionSchema.methods.canRefund = function() {
    return this.status === 'completed' && 
           this.totalRefunded < this.totalAmount &&
           this.transactionDate > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Within 90 days
};

transactionSchema.methods.processRefund = function(refundData) {
    if (!this.canRefund()) {
        throw new Error('Transaction cannot be refunded');
    }
    
    const refundAmount = Math.min(refundData.amount, this.totalAmount - this.totalRefunded);
    
    this.refunds.push({
        refundId: new mongoose.Types.ObjectId(),
        amount: refundAmount,
        date: new Date(),
        reason: refundData.reason,
        paymentMethod: refundData.paymentMethod,
        processedBy: refundData.processedBy,
        notes: refundData.notes
    });
    
    this.updateRefundStatus();
    return refundAmount;
};

transactionSchema.methods.updateRefundStatus = function() {
    const totalRefunded = this.totalRefunded;
    
    if (totalRefunded >= this.totalAmount) {
        this.status = 'refunded';
        this.payment.status = 'refunded';
        this.payment.refundedAt = new Date();
    } else if (totalRefunded > 0) {
        this.status = 'partially_refunded';
        this.payment.status = 'partially_refunded';
    }
};

transactionSchema.methods.validateDeliveryTransition = function(newStatus) {
    const validTransitions = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['preparing', 'cancelled'],
        'preparing': ['out_for_delivery', 'cancelled'],
        'out_for_delivery': ['delivered', 'failed', 'cancelled'],
        'delivered': [],
        'cancelled': [],
        'failed': ['cancelled']
    };
    
    const currentStatus = this.deliveryStatus;
    return validTransitions[currentStatus]?.includes(newStatus) || false;
};

// ===== PRE-SAVE MIDDLEWARE =====
transactionSchema.pre('save', async function(next) {
    try {
        // Generate unique IDs for new transactions
        if (this.isNew) {
            if (!this.transactionId) {
                this.transactionId = await this.constructor.generateUniqueId();
            }
            if (!this.transactionNumber) {
                const counter = await Counter.getNextSequence(`${this.transactionType}_number`);
                this.transactionNumber = `${this.transactionType.slice(0,3).toUpperCase()}${String(counter).padStart(8, '0')}`;
            }
            if (!this.transactionRef) {
                this.transactionRef = await this.constructor.generateUniqueId('REF');
            }
        }
        
        // Calculate financials
        this.calculateFinancials();
        this.calculateProfit();
        
        // Auto-update status based on payment and delivery
        this.autoUpdateStatus();
        
        // Set updatedBy field
        this.updatedBy = this.updatedBy || this.createdBy;
        
        next();
    } catch (error) {
        next(error);
    }
});

transactionSchema.methods.calculateFinancials = function() {
    this.subtotal = this.items.reduce((total, item) => total + (item.totalPrice || 0), 0);
    this.totalAmount = Math.max(0, this.subtotal + (this.tax || 0) - (this.discount || 0) + (this.deliveryFee || 0));
    
    // Sync payment amount
    if (this.payment.amount !== this.totalAmount) {
        this.payment.amount = this.totalAmount;
    }
};

transactionSchema.methods.autoUpdateStatus = function() {
    // Update status based on payment
    if (this.payment.status === 'completed' && this.status === 'pending') {
        this.status = 'completed';
        this.payment.paidAt = this.payment.paidAt || new Date();
    }
    
    // Auto-cancel if payment failed
    if (this.payment.status === 'failed' && this.status !== 'cancelled') {
        this.status = 'pending';
        this.payment.failedAt = new Date();
    }
};

// ===== COMPOUND INDEXES =====
transactionSchema.index({ pharmacyId: 1, transactionDate: -1 });
transactionSchema.index({ pharmacyId: 1, status: 1, transactionDate: -1 });
transactionSchema.index({ 'customerInfo.phone': 1, transactionDate: -1 });
transactionSchema.index({ transactionDate: 1, status: 1 });
transactionSchema.index({ 'payment.status': 1, transactionDate: -1 });
transactionSchema.index({ deliveryStatus: 1, estimatedDelivery: 1 });
transactionSchema.index({ pharmacyId: 1, transactionType: 1, createdAt: -1 });

// Text index for search
transactionSchema.index({
    'transactionNumber': 'text',
    'transactionRef': 'text',
    'customerInfo.name': 'text',
    'customerInfo.phone': 'text',
    'description': 'text'
});

module.exports = mongoose.model('Transaction', transactionSchema);