import QuestionPacket from '../models/QuestionPacket.js';
import UserLevel from '../models/UserLevel.js';
import QuestionPacketAnswer from '../models/QuestionPacketAnswer.js';
import UserAnswer from '../models/UserAnswer.js';


export const createQuestionPacket = async (req, res) => {
  try {
    const { packetTitle, packetDescription, subjectCategory, difficultyLevel, questionType, questions } = req.body;

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
      questions
    });

    await questionPacket.save();

    res.status(201).json({
      success: true,
      message: 'Question packet created successfully',
      data: questionPacket
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
    const { subject, difficulty, status } = req.query;
    
    let filter = {};
    
    if (subject) filter.subject = subject;
    if (difficulty) filter.difficultyLevel = difficulty;
    if (status) filter.status = status;

    const questionPackets = await QuestionPacket.find(filter)
      .populate('subject', 'name description icon category')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: questionPackets
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
    
    const questionPacket = await QuestionPacket.findById(id)
      .populate('subject', 'name description icon category');

    if (!questionPacket) {
      return res.status(404).json({
        success: false,
        message: 'Question packet not found'
      });
    }

    res.status(200).json({
      success: true,
      data: questionPacket
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


    if (updateData.questions && updateData.questions.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'A question packet must contain exactly 10 questions'
      });
    }

    const questionPacket = await QuestionPacket.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('subject', 'name description icon category');

    if (!questionPacket) {
      return res.status(404).json({
        success: false,
        message: 'Question packet not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Question packet updated successfully',
      data: questionPacket
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


    if (!answers || answers.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'You must answer all 10 questions'
      });
    }


    let correctAnswers = 0;
    const answerResults = [];

    for (let i = 0; i < 10; i++) {
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

    const score = (correctAnswers / 10) * 100;
    const isCompleted = correctAnswers === 10;


    const questionPacketAnswer = new QuestionPacketAnswer({
      userId,
      questionPacketId,
      branchId: null, // No longer using branch reference
      category: questionPacket.subjectCategory,
      answers: answerResults,
      correctAnswers,
      totalQuestions: 10,
      score,
      isCompleted
    });

    await questionPacketAnswer.save();


    let levelUpdated = false;
    if (isCompleted) {
      const userLevel = await UserLevel.findOne({
        userId,
        branchId: questionPacket.subject._id
      });

      if (userLevel) {

        userLevel.currentLevel += 1;
        

        userLevel.completedLevels.push({
          level: userLevel.currentLevel - 1,
          completedAt: new Date(),
          questionsAnswered: 10,
          correctAnswers: 10,
          totalQuestions: 10
        });


        userLevel.totalQuestionsAnswered += 10;
        userLevel.totalCorrectAnswers += 10;

        await userLevel.save();
        levelUpdated = true;


        questionPacketAnswer.levelUpdated = true;
        await questionPacketAnswer.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Answers submitted successfully',
      data: {
        correctAnswers,
        totalQuestions: 10,
        score,
        isCompleted,
        results: answerResults,
        levelUpdated
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


    const questionPacket = await QuestionPacket.findById(questionPacketId)
    
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


    const optionIndex = question.options.findIndex(option => option === userAnswer);
    
    if (optionIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid answer option'
      });
    }


    const existingAnswer = await UserAnswer.findOne({
      userId,
      questionId: `${questionPacketId}_${questionIndex}` // Create unique ID for packet question
    });

    let userAnswerRecord;
    if (existingAnswer) {

      existingAnswer.selectedOptionIndex = optionIndex;
      existingAnswer.isCorrect = isCorrect;
      existingAnswer.answeredAt = new Date();
      await existingAnswer.save();
      userAnswerRecord = existingAnswer;
    } else {

      userAnswerRecord = new UserAnswer({
        userId,
        questionId: `${questionPacketId}_${questionIndex}`,
        branchId: null, // No longer using branch reference
        category: questionPacket.subjectCategory,
        selectedOptionIndex: optionIndex,
        isCorrect,
        pointsEarned: isCorrect ? 1 : 0
      });
      await userAnswerRecord.save();
    }


    const totalAnswered = await UserAnswer.countDocuments({
      userId,
      questionId: { $regex: `^${questionPacketId}_` }
    });

    const totalCorrect = await UserAnswer.countDocuments({
      userId,
      questionId: { $regex: `^${questionPacketId}_` },
      isCorrect: true
    });

    const isPacketCompleted = totalAnswered === questionPacket.questions.length;
    const allCorrect = totalCorrect === questionPacket.questions.length;


    let levelUpdated = false;
    if (isPacketCompleted && allCorrect) {
      const userLevel = await UserLevel.findOne({
        userId,
        branchId: questionPacket.subject._id
      });

      if (userLevel) {

        userLevel.currentLevel += 1;
        

        userLevel.completedLevels.push({
          level: userLevel.currentLevel - 1,
          completedAt: new Date(),
          questionsAnswered: questionPacket.questions.length,
          correctAnswers: questionPacket.questions.length,
          totalQuestions: questionPacket.questions.length
        });


        userLevel.totalQuestionsAnswered += questionPacket.questions.length;
        userLevel.totalCorrectAnswers += questionPacket.questions.length;

        await userLevel.save();
        levelUpdated = true;
      }
    }

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
          answered: totalAnswered,
          total: questionPacket.questions.length,
          correct: totalCorrect,
          isCompleted: isPacketCompleted,
          allCorrect
        },
        levelUpdated
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
    const { questionPacketId } = req.params;
    const userId = req.user.id;


    const questionPacket = await QuestionPacket.findById(questionPacketId)
    
    if (!questionPacket) {
      return res.status(404).json({
        success: false,
        message: 'Question packet not found'
      });
    }


    const userAnswers = await UserAnswer.find({
      userId,
      questionId: { $regex: `^${questionPacketId}_` }
    });


    const progressMap = {};
    let totalCorrect = 0;

    userAnswers.forEach(answer => {
      const questionIndex = parseInt(answer.questionId.split('_').pop());
      progressMap[questionIndex] = {
        userAnswer: questionPacket.questions[questionIndex].options[answer.selectedOptionIndex],
        isCorrect: answer.isCorrect,
        answeredAt: answer.answeredAt
      };
      if (answer.isCorrect) totalCorrect++;
    });

    const totalAnswered = userAnswers.length;
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
    const { packetTitle, packetDescription, subject, difficultyLevel, questionType, questions } = req.body;

    const questionPacket = new QuestionPacket({
      packetTitle,
      packetDescription,
      subject,
      difficultyLevel,
      questionType,
      questions: questions || [], // Allow empty questions for draft
      status: 'Draft'
    });

    await questionPacket.save();

    res.status(201).json({
      success: true,
      message: 'Question packet saved as draft',
      data: questionPacket
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
