import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  tagline: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  billingCycle: {
    type: String,
    required: true,
    enum: ['monthly', 'annual'],
    default: 'monthly'
  },
  trialDays: {
    type: Number,
    default: 0,
    min: 0
  },
  features: [{
    type: String,
    required: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

planSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Plan = mongoose.model('Plan', planSchema);

export default Plan;