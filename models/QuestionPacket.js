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
  subjectCategory: {
    type: String,
    required: true,
    enum: ['Maths', 'Reading & Writing'],
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
    enum: ['Multiple Choice', 'True/False', 'Fill in the Blanks'],
    default: 'Multiple Choice'
  },
  status: {
    type: String,
    required: true,
    enum: ['Active', 'Draft'],
    default: 'Active',
    index: true
  },
  questions: {
    type: [questionSchema],
    validate: {
      validator: function(questions) {
        return questions.length > 0;
      },
      message: 'A question packet must contain at least 1 question'
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

questionPacketSchema.index({ subjectCategory: 1, difficultyLevel: 1 });
questionPacketSchema.index({ subjectCategory: 1, status: 1 });
questionPacketSchema.index({ status: 1 });

const QuestionPacket = mongoose.model('QuestionPacket', questionPacketSchema);

export default QuestionPacket;
