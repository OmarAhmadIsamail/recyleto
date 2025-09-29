const mongoose = require('mongoose');
const request = require('supertest');
const app = require('./server'); // Your Express app
const User = require('./models/User');
const Cart = require('./models/Cart');
const Medicine = require('./models/Medicine');

// Test data
let testUser, testMedicine, testToken;

async function setupTestData() {
  // Connect to test database
  await mongoose.connect(process.env.MONGODB_URI_TEST);
  
  // Create test user
  testUser = await User.create({
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    role: 'customer'
  });
  
  // Create test medicine
  testMedicine = await Medicine.create({
    name: 'Test Medicine',
    genericName: 'Test Generic',
    form: 'tablet',
    price: 10.99,
    stock: 100
  });
  
  // Create test cart
  await Cart.create({
    userId: testUser._id,
    items: [{
      medicineId: testMedicine._id,
      quantity: 2,
      expiryDate: new Date('2025-12-31')
    }]
  });
  
  // Generate test token (you might need to adjust this based on your auth system)
  testToken = 'your_generated_jwt_token_here';
}

async function testCheckout() {
  try {
    await setupTestData();
    
    // Test 1: Get transaction summary
    console.log('Testing transaction summary...');
    const summaryResponse = await request(app)
      .get('/api/checkout/summary')
      .set('Authorization', `Bearer ${testToken}`);
    
    console.log('Summary response:', summaryResponse.status, summaryResponse.body);
    
    // Test 2: Process checkout
    console.log('Testing checkout process...');
    const checkoutResponse = await request(app)
      .post('/api/checkout/process')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        paymentMethod: 'cash',
        customerInfo: {
          name: 'Test Customer',
          phone: '1234567890'
        },
        receiptOptions: {
          print: true,
          email: false,
          sms: false
        },
        transactionNotes: 'Test transaction'
      });
    
    console.log('Checkout response:', checkoutResponse.status, checkoutResponse.body);
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testCheckout();