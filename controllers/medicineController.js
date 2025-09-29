const Medicine = require('../models/Medicine');

exports.addMedicine = async (req, res) => {
    try {
        const pharmacyId = req.user._id;
        const {
            name,
            genericName,
            form,
            packSize,
            quantity,
            price,
            expiryDate,
            manufacturer,
            batchNumber,
            category,
            requiresPrescription
        } = req.body;

        const medicine = new Medicine({
            pharmacyId,
            name,
            genericName,
            form,
            packSize,
            quantity: parseInt(quantity),
            price: parseFloat(price),
            expiryDate: new Date(expiryDate),
            manufacturer,
            batchNumber,
            category,
            requiresPrescription: requiresPrescription === 'true'
        });

        await medicine.save();

        res.status(201).json({
            success: true,
            message: 'Medicine added successfully',
            data: medicine
        });

    } catch (error) {
        console.error('Add medicine error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding medicine'
        });
    }
};

exports.searchMedicines = async (req, res) => {
    try {
        const pharmacyId = req.user._id;
        const { search, page = 1, limit = 10 } = req.query;

        const query = { pharmacyId, status: 'active' };

        if (search) {
            query.$text = { $search: search };
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { name: 1 }
        };

        const medicines = await Medicine.find(query)
            .select('name genericName form packSize price quantity expiryDate')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ name: 1 });

        const total = await Medicine.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                medicines,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total
            }
        });

    } catch (error) {
        console.error('Search medicines error:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching medicines'
        });
    }
};

exports.getMedicineById = async (req, res) => {
    try {
        const pharmacyId = req.user._id;
        const { id } = req.params;

        const medicine = await Medicine.findOne({ _id: id, pharmacyId });

        if (!medicine) {
            return res.status(404).json({
                success: false,
                message: 'Medicine not found'
            });
        }

        res.status(200).json({
            success: true,
            data: medicine
        });

    } catch (error) {
        console.error('Get medicine error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching medicine'
        });
    }
};

exports.updateMedicine = async (req, res) => {
    try {
        const pharmacyId = req.user._id;
        const { id } = req.params;
        const updateData = req.body;

        const medicine = await Medicine.findOneAndUpdate(
            { _id: id, pharmacyId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!medicine) {
            return res.status(404).json({
                success: false,
                message: 'Medicine not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Medicine updated successfully',
            data: medicine
        });

    } catch (error) {
        console.error('Update medicine error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating medicine'
        });
    }
};

// Endpoint for expiring medicines
exports.getExpiringMedicines = async (req, res) => {
    try {
        const pharmacyId = req.user._id;
        const days = parseInt(req.query.days) || 30;
        
        if (days < 0) {
            return res.status(400).json({
                success: false,
                message: 'Days parameter must be a positive number'
            });
        }

        // Calculate date range
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);

        // Query for medicines expiring within the specified days
        const expiringMedicines = await Medicine.find({
            pharmacyId,
            status: 'active',
            expiryDate: {
                $gte: startDate,
                $lte: endDate
            }
        })
        .select('name genericName form packSize quantity price expiryDate manufacturer batchNumber category requiresPrescription inTransaction transactionNumber')
        .sort({ expiryDate: 1 });

        res.status(200).json({
            success: true,
            data: expiringMedicines,
            meta: {
                total: expiringMedicines.length,
                days: days,
                expiryRange: {
                    from: startDate.toISOString(),
                    to: endDate.toISOString()
                }
            }
        });

    } catch (error) {
        console.error('Get expiring medicines error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching expiring medicines'
        });
    }
};

// Helper method to mark medicine as in transaction
exports.markMedicineInTransaction = async (medicineId, transactionNumber, pharmacyId) => {
    try {
        const medicine = await Medicine.findOneAndUpdate(
            { _id: medicineId, pharmacyId },
            { 
                inTransaction: true,
                transactionNumber: transactionNumber
            },
            { new: true }
        );
        return medicine;
    } catch (error) {
        console.error('Mark medicine in transaction error:', error);
        throw error;
    }
};

// Helper method to mark medicine as not in transaction
exports.markMedicineNotInTransaction = async (medicineId, pharmacyId) => {
    try {
        const medicine = await Medicine.findOneAndUpdate(
            { _id: medicineId, pharmacyId },
            { 
                inTransaction: false,
                transactionNumber: null
            },
            { new: true }
        );
        return medicine;
    } catch (error) {
        console.error('Mark medicine not in transaction error:', error);
        throw error;
    }
};