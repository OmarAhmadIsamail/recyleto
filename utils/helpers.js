const Counter = require('../models/Counter');
const Medicine = require('../models/Medicine');
const Inventory = require('../models/Inventory');

// Transaction number configuration
const TRANSACTION_CONFIG = {
  sale: { prefix: 'SALE', length: 6 },
  purchase: { prefix: 'PUR', length: 6 },
  return: { prefix: 'RET', length: 6 },
  adjustment: { prefix: 'ADJ', length: 6 },
  transfer: { prefix: 'TRF', length: 6 }
};

// Generate transaction number with enhanced error handling and retry logic
exports.generateTransactionNumber = async (type = 'sale') => {
  try {
    const config = TRANSACTION_CONFIG[type] || TRANSACTION_CONFIG.sale;
    const counterName = `transaction_${type}`;
    
    const counter = await Counter.findOneAndUpdate(
      { name: counterName },
      { $inc: { seq: 1 }, updatedAt: new Date() },
      { 
        new: true, 
        upsert: true,
        returnDocument: 'after'
      }
    );

    const paddedSeq = String(counter.seq).padStart(config.length, '0');
    return `${config.prefix}-${paddedSeq}`;
    
  } catch (error) {
    console.error(`Failed to generate transaction number for ${type}:`, error);
    
    // Enhanced fallback mechanism
    const timestamp = Date.now().toString().slice(-8);
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const config = TRANSACTION_CONFIG[type] || TRANSACTION_CONFIG.sale;
    
    return `${config.prefix}-F${timestamp}${randomSuffix}`;
  }
};

// Generate transaction reference with enhanced uniqueness
exports.generateTransactionRef = (prefix = 'TXN') => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  const processId = process.pid ? process.pid.toString(36).slice(-4) : '0000';
  
  return `${prefix}-${timestamp}-${randomStr}-${processId}`.toUpperCase();
};

// Enhanced currency formatting with localization support
exports.formatCurrency = (amount, currency = 'USD', locale = 'en-US') => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error('Invalid amount provided for currency formatting');
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    // Fallback formatting
    return `$${amount.toFixed(2)}`;
  }
};

// Calculate transaction totals with enhanced validation
exports.calculateTransactionTotals = (items, options = {}) => {
  const {
    taxRate = 0,
    discountAmount = 0,
    discountPercentage = 0,
    deliveryFee = 0,
    rounding = false
  } = options;

  // Validate items
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Items array must contain at least one item');
  }

  const subtotal = items.reduce((sum, item) => {
    if (!item.quantity || !item.unitPrice) {
      throw new Error('Each item must have quantity and unitPrice');
    }
    return sum + (item.quantity * item.unitPrice);
  }, 0);

  // Calculate discounts
  const percentageDiscount = subtotal * (discountPercentage / 100);
  const totalDiscount = discountAmount + percentageDiscount;
  
  // Calculate tax
  const taxableAmount = Math.max(0, subtotal - totalDiscount);
  const tax = taxableAmount * (taxRate / 100);
  
  // Calculate total
  let total = subtotal + tax + deliveryFee - totalDiscount;
  
  // Apply rounding if needed
  if (rounding) {
    total = Math.round(total * 100) / 100;
  }

  return {
    subtotal: Math.max(0, subtotal),
    tax: Math.max(0, tax),
    discount: Math.max(0, totalDiscount),
    deliveryFee: Math.max(0, deliveryFee),
    total: Math.max(0, total),
    taxableAmount: Math.max(0, taxableAmount)
  };
};

// Enhanced stock validation with transaction context
exports.validateStock = async (items, transactionType = 'sale', options = {}) => {
  const {
    allowPartial = false,
    validateExpiry = true,
    minStockThreshold = 0
  } = options;

  const stockIssues = [];
  const availableItems = [];

  for (const [index, item] of items.entries()) {
    try {
      const medicine = await Medicine.findById(item.medicineId)
        .select('name quantity stockLevel expiryDate');
      
      if (!medicine) {
        stockIssues.push({
          index,
          medicineId: item.medicineId,
          error: 'MEDICINE_NOT_FOUND',
          message: `Medicine not found: ${item.medicineId}`
        });
        continue;
      }

      const validationResult = {
        medicineId: item.medicineId,
        medicineName: medicine.name,
        requested: item.quantity,
        available: medicine.quantity,
        isValid: true
      };

      // Stock availability check
      if (transactionType === 'sale' || transactionType === 'transfer') {
        if (medicine.quantity < item.quantity) {
          validationResult.isValid = false;
          validationResult.error = 'INSUFFICIENT_STOCK';
          validationResult.message = 
            `Insufficient stock for ${medicine.name}. Available: ${medicine.quantity}, Requested: ${item.quantity}`;
          
          if (allowPartial && medicine.quantity > minStockThreshold) {
            validationResult.suggestedQuantity = medicine.quantity;
            validationResult.isPartial = true;
          }
        }
      }

      // Expiry date check
      if (validateExpiry && medicine.expiryDate && new Date(medicine.expiryDate) <= new Date()) {
        validationResult.warning = 'EXPIRED_MEDICINE';
        validationResult.message = 
          `Medicine ${medicine.name} has expired on ${medicine.expiryDate}`;
      }

      // Low stock warning
      if (medicine.quantity <= minStockThreshold) {
        validationResult.warning = 'LOW_STOCK';
        validationResult.message = 
          `Low stock warning for ${medicine.name}. Current: ${medicine.quantity}, Threshold: ${minStockThreshold}`;
      }

      if (!validationResult.isValid) {
        stockIssues.push(validationResult);
      } else {
        availableItems.push(validationResult);
      }

    } catch (error) {
      stockIssues.push({
        index,
        medicineId: item.medicineId,
        error: 'VALIDATION_ERROR',
        message: `Error validating medicine: ${error.message}`
      });
    }
  }

  return {
    isValid: stockIssues.length === 0,
    stockIssues,
    availableItems,
    canProceed: allowPartial ? availableItems.length > 0 : stockIssues.length === 0
  };
};

// Enhanced expiry status calculation
exports.calculateExpiryStatus = (expiryDate, options = {}) => {
  const {
    criticalThreshold = 7,    // days
    warningThreshold = 30,    // days
    extendedWarning = false   // Include extended warning period
  } = options;

  if (!expiryDate) return 'unknown';

  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 'expired';
  if (diffDays <= criticalThreshold) return 'critical';
  if (diffDays <= warningThreshold) return 'warning';
  if (extendedWarning && diffDays <= 90) return 'notice';
  return 'good';
};

// Enhanced stock alerts with pagination and filtering
exports.generateStockAlerts = async (pharmacyId, options = {}) => {
  const {
    alertTypes = ['low_stock', 'expiring', 'expired', 'out_of_stock'],
    severity = ['critical', 'warning', 'notice'],
    limit = 50,
    page = 1
  } = options;

  const skip = (page - 1) * limit;
  const queryConditions = [{ pharmacyId }];

  // Build alert conditions based on types
  if (alertTypes.includes('low_stock')) {
    queryConditions.push({ status: 'low_stock' });
  }

  if (alertTypes.includes('expiring') || alertTypes.includes('expired')) {
    const expiryConditions = [];
    
    if (alertTypes.includes('expiring')) {
      expiryConditions.push({
        expiryDate: { 
          $lte: new Date(new Date().setDate(new Date().getDate() + 30)),
          $gt: new Date()
        }
      });
    }
    
    if (alertTypes.includes('expired')) {
      expiryConditions.push({
        expiryDate: { $lte: new Date() }
      });
    }

    if (expiryConditions.length > 0) {
      queryConditions.push({ $or: expiryConditions });
    }
  }

  if (alertTypes.includes('out_of_stock')) {
    queryConditions.push({ quantity: { $lte: 0 } });
  }

  const alerts = await Inventory.find({
    $and: queryConditions
  })
  .populate('productId', 'name category brand manufacturer')
  .select('productId quantity stockLevel expiryDate status lastUpdated')
  .sort({ expiryDate: 1, quantity: 1 })
  .skip(skip)
  .limit(limit)
  .lean();

  // Enhance alerts with severity and metadata
  const enhancedAlerts = alerts.map(alert => {
    const enhancedAlert = { ...alert };
    
    // Calculate expiry status
    if (alert.expiryDate) {
      enhancedAlert.expiryStatus = this.calculateExpiryStatus(alert.expiryDate);
    }

    // Determine overall severity
    if (alert.quantity <= 0) {
      enhancedAlert.severity = 'critical';
    } else if (alert.status === 'low_stock') {
      enhancedAlert.severity = 'warning';
    } else if (enhancedAlert.expiryStatus === 'critical') {
      enhancedAlert.severity = 'critical';
    } else if (enhancedAlert.expiryStatus === 'warning') {
      enhancedAlert.severity = 'warning';
    } else {
      enhancedAlert.severity = 'notice';
    }

    // Filter by severity if specified
    enhancedAlert.include = severity.includes(enhancedAlert.severity);

    return enhancedAlert;
  });

  // Get total count for pagination
  const totalAlerts = await Inventory.countDocuments({
    $and: queryConditions
  });

  return {
    alerts: enhancedAlerts.filter(alert => alert.include),
    pagination: {
      page,
      limit,
      total: totalAlerts,
      pages: Math.ceil(totalAlerts / limit)
    },
    summary: {
      critical: enhancedAlerts.filter(a => a.severity === 'critical').length,
      warning: enhancedAlerts.filter(a => a.severity === 'warning').length,
      notice: enhancedAlerts.filter(a => a.severity === 'notice').length
    }
  };
};

// Enhanced client ID generation for offline support
exports.generateClientId = (prefix = 'CLIENT') => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  const clientId = `${prefix}-${timestamp}-${randomStr}`;
  
  return {
    id: clientId.toUpperCase(),
    timestamp: new Date(),
    type: prefix.toLowerCase()
  };
};

// New: Batch operation helper
exports.processInBatches = async (items, batchSize, processor) => {
  const results = [];
  const errors = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    try {
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      );
      results.push(...batchResults);
    } catch (error) {
      errors.push({
        batch: Math.floor(i / batchSize) + 1,
        error: error.message,
        items: batch
      });
    }
  }
  
  return { results, errors, processed: results.length, failed: errors.length };
};

// New: Validation helpers
exports.validateMedicineData = (medicineData) => {
  const errors = [];
  
  if (!medicineData.name || medicineData.name.trim().length === 0) {
    errors.push('Medicine name is required');
  }
  
  if (medicineData.quantity !== undefined && medicineData.quantity < 0) {
    errors.push('Quantity cannot be negative');
  }
  
  if (medicineData.unitPrice !== undefined && medicineData.unitPrice < 0) {
    errors.push('Unit price cannot be negative');
  }
  
  if (medicineData.expiryDate && new Date(medicineData.expiryDate) <= new Date()) {
    errors.push('Expiry date must be in the future');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = exports;