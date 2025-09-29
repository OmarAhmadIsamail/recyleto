const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['user', 'support'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  attachments: [{
    filename: String,
    path: String,
    originalName: String
  }]
});

const supportTicketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    unique: true,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    enum: ['Technical Issue', 'Billing', 'Account', 'Feature Request', 'General Inquiry', 'Other']
  },
  priority: {
    type: String,
    required: true,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open'
  },
  messages: [messageSchema],
  userInfo: {
    appVersion: String,
    deviceInfo: String,
    os: String
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate ticket number before saving - UPDATED to match your Counter model
supportTicketSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      const Counter = mongoose.model('Counter');
      const counter = await Counter.findOneAndUpdate(
        { name: 'supportTicketNumber' }, // Use 'name' field instead of '_id'
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      
      this.ticketNumber = `TKT${String(counter.seq).padStart(6, '0')}`;
      next();
    } catch (error) {
      console.error('Error generating ticket number:', error);
      // Fallback: generate based on timestamp
      this.ticketNumber = `TKT${Date.now()}${Math.floor(Math.random() * 1000)}`;
      next();
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('SupportTicket', supportTicketSchema);