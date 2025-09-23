import UserLevel from '../models/UserLevel.js';
import Question from '../models/Question.js';
import Branch from '../models/Branch.js';
import UserAnswer from '../models/UserAnswer.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { checkLevelCompletionAchievement } from './achievementController.js';

export const getUserLevels = async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, branchId } = req.query;

    let filter = { userId };
    if (category) filter.category = category;
    if (branchId) filter.branchId = branchId;

    const userLevels = await UserLevel.find(filter)
      .populate('branchId', 'name category icon')
      .sort({ category: 1, 'branchId.name': 1 });

    const formattedLevels = userLevels.map(ul => ({
      _id: ul._id,
      branch: {
        _id: ul.branchId._id,
        name: ul.branchId.name,
        category: ul.branchId.category,
        icon: ul.branchId.icon
      },
      currentLevel: ul.currentLevel,
      completedLevels: ul.completedLevels,
      totalQuestionsAnswered: ul.totalQuestionsAnswered,
      totalCorrectAnswers: ul.totalCorrectAnswers,
      isUnlocked: ul.isUnlocked,
      progressPercentage: Math.round((ul.completedLevels.length / 10) * 100)
    }));

    return sendSuccess(res, 'User levels retrieved successfully', formattedLevels);
  } catch (error) {
    console.error('Error getting user levels:', error);
    return sendError(res, 'Failed to retrieve user levels', 500);
  }
};

export const getLevelQuestions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { branchId, level } = req.params;

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return sendError(res, 'Branch not found', 404);
    }

    const userLevel = await UserLevel.findOne({ userId, branchId });
    if (!userLevel) {
      return sendError(res, 'User level not found. Please start from level 1', 404);
    }

    const requestedLevel = parseInt(level);
    if (requestedLevel > userLevel.currentLevel) {
      return sendError(res, 'Level not unlocked yet. Complete previous levels first', 403);
    }

    const questions = await Question.find({
      branchId,
      level: requestedLevel,
      isActive: true
    }).sort({ questionNumber: 1 });

    if (questions.length === 0) {
      return sendError(res, 'No questions found for this level', 404);
    }

    const userAnswers = await UserAnswer.find({
      userId,
      branchId,
      questionId: { $in: questions.map(q => q._id) }
    });

    const questionsWithAnswers = questions.map(question => {
      const userAnswer = userAnswers.find(ua => ua.questionId.toString() === question._id.toString());
      return {
        _id: question._id,
        questionNumber: question.questionNumber,
        level: question.level,
        questionText: question.questionText,
        equation: question.equation,
        options: question.options,
        correctAnswerIndex: question.correctAnswerIndex,
        correctAnswerExplanation: question.correctAnswerExplanation,
        userAnswer: userAnswer ? {
          selectedOptionIndex: userAnswer.selectedOptionIndex,
          isCorrect: userAnswer.isCorrect,
          answeredAt: userAnswer.answeredAt
        } : null
      };
    });

    return sendSuccess(res, 'Level questions retrieved successfully', {
      branch: {
        _id: branch._id,
        name: branch.name,
        category: branch.category,
        icon: branch.icon
      },
      level: requestedLevel,
      totalQuestions: questions.length,
      questions: questionsWithAnswers,
      userProgress: {
        currentLevel: userLevel.currentLevel,
        completedLevels: userLevel.completedLevels.length,
        totalLevels: 10
      }
    });
  } catch (error) {
    console.error('Error getting level questions:', error);
    return sendError(res, 'Failed to retrieve level questions', 500);
  }
};

export const submitLevelAnswer = async (req, res) => {
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

    const userLevel = await UserLevel.findOne({ userId, branchId: question.branchId });
    if (!userLevel) {
      return sendError(res, 'User level not found', 404);
    }

    if (question.level > userLevel.currentLevel) {
      return sendError(res, 'Level not unlocked yet', 403);
    }

    if (selectedOptionIndex < 0 || selectedOptionIndex >= question.options.length) {
      return sendError(res, 'Invalid selected option index', 400);
    }

    const isCorrect = selectedOptionIndex === question.correctAnswerIndex;
    const pointsEarned = isCorrect ? 10 : 0;

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
      userLevel.totalQuestionsAnswered += 1;
      if (isCorrect) {
        userLevel.totalCorrectAnswers += 1;
      }
      await userLevel.save();
    }

    const levelQuestions = await Question.find({
      branchId: question.branchId,
      level: question.level,
      isActive: true
    });

    const levelAnswers = await UserAnswer.find({
      userId,
      branchId: question.branchId,
      questionId: { $in: levelQuestions.map(q => q._id) }
    });

    const isLevelComplete = levelAnswers.length >= levelQuestions.length;
    let levelCompleted = false;

    if (isLevelComplete && question.level === userLevel.currentLevel) {
      const levelCompletion = {
        level: question.level,
        completedAt: new Date(),
        questionsAnswered: levelAnswers.length,
        correctAnswers: levelAnswers.filter(a => a.isCorrect).length,
        totalQuestions: levelQuestions.length
      };

      userLevel.completedLevels.push(levelCompletion);
      userLevel.currentLevel = Math.min(userLevel.currentLevel + 1, 10);
      levelCompleted = true;
      await userLevel.save();

      await checkLevelCompletionAchievement(
        userId, 
        question.branchId, 
        question.category, 
        userLevel.completedLevels.length
      );
    }

    return sendSuccess(res, 'Answer submitted successfully', {
      isCorrect,
      correctAnswerIndex: question.correctAnswerIndex,
      correctAnswerExplanation: question.correctAnswerExplanation,
      pointsEarned,
      levelCompleted,
      currentLevel: userLevel.currentLevel,
      completedLevels: userLevel.completedLevels.length,
      levelProgress: {
        answered: levelAnswers.length,
        total: levelQuestions.length,
        percentage: Math.round((levelAnswers.length / levelQuestions.length) * 100)
      }
    });
  } catch (error) {
    console.error('Error submitting level answer:', error);
    return sendError(res, 'Failed to submit answer', 500);
  }
};

export const getBranchProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { branchId } = req.params;

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return sendError(res, 'Branch not found', 404);
    }

    const userLevel = await UserLevel.findOne({ userId, branchId });
    if (!userLevel) {
      return sendSuccess(res, 'Branch progress retrieved successfully', {
        branch: {
          _id: branch._id,
          name: branch.name,
          category: branch.category,
          icon: branch.icon
        },
        currentLevel: 1,
        completedLevels: 0,
        totalLevels: 10,
        progressPercentage: 0,
        isUnlocked: true
      });
    }

    const levelProgress = [];
    for (let level = 1; level <= 10; level++) {
      const levelQuestions = await Question.find({
        branchId,
        level,
        isActive: true
      });

      const levelAnswers = await UserAnswer.find({
        userId,
        branchId,
        questionId: { $in: levelQuestions.map(q => q._id) }
      });

      const isCompleted = levelAnswers.length >= levelQuestions.length;
      const isUnlocked = level <= userLevel.currentLevel;

      levelProgress.push({
        level,
        isCompleted,
        isUnlocked,
        questionsAnswered: levelAnswers.length,
        totalQuestions: levelQuestions.length,
        correctAnswers: levelAnswers.filter(a => a.isCorrect).length,
        progressPercentage: levelQuestions.length > 0 ? 
          Math.round((levelAnswers.length / levelQuestions.length) * 100) : 0
      });
    }

    return sendSuccess(res, 'Branch progress retrieved successfully', {
      branch: {
        _id: branch._id,
        name: branch.name,
        category: branch.category,
        icon: branch.icon
      },
      currentLevel: userLevel.currentLevel,
      completedLevels: userLevel.completedLevels.length,
      totalLevels: 10,
      progressPercentage: Math.round((userLevel.completedLevels.length / 10) * 100),
      isUnlocked: userLevel.isUnlocked,
      levelProgress
    });
  } catch (error) {
    console.error('Error getting branch progress:', error);
    return sendError(res, 'Failed to retrieve branch progress', 500);
  }
};

export const initializeUserLevel = async (userId, branchId, category) => {
  try {
    const existingUserLevel = await UserLevel.findOne({ userId, branchId });
    if (existingUserLevel) {
      return existingUserLevel;
    }

    const userLevel = new UserLevel({
      userId,
      branchId,
      category,
      currentLevel: 1,
      completedLevels: [],
      totalQuestionsAnswered: 0,
      totalCorrectAnswers: 0,
      isUnlocked: true
    });

    await userLevel.save();
    return userLevel;
  } catch (error) {
    console.error('Error initializing user level:', error);
    return null;
  }
};