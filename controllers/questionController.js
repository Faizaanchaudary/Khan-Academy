import Question from '../models/Question.js';
import UserAnswer from '../models/UserAnswer.js';
import Branch from '../models/Branch.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { checkAchievementProgress } from './achievementController.js';
import { initializeUserLevel } from './levelController.js';

const updateUserLevelProgress = async (userId, branchId, category, questionLevel, isCorrect) => {
  try {
    const UserLevel = (await import('../models/UserLevel.js')).default;
    const UserAnswer = (await import('../models/UserAnswer.js')).default;
    const Question = (await import('../models/Question.js')).default;

    let userLevel = await UserLevel.findOne({ userId, branchId });
    if (!userLevel) {
      console.error('User level not found for progress update');
      return false;
    }

    if (questionLevel !== userLevel.currentLevel) {
      return false;
    }

    const questionsInLevel = await Question.find({
      branchId,
      category,
      level: questionLevel
    });

    const questionIdsInLevel = questionsInLevel.map(q => q._id);
    const questionsAnsweredInLevel = await UserAnswer.countDocuments({
      userId,
      questionId: { $in: questionIdsInLevel }
    });

    const correctAnswersInLevel = await UserAnswer.countDocuments({
      userId,
      questionId: { $in: questionIdsInLevel },
      isCorrect: true
    });

    userLevel.totalQuestionsAnswered = questionsAnsweredInLevel;
    userLevel.totalCorrectAnswers = correctAnswersInLevel;

    const questionsPerLevel = 10;
    const isLevelCompleted = questionsAnsweredInLevel >= questionsPerLevel && correctAnswersInLevel >= questionsPerLevel;

    if (isLevelCompleted) {
      const completedLevel = {
        level: questionLevel,
        completedAt: new Date(),
        questionsAnswered: questionsAnsweredInLevel,
        correctAnswers: correctAnswersInLevel,
        totalQuestions: questionsPerLevel
      };

      userLevel.completedLevels.push(completedLevel);
      
      if (userLevel.currentLevel < 10) {
        userLevel.currentLevel = userLevel.currentLevel + 1;
      }

      console.log(`🎉 User completed level ${questionLevel}! Advanced to level ${userLevel.currentLevel}`);
    }

    await userLevel.save();
    return true;
  } catch (error) {
    console.error('Error updating user level progress:', error);
    return false;
  }
};

export const getAllQuestions = async (req, res) => {
  try {
    const { branchId, category } = req.query;
    
    let filter = { isActive: true };
    
    if (branchId) {
      filter.branchId = branchId;
    }
    
    if (category) {
      filter.category = category;
    }

    const questions = await Question.find(filter)
      .populate('branchId', 'name category')
      .sort({ category: 1, branchId: 1, questionNumber: 1 })
      .lean();

    sendSuccess(res, 'Questions retrieved successfully', { questions });
  } catch (error) {
    console.error('Get questions error:', error);
    sendError(res, 'Internal server error while retrieving questions');
  }
};

export const getQuestionsByBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return sendError(res, 'Branch not found', 404);
    }

    const questions = await Question.find({ 
      branchId, 
      isActive: true 
    }).sort({ questionNumber: 1 }).lean();

    sendSuccess(res, 'Questions retrieved successfully', { 
      branch: {
        _id: branch._id,
        name: branch.name,
        category: branch.category
      },
      questions 
    });
  } catch (error) {
    console.error('Get questions by branch error:', error);
    sendError(res, 'Internal server error while retrieving questions');
  }
};

export const getQuestionsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
    if (!['math', 'reading_writing'].includes(category)) {
      return sendError(res, 'Invalid category. Must be math or reading_writing', 400);
    }

    const questions = await Question.find({ 
      category, 
      isActive: true 
    })
    .populate('branchId', 'name category')
    .sort({ branchId: 1, questionNumber: 1 })
    .lean();

    const groupedQuestions = questions.reduce((acc, question) => {
      const branchName = question.branchId.name;
      if (!acc[branchName]) {
        acc[branchName] = [];
      }
      acc[branchName].push(question);
      return acc;
    }, {});

    sendSuccess(res, 'Questions retrieved successfully', { 
      category,
      groupedQuestions 
    });
  } catch (error) {
    console.error('Get questions by category error:', error);
    sendError(res, 'Internal server error while retrieving questions');
  }
};

export const getQuestionById = async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await Question.findById(questionId)
      .populate('branchId', 'name category');
    
    if (!question) {
      return sendError(res, 'Question not found', 404);
    }

    sendSuccess(res, 'Question retrieved successfully', { question });
  } catch (error) {
    console.error('Get question by ID error:', error);
    sendError(res, 'Internal server error while retrieving question');
  }
};

export const createQuestion = async (req, res) => {
  try {
    const { 
      branchId, 
      level,
      questionText, 
      equation, 
      options, 
      correctAnswerIndex, 
      correctAnswerExplanation
    } = req.body;

    // Validation
    if (!branchId || !questionText || !options || correctAnswerIndex === undefined || !level) {
      return sendError(res, 'Branch ID, level, question text, options, and correct answer index are required', 400);
    }

    if (!Array.isArray(options) || options.length < 2) {
      return sendError(res, 'At least two options are required', 400);
    }

    if (correctAnswerIndex < 0 || correctAnswerIndex >= options.length) {
      return sendError(res, 'Invalid correct answer index', 400);
    }

    if (level < 1 || level > 10) {
      return sendError(res, 'Level must be between 1 and 10', 400);
    }

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return sendError(res, 'Branch not found', 404);
    }

    // Get question number for this specific level
    const questionNumber = await Question.countDocuments({ branchId, level }) + 1;

    const question = new Question({
      branchId,
      category: branch.category,
      level,
      questionNumber,
      questionText,
      equation,
      options: options.map((option, index) => ({
        optionText: option,
        isCorrect: index === correctAnswerIndex
      })),
      correctAnswerIndex,
      correctAnswerExplanation,
    });

    await question.save();

    // Populate branch details for response
    await question.populate('branchId', 'name category');

    sendSuccess(res, 'Question created successfully', { question }, 201);
  } catch (error) {
    console.error('Create question error:', error);
    if (error.code === 11000) {
      return sendError(res, 'A question with this branch, level, and question number already exists', 400);
    }
    sendError(res, 'Internal server error while creating question');
  }
};

export const createBulkQuestions = async (req, res) => {
  try {
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return sendError(res, 'Questions array is required and cannot be empty', 400);
    }

    const createdQuestions = [];
    const errors = [];

    for (let i = 0; i < questions.length; i++) {
      try {
        const questionData = questions[i];
        const { 
          branchId, 
          level,
          questionText, 
          equation, 
          options, 
          correctAnswerIndex, 
          correctAnswerExplanation
        } = questionData;

        // Validation for each question
        if (!branchId || !questionText || !options || correctAnswerIndex === undefined || !level) {
          errors.push(`Question ${i + 1}: Branch ID, level, question text, options, and correct answer index are required`);
          continue;
        }

        if (!Array.isArray(options) || options.length < 2) {
          errors.push(`Question ${i + 1}: At least two options are required`);
          continue;
        }

        if (correctAnswerIndex < 0 || correctAnswerIndex >= options.length) {
          errors.push(`Question ${i + 1}: Invalid correct answer index`);
          continue;
        }

        if (level < 1 || level > 10) {
          errors.push(`Question ${i + 1}: Level must be between 1 and 10`);
          continue;
        }

        const branch = await Branch.findById(branchId);
        if (!branch) {
          errors.push(`Question ${i + 1}: Branch not found`);
          continue;
        }

        // Get question number for this specific level
        const questionNumber = await Question.countDocuments({ branchId, level }) + 1;

        const question = new Question({
          branchId,
          category: branch.category,
          level,
          questionNumber,
          questionText,
          equation,
          options: options.map((option, index) => ({
            optionText: option,
            isCorrect: index === correctAnswerIndex
          })),
          correctAnswerIndex,
          correctAnswerExplanation,
        });

        await question.save();
        await question.populate('branchId', 'name category');
        createdQuestions.push(question);

      } catch (error) {
        if (error.code === 11000) {
          errors.push(`Question ${i + 1}: A question with this branch, level, and question number already exists`);
        } else {
          errors.push(`Question ${i + 1}: ${error.message}`);
        }
      }
    }

    const response = {
      created: createdQuestions.length,
      failed: errors.length,
      total: questions.length,
      questions: createdQuestions
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    const statusCode = createdQuestions.length > 0 ? 201 : 400;
    sendSuccess(res, `Bulk question creation completed. ${createdQuestions.length} created, ${errors.length} failed`, response, statusCode);

  } catch (error) {
    console.error('Bulk create questions error:', error);
    sendError(res, 'Internal server error while creating bulk questions');
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { 
      questionText, 
      equation, 
      options, 
      correctAnswerIndex, 
      correctAnswerExplanation, 
    
    } = req.body;

    const question = await Question.findById(questionId);
    if (!question) {
      return sendError(res, 'Question not found', 404);
    }

    if (questionText) question.questionText = questionText;
    if (equation !== undefined) question.equation = equation;
    if (options) {
      if (!Array.isArray(options) || options.length < 2) {
        return sendError(res, 'At least two options are required', 400);
      }
      question.options = options.map((option, index) => ({
        optionText: option,
        isCorrect: index === correctAnswerIndex
      }));
    }
    if (correctAnswerIndex !== undefined) {
      if (correctAnswerIndex < 0 || correctAnswerIndex >= question.options.length) {
        return sendError(res, 'Invalid correct answer index', 400);
      }
      question.correctAnswerIndex = correctAnswerIndex;
    }
    if (correctAnswerExplanation !== undefined) question.correctAnswerExplanation = correctAnswerExplanation;
    if (difficulty) question.difficulty = difficulty;
    if (points !== undefined) question.points = points;
    if (tags) question.tags = tags;

    await question.save();

    sendSuccess(res, 'Question updated successfully', { question });
  } catch (error) {
    console.error('Update question error:', error);
    sendError(res, 'Internal server error while updating question');
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await Question.findById(questionId);
    if (!question) {
      return sendError(res, 'Question not found', 404);
    }

    await Question.findByIdAndUpdate(questionId, { isActive: false });

    sendSuccess(res, 'Question deleted successfully');
  } catch (error) {
    console.error('Delete question error:', error);
    sendError(res, 'Internal server error while deleting question');
  }
};

export const submitAnswer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { questionId } = req.params;
    const { selectedOptionIndex, timeSpent } = req.body;

    if (selectedOptionIndex === undefined) {
      return sendError(res, 'Selected option index is required', 400);
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return sendError(res, 'Question not found', 404);
    }

    if (selectedOptionIndex < 0 || selectedOptionIndex >= question.options.length) {
      return sendError(res, 'Invalid selected option index', 400);
    }

    const isCorrect = selectedOptionIndex === question.correctAnswerIndex;
    const pointsEarned = isCorrect ? question.points : 0;

    const existingAnswer = await UserAnswer.findOne({ userId, questionId });
    let isNewAnswer = false;
    
    if (existingAnswer) {
      existingAnswer.selectedOptionIndex = selectedOptionIndex;
      existingAnswer.isCorrect = isCorrect;
      existingAnswer.pointsEarned = pointsEarned;
      existingAnswer.timeSpent = timeSpent || 0;
      existingAnswer.answeredAt = new Date();
      await existingAnswer.save();
    } else {
      isNewAnswer = true;
      const userAnswer = new UserAnswer({
        userId,
        questionId,
        branchId: question.branchId,
        category: question.category,
        selectedOptionIndex,
        isCorrect,
        pointsEarned,
        timeSpent: timeSpent || 0
      });
      await userAnswer.save();
    }

    if (isNewAnswer) {
      const UserLevel = (await import('../models/UserLevel.js')).default;
      let userLevel = await UserLevel.findOne({ userId, branchId: question.branchId });
      
      if (!userLevel) {
        userLevel = new UserLevel({
          userId,
          branchId: question.branchId,
          category: question.category,
          currentLevel: 1,
          completedLevels: [],
          totalQuestionsAnswered: 0,
          totalCorrectAnswers: 0,
          isUnlocked: true
        });
        await userLevel.save();
      }
      
      await updateUserLevelProgress(userId, question.branchId, question.category, question.level, isCorrect);
      
      await checkAchievementProgress(userId, questionId, question.branchId, question.category, isCorrect);
    }

    const response = {
      isCorrect,
      correctAnswerIndex: question.correctAnswerIndex,
      correctAnswerExplanation: question.correctAnswerExplanation,
      pointsEarned,
      totalPoints: question.points
    };

    sendSuccess(res, 'Answer submitted successfully', response);
  } catch (error) {
    console.error('Submit answer error:', error);
    sendError(res, 'Internal server error while submitting answer');
  }
};

export const getUserAnswers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { branchId, category } = req.query;

    let filter = { userId };
    
    if (branchId) {
      filter.branchId = branchId;
    }
    
    if (category) {
      filter.category = category;
    }

    const userAnswers = await UserAnswer.find(filter)
      .populate('questionId', 'questionText options correctAnswerExplanation points')
      .populate('branchId', 'name category')
      .sort({ answeredAt: -1 })
      .lean();

    sendSuccess(res, 'User answers retrieved successfully', { userAnswers });
  } catch (error) {
    console.error('Get user answers error:', error);
    sendError(res, 'Internal server error while retrieving user answers');
  }
};

export const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { branchId, category } = req.query;

    let matchFilter = { userId };
    
    if (branchId) {
      matchFilter.branchId = branchId;
    }
    
    if (category) {
      matchFilter.category = category;
    }

    const stats = await UserAnswer.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalQuestions: { $sum: 1 },
          correctAnswers: { $sum: { $cond: ['$isCorrect', 1, 0] } },
          totalPoints: { $sum: '$pointsEarned' },
          averageTimeSpent: { $avg: '$timeSpent' }
        }
      }
    ]);

    const result = stats[0] || {
      totalQuestions: 0,
      correctAnswers: 0,
      totalPoints: 0,
      averageTimeSpent: 0
    };

    result.accuracy = result.totalQuestions > 0 
      ? Math.round((result.correctAnswers / result.totalQuestions) * 100) 
      : 0;

    sendSuccess(res, 'User stats retrieved successfully', { stats: result });
  } catch (error) {
    console.error('Get user stats error:', error);
    sendError(res, 'Internal server error while retrieving user stats');
  }
};

export const getUserLevelProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { branchId } = req.params;

    const UserLevel = (await import('../models/UserLevel.js')).default;
    const UserAnswer = (await import('../models/UserAnswer.js')).default;
    const Question = (await import('../models/Question.js')).default;
    const Branch = (await import('../models/Branch.js')).default;

    let userLevel = await UserLevel.findOne({ userId, branchId });
    
    if (!userLevel) {
      const branch = await Branch.findById(branchId);
      if (!branch) {
        return sendError(res, 'Branch not found', 404);
      }

      userLevel = new UserLevel({
        userId,
        branchId,
        category: branch.category,
        currentLevel: 1,
        completedLevels: [],
        totalQuestionsAnswered: 0,
        totalCorrectAnswers: 0,
        isUnlocked: true
      });
      await userLevel.save();
    }

    const currentLevel = userLevel.currentLevel;
    const questionsInCurrentLevel = await Question.find({
      branchId,
      category: userLevel.category,
      level: currentLevel
    });

    const questionIdsInCurrentLevel = questionsInCurrentLevel.map(q => q._id);
    const questionsAnsweredInCurrentLevel = await UserAnswer.countDocuments({
      userId,
      questionId: { $in: questionIdsInCurrentLevel }
    });

    const correctAnswersInCurrentLevel = await UserAnswer.countDocuments({
      userId,
      questionId: { $in: questionIdsInCurrentLevel },
      isCorrect: true
    });

    const isCurrentLevelCompleted = questionsAnsweredInCurrentLevel >= 10 && correctAnswersInCurrentLevel >= 10;

    const response = {
      branchId: userLevel.branchId,
      category: userLevel.category,
      currentLevel: userLevel.currentLevel,
      completedLevels: userLevel.completedLevels.length,
      totalLevels: 10,
      currentLevelProgress: {
        questionsAnswered: questionsAnsweredInCurrentLevel,
        correctAnswers: correctAnswersInCurrentLevel,
        totalQuestions: 10,
        isCompleted: isCurrentLevelCompleted
      },
      overallProgress: {
        totalQuestionsAnswered: userLevel.totalQuestionsAnswered,
        totalCorrectAnswers: userLevel.totalCorrectAnswers,
        levelsCompleted: userLevel.completedLevels.length,
        totalLevels: 10
      },
      canAdvanceToNextLevel: isCurrentLevelCompleted && userLevel.currentLevel < 10
    };

    sendSuccess(res, 'User level progress retrieved successfully', response);
  } catch (error) {
    console.error('Error getting user level progress:', error);
    sendError(res, 'Internal server error while getting user level progress');
  }
};

export const getFilteredQuestions = async (req, res) => {
  try {
    const { branchId, level } = req.query;
    
    // Build filter object
    let filter = { isActive: true };
    
    // Add branchId filter
    if (branchId) {
      // Check if branch exists
      const branchDoc = await Branch.findById(branchId);
      if (!branchDoc) {
        return sendError(res, 'Branch not found', 404);
      }
      filter.branchId = branchId;
    }
    
    // Add level filter
    if (level) {
      const levelNum = parseInt(level);
      if (isNaN(levelNum) || levelNum < 1 || levelNum > 10) {
        return sendError(res, 'Invalid level. Must be between 1 and 10', 400);
      }
      filter.level = levelNum;
    }

    // Get questions with filters
    const questions = await Question.find(filter)
      .populate('branchId', 'name category description icon')
      .sort({ category: 1, branchId: 1, level: 1, questionNumber: 1 })
      .lean();

    // Get count for pagination info
    const totalCount = await Question.countDocuments(filter);

    const response = {
      filters: {
        branchId: branchId || 'all',
        level: level || 'all'
      },
      totalQuestions: totalCount,
      questions: questions
    };

    sendSuccess(res, 'Questions retrieved successfully', response);
  } catch (error) {
    console.error('Get filtered questions error:', error);
    sendError(res, 'Internal server error while retrieving questions');
  }
};