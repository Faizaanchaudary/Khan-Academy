import mongoose from 'mongoose';

const userAchievementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  achievementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement',
    required: true,
    index: true
  },
  progress: {
    levelsCompleted: {
      type: Number,
      default: 0
    },
    questionsAnswered: {
      type: Number,
      default: 0
    },
    correctAnswers: {
      type: Number,
      default: 0
    },
    totalRequired: {
      type: Number,
      required: true
    },
    dailyProgress: {
      type: Number,
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    }
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  pointsEarned: {
    type: Number,
    default: 0
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

userAchievementSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  if (!this.isCompleted && this.progress.levelsCompleted >= this.progress.totalRequired) {
    this.isCompleted = true;
    this.completedAt = new Date();
  }
  
  next();
});

userAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
userAchievementSchema.index({ userId: 1, isCompleted: 1 });
userAchievementSchema.index({ achievementId: 1 });

const UserAchievement = mongoose.model('UserAchievement', userAchievementSchema);

export default UserAchievement;