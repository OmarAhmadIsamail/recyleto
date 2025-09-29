const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendResetCode, sendWelcomeEmail } = require('../utils/mailer');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Generate JWT token
function generateToken(user) {
    const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET || 'yourSecretKey', // Use environment variable for security
        {
            expiresIn: '1h' // Token expires in 1 hour
        }
    );
    return token;
}

// ------------------- LOGIN (Updated with 2FA check) -------------------
exports.login = async (req, res) => {
    try {
        const { email, username, password, twoFactorToken } = req.body;

        const user = await User.findOne({
            $or: [
                email ? { email } : null,
                username ? { username } : null
            ].filter(Boolean)
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if 2FA is enabled
        if (user.twoFactorEnabled) {
            // If 2FA token is not provided, request it
            if (!twoFactorToken) {
                return res.status(200).json({
                    success: true,
                    requires2FA: true,
                    message: '2FA verification required'
                });
            }

            // Verify 2FA token
            const verified = speakeasy.totp.verify({
                secret: user.twoFactorSecret,
                encoding: 'base32',
                token: twoFactorToken,
                window: 1 // Allow 1 step (30 seconds) before/after current time
            });

            if (!verified) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid 2FA token'
                });
            }
        }

        const token = generateToken(user);

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                pharmacyName: user.pharmacyName,
                twoFactorEnabled: user.twoFactorEnabled
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ------------------- FORGOT PASSWORD -------------------
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resetCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        user.resetPasswordToken = resetCode;
        user.resetPasswordExpires = resetCodeExpires;
        await user.save();

        try {
            await sendResetCode(email, resetCode);
        } catch (emailError) {
            console.error('Failed to send reset code email:', emailError);
        }

        res.status(200).json({ success: true, message: 'Reset code sent to email' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ------------------- RESET PASSWORD -------------------
exports.resetPassword = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        const user = await User.findOne({
            email,
            resetPasswordToken: code,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset code' });
        }

        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ------------------- REGISTER PHARMACY -------------------
exports.registerPharmacy = async (req, res) => {
    let licenseFilePath = null;
    let logoFilePath = null;

    try {
        let {
            pharmacyName,
            businessEmail,
            businessPhone,
            mobileNumber,
            password,
            businessAddress,
            location,
            logo // This would be handled via file upload, not in req.body
        } = req.body;

        // Parse address if JSON string
        if (businessAddress && typeof businessAddress === 'string') {
            try { 
                businessAddress = JSON.parse(businessAddress); 
            } catch { 
                businessAddress = undefined; 
            }
        }

        // Parse location if JSON string
        if (location && typeof location === 'string') {
            try { 
                location = JSON.parse(location); 
            } catch { 
                location = undefined; 
            }
        }

        // Handle license file upload
        if (req.files?.licenseImage) {
            licenseFilePath = path.resolve(__dirname, '..', 'uploads', 'licenses', req.files.licenseImage[0].filename);
        }

        // Handle logo file upload
        if (req.files?.logo) {
            logoFilePath = path.resolve(__dirname, '..', 'uploads', 'logos', req.files.logo[0].filename);
        }

        const existingUser = await User.findOne({
            $or: [{ email: businessEmail }, { businessEmail: businessEmail }]
        });

        if (existingUser) {
            // Clean up uploaded files if user already exists
            if (licenseFilePath) {
                try { 
                    await fs.unlink(licenseFilePath); 
                } catch { 
                    /* ignore cleanup errors */ 
                }
            }
            if (logoFilePath) {
                try { 
                    await fs.unlink(logoFilePath); 
                } catch { 
                    /* ignore cleanup errors */ 
                }
            }
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const user = new User({
            email: businessEmail,
            businessEmail,
            pharmacyName,
            businessPhone,
            mobileNumber,
            password,
            businessAddress,
            location: location || { type: 'Point', coordinates: [0, 0] },
            licenseImage: req.files?.licenseImage ? req.files.licenseImage[0].filename : null,
            logo: req.files?.logo ? req.files.logo[0].filename : null
        });

        await user.save();

        // Extract latitude and longitude from location if available
        let latitude = null;
        let longitude = null;
        if (location && location.coordinates && location.coordinates.length >= 2) {
            latitude = location.coordinates[1];
            longitude = location.coordinates[0];
        }

        // Send welcome email but do NOT block registration if it fails
        try {
            await sendWelcomeEmail(
                businessEmail, 
                pharmacyName, 
                businessAddress, 
                req.files?.logo ? req.files.logo[0].filename : null,
                latitude, 
                longitude
            );
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
        }

        const token = generateToken(user);
        return res.status(201).json({
            success: true,
            token,
            user: { 
                id: user._id, 
                email: user.email, 
                pharmacyName: user.pharmacyName,
                twoFactorEnabled: user.twoFactorEnabled
            }
        });

    } catch (error) {
        console.error('Register pharmacy error:', error);
        // Clean up uploaded files on error
        if (licenseFilePath) {
            try { 
                await fs.unlink(licenseFilePath); 
            } catch { 
                /* ignore cleanup errors */ 
            }
        }
        if (logoFilePath) {
            try { 
                await fs.unlink(logoFilePath); 
            } catch { 
                /* ignore cleanup errors */ 
            }
        }
        return res.status(500).json({ success: false, message: 'Server error during registration' });
    }
};

// ------------------- 2FA METHODS -------------------
exports.enable2FA = async (req, res) => {
    try {
        // Check if session is available
        if (!req.session) {
            return res.status(500).json({
                success: false,
                message: 'Session not available. Please check session configuration.'
            });
        }
        
        const secret = speakeasy.generateSecret({
            name: `Recyleto (${req.user.email})`
        });
        
        // Generate QR code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
        
        // Save secret temporarily (not enabling yet)
        req.session.temp2FASecret = secret.base32;
        
        res.json({
            success: true,
            secret: secret.base32,
            qrCode: qrCodeUrl
        });
    } catch (error) {
        console.error('Enable 2FA error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating 2FA setup'
        });
    }
};

exports.verify2FA = async (req, res) => {
    try {
        // Check if session is available
        if (!req.session) {
            return res.status(500).json({
                success: false,
                message: 'Session not available. Please check session configuration.'
            });
        }
        
        const { token } = req.body;
        const secret = req.session.temp2FASecret;
        
        if (!secret) {
            return res.status(400).json({
                success: false,
                message: '2FA setup session expired. Please try again.'
            });
        }
        
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 1 // Allow 1 step (30 seconds) before/after current time
        });
        
        if (verified) {
            // Enable 2FA for user
            await User.findByIdAndUpdate(req.user.id, {
                twoFactorEnabled: true,
                twoFactorSecret: secret
            });
            
            // Clear temporary secret
            delete req.session.temp2FASecret;
            
            res.json({
                success: true,
                message: '2FA enabled successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Invalid verification code'
            });
        }
    } catch (error) {
        console.error('Verify 2FA error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying 2FA code'
        });
    }
};

exports.disable2FA = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, {
            twoFactorEnabled: false,
            twoFactorSecret: null
        });
        
        res.json({
            success: true,
            message: '2FA disabled successfully'
        });
    } catch (error) {
        console.error('Disable 2FA error:', error);
        res.status(500).json({
            success: false,
            message: 'Error disabling 2FA'
        });
    }
};
