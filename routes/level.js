import express from 'express';
import {
  getUserLevels,
  getLevelQuestions,
  submitLevelAnswer,
  getBranchProgress,
  calculateOverallLevel
} from '../controllers/levelController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);



router.get('/', getUserLevels);
router.get('/branch/:branchId/progress', getBranchProgress);
router.get('/branch/:branchId/level/:level', getLevelQuestions);
router.post('/question/:questionId/answer', submitLevelAnswer);
router.get('/overall', calculateOverallLevel);



export default router;
