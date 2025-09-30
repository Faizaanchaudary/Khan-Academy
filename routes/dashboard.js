import express from 'express';
import {
  getDashboardStats,
  getUserStats,
  getReviewStats,
  getQuestionPacketStats
} from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Main dashboard statistics endpoint
router.get('/stats', authenticate, getDashboardStats);

// Detailed statistics endpoints
router.get('/users', authenticate, getUserStats);
router.get('/reviews', authenticate, getReviewStats);
router.get('/question-packets', authenticate, getQuestionPacketStats);

export default router;
