import mongoose from 'mongoose';

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  blacklistedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

tokenBlacklistSchema.index({ token: 1 });
tokenBlacklistSchema.index({ userId: 1 });
tokenBlacklistSchema.index({ expiresAt: 1 });

tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('TokenBlacklist', tokenBlacklistSchema);