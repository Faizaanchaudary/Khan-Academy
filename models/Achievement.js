import mongoose from 'mongoose';

const achievementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  icon: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['math', 'reading_writing'],
    index: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
    index: true
  },
  requirements: {
    type: {
      levelsCompleted: {
        type: Number,
        required: true,
        default: 10
      },
      questionsAnswered: {
        type: Number,
        required: false,
        default: null
      },
      correctAnswers: {
        type: Number,
        required: false,
        default: null
      },
      timeLimit: {
        type: Number,
        required: false,
        default: null
      },
      isDaily: {
        type: Boolean,
        default: false
      },
      timeFrame: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'lifetime'],
        default: 'lifetime'
      }
    },
    required: true
  },
  pointsReward: {
    type: Number,
    default: 100
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

achievementSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

achievementSchema.index({ category: 1, branchId: 1 });
achievementSchema.index({ isActive: 1 });

const Achievement = mongoose.model('Achievement', achievementSchema);

export default Achievement;