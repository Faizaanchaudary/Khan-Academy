import express from 'express';
import {
  getAvailablePlans,
  selectPlan,
  getCurrentSubscription
} from '../controllers/planSelectionController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all available plans (public route)
router.get('/plans', getAvailablePlans);

// Get user's current subscription (protected route)
router.get('/current-subscription', authenticate, getCurrentSubscription);

// Select a plan (protected route)
router.post('/select-plan', authenticate, selectPlan);

export default router;
