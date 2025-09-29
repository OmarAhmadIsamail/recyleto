const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
};

// Update profile information
exports.updateProfile = async (req, res) => {
    try {
      const {
        pharmacyName,      // instead of businessName
        businessEmail,     // instead of email
        businessPhone,     // instead of phone
        mobileNumber,      // instead of mobile
        businessAddress    // instead of address
      } = req.body;
  
      // Check if businessEmail is already taken by another user
      if (businessEmail) {
        const existingUser = await User.findOne({ 
          businessEmail, 
          _id: { $ne: req.userId } 
        });
        
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Email is already taken by another user'
          });
        }
      }
  
      const updateData = {};
      if (pharmacyName) updateData.pharmacyName = pharmacyName;
      if (businessEmail) updateData.businessEmail = businessEmail;
      if (businessPhone) updateData.businessPhone = businessPhone;
      if (mobileNumber) updateData.mobileNumber = mobileNumber;
      if (businessAddress) updateData.businessAddress = businessAddress;
  
      // Handle license image upload if file exists
      if (req.file) {
        const user = await User.findById(req.userId);
        if (user.licenseImage) {
          const oldImagePath = path.join(__dirname, '..', 'uploads', 'licenses', path.basename(user.licenseImage));
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        updateData.licenseImage = `/uploads/licenses/${req.file.filename}`;
      }
  
      const updatedUser = await User.findByIdAndUpdate(
        req.userId,
        updateData,
        { new: true, runValidators: true }
      ).select('-password');
  
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while updating profile'
      });
    }
  };
  

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.userId).select('+password');
    
    // Check if current password is correct
    const isPasswordCorrect = await user.correctPassword(currentPassword, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while changing password'
    });
  }
};