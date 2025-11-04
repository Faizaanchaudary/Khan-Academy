import express from 'express';
import {
  getAllQuestions,
  getQuestionsByBranch,
  getQuestionsByCategory,
  getQuestionById,
  createQuestion,
  createBulkQuestions,
  updateQuestion,
  deleteQuestion,
  submitAnswer,
  getUserAnswers,
  getUserStats,
  getUserLevelProgress,
  getFilteredQuestions,
  getQuestionCount,
} from '../controllers/questionController.js';
import { authenticate, requireActiveSubscription } from '../middleware/auth.js';
import { validateQuestionCreation, validateBulkQuestionCreation } from '../middleware/validation.js';
import { uploadQuestionImage } from '../middleware/upload.js';
import { parseFormData } from '../middleware/parseFormData.js';

const router = express.Router();

router.get('/', getAllQuestions);
router.get('/count', getQuestionCount);
router.get('/filtered', authenticate, requireActiveSubscription, getFilteredQuestions);
router.get('/category/:category', getQuestionsByCategory);
router.get('/branch/:branchId', getQuestionsByBranch);
router.get('/:questionId', getQuestionById);
router.post('/', authenticate, uploadQuestionImage, parseFormData, validateQuestionCreation, createQuestion);
router.post('/bulk', authenticate, validateBulkQuestionCreation, createBulkQuestions);
router.put('/:questionId', authenticate, updateQuestion);
router.delete('/:questionId', authenticate, deleteQuestion);
router.post('/:questionId/answer', authenticate, requireActiveSubscription, submitAnswer);
router.get('/user/answers', authenticate, requireActiveSubscription, getUserAnswers);
router.get('/user/stats', authenticate, requireActiveSubscription, getUserStats);
router.get('/user/level-progress/:branchId', authenticate, requireActiveSubscription, getUserLevelProgress);

export default router;