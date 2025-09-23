import express from 'express';
import {
  generateSignupLink,
  validateInvitation,
  signupWithInvitation,
  getInvitations
} from '../controllers/invitationController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import {
  validateUserRegistration,
  validateInvitationGeneration
} from '../middleware/validation.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/validate/:token', validateInvitation);
router.post('/signup', validateUserRegistration, signupWithInvitation);

// Protected routes (authentication required)
router.use(authenticate);

// Admin only routes
router.post('/generate', validateInvitationGeneration, generateSignupLink);
router.get('/', getInvitations);

export default router;
