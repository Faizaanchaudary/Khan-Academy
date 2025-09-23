import { body, param, query } from 'express-validator';

export const validateCreateAchievement = [
  body('name')
    .notEmpty()
    .withMessage('Achievement name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Achievement name must be between 3 and 100 characters')
    .trim(),
  
  body('description')
    .notEmpty()
    .withMessage('Achievement description is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Achievement description must be between 10 and 500 characters')
    .trim(),
  
  body('icon')
    .notEmpty()
    .withMessage('Achievement icon is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Achievement icon must be between 1 and 50 characters')
    .trim(),
  
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(['math', 'reading_writing'])
    .withMessage('Category must be either math or reading_writing'),
  
  body('branchId')
    .notEmpty()
    .withMessage('Branch ID is required')
    .isMongoId()
    .withMessage('Invalid branch ID format'),
  
  body('questionsAnswered')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Questions answered must be between 1 and 1000'),
  
  body('correctAnswers')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Correct answers must be between 0 and 1000'),
  
  body('timeLimit')
    .optional()
    .isInt({ min: 1, max: 3600 })
    .withMessage('Time limit must be between 1 and 3600 seconds'),
  
  body('isDaily')
    .optional()
    .isBoolean()
    .withMessage('isDaily must be a boolean value'),
  
  body('timeFrame')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'lifetime'])
    .withMessage('Time frame must be daily, weekly, monthly, or lifetime'),
  
  body('pointsReward')
    .optional()
    .isInt({ min: 0, max: 10000 })
    .withMessage('Points reward must be between 0 and 10000')
];

export const validateUpdateAchievement = [
  param('achievementId')
    .isMongoId()
    .withMessage('Invalid achievement ID format'),
  
  body('name')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Achievement name must be between 3 and 100 characters')
    .trim(),
  
  body('description')
    .optional()
    .isLength({ min: 10, max: 500 })
    .withMessage('Achievement description must be between 10 and 500 characters')
    .trim(),
  
  body('icon')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Achievement icon must be between 1 and 50 characters')
    .trim(),
  
  body('category')
    .optional()
    .isIn(['math', 'reading_writing'])
    .withMessage('Category must be either math or reading_writing'),
  
  body('branchId')
    .optional()
    .isMongoId()
    .withMessage('Invalid branch ID format'),
  
  body('questionsAnswered')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Questions answered must be between 1 and 1000'),
  
  body('correctAnswers')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Correct answers must be between 0 and 1000'),
  
  body('timeLimit')
    .optional()
    .isInt({ min: 1, max: 3600 })
    .withMessage('Time limit must be between 1 and 3600 seconds'),
  
  body('isDaily')
    .optional()
    .isBoolean()
    .withMessage('isDaily must be a boolean value'),
  
  body('timeFrame')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'lifetime'])
    .withMessage('Time frame must be daily, weekly, monthly, or lifetime'),
  
  body('pointsReward')
    .optional()
    .isInt({ min: 0, max: 10000 })
    .withMessage('Points reward must be between 0 and 10000'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value')
];

export const validateCategory = [
  param('category')
    .isIn(['math', 'reading_writing'])
    .withMessage('Category must be either math or reading_writing')
];

export const validateAchievementId = [
  param('achievementId')
    .isMongoId()
    .withMessage('Invalid achievement ID format')
];

export const validateQueryParams = [
  query('category')
    .optional()
    .isIn(['math', 'reading_writing'])
    .withMessage('Category must be either math or reading_writing'),
  
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value')
];