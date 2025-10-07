import Branch from '../models/Branch.js';
import GuideBook from '../models/GuideBook.js';
import UserLevel from '../models/UserLevel.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const getAllBranches = async (req, res) => {
  try {
    const branches = await Branch.find()
      .sort({ category: 1, createdAt: 1 })
      .lean();

    // Check if user is authenticated
    const userId = req.user?.id;
    let userLevels = [];

    console.log('Branches API - User ID:', userId);
    console.log('Branches API - User object:', req.user ? 'Present' : 'Not present');

    if (userId) {
      // Fetch user levels for all branches
      userLevels = await UserLevel.find({ userId })
        .populate('branchId', 'name category icon')
        .lean();
      
      console.log('Branches API - User levels found:', userLevels.length);
    }

    // Helper function to add user level info to branches
    const addUserLevelInfo = (branchList) => {
      return branchList.map(branch => {
        const userLevel = userLevels.find(ul => ul.branchId._id.toString() === branch._id.toString());
        
        if (userLevel) {
          return {
            ...branch,
            userProgress: {
              currentLevel: userLevel.currentLevel,
              totalLevels: 10,
              completedLevels: userLevel.completedLevels.length,
              completedLevelsArray: userLevel.completedLevels.map(cl => cl.level),
              isUnlocked: userLevel.isUnlocked,
              progressPercentage: Math.round((userLevel.completedLevels.length / 10) * 100)
            }
          };
        } else {
          return {
            ...branch,
            userProgress: {
              currentLevel: 1,
              totalLevels: 10,
              completedLevels: 0,
              isUnlocked: true,
              progressPercentage: 0
            }
          };
        }
      });
    };

    const mathBranches = branches.filter(branch => branch.category === 'math');
    const readingWritingBranches = branches.filter(branch => branch.category === 'reading_writing');

    const response = {
      mathBranches: addUserLevelInfo(mathBranches),
      readingWritingBranches: addUserLevelInfo(readingWritingBranches)
    };

    sendSuccess(res, 'Branches retrieved successfully', response);
  } catch (error) {
    console.error('Get branches error:', error);
    sendError(res, 'Internal server error while retrieving branches');
  }
};

export const getBranchById = async (req, res) => {
  try {
    const { branchId } = req.params;

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return sendError(res, 'Branch not found', 404);
    }

    sendSuccess(res, 'Branch retrieved successfully', { branch });
  } catch (error) {
    console.error('Get branch error:', error);
    sendError(res, 'Internal server error while retrieving branch');
  }
};

export const createBranch = async (req, res) => {
  try {
    const { name, description, icon, category } = req.body;

    if (!name || !description || !icon || !category) {
      return sendError(res, 'Name, description, icon, and category are required', 400);
    }

    const existingBranch = await Branch.findOne({ name, category });
    if (existingBranch) {
      return sendError(res, 'Branch with this name already exists in this category', 400);
    }

    const branch = new Branch({
      name,
      description,
      icon,
      category
    });

    await branch.save();

    sendSuccess(res, 'Branch created successfully', { branch }, 201);
  } catch (error) {
    console.error('Create branch error:', error);
    sendError(res, 'Internal server error while creating branch');
  }
};

export const updateBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { name, description, icon, category } = req.body;

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return sendError(res, 'Branch not found', 404);
    }

    if (name) branch.name = name;
    if (description) branch.description = description;
    if (icon) branch.icon = icon;
    if (category) branch.category = category;

    await branch.save();

    sendSuccess(res, 'Branch updated successfully', { branch });
  } catch (error) {
    console.error('Update branch error:', error);
    sendError(res, 'Internal server error while updating branch');
  }
};

export const getBranchesByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    if (!category || !['math', 'reading_writing'].includes(category)) {
      return sendError(res, 'Invalid category. Must be either "math" or "reading_writing"', 400);
    }

    const branches = await Branch.find({ category })
      .sort({ createdAt: 1 })
      .lean();

    // Check if user is authenticated
    const userId = req.user?.id;
    let userLevels = [];

    console.log('Branches by Category API - User ID:', userId);
    console.log('Branches by Category API - User object:', req.user ? 'Present' : 'Not present');

    if (userId) {
      // Fetch user levels for branches in this category
      userLevels = await UserLevel.find({ userId, category })
        .populate('branchId', 'name category icon')
        .lean();
      
      console.log('Branches by Category API - User levels found:', userLevels.length);
    }

    // Helper function to add user level info to branches
    const addUserLevelInfo = (branchList) => {
      return branchList.map(branch => {
        const userLevel = userLevels.find(ul => ul.branchId._id.toString() === branch._id.toString());
        
        if (userLevel) {
          return {
            ...branch,
            userProgress: {
              currentLevel: userLevel.currentLevel,
              totalLevels: 10,
              completedLevels: userLevel.completedLevels.length,
              completedLevelsArray: userLevel.completedLevels.map(cl => cl.level),
              isUnlocked: userLevel.isUnlocked,
              progressPercentage: Math.round((userLevel.completedLevels.length / 10) * 100)
            }
          };
        } else {
          return {
            ...branch,
            userProgress: {
              currentLevel: 1,
              totalLevels: 10,
              completedLevels: 0,
              isUnlocked: true,
              progressPercentage: 0
            }
          };
        }
      });
    };

    const branchesWithUserProgress = addUserLevelInfo(branches);

    sendSuccess(res, `Branches for ${category} category retrieved successfully`, { 
      category, 
      branches: branchesWithUserProgress,
      count: branchesWithUserProgress.length 
    });
  } catch (error) {
    console.error('Get branches by category error:', error);
    sendError(res, 'Internal server error while retrieving branches by category');
  }
};

export const getBranchBasicInfo = async (req, res) => {
  try {
    const { branchId } = req.params;

    const branch = await Branch.findById(branchId).select('name description');
    if (!branch) {
      return sendError(res, 'Branch not found', 404);
    }

    sendSuccess(res, 'Branch basic info retrieved successfully', { 
      name: branch.name, 
      description: branch.description 
    });
  } catch (error) {
    console.error('Get branch basic info error:', error);
    sendError(res, 'Internal server error while retrieving branch basic info');
  }
};

export const deleteBranch = async (req, res) => {
  try {
    const { branchId } = req.params;

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return sendError(res, 'Branch not found', 404);
    }

    await Branch.findByIdAndDelete(branchId);

    sendSuccess(res, 'Branch deleted successfully');
  } catch (error) {
    console.error('Delete branch error:', error);
    sendError(res, 'Internal server error while deleting branch');
  }
};

// Guide Book Controllers
export const createGuideBook = async (req, res) => {
  try {
    const { branchId, title, description } = req.body;

    if (!branchId || !title || !description) {
      return sendError(res, 'Branch ID, title, and description are required', 400);
    }

    // Validate that the branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return sendError(res, 'Branch not found', 404);
    }

    // Check if guide book already exists for this branch
    const existingGuideBook = await GuideBook.findOne({ branchId });
    if (existingGuideBook) {
      return sendError(res, 'Guide book already exists for this branch', 400);
    }

    // Validate description structure
    if (!description.sections || !Array.isArray(description.sections)) {
      return sendError(res, 'Description must contain sections array', 400);
    }

    // Validate each section
    for (const section of description.sections) {
      if (!section.heading || !section.content || !Array.isArray(section.content)) {
        return sendError(res, 'Each section must have heading and content array', 400);
      }
    }

    const guideBook = new GuideBook({
      branchId,
      title,
      description
    });

    await guideBook.save();

    // Populate branch details
    await guideBook.populate('branchId', 'name category');

    sendSuccess(res, 'Guide book created successfully', { guideBook }, 201);
  } catch (error) {
    console.error('Create guide book error:', error);
    sendError(res, 'Internal server error while creating guide book');
  }
};

export const getGuideBookByBranchId = async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!branchId) {
      return sendError(res, 'Branch ID is required', 400);
    }

    // Validate that the branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return sendError(res, 'Branch not found', 404);
    }

    const guideBook = await GuideBook.findOne({ branchId, isActive: true })
      .populate('branchId', 'name category description icon');

    if (!guideBook) {
      return sendError(res, 'Guide book not found for this branch', 404);
    }

    sendSuccess(res, 'Guide book retrieved successfully', { guideBook });
  } catch (error) {
    console.error('Get guide book error:', error);
    sendError(res, 'Internal server error while retrieving guide book');
  }
};

