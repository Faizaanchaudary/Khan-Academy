import mongoose from 'mongoose';

const questionPacketAnswerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  questionPacketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuestionPacket',
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
  answers: [{
    questionIndex: {
      type: Number,
      required: true
    },
    userAnswer: {
      type: String,
      required: true,
      trim: true
    },
    correctAnswer: {
      type: String,
      required: true,
      trim: true
    },
    isCorrect: {
      type: Boolean,
      required: true
    },
    explanation: {
      type: String,
      trim: true
    }
  }],
  correctAnswers: {
    type: Number,
    required: true,
    default: 0
  },
  totalQuestions: {
    type: Number,
    required: true,
    default: 10
  },
  score: {
    type: Number,
    required: true,
    default: 0
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  levelUpdated: {
    type: Boolean,
    default: false
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

questionPacketAnswerSchema.index({ userId: 1, questionPacketId: 1 }, { unique: true });
questionPacketAnswerSchema.index({ userId: 1, branchId: 1 });
questionPacketAnswerSchema.index({ userId: 1, category: 1 });
questionPacketAnswerSchema.index({ submittedAt: -1 });

const QuestionPacketAnswer = mongoose.model('QuestionPacketAnswer', questionPacketAnswerSchema);

export default QuestionPacketAnswer;
