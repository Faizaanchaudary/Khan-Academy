import express from 'express';
import {
  createSubscription,
  getUserSubscription,
  getSubscriptionById,
  getAllSubscriptions,
  cancelSubscription,
  renewSubscription,
  getSubscriptionAnalytics,
  checkSubscriptionStatus
} from '../controllers/subscriptionController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticate, createSubscription);
router.get('/my-subscription', authenticate, getUserSubscription);
router.get('/status', authenticate, checkSubscriptionStatus);
router.put('/:subscriptionId/cancel', authenticate, cancelSubscription);
router.put('/:subscriptionId/renew', authenticate, renewSubscription);

router.get('/all', authenticate, getAllSubscriptions);
router.get('/analytics', authenticate, getSubscriptionAnalytics);
router.get('/:subscriptionId', authenticate, getSubscriptionById);

export default router;
