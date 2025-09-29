const Request = require('../models/Request');
const User = require('../models/User');

// Create a new medicine request
exports.createMedicineRequest = async (req, res) => {
  try {
    const {
      medicineName,
      genericName,
      form,
      packSize,
      additionalNotes,
      urgencyLevel
    } = req.body;

    // Get user info
    const user = await User.findById(req.user.id);

    // Check if user has a pharmacyName
    if (!user.pharmacyName) {
      return res.status(400).json({
        success: false,
        message: 'User is not associated with a pharmacy. Please update your pharmacy profile.'
      });
    }

    // Find the main pharmacist for this pharmacy to use as pharmacyId reference
    const pharmacist = await User.findOne({ 
      pharmacyName: user.pharmacyName,
      role: 'pharmacist' 
    });

    // Use the pharmacist's ID or the current user's ID as pharmacy reference
    const targetPharmacyId = pharmacist ? pharmacist._id : user._id;

    // Create new medicine request
    const newRequest = new Request({
      pharmacyId: targetPharmacyId,
      userId: req.user.id,
      type: 'medicine_request',
      title: `Medicine Request: ${medicineName}`,
      description: additionalNotes || '',
      priority: urgencyLevel || 'medium',
      medicineDetails: {
        medicineName,
        genericName,
        form,
        packSize,
        image: req.file ? `/uploads/requests/${req.file.filename}` : null
      }
    });

    await newRequest.save();

    // Populate user details for response
    await newRequest.populate('userId', 'name email');

    res.status(201).json({
      success: true,
      message: 'Medicine request submitted successfully',
      data: newRequest
    });
  } catch (error) {
    console.error('Error creating medicine request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating medicine request'
    });
  }
};

// Get all medicine requests for a pharmacy
exports.getPharmacyMedicineRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Determine pharmacy filter based on user role
    let pharmacyFilter = {};
    
    if (user.role === 'pharmacist') {
      // Pharmacist can see all requests where they are the pharmacy reference
      pharmacyFilter = { pharmacyId: user._id };
    } else if (user.role === 'assistant') {
      // Assistants work under a pharmacist - find their pharmacist
      const pharmacist = await User.findOne({
        pharmacyName: user.pharmacyName,
        role: 'pharmacist'
      });
      
      if (!pharmacist) {
        return res.status(400).json({
          success: false,
          message: 'No pharmacist found for your pharmacy'
        });
      }
      
      pharmacyFilter = { pharmacyId: pharmacist._id };
    } else if (user.role === 'admin') {
      // Admin can see all requests - no filter needed
      pharmacyFilter = {};
    } else {
      // Customers shouldn't access this route (handled by authorization middleware)
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { status, page = 1, limit = 10 } = req.query;

    const filter = { 
      ...pharmacyFilter,
      type: 'medicine_request'
    };

    if (status && status !== 'all') {
      filter.status = status;
    }

    const requests = await Request.find(filter)
      .populate('userId', 'name email')
      .populate('pharmacyId', 'pharmacyName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Request.countDocuments(filter);

    res.json({
      success: true,
      data: requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Error fetching pharmacy medicine requests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching medicine requests'
    });
  }
};

// Get user's own medicine requests
exports.getUserMedicineRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { 
      userId: req.user.id,
      type: 'medicine_request'
    };

    if (status && status !== 'all') {
      filter.status = status;
    }

    const requests = await Request.find(filter)
      .populate('pharmacyId', 'pharmacyName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Request.countDocuments(filter);

    res.json({
      success: true,
      data: requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Error fetching user medicine requests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching medicine requests'
    });
  }
};

// Get single medicine request details
exports.getMedicineRequestDetails = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await Request.findOne({
      _id: requestId,
      type: 'medicine_request'
    })
      .populate('userId', 'name email phone')
      .populate('pharmacyId', 'pharmacyName');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Medicine request not found'
      });
    }

    // Check if user has permission to view this request
    const user = await User.findById(req.user.id);
    
    // Request owner can view
    if (request.userId._id.toString() === req.user.id) {
      return res.json({
        success: true,
        data: request
      });
    }
    
    // Pharmacy staff can view requests for their pharmacy
    if (user.pharmacyName && request.pharmacyId && 
        user.pharmacyName === request.pharmacyId.pharmacyName) {
      return res.json({
        success: true,
        data: request
      });
    }
    
    // Admin can view all requests
    if (user.role === 'admin') {
      return res.json({
        success: true,
        data: request
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  } catch (error) {
    console.error('Error fetching medicine request details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching medicine request details'
    });
  }
};