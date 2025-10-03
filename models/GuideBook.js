import mongoose from 'mongoose';

const guideBookSchema = new mongoose.Schema({
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    sections: [{
      heading: {
        type: String,
        required: true,
        trim: true
      },
      content: [{
        type: String,
        required: true,
        trim: true
      }]
    }]
  },
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

guideBookSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

guideBookSchema.index({ branchId: 1 });
guideBookSchema.index({ isActive: 1 });

const GuideBook = mongoose.model('GuideBook', guideBookSchema);

export default GuideBook;
