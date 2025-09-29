const mongoose = require('mongoose');
const Medicine = require('./models/Medicine'); // Adjust path if needed

async function testMedicine() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27018/recyleto'); // use correct port
    console.log('Connected to MongoDB');

    const medicineId = "68aba5fc8e6b2524a5e766b3";
    const medicine = await Medicine.findById(medicineId);

    if (!medicine) {
      console.log('Medicine not found!');
    } else {
      console.log('Medicine found:', medicine);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

testMedicine();
