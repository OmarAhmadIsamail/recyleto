const mongoose = require('mongoose');

const deliveryAddressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 100
  },
  address: {
    type: String,
    required: true,
    maxlength: 255
  },
  city: {
    type: String,
    required: true,
    maxlength: 100
  },
  state: {
    type: String,
    required: true,
    maxlength: 100
  },
  zipCode: {
    type: String,
    required: true,
    maxlength: 20
  },
  phone: {
    type: String,
    required: true,
    maxlength: 20
  },
  landmark: {
    type: String,
    maxlength: 255
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Ensure only one default address per user
deliveryAddressSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

module.exports = mongoose.model('DeliveryAddress', deliveryAddressSchema);