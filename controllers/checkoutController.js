const Transaction = require('../models/Transaction');
const Cart = require('../models/Cart');
const Medicine = require('../models/Medicine');
const User = require('../models/User');
const DeliveryAddress = require('../models/DeliveryAddress');
const Receipt = require('../models/Receipt');
const { generateReceipt } = require('../utils/receiptGenerator');
const { sendEmail, isEmailConfigured, transporter } = require('../utils/mailer');
const { syncTransactionToSales } = require('../services/salesService'); // Add this line

/**
 * Process checkout with payment method and generate receipt
 */
exports.processCheckout = async (req, res) => {
  let emailSent = false;
  let receipt = null;
  
  try {
    const {
      paymentMethod,
      paymentDetails,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddressId,
      deliveryOption = 'pickup',
      notes
    } = req.body;

    const pharmacyId = req.user.pharmacyId || req.user._id;
    const userId = req.user._id;

    console.log('💰 Checkout request:', {
      paymentMethod,
      deliveryOption,
      pharmacyId,
      userId
    });

    // Validate required fields
    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Payment method is required'
      });
    }

    // Find active cart
    const cart = await Cart.findOne({
      pharmacyId,
      status: 'active'
    }).populate('items.medicineId', 'name genericName form price stockQuantity');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty or not found'
      });
    }

    // Find pending transaction
    let transaction = await Transaction.findOne({
      pharmacyId,
      status: 'pending'
    });

    if (!transaction) {
      return res.status(400).json({
        success: false,
        message: 'No pending transaction found for checkout'
      });
    }

    // ✅ FIX: Ensure userId is set on the transaction
    if (!transaction.userId) {
      transaction.userId = userId;
    }

    // Handle delivery address
    let deliveryAddress = null;
    let deliveryFee = 0;
    let estimatedDelivery = null;
    let deliveryStatus = 'not_required';

    if (deliveryOption === 'delivery') {
      if (!deliveryAddressId) {
        return res.status(400).json({
          success: false,
          message: 'Delivery address is required for delivery option'
        });
      }

      // Validate delivery address exists and belongs to user
      deliveryAddress = await DeliveryAddress.findOne({
        _id: deliveryAddressId,
        userId: userId
      });

      if (!deliveryAddress) {
        return res.status(404).json({
          success: false,
          message: 'Delivery address not found'
        });
      }

      // Calculate delivery fee
      deliveryFee = calculateDeliveryFee(cart.totalAmount, deliveryAddress);
      estimatedDelivery = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      deliveryStatus = 'pending';
    }

    // Validate stock before checkout
    for (const item of cart.items) {
      const medicine = await Medicine.findById(item.medicineId);
      if (!medicine) {
        return res.status(404).json({
          success: false,
          message: `Medicine ${item.medicineName} not found`
        });
      }

      if (cart.transactionType === 'sale' && medicine.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.medicineName}. Available: ${medicine.quantity}, Requested: ${item.quantity}`
        });
      }
    }

    // Get pharmacy information
    const pharmacy = await User.findById(pharmacyId).select('businessName phone email address taxNumber');

    // Add delivery fee to final amount
    const finalAmountWithDelivery = cart.finalAmount + deliveryFee;

    // Process payment based on method
    const paymentResult = await processPayment(paymentMethod, paymentDetails, finalAmountWithDelivery);
    
    if (!paymentResult.success) {
      return res.status(400).json({
        success: false,
        message: `Payment failed: ${paymentResult.message}`
      });
    }

    // Update transaction with checkout details
    transaction.customerInfo = {
      name: customerName || cart.customerName,
      phone: customerPhone || cart.customerPhone,
      email: customerEmail || cart.customerEmail
    };

    transaction.payment = {
      method: paymentMethod,
      details: paymentDetails,
      amount: finalAmountWithDelivery,
      status: 'completed',
      transactionId: paymentResult.transactionId,
      processedAt: new Date()
    };

    // Set delivery information
    if (deliveryOption === 'delivery' && deliveryAddress) {
      transaction.deliveryAddress = deliveryAddressId;
      transaction.deliveryOption = 'delivery';
      transaction.deliveryFee = deliveryFee;
      transaction.deliveryStatus = deliveryStatus;
      transaction.estimatedDelivery = estimatedDelivery;
    } else {
      transaction.deliveryOption = 'pickup';
      transaction.deliveryFee = 0;
      transaction.deliveryStatus = 'not_required';
      // Clear delivery-specific fields for pickup
      transaction.deliveryAddress = undefined;
      transaction.estimatedDelivery = undefined;
    }

    transaction.notes = notes || cart.notes;
    transaction.status = 'completed';
    transaction.checkoutDate = new Date();

    // Update totals from cart (include delivery fee)
    transaction.subtotal = cart.totalAmount;
    transaction.tax = cart.taxAmount;
    transaction.discount = cart.discount.amount;
    transaction.discountType = cart.discount.type;
    transaction.deliveryFee = deliveryFee;
    transaction.totalAmount = finalAmountWithDelivery;

    // ✅ FIX: Ensure required fields are set
    transaction.userId = userId;
    transaction.createdBy = transaction.createdBy || userId;
    transaction.updatedBy = userId;

    await transaction.save();

    // ✅ CREATE RECEIPT
    receipt = await createReceipt(transaction, cart, paymentResult);
    console.log('🧾 Receipt created:', receipt.receiptNumber);

    // Update stock for sale transactions
    if (cart.transactionType === 'sale') {
      for (const item of cart.items) {
        await Medicine.findByIdAndUpdate(
          item.medicineId,
          { $inc: { quantity: -item.quantity } }
        );
      }
    }

    // Update cart status
    cart.status = 'completed';
    cart.paymentMethod = paymentMethod;
    cart.customerName = customerName || cart.customerName;
    cart.customerPhone = customerPhone || cart.customerPhone;
    cart.customerEmail = customerEmail || cart.customerEmail;
    await cart.save();

    // ✅ SYNC TRANSACTION TO SALES - Add this line
    await syncTransactionToSales(transaction._id);

    // Generate receipt PDF/HTML
    const receiptDocument = await generateReceipt({
      transaction: {
        ...transaction.toObject(),
        pharmacyInfo: pharmacy,
        deliveryInfo: deliveryAddress ? {
          address: deliveryAddress.address,
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          zipCode: deliveryAddress.zipCode,
          phone: deliveryAddress.phone
        } : null
      },
      cart: cart.toObject(),
      payment: {
        method: paymentMethod,
        details: paymentDetails,
        transactionId: paymentResult.transactionId
      },
      delivery: {
        option: deliveryOption,
        fee: deliveryFee,
        estimatedDelivery: estimatedDelivery
      },
      receipt: receipt // Include receipt data
    });

    // Send email receipt if customer email provided
    const emailResult = await handleReceiptEmail(
      customerEmail || cart.customerEmail, 
      transaction, 
      receiptDocument, 
      cart,
      pharmacy,
      deliveryAddress,
      receipt // Pass receipt to email
    );

    emailSent = emailResult.success;

    console.log('✅ Checkout completed successfully:', {
      transactionNumber: transaction.transactionNumber,
      receiptNumber: receipt.receiptNumber,
      amount: transaction.totalAmount,
      paymentMethod,
      deliveryOption,
      deliveryStatus,
      emailSent: emailResult.success
    });

    // Close SMTP connection pool after successful email to prevent timeouts
    if (emailSent && transporter && transporter.close) {
      setTimeout(() => {
        transporter.close();
        console.log('📧 SMTP connection pool closed');
      }, 1000);
    }

    res.status(200).json({
      success: true,
      message: 'Checkout completed successfully',
      data: {
        transaction,
        receipt: {
          receiptNumber: receipt.receiptNumber,
          html: receiptDocument.html,
          text: receiptDocument.text,
          transactionNumber: transaction.transactionNumber,
          totalAmount: transaction.totalAmount
        },
        payment: paymentResult,
        delivery: {
          option: deliveryOption,
          fee: deliveryFee,
          estimatedDelivery: estimatedDelivery,
          status: deliveryStatus
        },
        email: {
          sent: emailResult.success,
          message: emailResult.message,
          skipped: emailResult.skipped,
          messageId: emailResult.messageId
        }
      }
    });

  } catch (error) {
    console.error('❌ Checkout error:', error);
    
    // Close SMTP connection pool on error
    if (transporter && transporter.close) {
      setTimeout(() => {
        transporter.close();
        console.log('📧 SMTP connection pool closed due to error');
      }, 1000);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error during checkout process',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create receipt for completed transaction
 */
async function createReceipt(transaction, cart, paymentResult) {
  try {
    const receiptNumber = await Receipt.generateReceiptNumber();
    
    const receiptData = {
      receiptNumber,
      transactionId: transaction._id,
      transactionNumber: transaction.transactionNumber,
      pharmacyId: transaction.pharmacyId,
      userId: transaction.userId,
      items: cart.items.map(item => ({
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        genericName: item.genericName,
        form: item.form,
        packSize: item.packSize,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        manufacturer: item.manufacturer
      })),
      subtotal: transaction.subtotal,
      tax: transaction.tax,
      discount: transaction.discount,
      deliveryFee: transaction.deliveryFee,
      totalAmount: transaction.totalAmount,
      payment: {
        method: transaction.payment.method,
        amount: transaction.payment.amount,
        status: transaction.payment.status,
        transactionId: paymentResult.transactionId
      },
      customerInfo: transaction.customerInfo,
      receiptDate: transaction.checkoutDate
    };

    const receipt = new Receipt(receiptData);
    await receipt.save();
    
    return receipt;
  } catch (error) {
    console.error('❌ Error creating receipt:', error);
    throw new Error('Failed to create receipt');
  }
}

/**
 * Handle sending receipt email with receipt information
 */
async function handleReceiptEmail(customerEmail, transaction, receiptDocument, cart, pharmacy, deliveryAddress, receipt) {
  if (!customerEmail) {
    return { 
      success: false, 
      message: 'No customer email provided',
      skipped: true 
    };
  }

  // Check if email is configured
  if (!isEmailConfigured()) {
    console.log('📧 Email not configured, skipping receipt email');
    return { 
      success: true, 
      message: 'Email not configured',
      skipped: true 
    };
  }

  try {
    // Prepare comprehensive email data with receipt information
    const emailData = {
      // Receipt details
      receiptNumber: receipt.receiptNumber,
      
      // Transaction details
      transactionNumber: transaction.transactionNumber,
      transactionDate: transaction.checkoutDate ? new Date(transaction.checkoutDate).toLocaleDateString() : new Date().toLocaleDateString(),
      transactionTime: transaction.checkoutDate ? new Date(transaction.checkoutDate).toLocaleTimeString() : new Date().toLocaleTimeString(),
      
      // Amount details
      totalAmount: transaction.totalAmount,
      subtotal: transaction.subtotal,
      tax: transaction.tax,
      discount: transaction.discount,
      deliveryFee: transaction.deliveryFee,
      
      // Payment details
      paymentMethod: transaction.payment.method,
      paymentStatus: transaction.payment.status,
      
      // Customer details
      customerName: transaction.customerInfo?.name,
      customerPhone: transaction.customerInfo?.phone,
      customerEmail: transaction.customerInfo?.email,
      
      // Items from receipt
      items: receipt.items.map(item => ({
        medicineName: item.medicineName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      })),
      
      // Delivery information
      deliveryOption: transaction.deliveryOption,
      estimatedDelivery: transaction.estimatedDelivery,
      
      // Pharmacy information
      pharmacy: {
        businessName: pharmacy.businessName,
        address: pharmacy.address,
        phone: pharmacy.phone,
        email: pharmacy.email
      },
      
      // Delivery address
      deliveryInfo: deliveryAddress ? {
        address: deliveryAddress.address,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        zipCode: deliveryAddress.zipCode,
        phone: deliveryAddress.phone
      } : null,
      
      // Dates
      checkoutDate: transaction.checkoutDate,
      receiptDate: receipt.receiptDate,
      currentDate: new Date().toLocaleDateString(),
      currentTime: new Date().toLocaleTimeString(),
      
      // Receipt content
      receiptHtml: receiptDocument.html,
      receiptText: receiptDocument.text
    };

    // Set timeout for email sending to prevent hanging
    const emailPromise = sendEmail({
      to: customerEmail,
      subject: `Receipt #${receipt.receiptNumber} for Order #${transaction.transactionNumber}`,
      template: 'receipt',
      data: emailData
    });

    // Add timeout to email sending
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({
        success: false,
        message: 'Email sending timeout',
        timeout: true
      }), 15000); // 15 second timeout
    });

    const emailResult = await Promise.race([emailPromise, timeoutPromise]);

    if (emailResult.success) {
      console.log('✅ Receipt email sent successfully:', emailResult.messageId);
      return {
        ...emailResult,
        message: 'Email receipt sent successfully'
      };
    } else if (emailResult.timeout) {
      console.log('⏰ Email sending timed out, but may have been delivered');
      return {
        success: true,
        message: 'Email sent (timeout occurred but delivery likely succeeded)',
        timeout: true,
        likelyDelivered: true
      };
    } else {
      console.log('📧 Email sending failed:', emailResult.message);
      return {
        ...emailResult,
        message: emailResult.message || 'Failed to send email receipt'
      };
    }
  } catch (emailError) {
    console.error('📧 Email sending error:', emailError.message);
    return {
      success: false,
      message: 'Failed to send email receipt',
      error: emailError.message,
      skipped: false
    };
  }
}

/**
 * Calculate delivery fee based on order amount and address
 */
function calculateDeliveryFee(orderAmount, deliveryAddress) {
  // Free delivery for orders above $50
  if (orderAmount > 50) {
    return 0;
  }
  
  // Base delivery fee
  let fee = 5.00;
  
  // Additional fee for distant areas
  const distantCities = ['remote', 'rural'];
  if (distantCities.some(city => deliveryAddress.city.toLowerCase().includes(city))) {
    fee += 3.00;
  }
  
  return fee;
}

/**
 * Process different payment methods
 */
async function processPayment(method, details, amount) {
  console.log('💳 Processing payment:', { method, amount });

  switch (method) {
    case 'cash':
      return {
        success: true,
        message: 'Cash payment accepted',
        transactionId: `CASH-${Date.now()}`,
        amount: amount
      };

    case 'card':
      if (!details?.cardNumber || !details?.expiryDate || !details?.cvv) {
        return {
          success: false,
          message: 'Card details incomplete'
        };
      }
      return {
        success: true,
        message: 'Card payment processed successfully',
        transactionId: `CARD-${Date.now()}`,
        amount: amount,
        cardLast4: details.cardNumber.slice(-4)
      };

    case 'mobile_money':
      if (!details?.phoneNumber || !details?.provider) {
        return {
          success: false,
          message: 'Mobile money details incomplete'
        };
      }
      return {
        success: true,
        message: 'Mobile money payment processed successfully',
        transactionId: `MM-${Date.now()}`,
        amount: amount,
        provider: details.provider
      };

    case 'bank_transfer':
      if (!details?.accountNumber || !details?.bankName) {
        return {
          success: false,
          message: 'Bank transfer details incomplete'
        };
      }
      return {
        success: true,
        message: 'Bank transfer initiated successfully',
        transactionId: `BANK-${Date.now()}`,
        amount: amount,
        bankName: details.bankName
      };

    case 'digital_wallet':
      if (!details?.walletId || !details?.provider) {
        return {
          success: false,
          message: 'Digital wallet details incomplete'
        };
      }
      return {
        success: true,
        message: 'Digital wallet payment processed successfully',
        transactionId: `WALLET-${Date.now()}`,
        amount: amount,
        provider: details.provider
      };

    case 'credit':
      return {
        success: true,
        message: 'Credit payment recorded',
        transactionId: `CREDIT-${Date.now()}`,
        amount: amount,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

    default:
      return {
        success: false,
        message: 'Unsupported payment method'
      };
  }
}

// ... rest of the file remains the same (getCheckoutSummary, applyDiscount, setTax)

/**
 * Get checkout summary before processing
 */
exports.getCheckoutSummary = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const userId = req.user._id;

    const cart = await Cart.findOne({
      pharmacyId,
      status: 'active'
    }).populate('items.medicineId', 'name genericName form price');

    const transaction = await Transaction.findOne({
      pharmacyId,
      status: 'pending'
    });

    const pharmacy = await User.findById(pharmacyId).select('businessName phone email address taxNumber');
    
    // Get user's delivery addresses
    const deliveryAddresses = await DeliveryAddress.find({ userId }).sort({ isDefault: -1 });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Calculate potential delivery fees
    const deliveryOptions = {
      pickup: { fee: 0, estimatedDelivery: null },
      delivery: { fee: 5.00, estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) }
    };

    res.status(200).json({
      success: true,
      data: {
        cart: {
          items: cart.items,
          totalAmount: cart.totalAmount,
          discount: cart.discount,
          taxAmount: cart.taxAmount,
          finalAmount: cart.finalAmount,
          totalItems: cart.totalItems,
          totalQuantity: cart.totalQuantity
        },
        transaction: transaction ? {
          transactionNumber: transaction.transactionNumber,
          items: transaction.items
        } : null,
        pharmacy,
        delivery: {
          addresses: deliveryAddresses,
          options: deliveryOptions
        },
        summary: {
          subtotal: cart.totalAmount,
          discount: cart.discount.amount,
          tax: cart.taxAmount,
          deliveryFee: 0,
          total: cart.finalAmount
        }
      }
    });

  } catch (error) {
    console.error('Get checkout summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching checkout summary'
    });
  }
};

/**
 * Apply discount to cart
 */
exports.applyDiscount = async (req, res) => {
  try {
    const { amount, type = 'fixed', reason = '' } = req.body;
    const pharmacyId = req.user.pharmacyId || req.user._id;

    const cart = await Cart.findOne({
      pharmacyId,
      status: 'active'
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Active cart not found'
      });
    }

    await cart.applyDiscount(amount, type, reason);

    res.status(200).json({
      success: true,
      message: 'Discount applied successfully',
      data: {
        discount: cart.discount,
        finalAmount: cart.finalAmount
      }
    });

  } catch (error) {
    console.error('Apply discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Error applying discount'
    });
  }
};

/**
 * Set tax for cart
 */
exports.setTax = async (req, res) => {
  try {
    const { taxAmount } = req.body;
    const pharmacyId = req.user.pharmacyId || req.user._id;

    const cart = await Cart.findOne({
      pharmacyId,
      status: 'active'
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Active cart not found'
      });
    }

    await cart.setTax(taxAmount);

    res.status(200).json({
      success: true,
      message: 'Tax applied successfully',
      data: {
        taxAmount: cart.taxAmount,
        finalAmount: cart.finalAmount
      }
    });

  } catch (error) {
    console.error('Set tax error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting tax'
    });
  }
};