import UserLevel from '../models/UserLevel.js';
import Question from '../models/Question.js';
import Branch from '../models/Branch.js';
import UserAnswer from '../models/UserAnswer.js';
import QuestionPacketAnswer from '../models/QuestionPacketAnswer.js';
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

    const formattedLevels = userLevels.map(ul => {
      // Calculate actual totals from completed levels
      const totalQuestionsAnswered = ul.completedLevels.reduce((sum, level) => sum + level.questionsAnswered, 0);
      const totalCorrectAnswers = ul.completedLevels.reduce((sum, level) => sum + level.correctAnswers, 0);
      
      return {
        _id: ul._id,
        branch: {
          _id: ul.branchId._id,
          name: ul.branchId.name,
          category: ul.branchId.category,
          icon: ul.branchId.icon
        },
        currentLevel: ul.currentLevel,
        completedLevels: ul.completedLevels,
        totalQuestionsAnswered,
        totalCorrectAnswers,
        isUnlocked: ul.isUnlocked,
        progressPercentage: Math.round((ul.completedLevels.length / 10) * 100)
      };
    });

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

export const getUserDetailedProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { branchId, level } = req.query;

    console.log('getUserDetailedProgress - User ID:', userId);
    console.log('getUserDetailedProgress - Branch ID:', branchId);
    console.log('getUserDetailedProgress - Level:', level);

    if (!branchId) {
      return sendError(res, 'Branch ID is required', 400);
    }

    // Validate level parameter if provided
    if (level && (isNaN(level) || level < 1 || level > 10)) {
      return sendError(res, 'Level must be a number between 1 and 10', 400);
    }

    // Get branch information
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return sendError(res, 'Branch not found', 404);
    }

    // Get user level data
    const userLevel = await UserLevel.findOne({ userId, branchId });
    const currentLevel = userLevel ? userLevel.currentLevel : 1;
    const completedLevels = userLevel ? userLevel.completedLevels.length : 0;

    // Get all questions for the branch
    const questions = await Question.find({
      branchId,
      isActive: true
    }).sort({ level: 1, questionNumber: 1 });

    console.log('getUserDetailedProgress - Questions found:', questions.length);

    // Get all user answers for this branch
    const userAnswers = await UserAnswer.find({
      userId,
      branchId
    }).populate({
      path: 'questionId',
      select: 'questionText equation options correctAnswerIndex correctAnswerExplanation level questionNumber'
    });

    console.log('getUserDetailedProgress - User answers found:', userAnswers.length);
    if (userAnswers.length > 0) {
      console.log('getUserDetailedProgress - First user answer structure:', {
        questionId: userAnswers[0].questionId,
        selectedOptionIndex: userAnswers[0].selectedOptionIndex,
        isCorrect: userAnswers[0].isCorrect,
        level: userAnswers[0].questionId?.level
      });
      
      // Check what levels have answers
      const levelsWithAnswers = [...new Set(userAnswers.map(a => a.questionId?.level).filter(l => l !== undefined))];
      console.log('getUserDetailedProgress - Levels with answers:', levelsWithAnswers);
      
      // Debug: Check if questionId is populated correctly
      console.log('getUserDetailedProgress - First questionId type:', typeof userAnswers[0].questionId);
      console.log('getUserDetailedProgress - First questionId level:', userAnswers[0].questionId?.level);
    }

    // Group questions and answers by level
    const levelDetails = [];
    
    // Determine which levels to process
    const levelsToProcess = level ? [parseInt(level)] : Array.from({length: 10}, (_, i) => i + 1);
    
    for (const levelNum of levelsToProcess) {
      const levelQuestions = questions.filter(q => q.level === levelNum);
      const levelAnswers = userAnswers.filter(a => {
        if (!a.questionId) return false;
        // If questionId is a string (not populated), we need to get it from the question directly
        if (typeof a.questionId === 'string') {
          // Find the question in our questions array to get the level
          const question = questions.find(q => q._id.toString() === a.questionId.toString());
          return question && question.level === levelNum;
        }
        // If level is undefined in populated object, get it from questions array
        if (a.questionId.level === undefined) {
          const question = questions.find(q => q._id.toString() === a.questionId._id.toString());
          return question && question.level === levelNum;
        }
        return a.questionId.level === levelNum;
      });
      
      console.log(`Level ${levelNum} - Questions: ${levelQuestions.length}, Answers: ${levelAnswers.length}`);
      if (levelAnswers.length > 0) {
        const firstAnswer = levelAnswers[0];
        const questionIdValue = typeof firstAnswer.questionId === 'string' 
          ? firstAnswer.questionId 
          : firstAnswer.questionId._id;
        console.log(`Level ${levelNum} - First answer questionId:`, questionIdValue);
        console.log(`Level ${levelNum} - First question _id:`, levelQuestions[0]?._id);
      }
      
      const levelStats = {
        level: levelNum,
        totalQuestions: levelQuestions.length,
        questionsAnswered: levelAnswers.length,
        correctAnswers: levelAnswers.filter(a => a.isCorrect).length,
        accuracyPercentage: levelAnswers.length > 0 ? 
          Math.round((levelAnswers.filter(a => a.isCorrect).length / levelAnswers.length) * 100) : 0,
        averageTimeSpent: levelAnswers.length > 0 ? 
          Math.round(levelAnswers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / levelAnswers.length) : 0,
        isCompleted: levelAnswers.length >= levelQuestions.length,
        isUnlocked: levelNum <= currentLevel,
        questions: levelQuestions.map(question => {
          const userAnswer = levelAnswers.find(a => {
            if (!a.questionId) return false;
            const answerQuestionId = typeof a.questionId === 'string' 
              ? a.questionId.toString() 
              : a.questionId._id?.toString();
            const currentQuestionId = question._id.toString();
            return answerQuestionId === currentQuestionId;
          });
          
          // Debug logging for first question
          if (question.questionNumber === 1) {
            console.log(`Level ${levelNum} - Question 1 ID:`, question._id.toString());
            const availableAnswerIds = levelAnswers.map(a => {
              if (!a.questionId) return 'null';
              return typeof a.questionId === 'string' 
                ? a.questionId.toString() 
                : a.questionId._id?.toString();
            });
            console.log(`Level ${levelNum} - Available answer IDs:`, availableAnswerIds);
            console.log(`Level ${levelNum} - Found user answer:`, userAnswer ? 'YES' : 'NO');
            if (userAnswer) {
              console.log(`Level ${levelNum} - User answer details:`, {
                selectedOptionIndex: userAnswer.selectedOptionIndex,
                isCorrect: userAnswer.isCorrect
              });
            }
          }
          
          return {
            _id: question._id,
            questionNumber: question.questionNumber,
            questionText: question.questionText,
            equation: question.equation,
            options: question.options,
            correctAnswerIndex: question.correctAnswerIndex,
            correctAnswerExplanation: question.correctAnswerExplanation,
            userAnswer: userAnswer ? {
              selectedOptionIndex: userAnswer.selectedOptionIndex,
              selectedOption: question.options[userAnswer.selectedOptionIndex],
              isCorrect: userAnswer.isCorrect,
              pointsEarned: userAnswer.pointsEarned,
              timeSpent: userAnswer.timeSpent,
              answeredAt: userAnswer.answeredAt
            } : null
          };
        })
      };
      
      levelDetails.push(levelStats);
    }

    // Calculate overall statistics
    // If specific level is requested, only calculate stats for that level
    const relevantAnswers = level ? 
      userAnswers.filter(a => {
        if (!a.questionId) return false;
        // If questionId is a string (not populated), get level from questions array
        if (typeof a.questionId === 'string') {
          const question = questions.find(q => q._id.toString() === a.questionId.toString());
          return question && question.level === parseInt(level);
        }
        // If level is undefined in populated object, get it from questions array
        if (a.questionId.level === undefined) {
          const question = questions.find(q => q._id.toString() === a.questionId._id.toString());
          return question && question.level === parseInt(level);
        }
        return a.questionId.level === parseInt(level);
      }) : 
      userAnswers;
    
    const totalQuestionsAnswered = relevantAnswers.length;
    const totalCorrectAnswers = relevantAnswers.filter(a => a.isCorrect).length;
    const accuracyPercentage = totalQuestionsAnswered > 0 ? 
      Math.round((totalCorrectAnswers / totalQuestionsAnswered) * 100) : 0;
    const averageTimeSpent = totalQuestionsAnswered > 0 ? 
      Math.round(relevantAnswers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / totalQuestionsAnswered) : 0;

    return sendSuccess(res, 'User detailed progress retrieved successfully', {
      branch: {
        _id: branch._id,
        name: branch.name,
        category: branch.category,
        icon: branch.icon,
        description: branch.description
      },
      userProgress: {
        currentLevel: currentLevel,
        completedLevels: completedLevels,
        totalLevels: 10,
        progressPercentage: Math.round((completedLevels / 10) * 100),
        isUnlocked: userLevel ? userLevel.isUnlocked : true
      },
      levelDetails,
      overallStats: {
        totalQuestionsAnswered,
        totalCorrectAnswers,
        accuracyPercentage,
        averageTimeSpent,
        totalPointsEarned: relevantAnswers.reduce((sum, a) => sum + (a.pointsEarned || 0), 0)
      }
    });
  } catch (error) {
    console.error('Error getting user detailed progress:', error);
    return sendError(res, 'Failed to retrieve user detailed progress', 500);
  }
};

export const calculateOverallLevel = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all user levels to check branch completions
    const userLevels = await UserLevel.find({ userId }).populate('branchId', 'name category');
    
    // Count completed branches (branches where all 10 levels are completed)
    const completedBranches = userLevels.filter(userLevel => 
      userLevel.completedLevels.length === 10
    );

    // Get completed question packets
    const completedQuestionPackets = await QuestionPacketAnswer.find({
      userId,
      isCompleted: true
    });

    let overallLevel = 0;
    let levelBreakdown = {
      branchCompletions: completedBranches.length,
      questionPacketCompletions: completedQuestionPackets.length,
      levelProgression: []
    };

    // Calculate overall level based on the specified flow
    if (completedBranches.length >= 1) {
      overallLevel = 1;
      levelBreakdown.levelProgression.push({
        level: 1,
        requirement: 'Complete 1 full branch',
        achieved: true,
        completedBranches: completedBranches.length
      });
    }

    if (completedBranches.length >= 3) {
      overallLevel = 2;
      levelBreakdown.levelProgression.push({
        level: 2,
        requirement: 'Complete 3 total branches',
        achieved: true,
        completedBranches: completedBranches.length
      });
    }

    if (completedBranches.length >= 6) {
      overallLevel = 3;
      levelBreakdown.levelProgression.push({
        level: 3,
        requirement: 'Complete 6 total branches',
        achieved: true,
        completedBranches: completedBranches.length
      });
    }

    // After level 3, question packets start counting
    if (overallLevel >= 3) {
      const questionPacketLevels = Math.floor(completedQuestionPackets.length / 3);
      if (questionPacketLevels >= 1) {
        overallLevel = 3 + questionPacketLevels;
        
        // Add question packet level progressions
        for (let i = 1; i <= questionPacketLevels; i++) {
          const requiredPackets = 3 * i;
          levelBreakdown.levelProgression.push({
            level: 3 + i,
            requirement: `Complete ${requiredPackets} question packets (after reaching level 3)`,
            achieved: true,
            completedPackets: completedQuestionPackets.length
          });
        }
      }
    }

    // Check next level requirements
    let nextLevelRequirement = null;
    if (overallLevel < 3) {
      const branchesNeeded = overallLevel === 0 ? 1 : overallLevel === 1 ? 3 : 6;
      nextLevelRequirement = {
        type: 'branches',
        required: branchesNeeded,
        current: completedBranches.length,
        remaining: branchesNeeded - completedBranches.length
      };
    } else {
      const currentPacketLevel = Math.floor(completedQuestionPackets.length / 3);
      const nextPacketLevel = currentPacketLevel + 1;
      const packetsNeeded = 3 * nextPacketLevel;
      nextLevelRequirement = {
        type: 'question_packets',
        required: packetsNeeded,
        current: completedQuestionPackets.length,
        remaining: packetsNeeded - completedQuestionPackets.length
      };
    }

    return sendSuccess(res, 'Overall level calculated successfully', {
      userId,
      overallLevel,
      levelBreakdown,
      nextLevelRequirement,
      completedBranches: completedBranches.map(branch => ({
        _id: branch.branchId._id,
        name: branch.branchId.name,
        category: branch.branchId.category,
        completedAt: branch.completedLevels[9]?.completedAt // Last level completion date
      })),
      completedQuestionPackets: completedQuestionPackets.map(packet => ({
        _id: packet._id,
        questionPacketId: packet.questionPacketId,
        score: packet.score,
        completedAt: packet.submittedAt
      }))
    });
  } catch (error) {
    console.error('Error calculating overall level:', error);
    return sendError(res, 'Failed to calculate overall level', 500);
  }
};