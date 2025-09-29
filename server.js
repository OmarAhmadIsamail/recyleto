require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

// Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const medicineRoutes = require('./routes/medicine');
const transactionRoutes = require('./routes/transaction');
const checkoutRoutes = require('./routes/checkout');
const profileRoutes = require('./routes/profile');
const marketRoutes = require('./routes/market');
const refundRoutes = require('./routes/refund');
const requestRoutes = require('./routes/request');
const supportRoutes = require('./routes/support');
const businessSettingsRoutes = require('./routes/businessSettings');
const analyticsRoutes = require('./routes/analytics');
const paymentMethodRoutes = require('./routes/paymentMethod');
const deliveryRoutes = require('./routes/delivery');
const salesRoutes = require('./routes/sales'); // Added sales routes
const marketplaceRoutes = require('./routes/marketplace'); // Added marketplace routes

// Middleware
const { handleMulterError } = require('./middleware/upload');

const app = express();

// Create uploads directories if they don't exist
const createUploadsDirectories = () => {
    const directories = [
        'uploads',
        'uploads/licenses',
        'uploads/requests',
        'uploads/deliveries',
        'uploads/sales', // Added sales directory
        'uploads/marketplace' // Added marketplace directory
    ];

    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });
};

createUploadsDirectories();

// Connect to database
connectDB();

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Session middleware configuration - Added after other middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/settings/business', businessSettingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payment-methods', paymentMethodRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/sales', salesRoutes); // Added sales routes
app.use('/api/marketplace', marketplaceRoutes); // Added marketplace routes

// Multer error handling
app.use(handleMulterError);

// Initialize cron jobs for alerts
require('./utils/alerts');

// Error handling middleware
app.use((error, req, res, next) => {
    console.error(error.stack);
    res.status(500).json({
        success: false,
        message: error.message || 'Server Error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Uploads directory: ${path.resolve('uploads')}`);
    console.log(`Available API endpoints:`);
    console.log(`- /api/auth`);
    console.log(`- /api/dashboard`);
    console.log(`- /api/medicines`);
    console.log(`- /api/transactions`);
    console.log(`- /api/checkout`);
    console.log(`- /api/profile`);
    console.log(`- /api/market`);
    console.log(`- /api/refunds`);
    console.log(`- /api/requests`);
    console.log(`- /api/support`);
    console.log(`- /api/settings/business`);
    console.log(`- /api/analytics`);
    console.log(`- /api/payment-methods`);
    console.log(`- /api/delivery`);
    console.log(`- /api/sales`); // Added sales endpoint
    console.log(`- /api/marketplace`); // Added marketplace endpoint
});