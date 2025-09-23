import express from 'express';
import {
  createPayPalOrder,
  capturePayPalPayment,
  getPayPalOrder,
  cancelPayPalOrder,
  handlePayPalWebhook,
  getPayPalInfo,
  getUserPayPalSubscriptions
} from '../controllers/paypalController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public webhook endpoint (no authentication required)
router.post('/webhook', handlePayPalWebhook);

// PayPal environment info (public)
router.get('/info', getPayPalInfo);

// Protected routes (require authentication)
router.post('/create-order', authenticate, createPayPalOrder);
router.post('/capture/:orderId', authenticate, capturePayPalPayment);
router.get('/order/:orderId', authenticate, getPayPalOrder);
router.post('/cancel/:orderId', authenticate, cancelPayPalOrder);
router.get('/subscriptions', authenticate, getUserPayPalSubscriptions);

export default router;
