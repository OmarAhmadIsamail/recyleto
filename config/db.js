const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check if MONGO_URI exists in environment variables
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI environment variable is not set!');
      process.exit(1);
    }
    
    // Connect with updated options
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Optional: Log more detailed connection info
    console.log(`Database Name: ${conn.connection.name}`);
    console.log(`Connection State: ${conn.connection.readyState === 1 ? 'Connected' : 'Not Connected'}`);
    
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
};

module.exports = connectDB;