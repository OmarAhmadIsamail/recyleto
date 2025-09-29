# Recyleto 💊

A comprehensive medicine management and marketplace platform built with Node.js and MongoDB.

## 📋 Overview

Recyleto is a full-featured medicine inventory and transaction management system that includes marketplace functionality, delivery management, payment processing, and comprehensive analytics. The platform supports both internal inventory management and external marketplace purchasing.

## 🚀 Features

### Core Functionality
- **Medicine Inventory Management** - Complete CRUD operations for medicine stock
- **Transaction Processing** - Shopping cart, checkout, and payment handling
- **Marketplace Integration** - Purchase medicines from external suppliers
- **Delivery Management** - Complete delivery tracking and confirmation system
- **Payment Processing** - Secure payment methods with refund support
- **User Management** - Authentication with 2FA support
- **Analytics Dashboard** - Business insights and sales reporting

### Security Features
- JWT-based authentication
- Two-factor authentication (2FA)
- Data encryption and key management
- Secure file uploads
- Input validation and sanitization

### Business Features
- Sales analytics (full and per-medicine reporting)
- Customer support ticket system
- Business configuration settings
- Receipt generation and management
- Medicine request handling
- Inventory alerts and notifications

## 📁 Project Structure

```
recyleto/
├── config/
│   └── db.js                           # MongoDB database connection
├── controllers/
│   ├── authController.js               # Authentication operations
│   ├── dashboardController.js          # Analytics and insights
│   ├── medicineController.js           # Medicine CRUD and inventory
│   ├── transactionController.js        # Shopping cart operations
│   ├── checkoutController.js           # Payment processing with delivery
│   ├── refundController.js             # Refund processing
│   ├── requestController.js            # Medicine requests
│   ├── profileController.js            # User profile management
│   ├── supportController.js            # Customer support
│   ├── businessSettingsController.js   # Business configuration
│   ├── paymentMethodController.js      # Payment method management
│   ├── deliveryController.js           # Delivery management
│   ├── salesController.js              # Sales page operations
│   └── marketplaceController.js        # Marketplace purchasing operations
├── middleware/
│   ├── auth.js                         # JWT authentication middleware
│   ├── upload.js                       # File upload configuration
│   ├── validateResult.js               # Validation error handling
│   └── security.js                     # Security middleware
├── models/
│   ├── User.js                         # User schema with 2FA
│   ├── Medicine.js                     # Medicine inventory schema
│   ├── Transaction.js                  # Transaction records with delivery + marketplace
│   ├── Cart.js                         # Shopping cart with marketplace support
│   ├── Inventory.js                    # Stock tracking
│   ├── Receipt.js                      # Receipt generation
│   ├── Refund.js                       # Refund requests
│   ├── Request.js                      # Medicine requests
│   ├── Counter.js                      # Unique ID generation
│   ├── Support.js                      # Support tickets
│   ├── BusinessSettings.js             # Business configuration
│   ├── PaymentMethod.js                # Secure payment methods
│   └── DeliveryAddress.js              # Delivery addresses
├── routes/
│   ├── auth.js                         # Authentication endpoints
│   ├── dashboard.js                    # Dashboard analytics
│   ├── medicine.js                     # Medicine management
│   ├── transaction.js                  # Transaction endpoints
│   ├── checkout.js                     # Checkout with delivery
│   ├── refund.js                       # Refund management
│   ├── request.js                      # Medicine requests
│   ├── profile.js                      # Profile management
│   ├── support.js                      # Customer support
│   ├── businessSettings.js             # Business settings
│   ├── paymentMethod.js                # Payment methods
│   ├── delivery.js                     # Delivery management
│   ├── sales.js                        # Sales page routes
│   └── marketplace.js                  # Marketplace routes
├── templates/
│   ├── receipt.ejs                     # Receipt template
│   ├── delivery-confirmation.ejs       # Delivery confirmation
│   └── emails/                         # Email templates
├── validators/                         # Input validation rules
├── utils/
│   ├── mailer.js                       # Email/SMS services
│   ├── helpers.js                      # Utility functions with transaction helpers
│   ├── receiptGenerator.js             # Receipt generation
│   ├── alerts.js                       # Cron job scheduler
│   ├── encryption.js                   # Data encryption
│   ├── keyManager.js                   # Key management
│   └── deliveryService.js              # Delivery utilities
├── keys/                               # Encryption keys (gitignored)
├── tests/                              # Test suites
├── uploads/                            # File uploads
└── server.js                           # Express application
```

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd recyleto
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/recyleto
   JWT_SECRET=your-jwt-secret
   EMAIL_SERVICE=your-email-service
   EMAIL_USER=your-email
   EMAIL_PASS=your-password
   ENCRYPTION_KEY=your-encryption-key
   ```

4. **Database Setup**
   Ensure MongoDB is running and accessible via the connection string in your `.env` file.

5. **Start the application**
   ```bash
   npm start
   ```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/2fa/setup` - Setup 2FA
- `POST /api/auth/2fa/verify` - Verify 2FA

### Medicine Management
- `GET /api/medicine` - Get all medicines
- `POST /api/medicine` - Add new medicine
- `PUT /api/medicine/:id` - Update medicine
- `DELETE /api/medicine/:id` - Delete medicine

### Transactions
- `GET /api/transaction` - Get transactions
- `POST /api/transaction` - Create transaction
- `GET /api/transaction/:id` - Get specific transaction

### Marketplace
- `GET /api/marketplace` - Browse marketplace
- `POST /api/marketplace/purchase` - Purchase from marketplace

### Sales & Analytics
- `GET /api/sales/overview` - Sales overview
- `GET /api/sales/medicine/:id` - Per-medicine sales data
- `GET /api/dashboard/analytics` - Dashboard analytics

## 🔧 Configuration

### Business Settings
Configure your business settings through the `/api/business-settings` endpoints:
- Store information
- Tax rates
- Delivery zones
- Payment methods

### Security Configuration
- JWT expiration times
- 2FA settings
- Encryption parameters
- File upload limits

## 📧 Notifications

The system includes automated notifications for:
- Order confirmations
- Delivery updates
- Low stock alerts
- Payment confirmations
- Support ticket updates

## 🧪 Testing

Run the test suite:
```bash
npm test
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the support team through the in-app support system
- Check the documentation in the `/docs` folder

## 🔄 Updates

### Recent Features
- **Marketplace Integration** - Purchase medicines from external suppliers
- **Enhanced Transaction System** - Delivery tracking and marketplace support
- **Sales Analytics** - Comprehensive sales reporting
- **Improved Security** - Enhanced encryption and key management

### Upcoming Features
- Mobile app integration
- Advanced inventory forecasting
- Multi-location support
- Advanced reporting dashboard

---

**Version:** 1.0.0  
**Last Updated:** 2024