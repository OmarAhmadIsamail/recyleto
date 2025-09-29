// controllers/checkoutController.js

const PaymentMethod = require('../models/PaymentMethod');
const Transaction = require('../models/Transaction');
const Cart = require('../models/Cart');
const Medicine = require('../models/Medicine');
const DeliveryAddress = require('../models/DeliveryAddress');
const { generateTransactionNumber } = require('../utils/helpers');

// Generate unique transaction reference
const generateTransactionRef = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `TXN-${timestamp}-${randomStr}`.toUpperCase();
};

// Calculate totals with delivery options
const calculateTotal = async (items, deliveryOption, deliveryAddressId, taxRate = 0.08) => {
  let subtotal = items.reduce((total, item) => {
    return total + (item.unitPrice * item.quantity);
  }, 0);

  let deliveryFee = 0;
  let deliveryAddress = null;

  if (deliveryOption === 'delivery') {
    deliveryFee = 5.00; // Base delivery fee
    
    if (deliveryAddressId) {
      const address = await DeliveryAddress.findById(deliveryAddressId);
      if (address) {
        deliveryAddress = address;
      }
    }
  }

  const tax = subtotal * taxRate;
  const total = subtotal + tax + deliveryFee;

  return {
    subtotal,
    tax,
    deliveryFee,
    total,
    deliveryAddress
  };
};

const checkoutController = {
  // Process cart checkout with payment and delivery options
  processCheckout: async (req, res) => {
    try {
      const pharmacyId = req.user?.pharmacyId || req.user?._id;
      if (!pharmacyId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized: user not found' 
        });
      }

      const { 
        transactionType = 'sale', 
        description, 
        customerName, 
        customerPhone, 
        paymentMethod,
        paymentType,
        paymentMethodId,
        tax = 0,
        discount = 0,
        deliveryOption = 'pickup',
        deliveryAddressId,
        saveAsDraft = false,
        ...paymentData 
      } = req.body;

      // Find pending transaction (cart)
      const transaction = await Transaction.findOne({ 
        pharmacyId, 
        transactionType, 
        status: 'pending' 
      }).populate('items.medicineId');

      if (!transaction || !transaction.items?.length) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cart is empty' 
        });
      }

      // Calculate totals with delivery options
      const totals = await calculateTotal(
        transaction.items, 
        deliveryOption, 
        deliveryAddressId
      );

      // Validate stock for sale transactions
      if (transactionType === 'sale' && !saveAsDraft) {
        for (const item of transaction.items) {
          const medicine = await Medicine.findById(item.medicineId);
          if (!medicine) {
            return res.status(404).json({
              success: false,
              message: `Medicine ${item.medicineName} not found`
            });
          }
          if (medicine.quantity < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock for ${medicine.name}. Available: ${medicine.quantity}`
            });
          }
        }
      }

      // Process payment if not a draft
      let paymentResult = null;
      if (!saveAsDraft && paymentType) {
        let paymentMethodDoc;
        if (paymentMethodId) {
          paymentMethodDoc = await PaymentMethod.findOne({
            _id: paymentMethodId,
            userId: req.user.id,
            isActive: true
          });
        }

        paymentResult = await processPaymentByType(
          paymentType, 
          totals.total, 
          paymentMethodDoc, 
          paymentData
        );

        if (!paymentResult.success) {
          return res.status(400).json({
            success: false,
            message: paymentResult.message
          });
        }
      }

      // Update transaction with checkout details and delivery info
      transaction.description = description || transaction.description;
      transaction.customerInfo = {
        name: customerName,
        phone: customerPhone
      };
      transaction.paymentMethod = paymentMethod || paymentType;
      transaction.tax = totals.tax;
      transaction.discount = discount;
      transaction.subtotal = totals.subtotal;
      transaction.deliveryFee = totals.deliveryFee;
      transaction.totalAmount = Math.max(0, totals.subtotal + totals.tax - discount + totals.deliveryFee);
      transaction.status = saveAsDraft ? 'draft' : 'completed';
      transaction.transactionRef = generateTransactionRef();
      transaction.transactionDate = new Date();
      
      // Add delivery information
      transaction.deliveryOption = deliveryOption;
      if (deliveryOption === 'delivery' && totals.deliveryAddress) {
        transaction.deliveryAddress = totals.deliveryAddress;
      }
      transaction.deliveryStatus = deliveryOption === 'delivery' ? 'pending' : 'not_applicable';

      // Add payment details if completed
      if (!saveAsDraft && paymentResult) {
        transaction.payment = {
          method: paymentType,
          paymentMethodId: paymentMethodId,
          amount: transaction.totalAmount,
          status: 'completed',
          ...paymentResult.data,
          paidAt: new Date()
        };
      }

      await transaction.save();

      // If not a draft, update stock and clear cart
      if (!saveAsDraft) {
        // Update stock if sale
        if (transactionType === 'sale') {
          for (const item of transaction.items) {
            await Medicine.findByIdAndUpdate(
              item.medicineId, 
              { $inc: { quantity: -item.quantity } }
            );
          }
        }
        
        // Clear the cart (active cart)
        const cart = await Cart.findOne({ 
          pharmacyId, 
          transactionType, 
          status: 'active' 
        });
        
        if (cart) {
          cart.items = [];
          cart.totalAmount = 0;
          cart.totalItems = 0;
          cart.totalQuantity = 0;
          cart.status = 'completed';
          await cart.save();
        }
      }

      // Populate the final transaction for response
      const finalTransaction = await Transaction.findById(transaction._id)
        .populate('items.medicineId', 'name genericName form price')
        .populate('deliveryAddress');

      return res.status(201).json({ 
        success: true, 
        message: saveAsDraft ? 'Transaction saved as draft' : 'Transaction completed successfully', 
        data: finalTransaction,
        transactionId: transaction._id
      });

    } catch (error) {
      console.error('Checkout process error:', error);
      res.status(500).json({
        success: false,
        message: 'Error during checkout process',
        error: error.message
      });
    }
  },

  // Process payment for an existing transaction
  processPayment: async (req, res) => {
    try {
      const { transactionId, paymentType, paymentMethodId, ...paymentData } = req.body;
      
      if (!transactionId) {
        return res.status(400).json({ 
          success: false, 
          message: 'transactionId is required' 
        });
      }

      // Find the transaction
      const transaction = await Transaction.findById(transactionId)
        .populate('items.medicineId')
        .populate('deliveryAddress');

      if (!transaction) {
        return res.status(404).json({ 
          success: false, 
          message: 'Transaction not found' 
        });
      }

      // Check if transaction is eligible for payment
      if (!['pending', 'draft'].includes(transaction.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot process payment for transaction with status: ${transaction.status}`
        });
      }

      // Compute totals if needed
      const totals = await calculateTotal(
        transaction.items, 
        transaction.deliveryOption, 
        transaction.deliveryAddress?._id
      );
      const amount = transaction.totalAmount ?? totals.total;

      // Get stored payment method doc if provided
      let paymentMethodDoc = null;
      if (paymentMethodId) {
        paymentMethodDoc = await PaymentMethod.findOne({
          _id: paymentMethodId,
          userId: req.user?.id,
          isActive: true
        });
      }

      // Process payment using helper
      const paymentResult = await processPaymentByType(
        paymentType, 
        amount, 
        paymentMethodDoc, 
        paymentData
      );

      if (!paymentResult.success) {
        return res.status(400).json({ 
          success: false, 
          message: paymentResult.message || 'Payment failed' 
        });
      }

      // Update transaction payment info
      transaction.payment = {
        method: paymentType,
        paymentMethodId: paymentMethodId || null,
        amount: amount,
        status: 'completed',
        ...paymentResult.data,
        paidAt: new Date()
      };

      // Update transaction status and metadata
      transaction.status = 'completed';
      if (!transaction.transactionRef) transaction.transactionRef = generateTransactionRef();
      if (!transaction.transactionDate) transaction.transactionDate = new Date();

      await transaction.save();

      // Update stock for sale transactions
      if (transaction.transactionType === 'sale') {
        for (const item of transaction.items) {
          await Medicine.findByIdAndUpdate(
            item.medicineId, 
            { $inc: { quantity: -item.quantity } }
          );
        }
      }

      // Clear associated cart if exists
      const cart = await Cart.findOne({
        pharmacyId: transaction.pharmacyId,
        transactionType: transaction.transactionType,
        status: 'active'
      });
      
      if (cart) {
        cart.items = [];
        cart.totalAmount = 0;
        cart.totalItems = 0;
        cart.totalQuantity = 0;
        cart.status = 'completed';
        await cart.save();
      }

      const populatedTransaction = await Transaction.findById(transaction._id)
        .populate('items.medicineId', 'name genericName form price')
        .populate('deliveryAddress');

      return res.status(200).json({
        success: true,
        message: 'Payment processed successfully',
        data: populatedTransaction
      });
    } catch (error) {
      console.error('processPayment error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Server error processing payment', 
        error: error.message 
      });
    }
  },

  // Quick checkout without cart (direct transaction) with delivery options
  quickCheckout: async (req, res) => {
    try {
      const pharmacyId = req.user?.pharmacyId || req.user?._id;
      if (!pharmacyId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized: user not found' 
        });
      }

      const {
        transactionType = 'sale',
        description,
        items,
        customerName,
        customerPhone,
        paymentMethod,
        paymentType,
        paymentMethodId,
        tax = 0,
        discount = 0,
        deliveryOption = 'pickup',
        deliveryAddressId,
        ...paymentData
      } = req.body;

      if (!items || !items.length) {
        return res.status(400).json({
          success: false,
          message: 'No items provided for checkout'
        });
      }

      // Validate items and prepare transaction items
      const transactionItems = [];

      for (const item of items) {
        const medicine = await Medicine.findById(item.medicineId);
        if (!medicine) {
          return res.status(404).json({
            success: false,
            message: `Medicine with ID ${item.medicineId} not found`
          });
        }

        if (transactionType === 'sale' && medicine.quantity < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${medicine.name}. Available: ${medicine.quantity}`
          });
        }

        const unitPrice = item.unitPrice || medicine.price;
        const totalPrice = item.quantity * unitPrice;

        transactionItems.push({
          medicineId: medicine._id,
          medicineName: medicine.name,
          genericName: medicine.genericName,
          form: medicine.form,
          packSize: medicine.packSize,
          quantity: item.quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
          expiryDate: item.expiryDate || medicine.expiryDate,
          batchNumber: item.batchNumber || medicine.batchNumber,
          manufacturer: medicine.manufacturer
        });
      }

      // Calculate totals with delivery options
      const totals = await calculateTotal(
        transactionItems,
        deliveryOption,
        deliveryAddressId
      );

      const totalAmount = Math.max(0, totals.subtotal + totals.tax - discount + totals.deliveryFee);

      // Process payment
      let paymentResult = null;
      if (paymentType) {
        let paymentMethodDoc;
        if (paymentMethodId) {
          paymentMethodDoc = await PaymentMethod.findOne({
            _id: paymentMethodId,
            userId: req.user.id,
            isActive: true
          });
        }

        paymentResult = await processPaymentByType(
          paymentType, 
          totalAmount, 
          paymentMethodDoc, 
          paymentData
        );

        if (!paymentResult.success) {
          return res.status(400).json({
            success: false,
            message: paymentResult.message
          });
        }
      }

      // Generate transaction number
      const transactionNumber = await generateTransactionNumber(transactionType);

      // Create transaction
      const transactionData = {
        pharmacyId,
        transactionType,
        transactionNumber,
        transactionRef: generateTransactionRef(),
        description,
        items: transactionItems,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount,
        deliveryFee: totals.deliveryFee,
        totalAmount,
        customerInfo: {
          name: customerName,
          phone: customerPhone
        },
        paymentMethod: paymentMethod || paymentType,
        deliveryOption,
        deliveryStatus: deliveryOption === 'delivery' ? 'pending' : 'not_applicable',
        status: 'completed',
        transactionDate: new Date()
      };

      // Add delivery address if applicable
      if (deliveryOption === 'delivery' && totals.deliveryAddress) {
        transactionData.deliveryAddress = totals.deliveryAddress;
      }

      if (paymentResult) {
        transactionData.payment = {
          method: paymentType,
          paymentMethodId: paymentMethodId,
          amount: totalAmount,
          status: 'completed',
          ...paymentResult.data,
          paidAt: new Date()
        };
      }

      const transaction = new Transaction(transactionData);
      await transaction.save();

      // Update stock if sale
      if (transactionType === 'sale') {
        for (const item of items) {
          await Medicine.findByIdAndUpdate(
            item.medicineId, 
            { $inc: { quantity: -item.quantity } }
          );
        }
      }

      const populatedTransaction = await Transaction.findById(transaction._id)
        .populate('items.medicineId', 'name genericName form price')
        .populate('deliveryAddress');

      res.status(201).json({
        success: true,
        message: 'Quick checkout completed successfully',
        data: populatedTransaction
      });

    } catch (error) {
      console.error('Quick checkout error:', error);
      res.status(500).json({
        success: false,
        message: 'Error during quick checkout',
        error: error.message
      });
    }
  },

  // Get checkout summary with delivery options
  getCheckoutSummary: async (req, res) => {
    try {
      const pharmacyId = req.user?.pharmacyId || req.user?._id;
      const { transactionType = 'sale', deliveryOption = 'pickup', deliveryAddressId } = req.query;

      // Get pending transaction
      const transaction = await Transaction.findOne({ 
        pharmacyId, 
        transactionType, 
        status: 'pending' 
      }).populate('items.medicineId', 'name genericName form price');

      // Get active cart
      const cart = await Cart.findOne({ 
        pharmacyId, 
        transactionType, 
        status: 'active' 
      });

      if (!transaction && !cart) {
        return res.status(200).json({ 
          success: true, 
          data: { 
            transaction: null,
            cart: null,
            summary: {
              totalAmount: 0,
              totalItems: 0,
              totalQuantity: 0,
              deliveryFee: 0,
              tax: 0,
              subtotal: 0
            }
          } 
        });
      }

      // Use transaction items if available, otherwise use cart items
      const items = transaction?.items || cart?.items || [];
      
      // Calculate totals with delivery options
      const totals = await calculateTotal(
        items,
        deliveryOption,
        deliveryAddressId
      );

      let transactionData = null;
      let cartData = null;

      if (transaction) {
        transactionData = {
          _id: transaction._id,
          transactionType: transaction.transactionType,
          transactionNumber: transaction.transactionNumber,
          items: transaction.items.map(item => ({
            medicineId: item.medicineId?._id || item.medicineId,
            medicineName: item.medicineName,
            genericName: item.genericName,
            form: item.form,
            packSize: item.packSize,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            expiryDate: item.expiryDate,
            batchNumber: item.batchNumber
          })),
          subtotal: totals.subtotal,
          tax: totals.tax,
          discount: transaction.discount,
          deliveryFee: totals.deliveryFee,
          totalAmount: totals.total
        };
      }

      if (cart) {
        const populatedCart = await cart.getPopulatedCart();
        cartData = {
          ...populatedCart,
          deliveryFee: totals.deliveryFee,
          tax: totals.tax
        };
      }

      const summary = {
        subtotal: totals.subtotal,
        tax: totals.tax,
        deliveryFee: totals.deliveryFee,
        totalAmount: totals.total,
        totalItems: items.length,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0)
      };

      res.status(200).json({
        success: true,
        data: {
          transaction: transactionData,
          cart: cartData,
          summary,
          deliveryOptions: {
            selected: deliveryOption,
            address: totals.deliveryAddress
          }
        }
      });

    } catch (error) {
      console.error('Checkout summary error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching checkout summary', 
        error: error.message 
      });
    }
  },

  // Update delivery option for pending transaction
  updateDeliveryOption: async (req, res) => {
    try {
      const { transactionId, deliveryOption, deliveryAddressId } = req.body;
      
      const transaction = await Transaction.findOne({
        _id: transactionId,
        status: { $in: ['pending', 'draft'] }
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found or not editable'
        });
      }

      // Calculate new totals with updated delivery option
      const totals = await calculateTotal(
        transaction.items,
        deliveryOption,
        deliveryAddressId
      );

      // Update transaction with new delivery info and totals
      transaction.deliveryOption = deliveryOption;
      transaction.deliveryFee = totals.deliveryFee;
      transaction.tax = totals.tax;
      transaction.subtotal = totals.subtotal;
      transaction.totalAmount = Math.max(0, totals.subtotal + totals.tax - (transaction.discount || 0) + totals.deliveryFee);
      
      if (deliveryOption === 'delivery' && totals.deliveryAddress) {
        transaction.deliveryAddress = totals.deliveryAddress;
        transaction.deliveryStatus = 'pending';
      } else {
        transaction.deliveryAddress = null;
        transaction.deliveryStatus = 'not_applicable';
      }

      await transaction.save();

      const updatedTransaction = await Transaction.findById(transaction._id)
        .populate('items.medicineId', 'name genericName form price')
        .populate('deliveryAddress');

      res.json({
        success: true,
        message: 'Delivery option updated successfully',
        data: updatedTransaction
      });

    } catch (error) {
      console.error('Update delivery option error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating delivery option',
        error: error.message
      });
    }
  }
};

// Payment processing helper functions
async function processPaymentByType(type, amount, paymentMethod, paymentData) {
  switch (type) {
    case 'cash':
      return processCashPayment(amount);
    
    case 'card':
      return processCardPayment(amount, paymentMethod, paymentData);
    
    case 'bank_transfer':
      return processBankTransfer(amount, paymentMethod, paymentData);
    
    case 'digital_wallet':
      return processDigitalWallet(amount, paymentMethod, paymentData);
    
    default:
      return { success: false, message: 'Unsupported payment method' };
  }
}

function processCashPayment(amount) {
  return {
    success: true,
    data: {
      cashReceived: amount,
      changeGiven: 0
    }
  };
}

async function processCardPayment(amount, paymentMethod, paymentData) {
  try {
    const paymentResult = await mockCardPaymentGateway(amount, paymentMethod);
    
    return {
      success: paymentResult.success,
      data: {
        cardLastFour: paymentMethod?.cardLastFour,
        transactionId: paymentResult.transactionId,
        authorizationCode: paymentResult.authorizationCode
      },
      message: paymentResult.message
    };
  } catch (error) {
    return { success: false, message: 'Card payment failed' };
  }
}

async function processBankTransfer(amount, paymentMethod, paymentData) {
  const reference = `BT${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    success: true,
    data: {
      bankReference: reference,
      bankName: paymentMethod?.bankName,
      accountLastFour: paymentMethod?.accountNumber?.slice(-4)
    }
  };
}

async function processDigitalWallet(amount, paymentMethod, paymentData) {
  try {
    const walletResult = await mockDigitalWalletPayment(amount, paymentMethod);
    
    return {
      success: walletResult.success,
      data: {
        walletProvider: paymentMethod?.walletProvider,
        phoneNumber: paymentMethod?.phoneNumber,
        transactionId: walletResult.transactionId
      },
      message: walletResult.message
    };
  } catch (error) {
    return { success: false, message: 'Digital wallet payment failed' };
  }
}

// Mock payment gateways
async function mockCardPaymentGateway(amount, paymentMethod) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (Math.random() < 0.05) {
    return { success: false, message: 'Payment declined by bank' };
  }
  
  return {
    success: true,
    transactionId: `CARD${Date.now()}`,
    authorizationCode: `AUTH${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
    message: 'Payment approved'
  };
}

async function mockDigitalWalletPayment(amount, paymentMethod) {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  if (Math.random() < 0.03) {
    return { success: false, message: 'Wallet transaction failed' };
  }
  
  return {
    success: true,
    transactionId: `WALLET${Date.now()}`,
    message: 'Wallet payment successful'
  };
}

module.exports = checkoutController;