import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  deleteUserAccount
} from '../controllers/profileController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get user profile (protected route)
router.get('/', authenticate, getUserProfile);

// Update user profile (protected route)
router.put('/', authenticate, updateUserProfile);

// Change password (protected route)
router.put('/change-password', authenticate, changePassword);

// Delete user account (protected route)
router.delete('/', authenticate, deleteUserAccount);

export default router;
