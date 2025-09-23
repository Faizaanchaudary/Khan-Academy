import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  options: [{
    type: String,
    required: true,
    trim: true
  }],
  correctAnswer: {
    type: String,
    required: true,
    trim: true
  },
  reasonForCorrectAnswer: {
    type: String,
    required: true,
    trim: true
  }
});

const questionPacketSchema = new mongoose.Schema({
  packetTitle: {
    type: String,
    required: true,
    trim: true
  },
  packetDescription: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
    index: true
  },
  difficultyLevel: {
    type: String,
    required: true,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    index: true
  },
  questionType: {
    type: String,
    required: true,
    enum: ['Multiple Choice', 'True/False', 'Fill in the Blank'],
    default: 'Multiple Choice'
  },
  status: {
    type: String,
    required: true,
    enum: ['Active', 'Draft'],
    default: 'Draft',
    index: true
  },
  questions: {
    type: [questionSchema],
    validate: {
      validator: function(questions) {
        return questions.length === 10;
      },
      message: 'A question packet must contain exactly 10 questions'
    }
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

questionPacketSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

questionPacketSchema.index({ subject: 1, difficultyLevel: 1 });
questionPacketSchema.index({ subject: 1, status: 1 });
questionPacketSchema.index({ status: 1 });

const QuestionPacket = mongoose.model('QuestionPacket', questionPacketSchema);

export default QuestionPacket;
