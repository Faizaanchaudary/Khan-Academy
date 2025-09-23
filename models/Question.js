import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
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
  questionNumber: {
    type: Number,
    required: true
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    index: true
  },
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  equation: {
    type: String,
    trim: true
  },
  options: [{
    optionText: {
      type: String,
      required: true,
      trim: true
    },
    isCorrect: {
      type: Boolean,
      default: false
    }
  }],
  correctAnswerIndex: {
    type: Number,
    required: true
  },
  correctAnswerExplanation: {
    type: String,
    trim: true
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

questionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

questionSchema.index({ branchId: 1, level: 1, questionNumber: 1 }, { unique: true });
questionSchema.index({ category: 1, branchId: 1 });
questionSchema.index({ branchId: 1, level: 1 });
questionSchema.index({ isActive: 1 });

const Question = mongoose.model('Question', questionSchema);

export default Question;