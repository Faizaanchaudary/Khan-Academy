import mongoose from 'mongoose';

const userAnswerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  questionId: {
    type: String,
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
  selectedOptionIndex: {
    type: Number,
    required: true
  },
  isCorrect: {
    type: Boolean,
    required: true
  },
  pointsEarned: {
    type: Number,
    default: 0
  },
  timeSpent: {
    type: Number,
    default: 0
  },
  answeredAt: {
    type: Date,
    default: Date.now
  }
});

userAnswerSchema.index({ userId: 1, questionId: 1 }, { unique: true });
userAnswerSchema.index({ userId: 1, branchId: 1 });
userAnswerSchema.index({ userId: 1, category: 1 });

const UserAnswer = mongoose.model('UserAnswer', userAnswerSchema);

export default UserAnswer;
