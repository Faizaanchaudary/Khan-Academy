import express from 'express';
import {
  getUserLevels,
  getLevelQuestions,
  submitLevelAnswer,
  getBranchProgress,
  calculateOverallLevel,
  getUserDetailedProgress
} from '../controllers/levelController.js';
import { authenticate, requireActiveSubscription } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
router.use(requireActiveSubscription);



router.get('/', getUserLevels);
router.get('/branch/:branchId/progress', getBranchProgress);
router.get('/branch/:branchId/level/:level', getLevelQuestions);
router.post('/question/:questionId/answer', submitLevelAnswer);
router.get('/overall', calculateOverallLevel);
router.get('/detailed-progress', getUserDetailedProgress);



export default router;
