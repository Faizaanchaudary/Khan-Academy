import User from '../models/User.js';
import UserLevel from '../models/UserLevel.js';
import UserAnswer from '../models/UserAnswer.js';
import Branch from '../models/Branch.js';
import bcrypt from 'bcryptjs';

export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('-password -resetPasswordOTP') 
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalUsers: total,
          hasNextPage: skip + users.length < total,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving users'
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const user = await User.findById(id)
      .select('-resetPasswordOTP'); 

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User retrieved successfully',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving user'
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required'
      });
    }

    if (firstName.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'First name cannot exceed 50 characters'
      });
    }

    if (lastName.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Last name cannot exceed 50 characters'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        firstName: firstName.trim(),
        lastName: lastName.trim()
      },
      {
        new: true,
        runValidators: true
      }
    ).select('-password -resetPasswordOTP');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while updating user'
    });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'User profile retrieved successfully',
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving user profile'
    });
  }
};

export const getStudents = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const query = { role: 'student' };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const students = await User.find(query)
      .select('-password -resetPasswordOTP') 
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      message: 'Students retrieved successfully',
      data: {
        students,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalStudents: total,
          hasNextPage: skip + students.length < total,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving students'
    });
  }
};

export const updatePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (!oldPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'Old password, new password, and confirm new password are required'
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'This account does not have a password set. Please use your Google account to sign in.'
      });
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Old password is incorrect'
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from the old password'
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedNewPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while updating password'
    });
  }
};

// Helper function to format time ago
const getTimeAgo = (date) => {
  if (!date) return 'Never';
  
  const now = new Date();
  const diffInMs = now - new Date(date);
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInWeeks = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 7));
  const diffInMonths = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 30));
  const diffInYears = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 365));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
  if (diffInHours < 24) return `${diffInHours} hr ago`;
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  if (diffInWeeks < 4) return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
  return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
};

export const getStudentOverview = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search,
      topScorer,
      activeStudent,
      category
    } = req.query;

    const query = { role: 'student' };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Apply Active Student filter (filters at database level - returns only matching students)
    if (activeStudent && activeStudent.toLowerCase() !== 'all') {
      const now = new Date();
      switch (activeStudent.toLowerCase()) {
        case 'online':
          // Filter to only include students who were online within last 5 minutes
          query.lastOnline = { $gte: new Date(now.getTime() - 5 * 60 * 1000) };
          break;
        case 'offline':
          // Filter to only include students who were offline for more than 5 minutes
          query.lastOnline = { $lt: new Date(now.getTime() - 5 * 60 * 1000) };
          break;
        case 'recently online':
          // Filter to only include students who were online within last 24 hours
          query.lastOnline = { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
          break;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get all students with basic info
    const students = await User.find(query)
      .select('firstName lastName email profilePic lastOnline createdAt')
      .sort({ createdAt: -1 });

    // Get user levels for all students
    const studentIds = students.map(student => student._id);
    const userLevels = await UserLevel.find({ userId: { $in: studentIds } })
      .populate('branchId', 'name category')
      .select('userId currentLevel branchId category');

    // Create a map of userId to their highest level and progress
    const userHighestLevels = {};
    const userProgress = {};
    
    userLevels.forEach(level => {
      const userId = level.userId.toString();
      const category = level.branchId.category;
      
      // Track highest level across all branches
      if (!userHighestLevels[userId] || level.currentLevel > userHighestLevels[userId].currentLevel) {
        userHighestLevels[userId] = {
          currentLevel: level.currentLevel,
          branchName: level.branchId.name,
          category: level.branchId.category
        };
      }
      
      // Initialize progress tracking for this user
      if (!userProgress[userId]) {
        userProgress[userId] = {
          math: 0,
          reading_writing: 0,
          total: 0
        };
      }
      
      // Add progress based on current level (1% per level)
      // currentLevel represents the level they're currently on, so completed levels = currentLevel - 1
      const completedLevels = Math.max(0, level.currentLevel - 1);
      userProgress[userId][category] += completedLevels;
    });
    
    // Calculate total progress and average for each user
    Object.keys(userProgress).forEach(userId => {
      const progress = userProgress[userId];
      progress.total = progress.math + progress.reading_writing;
      progress.average = progress.total; // Sum of math and reading_writing
    });

    // Format the response with student details, highest level, and progress
    let studentsWithLevels = students.map(student => {
      const studentId = student._id.toString();
      const highestLevel = userHighestLevels[studentId] || {
        currentLevel: 0,
        branchName: 'No progress',
        category: null
      };
      
      const progress = userProgress[studentId] || {
        math: 0,
        reading_writing: 0,
        total: 0,
        average: 0
      };

      return {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        profilePic: student.profilePic,
        lastOnline: getTimeAgo(student.lastOnline),
        highestLevel: highestLevel.currentLevel,
        highestLevelBranch: highestLevel.branchName,
        category: highestLevel.category,
        progress: {
          math: progress.math,
          reading_writing: progress.reading_writing,
          total: progress.total,
          average: Math.round(progress.average * 100) / 100 // Round to 2 decimal places
        },
        createdAt: student.createdAt
      };
    });

    // Apply Top Scorer filter
    if (topScorer && topScorer.toLowerCase() !== 'all') {
      switch (topScorer.toLowerCase()) {
        case 'math':
          // Filter students who have math progress and find the highest level in math
          const mathStudents = studentsWithLevels.filter(student => student.progress.math > 0);
          if (mathStudents.length > 0) {
            const maxMathLevel = Math.max(...mathStudents.map(student => {
              // Get the highest level for math category
              const mathLevels = userLevels.filter(level => 
                level.userId.toString() === student._id.toString() && 
                level.branchId.category === 'math'
              );
              return mathLevels.length > 0 ? Math.max(...mathLevels.map(l => l.currentLevel)) : 0;
            }));
            
            studentsWithLevels = studentsWithLevels.filter(student => {
              if (student.progress.math === 0) return false;
              const studentMathLevels = userLevels.filter(level => 
                level.userId.toString() === student._id.toString() && 
                level.branchId.category === 'math'
              );
              const studentMaxMathLevel = studentMathLevels.length > 0 ? Math.max(...studentMathLevels.map(l => l.currentLevel)) : 0;
              return studentMaxMathLevel === maxMathLevel;
            });
          } else {
            studentsWithLevels = [];
          }
          break;
        case 'english':
        case 'grammar':
          // Filter students who have reading_writing progress and find the highest level in reading_writing
          const readingStudents = studentsWithLevels.filter(student => student.progress.reading_writing > 0);
          if (readingStudents.length > 0) {
            const maxReadingLevel = Math.max(...readingStudents.map(student => {
              // Get the highest level for reading_writing category
              const readingLevels = userLevels.filter(level => 
                level.userId.toString() === student._id.toString() && 
                level.branchId.category === 'reading_writing'
              );
              return readingLevels.length > 0 ? Math.max(...readingLevels.map(l => l.currentLevel)) : 0;
            }));
            
            studentsWithLevels = studentsWithLevels.filter(student => {
              if (student.progress.reading_writing === 0) return false;
              const studentReadingLevels = userLevels.filter(level => 
                level.userId.toString() === student._id.toString() && 
                level.branchId.category === 'reading_writing'
              );
              const studentMaxReadingLevel = studentReadingLevels.length > 0 ? Math.max(...studentReadingLevels.map(l => l.currentLevel)) : 0;
              return studentMaxReadingLevel === maxReadingLevel;
            });
          } else {
            studentsWithLevels = [];
          }
          break;
        default:
          // Keep all students if no specific criteria
          break;
      }
    }

    // Apply Category filter (level-based filtering/sorting)
    if (category && category.toLowerCase() !== 'all') {
      switch (category.toLowerCase()) {
        case 'lowest score':
          // Find the lowest level among all students
          const minLevel = Math.min(...studentsWithLevels.map(student => student.highestLevel));
          // Filter to only include students with the lowest level
          studentsWithLevels = studentsWithLevels.filter(student => student.highestLevel === minLevel);
          // Sort by highest level ascending (in case of ties)
          studentsWithLevels.sort((a, b) => a.highestLevel - b.highestLevel);
          break;
        case 'highest score':
          // Find the highest level among all students
          const maxLevel = Math.max(...studentsWithLevels.map(student => student.highestLevel));
          // Filter to only include students with the highest level
          studentsWithLevels = studentsWithLevels.filter(student => student.highestLevel === maxLevel);
          // Sort by highest level descending (in case of ties)
          studentsWithLevels.sort((a, b) => b.highestLevel - a.highestLevel);
          break;
        default:
          // Keep original sorting (by createdAt)
          break;
      }
    }

    // Apply pagination after filtering
    const totalFiltered = studentsWithLevels.length;
    const paginatedStudents = studentsWithLevels.slice(skip, skip + parseInt(limit));

    // Only include filters that were actually provided
    const appliedFilters = {};
    if (topScorer) appliedFilters.topScorer = topScorer;
    if (activeStudent) appliedFilters.activeStudent = activeStudent;
    if (category) appliedFilters.category = category;

    res.json({
      success: true,
      message: 'Student overview retrieved successfully',
      data: {
        students: paginatedStudents,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalFiltered / parseInt(limit)),
          totalStudents: totalFiltered,
          hasNextPage: skip + paginatedStudents.length < totalFiltered,
          hasPrevPage: parseInt(page) > 1
        },
        filters: appliedFilters
      }
    });
  } catch (error) {
    console.error('Get student overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving student overview'
    });
  }
};

export const getDailyQuestionsCount = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Count questions answered in the last 24 hours
    const dailyQuestionsCount = await UserAnswer.countDocuments({
      userId: userId,
      answeredAt: { $gte: twentyFourHoursAgo }
    });

    // Get additional stats for context
    const totalQuestionsAnswered = await UserAnswer.countDocuments({
      userId: userId
    });

    // Get today's date for reference
    const today = new Date().toISOString().split('T')[0];

    res.json({
      success: true,
      message: 'Daily questions count retrieved successfully',
      data: {
        dailyQuestionsCount,
        totalQuestionsAnswered,
        date: today,
        goal: 10, // Daily goal is 10 questions
        progressPercentage: Math.min(Math.round((dailyQuestionsCount / 10) * 100), 100) // Cap at 100%
      }
    });
  } catch (error) {
    console.error('Get daily questions count error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving daily questions count'
    });
  }
};