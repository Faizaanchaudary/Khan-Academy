import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  icon: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['math', 'reading_writing'],
    index: true
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

branchSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

branchSchema.index({ category: 1 });

const Branch = mongoose.model('Branch', branchSchema);

export default Branch;