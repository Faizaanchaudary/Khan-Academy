import mongoose from 'mongoose';

const userLevelSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    enum: ['math', 'reading_writing'],
    index: true
  },
  currentLevel: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  completedLevels: [{
    level: {
      type: Number,
      required: true
    },
    completedAt: {
      type: Date,
      default: Date.now
    },
    questionsAnswered: {
      type: Number,
      default: 0
    },
    correctAnswers: {
      type: Number,
      default: 0
    },
    totalQuestions: {
      type: Number,
      default: 10
    }
  }],
  totalQuestionsAnswered: {
    type: Number,
    default: 0
  },
  totalCorrectAnswers: {
    type: Number,
    default: 0
  },
  isUnlocked: {
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

userLevelSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

userLevelSchema.index({ userId: 1, branchId: 1 }, { unique: true });
userLevelSchema.index({ userId: 1, category: 1 });
userLevelSchema.index({ branchId: 1, currentLevel: 1 });

const UserLevel = mongoose.model('UserLevel', userLevelSchema);

export default UserLevel;