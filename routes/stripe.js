import express from 'express';
import {
  createStripePaymentIntent,
  confirmStripePayment,
  getStripePaymentIntent,
  cancelStripePayment,
  handleStripeWebhook,
  getStripeInfo,
  getUserStripeSubscriptions,
  refundStripePayment
} from '../controllers/stripeController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public webhook endpoint (no authentication required)
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Stripe environment info (public)
router.get('/info', getStripeInfo);

// Protected routes (require authentication)
router.post('/create-payment-intent', authenticate, createStripePaymentIntent);
router.post('/confirm-payment/:paymentIntentId', authenticate, confirmStripePayment);
router.get('/payment-intent/:paymentIntentId', authenticate, getStripePaymentIntent);
router.post('/cancel-payment/:paymentIntentId', authenticate, cancelStripePayment);
router.get('/subscriptions', authenticate, getUserStripeSubscriptions);
router.post('/refund/:subscriptionId', authenticate, refundStripePayment);

export default router;
