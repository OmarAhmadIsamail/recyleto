const Medicine = require('../models/Medicine');
const Transaction = require('../models/Transaction');
const Cart = require('../models/Cart');
const mongoose = require('mongoose');
const { generateTransactionNumber } = require('../utils/helpers');

const marketplaceController = {
  // Get marketplace medicines (available for purchase)
  getMarketplaceMedicines: async (req, res) => {
    try {
      const pharmacyId = req.user.pharmacyId || req.user._id;
      const {
        search,
        category,
        manufacturer,
        minPrice,
        maxPrice,
        inStock = true,
        page = 1,
        limit = 20
      } = req.query;

      let query = {
        pharmacyId: { $ne: pharmacyId }, // Exclude own medicines
        isActive: true,
        quantity: { $gt: 0 } // Only show available medicines
      };

      if (search) {
        query.$or = [
          { name: new RegExp(search, 'i') },
          { genericName: new RegExp(search, 'i') },
          { manufacturer: new RegExp(search, 'i') }
        ];
      }

      if (category) query.category = category;
      if (manufacturer) query.manufacturer = new RegExp(manufacturer, 'i');
      
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseFloat(minPrice);
        if (maxPrice) query.price.$lte = parseFloat(maxPrice);
      }

      if (inStock === 'true') {
        query.quantity = { $gt: 0 };
      }

      const skip = (page - 1) * limit;

      const medicines = await Medicine.find(query)
        .populate('pharmacyId', 'pharmacyName contactInfo')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v');

      const total = await Medicine.countDocuments(query);

      res.status(200).json({
        success: true,
        data: medicines,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Marketplace medicines error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching marketplace medicines'
      });
    }
  },

  // Add marketplace medicine to cart
  addMarketplaceToCart: async (req, res) => {
    try {
      const pharmacyId = req.user.pharmacyId || req.user._id;
      const { medicineId, quantity, sellerId } = req.body;

      // Get marketplace medicine
      const medicine = await Medicine.findOne({
        _id: medicineId,
        pharmacyId: sellerId,
        isActive: true
      });

      if (!medicine) {
        return res.status(404).json({
          success: false,
          message: 'Medicine not found in marketplace'
        });
      }

      if (medicine.quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available: ${medicine.quantity}`
        });
      }

      // Find or create marketplace cart
      let cart = await Cart.findOne({
        pharmacyId,
        transactionType: 'purchase',
        status: 'active',
        'marketplace.sellerId': sellerId
      });

      if (!cart) {
        cart = new Cart({
          pharmacyId,
          transactionType: 'purchase',
          marketplace: {
            sellerId: sellerId,
            isMarketplace: true
          },
          status: 'active'
        });
      }

      // Add item to cart
      await cart.addItem({
        medicineId: medicine._id,
        medicineName: medicine.name,
        genericName: medicine.genericName,
        form: medicine.form,
        packSize: medicine.packSize,
        quantity: parseInt(quantity),
        unitPrice: medicine.price,
        expiryDate: medicine.expiryDate,
        batchNumber: medicine.batchNumber,
        manufacturer: medicine.manufacturer
      });

      const populatedCart = await cart.getPopulatedCart();

      res.status(200).json({
        success: true,
        message: 'Medicine added to marketplace cart',
        data: populatedCart
      });

    } catch (error) {
      console.error('Add marketplace to cart error:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding marketplace medicine to cart'
      });
    }
  },

  // Purchase from marketplace (full cart from a seller)
  purchaseFromMarketplace: async (req, res) => {
    try {
      const pharmacyId = req.user.pharmacyId || req.user._id;
      const { sellerId, description = 'Marketplace purchase' } = req.body;

      // Get marketplace cart for this seller
      const cart = await Cart.findOne({
        pharmacyId,
        transactionType: 'purchase',
        status: 'active',
        'marketplace.sellerId': sellerId
      });

      if (!cart || !cart.items.length) {
        return res.status(400).json({
          success: false,
          message: 'No items in marketplace cart for this seller'
        });
      }

      // Validate all items are still available
      const transactionItems = [];
      for (const cartItem of cart.items) {
        const medicine = await Medicine.findOne({
          _id: cartItem.medicineId,
          pharmacyId: sellerId,
          isActive: true
        });

        if (!medicine) {
          return res.status(404).json({
            success: false,
            message: `Medicine ${cartItem.medicineName} no longer available`
          });
        }

        if (medicine.quantity < cartItem.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${medicine.name}. Available: ${medicine.quantity}`
          });
        }

        transactionItems.push({
          medicineId: medicine._id,
          medicineName: medicine.name,
          genericName: medicine.genericName,
          form: medicine.form,
          packSize: medicine.packSize,
          quantity: cartItem.quantity,
          unitPrice: cartItem.unitPrice,
          totalPrice: cartItem.totalPrice,
          expiryDate: medicine.expiryDate,
          batchNumber: medicine.batchNumber,
          manufacturer: medicine.manufacturer
        });
      }

      // Calculate totals
      const subtotal = transactionItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const totalAmount = subtotal; // Marketplace purchases might have different pricing logic

      // Generate transaction numbers
      const transactionNumber = await generateTransactionNumber('purchase');
      const transactionRef = `MP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();

      // Create marketplace purchase transaction
      const transaction = new Transaction({
        pharmacyId,
        transactionType: 'purchase',
        transactionNumber,
        transactionRef,
        description,
        items: transactionItems,
        subtotal,
        totalAmount,
        paymentMethod: 'bank_transfer', // Default for marketplace
        status: 'completed',
        saleType: 'full',
        marketplace: {
          isMarketplace: true,
          sellerId: sellerId,
          commission: 0 // Could be calculated based on business rules
        },
        transactionDate: new Date()
      });

      await transaction.save();

      // Update seller's stock (this would typically be handled by the seller's system)
      // For now, we'll simulate the stock update
      for (const item of transactionItems) {
        await Medicine.findOneAndUpdate(
          { _id: item.medicineId, pharmacyId: sellerId },
          { $inc: { quantity: -item.quantity } }
        );
      }

      // Add purchased medicines to buyer's inventory
      for (const item of transactionItems) {
        const existingMedicine = await Medicine.findOne({
          pharmacyId,
          name: item.medicineName,
          genericName: item.genericName
        });

        if (existingMedicine) {
          // Update existing medicine
          await Medicine.findByIdAndUpdate(
            existingMedicine._id,
            { 
              $inc: { quantity: item.quantity },
              $set: { 
                price: item.unitPrice, // Update price to purchase price
                lastPurchasePrice: item.unitPrice
              }
            }
          );
        } else {
          // Create new medicine in buyer's inventory
          await Medicine.create({
            pharmacyId,
            name: item.medicineName,
            genericName: item.genericName,
            form: item.form,
            packSize: item.packSize,
            quantity: item.quantity,
            price: item.unitPrice * 1.2, // Markup for resale
            costPrice: item.unitPrice,
            category: 'Purchased',
            manufacturer: item.manufacturer,
            expiryDate: item.expiryDate,
            batchNumber: item.batchNumber,
            isActive: true
          });
        }
      }

      // Clear marketplace cart
      await cart.clearCart();

      const populatedTransaction = await Transaction.findById(transaction._id)
        .populate('items.medicineId', 'name genericName form')
        .populate('marketplace.sellerId', 'pharmacyName contactInfo');

      res.status(201).json({
        success: true,
        message: 'Marketplace purchase completed successfully',
        data: populatedTransaction
      });

    } catch (error) {
      console.error('Marketplace purchase error:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing marketplace purchase'
      });
    }
  },

  // Purchase individual medicine from marketplace
  purchaseSingleFromMarketplace: async (req, res) => {
    try {
      const pharmacyId = req.user.pharmacyId || req.user._id;
      const { medicineId, quantity, sellerId } = req.body;

      // Get marketplace medicine
      const medicine = await Medicine.findOne({
        _id: medicineId,
        pharmacyId: sellerId,
        isActive: true
      });

      if (!medicine) {
        return res.status(404).json({
          success: false,
          message: 'Medicine not found in marketplace'
        });
      }

      if (medicine.quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available: ${medicine.quantity}`
        });
      }

      const unitPrice = medicine.price;
      const totalPrice = quantity * unitPrice;

      // Generate transaction numbers
      const transactionNumber = await generateTransactionNumber('purchase');
      const transactionRef = `MP-SINGLE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();

      // Create single item purchase transaction
      const transaction = new Transaction({
        pharmacyId,
        transactionType: 'purchase',
        transactionNumber,
        transactionRef,
        description: `Single marketplace purchase: ${medicine.name}`,
        items: [{
          medicineId: medicine._id,
          medicineName: medicine.name,
          genericName: medicine.genericName,
          form: medicine.form,
          packSize: medicine.packSize,
          quantity: quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
          expiryDate: medicine.expiryDate,
          batchNumber: medicine.batchNumber,
          manufacturer: medicine.manufacturer
        }],
        subtotal: totalPrice,
        totalAmount: totalPrice,
        paymentMethod: 'bank_transfer',
        status: 'completed',
        saleType: 'per_medicine',
        marketplace: {
          isMarketplace: true,
          sellerId: sellerId,
          commission: 0
        },
        transactionDate: new Date()
      });

      await transaction.save();

      // Update seller's stock
      await Medicine.findOneAndUpdate(
        { _id: medicineId, pharmacyId: sellerId },
        { $inc: { quantity: -quantity } }
      );

      // Add to buyer's inventory
      const existingMedicine = await Medicine.findOne({
        pharmacyId,
        name: medicine.name,
        genericName: medicine.genericName
      });

      if (existingMedicine) {
        await Medicine.findByIdAndUpdate(
          existingMedicine._id,
          { 
            $inc: { quantity: quantity },
            $set: { 
              price: unitPrice,
              lastPurchasePrice: unitPrice
            }
          }
        );
      } else {
        await Medicine.create({
          pharmacyId,
          name: medicine.name,
          genericName: medicine.genericName,
          form: medicine.form,
          packSize: medicine.packSize,
          quantity: quantity,
          price: unitPrice * 1.2,
          costPrice: unitPrice,
          category: 'Purchased',
          manufacturer: medicine.manufacturer,
          expiryDate: medicine.expiryDate,
          batchNumber: medicine.batchNumber,
          isActive: true
        });
      }

      const populatedTransaction = await Transaction.findById(transaction._id)
        .populate('items.medicineId', 'name genericName form')
        .populate('marketplace.sellerId', 'pharmacyName contactInfo');

      res.status(201).json({
        success: true,
        message: 'Single marketplace purchase completed successfully',
        data: populatedTransaction
      });

    } catch (error) {
      console.error('Single marketplace purchase error:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing single marketplace purchase'
      });
    }
  },

  // Get marketplace purchase history
  getMarketplacePurchases: async (req, res) => {
    try {
      const pharmacyId = req.user.pharmacyId || req.user._id;
      const {
        sellerId,
        startDate,
        endDate,
        page = 1,
        limit = 10
      } = req.query;

      let query = {
        pharmacyId,
        transactionType: 'purchase',
        'marketplace.isMarketplace': true
      };

      if (sellerId) {
        query['marketplace.sellerId'] = sellerId;
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;

      const purchases = await Transaction.find(query)
        .populate('items.medicineId', 'name genericName form')
        .populate('marketplace.sellerId', 'pharmacyName contactInfo')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v');

      const total = await Transaction.countDocuments(query);

      res.status(200).json({
        success: true,
        data: purchases,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Marketplace purchases error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching marketplace purchases'
      });
    }
  }
};

module.exports = marketplaceController;