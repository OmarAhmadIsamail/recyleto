// controllers/businessSettingsController.js - FIXED
const BusinessSettings = require('../models/BusinessSettings');
const mongoose = require('mongoose');

exports.getBusinessSettings = async (req, res) => {
  try {
    console.log('Getting business settings for user ID:', req.user.id);
    
    // Always use req.user.id (the authenticated user's ID)
    const settings = await BusinessSettings.findOne({ pharmacyId: req.user.id });
    
    if (!settings) {
      console.log('No settings found, creating default settings for user:', req.user.id);
      
      // Create default settings if none exist
      const defaultSettings = new BusinessSettings({
        pharmacyId: req.user.id, // Use the user's ID directly
        businessName: req.user.pharmacyName || 'My Pharmacy'
      });
      
      await defaultSettings.save();
      return res.json({ 
        success: true, 
        message: 'Default settings created',
        settings: defaultSettings 
      });
    }
    
    console.log('Settings found:', settings);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error retrieving business settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving business settings'
    });
  }
};

exports.updateBusinessSettings = async (req, res) => {
  try {
    console.log('Updating business settings for user ID:', req.user.id);
    console.log('Update data:', req.body);
    
    const settings = await BusinessSettings.findOneAndUpdate(
      { pharmacyId: req.user.id }, // Always use the user's ID
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!settings) {
      console.log('Business settings not found for user:', req.user.id);
      return res.status(404).json({
        success: false,
        message: 'Business settings not found'
      });
    }
    
    console.log('Settings updated successfully:', settings);
    res.json({
      success: true,
      message: 'Business settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Error updating business settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating business settings'
    });
  }
};

// Add a debug endpoint to help troubleshoot
exports.debugBusinessSettings = async (req, res) => {
  try {
    console.log('=== BUSINESS SETTINGS DEBUG ===');
    console.log('User ID:', req.user.id);
    console.log('User role:', req.user.role);
    console.log('User pharmacyName:', req.user.pharmacyName);
    
    // Check if any business settings exist for this user
    const settings = await BusinessSettings.findOne({ pharmacyId: req.user.id });
    console.log('Found settings:', settings);
    
    // Check all business settings in database
    const allSettings = await BusinessSettings.find();
    console.log('All settings in DB:', allSettings);
    
    res.json({
      success: true,
      user: {
        id: req.user.id,
        role: req.user.role,
        pharmacyName: req.user.pharmacyName
      },
      userSettings: settings,
      allSettings: allSettings
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug error'
    });
  }
};