import QuestionPacket from '../models/QuestionPacket.js';
import QuestionPacketAnswer from '../models/QuestionPacketAnswer.js';
import UserAnswer from '../models/UserAnswer.js';
import Branch from '../models/Branch.js';

// Utility function to calculate progress for a question packet
const calculateProgress = (questions, userAnswers = []) => {
  const totalQuestions = questions ? questions.length : 0;
  const answeredQuestions = userAnswers ? userAnswers.length : 0;
  
  return {
    current: answeredQuestions,
    max: totalQuestions,
    percentage: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0,
    isComplete: answeredQuestions >= totalQuestions && totalQuestions > 0,
    status: answeredQuestions === 0 ? 'empty' : 
            answeredQuestions < totalQuestions ? 'incomplete' : 'complete'
  };
};


export const createQuestionPacket = async (req, res) => {
  try {
    const { packetTitle, packetDescription, subjectCategory, difficultyLevel, questionType, questions, category } = req.body;

    // Ensure at least 1 question
    if (!questions || questions.length < 1) {
      return res.status(400).json({
        success: false,
        message: 'A question packet must contain at least 1 question'
      });
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (!question.questionText || !question.options || !question.correctAnswer || !question.reasonForCorrectAnswer) {
        return res.status(400).json({
          success: false,
          message: `Question ${i + 1} is missing required fields`
        });
      }
      if (question.options.length !== 4) {
        return res.status(400).json({
          success: false,
          message: `Question ${i + 1} must have exactly 4 options`
        });
      }
    }

    const questionPacket = new QuestionPacket({
      packetTitle,
      packetDescription,
      subjectCategory,
      difficultyLevel,
      questionType,
      questions,
      category
    });

    await questionPacket.save();

    // Add progress information
    const packetWithProgress = {
      ...questionPacket.toObject(),
      progress: calculateProgress(questionPacket.questions)
    };

    res.status(201).json({
      success: true,
      message: 'Question packet created successfully',
      data: packetWithProgress
    });
  } catch (error) {
    console.error('Error creating question packet:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};



export const getQuestionPackets = async (req, res) => {
  try {
    const { subject, difficulty, status, category, minQuestions, maxQuestions } = req.query;
    const userId = req.user.id;
    
    let filter = {};
    
    // Map frontend filter names to database field names
    if (subject) {
      // Convert frontend subject names to database values
      if (subject === 'Math') {
        filter.subjectCategory = 'Maths';
      } else if (subject === 'Reading & Writing') {
        filter.subjectCategory = 'Reading & Writing';
      } else {
        filter.subjectCategory = subject;
      }
    }
    if (difficulty) filter.difficultyLevel = difficulty;
    if (status) filter.status = status;
    if (category) filter.category = category;
    
    // Filter by number of questions
    if (minQuestions || maxQuestions) {
      filter.numberOfQuestions = {};
      if (minQuestions) filter.numberOfQuestions.$gte = parseInt(minQuestions);
      if (maxQuestions) filter.numberOfQuestions.$lte = parseInt(maxQuestions);
    }

    console.log('Filter applied:', filter);
    
    const questionPackets = await QuestionPacket.find(filter)
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for better performance

    console.log('Found question packets:', questionPackets.length);

    // Get user's answers for all question packets
    const packetIds = questionPackets.map(packet => packet._id);
    const userAnswers = await QuestionPacketAnswer.find({
      userId,
      questionPacketId: { $in: packetIds }
    }).lean();

    // Create a map of packetId -> answers for quick lookup
    const answersMap = {};
    userAnswers.forEach(answer => {
      answersMap[answer.questionPacketId.toString()] = answer.answers || [];
    });

    // Add progress information to each packet based on user's actual progress
    const packetsWithProgress = questionPackets.map(packet => ({
      ...packet,
      progress: calculateProgress(packet.questions, answersMap[packet._id.toString()] || [])
    }));

    console.log('Packets with progress:', packetsWithProgress.length);

    res.status(200).json({
      success: true,
      message: 'Question packets retrieved successfully',
      data: packetsWithProgress
    });
  } catch (error) {
    console.error('Error fetching question packets:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


export const getQuestionPacketById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const questionPacket = await QuestionPacket.findById(id).lean();

    if (!questionPacket) {
      return res.status(404).json({
        success: false,
        message: 'Question packet not found'
      });
    }

    // Get user's answers for this specific question packet
    const userAnswer = await QuestionPacketAnswer.findOne({
      userId,
      questionPacketId: id
    }).lean();

    const userAnswers = userAnswer ? userAnswer.answers || [] : [];

    // Add progress information based on user's actual progress
    const packetWithProgress = {
      ...questionPacket,
      progress: calculateProgress(questionPacket.questions, userAnswers)
    };

    res.status(200).json({
      success: true,
      data: packetWithProgress
    });
  } catch (error) {
    console.error('Error fetching question packet:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


export const updateQuestionPacket = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Allow flexible number of questions for updates (1, 2, 3, 4, etc.)
    
    const questionPacket = await QuestionPacket.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!questionPacket) {
      return res.status(404).json({
        success: false,
        message: 'Question packet not found'
      });
    }

    // Add progress information
    const packetWithProgress = {
      ...questionPacket.toObject(),
      progress: calculateProgress(questionPacket.questions)
    };

    res.status(200).json({
      success: true,
      message: 'Question packet updated successfully',
      data: packetWithProgress
    });
  } catch (error) {
    console.error('Error updating question packet:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


export const deleteQuestionPacket = async (req, res) => {
  try {
    const { id } = req.params;

    const questionPacket = await QuestionPacket.findByIdAndDelete(id);

    if (!questionPacket) {
      return res.status(404).json({
        success: false,
        message: 'Question packet not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Question packet deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting question packet:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


export const submitQuestionPacketAnswers = async (req, res) => {
  try {
    const { questionPacketId, answers } = req.body;
    const userId = req.user.id;


    const questionPacket = await QuestionPacket.findById(questionPacketId)
    
    if (!questionPacket) {
      return res.status(404).json({
        success: false,
        message: 'Question packet not found'
      });
    }


    const totalQuestionsInPacket = questionPacket.questions.length;

    if (!answers || answers.length !== totalQuestionsInPacket) {
      return res.status(400).json({
        success: false,
        message: `You must answer all ${totalQuestionsInPacket} questions`
      });
    }


    let correctAnswers = 0;
    const answerResults = [];

    for (let i = 0; i < totalQuestionsInPacket; i++) {
      const userAnswer = answers[i];
      const correctAnswer = questionPacket.questions[i].correctAnswer;
      const isCorrect = userAnswer === correctAnswer;
      
      if (isCorrect) correctAnswers++;

      answerResults.push({
        questionIndex: i,
        userAnswer,
        correctAnswer,
        isCorrect,
        explanation: questionPacket.questions[i].reasonForCorrectAnswer
      });
    }

    const score = (correctAnswers / totalQuestionsInPacket) * 100;
    const isCompleted = correctAnswers === totalQuestionsInPacket;


    const questionPacketAnswer = new QuestionPacketAnswer({
      userId,
      questionPacketId,
      branchId: null, // No longer using branch reference
      category: questionPacket.subjectCategory,
      answers: answerResults,
      correctAnswers,
      totalQuestions: totalQuestionsInPacket,
      score,
      isCompleted
    });

    await questionPacketAnswer.save();


    res.status(200).json({
      success: true,
      message: 'Answers submitted successfully',
      data: {
        correctAnswers,
        totalQuestions: totalQuestionsInPacket,
        score,
        isCompleted,
        results: answerResults
      }
    });
  } catch (error) {
    console.error('Error submitting answers:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


export const answerIndividualQuestion = async (req, res) => {
  try {
    const { questionPacketId, questionIndex, userAnswer } = req.body;
    const userId = req.user.id;

    const questionPacket = await QuestionPacket.findById(questionPacketId);
    
    if (!questionPacket) {
      return res.status(404).json({
        success: false,
        message: 'Question packet not found'
      });
    }

    if (questionIndex < 0 || questionIndex >= questionPacket.questions.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question index'
      });
    }

    const question = questionPacket.questions[questionIndex];
    const isCorrect = userAnswer === question.correctAnswer;

    // Map subjectCategory to the correct enum values
    const categoryMap = {
      'Maths': 'math',
      'Reading & Writing': 'reading_writing'
    };

    // Get or create a "Question Packets" branch for tracking
    let questionPacketsBranch = await Branch.findOne({ name: 'Question Packets' });
    if (!questionPacketsBranch) {
      questionPacketsBranch = new Branch({
        name: 'Question Packets',
        description: 'Practice question packets for skill building',
        category: 'math', // Default category
        icon: 'book-icon.svg'
      });
      await questionPacketsBranch.save();
    }

    // Find existing packet answer record
    let packetAnswer = await QuestionPacketAnswer.findOne({
      userId,
      questionPacketId
    });

    if (!packetAnswer) {
      // Create new packet answer record
      packetAnswer = new QuestionPacketAnswer({
        userId,
        questionPacketId,
        branchId: questionPacketsBranch._id,
        category: categoryMap[questionPacket.subjectCategory] || 'math',
        answers: [],
        correctAnswers: 0,
        totalQuestions: questionPacket.questions.length,
        score: 0,
        isCompleted: false
      });
    }

    // Update or add the specific question answer
    const existingAnswerIndex = packetAnswer.answers.findIndex(
      answer => answer.questionIndex === questionIndex
    );

    const answerData = {
      questionIndex,
      userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      explanation: question.reasonForCorrectAnswer
    };

    if (existingAnswerIndex >= 0) {
      // Update existing answer
      packetAnswer.answers[existingAnswerIndex] = answerData;
    } else {
      // Add new answer
      packetAnswer.answers.push(answerData);
    }

    // Recalculate stats
    packetAnswer.correctAnswers = packetAnswer.answers.filter(a => a.isCorrect).length;
    packetAnswer.score = Math.round((packetAnswer.correctAnswers / packetAnswer.totalQuestions) * 100);
    packetAnswer.isCompleted = packetAnswer.answers.length === packetAnswer.totalQuestions;

    await packetAnswer.save();

    res.status(200).json({
      success: true,
      message: 'Answer submitted successfully',
      data: {
        questionIndex,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.reasonForCorrectAnswer,
        progress: {
          answered: packetAnswer.answers.length,
          total: packetAnswer.totalQuestions,
          correct: packetAnswer.correctAnswers,
          isCompleted: packetAnswer.isCompleted,
          score: packetAnswer.score
        }
      }
    });
  } catch (error) {
    console.error('Error answering individual question:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


export const getQuestionPacketProgress = async (req, res) => {
  try {
    const { id: questionPacketId } = req.params;
    const userId = req.user.id;


    const questionPacket = await QuestionPacket.findById(questionPacketId)
    
    if (!questionPacket) {
      return res.status(404).json({
        success: false,
        message: 'Question packet not found'
      });
    }


    // Get user's answers from QuestionPacketAnswer model
    const packetAnswer = await QuestionPacketAnswer.findOne({
      userId,
      questionPacketId
    });

    const progressMap = {};
    let totalCorrect = 0;
    let totalAnswered = 0;

    if (packetAnswer && packetAnswer.answers) {
      packetAnswer.answers.forEach(answer => {
        const questionIndex = answer.questionIndex;
        progressMap[questionIndex] = {
          userAnswer: answer.userAnswer,
          isCorrect: answer.isCorrect,
          answeredAt: answer.answeredAt || new Date()
        };
        if (answer.isCorrect) totalCorrect++;
        totalAnswered++;
      });
    }
    const isCompleted = totalAnswered === questionPacket.questions.length;
    const allCorrect = totalCorrect === questionPacket.questions.length;

    res.status(200).json({
      success: true,
      data: {
        questionPacketId,
        progress: {
          answered: totalAnswered,
          total: questionPacket.questions.length,
          correct: totalCorrect,
          score: questionPacket.questions.length > 0 ? (totalCorrect / questionPacket.questions.length) * 100 : 0,
          isCompleted,
          allCorrect
        },
        answers: progressMap,
        questions: questionPacket.questions.map((q, index) => ({
          index,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.reasonForCorrectAnswer,
          isAnswered: progressMap[index] ? true : false,
          userAnswer: progressMap[index]?.userAnswer || null,
          isCorrect: progressMap[index]?.isCorrect || false
        }))
      }
    });
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


export const saveAsDraft = async (req, res) => {
  try {
    const { packetTitle, packetDescription, subject, difficultyLevel, questionType, questions, category } = req.body;

    const questionPacket = new QuestionPacket({
      packetTitle,
      packetDescription,
      subject,
      difficultyLevel,
      questionType,
      questions: questions || [], // Allow empty questions for draft
      status: 'Draft',
      category
    });

    await questionPacket.save();

    // Add progress information
    const packetWithProgress = {
      ...questionPacket.toObject(),
      progress: calculateProgress(questionPacket.questions)
    };

    res.status(201).json({
      success: true,
      message: 'Question packet saved as draft',
      data: packetWithProgress
    });
  } catch (error) {
    console.error('Error saving draft:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
