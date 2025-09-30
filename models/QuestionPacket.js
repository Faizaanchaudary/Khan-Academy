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
  category: {
    type: String,
    required: false,
    trim: true
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
  numberOfQuestions: {
    type: Number,
    required: true,
    default: 1,
    min: 1
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
  
  // Auto-update numberOfQuestions based on questions array length
  if (this.questions && Array.isArray(this.questions)) {
    this.numberOfQuestions = this.questions.length;
  }
  
  next();
});

// Virtual field for progress calculation
questionPacketSchema.virtual('progress').get(function() {
  const totalQuestions = this.questions ? this.questions.length : 0;
  const maxQuestions = 10; // Standard maximum for progress calculation
  
  return {
    current: totalQuestions,
    max: maxQuestions,
    percentage: totalQuestions > 0 ? Math.round((totalQuestions / maxQuestions) * 100) : 0,
    isComplete: totalQuestions >= maxQuestions,
    status: totalQuestions === 0 ? 'empty' : 
            totalQuestions < maxQuestions ? 'incomplete' : 'complete'
  };
});

// Ensure virtual fields are included in JSON output
questionPacketSchema.set('toJSON', { virtuals: true });
questionPacketSchema.set('toObject', { virtuals: true });

questionPacketSchema.index({ subjectCategory: 1, difficultyLevel: 1 });
questionPacketSchema.index({ subjectCategory: 1, status: 1 });
questionPacketSchema.index({ status: 1 });
questionPacketSchema.index({ category: 1 });
questionPacketSchema.index({ numberOfQuestions: 1 });

const QuestionPacket = mongoose.model('QuestionPacket', questionPacketSchema);

export default QuestionPacket;
