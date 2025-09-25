import express from 'express';
import {
  getAllQuestions,
  getQuestionsByBranch,
  getQuestionsByCategory,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  submitAnswer,
  getUserAnswers,
  getUserStats,
  getUserLevelProgress,
} from '../controllers/questionController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getAllQuestions);
router.get('/category/:category', getQuestionsByCategory);
router.get('/branch/:branchId', getQuestionsByBranch);
router.get('/:questionId', getQuestionById);
router.post('/', createQuestion);
router.put('/:questionId', authenticate, updateQuestion);
router.delete('/:questionId', authenticate, deleteQuestion);
router.post('/:questionId/answer', authenticate, submitAnswer);
router.get('/user/answers', authenticate, getUserAnswers);
router.get('/user/stats', authenticate, getUserStats);
router.get('/user/level-progress/:branchId', authenticate, getUserLevelProgress);

export default router;