import Achievement from '../models/Achievement.js';
import UserAchievement from '../models/UserAchievement.js';
import UserAnswer from '../models/UserAnswer.js';
import Branch from '../models/Branch.js';
import UserLevel from '../models/UserLevel.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { validationResult } from 'express-validator';

export const getUserAchievements = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const achievements = await Achievement.find({ isActive: true })
      .populate('branchId', 'name category icon')
      .sort({ category: 1, createdAt: 1 });

    const userAchievements = await UserAchievement.find({ userId })
      .populate('achievementId');

    // Get actual user levels to calculate correct progress
    const userLevels = await UserLevel.find({ userId })
      .populate('branchId', 'name category icon');

    const userAchievementMap = new Map();
    userAchievements.forEach(ua => {
      userAchievementMap.set(ua.achievementId._id.toString(), ua);
    });

    const userLevelMap = new Map();
    userLevels.forEach(ul => {
      userLevelMap.set(ul.branchId._id.toString(), ul);
    });

    const achievementsWithProgress = achievements.map(achievement => {
      const userAchievement = userAchievementMap.get(achievement._id.toString());
      const userLevel = userLevelMap.get(achievement.branchId._id.toString());
      
      // Calculate actual completed levels from UserLevel model
      const actualCompletedLevels = userLevel ? userLevel.completedLevels.length : 0;
      
      if (userAchievement) {
        return {
          _id: achievement._id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          branch: achievement.branchId ? {
            _id: achievement.branchId._id,
            name: achievement.branchId.name,
            icon: achievement.branchId.icon
          } : {
            _id: null,
            name: 'Unknown Branch',
            icon: '❓'
          },
          progress: {
            current: actualCompletedLevels, // Use actual completed levels
            total: userAchievement.progress.totalRequired,
            percentage: Math.round((actualCompletedLevels / userAchievement.progress.totalRequired) * 100)
          },
          isCompleted: actualCompletedLevels >= userAchievement.progress.totalRequired,
          completedAt: userAchievement.completedAt,
          pointsEarned: userAchievement.pointsEarned
        };
      } else {
        return {
          _id: achievement._id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          branch: achievement.branchId ? {
            _id: achievement.branchId._id,
            name: achievement.branchId.name,
            icon: achievement.branchId.icon
          } : {
            _id: null,
            name: 'Unknown Branch',
            icon: '❓'
          },
          progress: {
            current: actualCompletedLevels, // Use actual completed levels
            total: achievement.requirements.levelsCompleted,
            percentage: Math.round((actualCompletedLevels / achievement.requirements.levelsCompleted) * 100)
          },
          isCompleted: actualCompletedLevels >= achievement.requirements.levelsCompleted,
          completedAt: null,
          pointsEarned: 0
        };
      }
    });

    return sendSuccess(res, 'User achievements retrieved successfully', achievementsWithProgress);
  } catch (error) {
    console.error('Error getting user achievements:', error);
    return sendError(res, 'Failed to retrieve user achievements', 500);
  }
};

export const getAchievementsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const userId = req.user.id;

    if (!['math', 'reading_writing'].includes(category)) {
      return sendError(res, 'Invalid category. Must be math or reading_writing', 400);
    }

    const achievements = await Achievement.find({ 
      category, 
      isActive: true 
    })
      .populate('branchId', 'name category icon')
      .sort({ createdAt: 1 });

    const achievementIds = achievements.map(a => a._id);
    const userAchievements = await UserAchievement.find({ 
      userId, 
      achievementId: { $in: achievementIds } 
    });

    const userAchievementMap = new Map();
    userAchievements.forEach(ua => {
      userAchievementMap.set(ua.achievementId.toString(), ua);
    });

    const achievementsWithProgress = achievements.map(achievement => {
      const userAchievement = userAchievementMap.get(achievement._id.toString());
      
      if (userAchievement) {
        return {
          _id: achievement._id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          branch: achievement.branchId ? {
            _id: achievement.branchId._id,
            name: achievement.branchId.name,
            icon: achievement.branchId.icon
          } : {
            _id: null,
            name: 'Unknown Branch',
            icon: '❓'
          },
          progress: {
            current: userAchievement.progress.levelsCompleted,
            total: userAchievement.progress.totalRequired,
            percentage: Math.round((userAchievement.progress.levelsCompleted / userAchievement.progress.totalRequired) * 100)
          },
          isCompleted: userAchievement.isCompleted,
          completedAt: userAchievement.completedAt,
          pointsEarned: userAchievement.pointsEarned
        };
      } else {
        return {
          _id: achievement._id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          branch: achievement.branchId ? {
            _id: achievement.branchId._id,
            name: achievement.branchId.name,
            icon: achievement.branchId.icon
          } : {
            _id: null,
            name: 'Unknown Branch',
            icon: '❓'
          },
          progress: {
            current: 0,
            total: achievement.requirements.levelsCompleted,
            percentage: 0
          },
          isCompleted: false,
          completedAt: null,
          pointsEarned: 0
        };
      }
    });

    return sendSuccess(res, `${category} achievements retrieved successfully`, achievementsWithProgress);
  } catch (error) {
    console.error('Error getting achievements by category:', error);
    return sendError(res, 'Failed to retrieve achievements by category', 500);
  }
};

export const checkAchievementProgress = async (userId, questionId, branchId, category, isCorrect) => {
  try {
    await checkRegularAchievementProgress(userId, questionId, branchId, category, isCorrect);
    await checkDailyAchievementProgress(userId, questionId, branchId, category, isCorrect);
    
    return true;
  } catch (error) {
    console.error('Error checking achievement progress:', error);
    return false;
  }
};

const checkRegularAchievementProgress = async (userId, questionId, branchId, category, isCorrect) => {
  try {
    const Question = (await import('../models/Question.js')).default;
    const question = await Question.findById(questionId);
    if (!question) {
      console.error('Question not found for achievement progress check');
      return false;
    }

    const UserLevel = (await import('../models/UserLevel.js')).default;
    const userLevel = await UserLevel.findOne({ userId, branchId });
    
    if (!userLevel) {
      console.error('User level not found for achievement progress check');
      return false;
    }

    const UserAnswer = (await import('../models/UserAnswer.js')).default;
    const currentLevel = userLevel.currentLevel;
    
    const questionsInLevel = await Question.find({
      branchId,
      category,
      level: currentLevel
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

    const achievements = await Achievement.find({
      category,
      branchId,
      isActive: true,
      'requirements.isDaily': { $ne: true }
    });

    for (const achievement of achievements) {
      let userAchievement = await UserAchievement.findOne({
        userId,
        achievementId: achievement._id
      });

      if (!userAchievement) {
        userAchievement = new UserAchievement({
          userId,
          achievementId: achievement._id,
          progress: {
            levelsCompleted: 0,
            questionsAnswered: 0,
            correctAnswers: 0,
            totalRequired: achievement.requirements.levelsCompleted,
            dailyProgress: 0,
            lastResetDate: new Date()
          },
          isCompleted: false
        });
      }

      if (userAchievement.isCompleted) {
        continue;
      }

      userAchievement.progress.levelsCompleted = userLevel.completedLevels.length;
      userAchievement.progress.questionsAnswered = userLevel.totalQuestionsAnswered;
      userAchievement.progress.correctAnswers = userLevel.totalCorrectAnswers;

      if (userAchievement.progress.levelsCompleted >= userAchievement.progress.totalRequired) {
        userAchievement.isCompleted = true;
        userAchievement.completedAt = new Date();
        userAchievement.pointsEarned = achievement.pointsReward;
      }

      await userAchievement.save();
    }

    const questionsPerLevel = 10;
    const isLevelCompleted = questionsAnsweredInLevel >= questionsPerLevel;

    if (isLevelCompleted) {
      const newLevel = userLevel.currentLevel + 1;
      const completedLevel = {
        level: userLevel.currentLevel,
        completedAt: new Date(),
        questionsAnswered: questionsPerLevel,
        correctAnswers: correctAnswersInLevel,
        totalQuestions: questionsPerLevel
      };

      userLevel.completedLevels.push(completedLevel);
      userLevel.currentLevel = Math.min(newLevel, 10);
      userLevel.totalQuestionsAnswered += questionsPerLevel;
      userLevel.totalCorrectAnswers += correctAnswersInLevel;
      await userLevel.save();

      for (const achievement of achievements) {
        let userAchievement = await UserAchievement.findOne({
          userId,
          achievementId: achievement._id
        });

        if (userAchievement && !userAchievement.isCompleted) {
          userAchievement.progress.levelsCompleted = userLevel.completedLevels.length;

          if (userAchievement.progress.levelsCompleted >= userAchievement.progress.totalRequired) {
            userAchievement.isCompleted = true;
            userAchievement.completedAt = new Date();
            userAchievement.pointsEarned = achievement.pointsReward;
          }

          await userAchievement.save();
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking regular achievement progress:', error);
    return false;
  }
};

export const getCompletedAchievements = async (req, res) => {
  try {
    const userId = req.user.id;

    const completedAchievements = await UserAchievement.find({
      userId,
      isCompleted: true
    })
      .populate({
        path: 'achievementId',
        populate: {
          path: 'branchId',
          select: 'name category icon'
        }
      })
      .sort({ completedAt: -1 });

    const formattedAchievements = completedAchievements.map(ua => ({
      _id: ua.achievementId._id,
      name: ua.achievementId.name,
      description: ua.achievementId.description,
      icon: ua.achievementId.icon,
      category: ua.achievementId.category,
      branch: ua.achievementId.branchId ? {
        _id: ua.achievementId.branchId._id,
        name: ua.achievementId.branchId.name,
        icon: ua.achievementId.branchId.icon
      } : {
        _id: null,
        name: 'Unknown Branch',
        icon: '❓'
      },
      completedAt: ua.completedAt,
      pointsEarned: ua.pointsEarned
    }));

    return sendSuccess(res, 'Completed achievements retrieved successfully', formattedAchievements);
  } catch (error) {
    console.error('Error getting completed achievements:', error);
    return sendError(res, 'Failed to retrieve completed achievements', 500);
  }
};

export const getAchievementStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await UserAchievement.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          totalAchievements: { $sum: 1 },
          completedAchievements: {
            $sum: { $cond: ['$isCompleted', 1, 0] }
          },
          totalPointsEarned: { $sum: '$pointsEarned' }
        }
      }
    ]);

    const result = stats[0] || {
      totalAchievements: 0,
      completedAchievements: 0,
      totalPointsEarned: 0
    };

    result.completionPercentage = result.totalAchievements > 0 
      ? Math.round((result.completedAchievements / result.totalAchievements) * 100)
      : 0;

    return sendSuccess(res, 'Achievement statistics retrieved successfully', result);
  } catch (error) {
    console.error('Error getting achievement stats:', error);
    return sendError(res, 'Failed to retrieve achievement statistics', 500);
  }
};

export const createAchievement = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'Validation failed', 400, errors.array());
    }

    const {
      name,
      description,
      icon,
      category,
      branchId,
      questionsAnswered = 10,
      correctAnswers = null,
      timeLimit = null,
      isDaily = false,
      timeFrame = 'lifetime',
      pointsReward = 100
    } = req.body;

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return sendError(res, 'Branch not found', 404);
    }

    const existingAchievement = await Achievement.findOne({ name });
    if (existingAchievement) {
      return sendError(res, 'Achievement with this name already exists', 400);
    }

    const achievement = new Achievement({
      name,
      description,
      icon,
      category,
      branchId,
      requirements: {
        questionsAnswered,
        correctAnswers,
        timeLimit,
        isDaily,
        timeFrame
      },
      pointsReward
    });

    await achievement.save();

    await achievement.populate('branchId', 'name category icon');

    return sendSuccess(res, 'Achievement created successfully', achievement, 201);
  } catch (error) {
    console.error('Error creating achievement:', error);
    return sendError(res, 'Failed to create achievement', 500);
  }
};

export const updateAchievement = async (req, res) => {
  try {
    const { achievementId } = req.params;
    const {
      name,
      description,
      icon,
      category,
      branchId,
      questionsAnswered,
      correctAnswers,
      timeLimit,
      isDaily,
      timeFrame,
      pointsReward,
      isActive
    } = req.body;

    const achievement = await Achievement.findById(achievementId);
    if (!achievement) {
      return sendError(res, 'Achievement not found', 404);
    }

    if (branchId && branchId !== achievement.branchId.toString()) {
      const branch = await Branch.findById(branchId);
      if (!branch) {
        return sendError(res, 'Branch not found', 404);
      }
    }

    if (name && name !== achievement.name) {
      const existingAchievement = await Achievement.findOne({ name, _id: { $ne: achievementId } });
      if (existingAchievement) {
        return sendError(res, 'Achievement with this name already exists', 400);
      }
    }
    if (name) achievement.name = name;
    if (description) achievement.description = description;
    if (icon) achievement.icon = icon;
    if (category) achievement.category = category;
    if (branchId) achievement.branchId = branchId;
    if (pointsReward !== undefined) achievement.pointsReward = pointsReward;
    if (isActive !== undefined) achievement.isActive = isActive;

    if (questionsAnswered !== undefined) achievement.requirements.questionsAnswered = questionsAnswered;
    if (correctAnswers !== undefined) achievement.requirements.correctAnswers = correctAnswers;
    if (timeLimit !== undefined) achievement.requirements.timeLimit = timeLimit;
    if (isDaily !== undefined) achievement.requirements.isDaily = isDaily;
    if (timeFrame) achievement.requirements.timeFrame = timeFrame;

    await achievement.save();
    await achievement.populate('branchId', 'name category icon');

    return sendSuccess(res, 'Achievement updated successfully', achievement);
  } catch (error) {
    console.error('Error updating achievement:', error);
    return sendError(res, 'Failed to update achievement', 500);
  }
};

export const deleteAchievement = async (req, res) => {
  try {
    const { achievementId } = req.params;

    const achievement = await Achievement.findById(achievementId);
    if (!achievement) {
      return sendError(res, 'Achievement not found', 404);
    }

    achievement.isActive = false;
    await achievement.save();

    return sendSuccess(res, 'Achievement deleted successfully');
  } catch (error) {
    console.error('Error deleting achievement:', error);
    return sendError(res, 'Failed to delete achievement', 500);
  }
};

export const getAllAchievements = async (req, res) => {
  try {
    const { category, isActive } = req.query;
    
    let filter = {};
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const achievements = await Achievement.find(filter)
      .populate('branchId', 'name category icon')
      .sort({ category: 1, createdAt: -1 });

    return sendSuccess(res, 'Achievements retrieved successfully', achievements);
  } catch (error) {
    console.error('Error getting all achievements:', error);
    return sendError(res, 'Failed to retrieve achievements', 500);
  }
};

export const getAchievementById = async (req, res) => {
  try {
    const { achievementId } = req.params;

    const achievement = await Achievement.findById(achievementId)
      .populate('branchId', 'name category icon');

    if (!achievement) {
      return sendError(res, 'Achievement not found', 404);
    }

    return sendSuccess(res, 'Achievement retrieved successfully', achievement);
  } catch (error) {
    console.error('Error getting achievement by ID:', error);
    return sendError(res, 'Failed to retrieve achievement', 500);
  }
};

export const checkLevelCompletionAchievement = async (userId, branchId, category, levelsCompleted) => {
  try {
    const achievements = await Achievement.find({
      category,
      branchId,
      isActive: true,
      'requirements.levelsCompleted': { $lte: levelsCompleted }
    });

    for (const achievement of achievements) {
      let userAchievement = await UserAchievement.findOne({
        userId,
        achievementId: achievement._id
      });

      if (!userAchievement) {
        userAchievement = new UserAchievement({
          userId,
          achievementId: achievement._id,
          progress: {
            levelsCompleted: 0,
            questionsAnswered: 0,
            correctAnswers: 0,
            totalRequired: achievement.requirements.levelsCompleted,
            dailyProgress: 0,
            lastResetDate: new Date()
          },
          isCompleted: false
        });
      }

      if (userAchievement.isCompleted) {
        continue;
      }

      userAchievement.progress.levelsCompleted = levelsCompleted;

      if (userAchievement.progress.levelsCompleted >= userAchievement.progress.totalRequired) {
        userAchievement.isCompleted = true;
        userAchievement.completedAt = new Date();
        userAchievement.pointsEarned = achievement.pointsReward;
      }

      await userAchievement.save();
    }

    return true;
  } catch (error) {
    console.error('Error checking level completion achievement:', error);
    return false;
  }
};

export const checkDailyAchievementProgress = async (userId, questionId, branchId, category, isCorrect) => {
  try {
    const achievements = await Achievement.find({
      category,
      branchId,
      isActive: true,
      'requirements.isDaily': true
    });

    for (const achievement of achievements) {
      let userAchievement = await UserAchievement.findOne({
        userId,
        achievementId: achievement._id
      });

      if (!userAchievement) {
        userAchievement = new UserAchievement({
          userId,
          achievementId: achievement._id,
          progress: {
            levelsCompleted: 0,
            questionsAnswered: 0,
            correctAnswers: 0,
            totalRequired: achievement.requirements.questionsAnswered,
            dailyProgress: 0,
            lastResetDate: new Date()
          },
          isCompleted: false
        });
      }

      const today = new Date();
      const lastReset = new Date(userAchievement.progress.lastResetDate);
      const isNewDay = today.toDateString() !== lastReset.toDateString();

      if (isNewDay) {
        userAchievement.progress.dailyProgress = 0;
        userAchievement.progress.lastResetDate = today;
        userAchievement.isCompleted = false;
        userAchievement.completedAt = null;
      }

      if (userAchievement.isCompleted && !isNewDay) {
        continue;
      }

      userAchievement.progress.questionsAnswered += 1;
      userAchievement.progress.dailyProgress += 1;
      if (isCorrect) {
        userAchievement.progress.correctAnswers += 1;
      }

      if (userAchievement.progress.dailyProgress >= userAchievement.progress.totalRequired) {
        userAchievement.isCompleted = true;
        userAchievement.completedAt = new Date();
        userAchievement.pointsEarned = achievement.pointsReward;
      }

      await userAchievement.save();
    }

    return true;
  } catch (error) {
    console.error('Error checking daily achievement progress:', error);
    return false;
  }
};

export const getBranchBadgeProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { branchId } = req.params;

    if (!branchId) {
      return sendError(res, 'Branch ID is required', 400);
    }

    // Get the branch information
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return sendError(res, 'Branch not found', 404);
    }

    // Get user's level progress for this branch
    const userLevel = await UserLevel.findOne({ userId, branchId });
    
    // Get achievement for this branch (assuming there's a badge achievement)
    const achievement = await Achievement.findOne({ 
      branchId: branchId,
      isActive: true,
      category: 'badge'
    });

    // Get user's achievement progress
    let userAchievement = null;
    if (achievement) {
      userAchievement = await UserAchievement.findOne({ 
        userId, 
        achievementId: achievement._id 
      });
    }

    const completedLevels = userLevel?.completedLevels?.length || 0;
    const totalLevels = 10; // Assuming 10 levels per branch
    const progressPercentage = Math.round((completedLevels / totalLevels) * 100);
    const isBadgeEarned = completedLevels >= totalLevels;

    const response = {
      branch: {
        _id: branch._id,
        name: branch.name,
        category: branch.category,
        icon: branch.icon
      },
      badge: {
        name: achievement?.name || `${branch.name} Pro Badge`,
        description: achievement?.description || `Complete all levels in ${branch.name} to earn this badge`,
        icon: achievement?.icon || '🏅',
        isEarned: isBadgeEarned,
        earnedAt: userAchievement?.completedAt || null
      },
      progress: {
        completedLevels,
        totalLevels,
        percentage: progressPercentage,
        isCompleted: isBadgeEarned
      }
    };

    sendSuccess(res, 'Branch badge progress retrieved successfully', response);
  } catch (error) {
    console.error('Get branch badge progress error:', error);
    sendError(res, 'Internal server error while retrieving badge progress');
  }
};