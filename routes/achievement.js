import express from 'express';
import {
  getUserAchievements,
  getAchievementsByCategory,
  getCompletedAchievements,
  getAchievementStats,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  getAllAchievements,
  getAchievementById,
  getBranchBadgeProgress
} from '../controllers/achievementController.js';
import { authenticate, requireActiveSubscription } from '../middleware/auth.js';
import {
  validateCreateAchievement,
  validateUpdateAchievement,
  validateCategory,
  validateAchievementId,
  validateQueryParams
} from '../middleware/achievementValidation.js';

const router = express.Router();

router.use(authenticate);
router.use(requireActiveSubscription);



router.get('/', getUserAchievements);
router.get('/branch/:branchId/badge', getBranchBadgeProgress);
router.get('/category/:category', validateCategory, getAchievementsByCategory);
router.get('/completed', getCompletedAchievements);
router.get('/stats', getAchievementStats);
router.get('/admin/all', validateQueryParams, getAllAchievements);
router.get('/admin/:achievementId', validateAchievementId, getAchievementById);
router.post('/admin/create', validateCreateAchievement, createAchievement);
router.put('/admin/:achievementId', validateUpdateAchievement, updateAchievement);
router.delete('/admin/:achievementId', validateAchievementId, deleteAchievement);



export default router;
