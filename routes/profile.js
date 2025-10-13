import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  uploadProfilePicture,
  deleteProfilePicture,
  changePassword,
  deleteUserAccount
} from '../controllers/profileController.js';
import { authenticate, requireActiveSubscription } from '../middleware/auth.js';
import { uploadProfilePicture as uploadMiddleware } from '../middleware/upload.js';

const router = express.Router();

// Get user profile (protected route)
router.get('/', authenticate, requireActiveSubscription, getUserProfile);

// Update user profile (protected route)
router.put('/', authenticate, requireActiveSubscription, updateUserProfile);

// Upload profile picture (protected route)
router.post('/upload-picture', authenticate, requireActiveSubscription, uploadMiddleware, uploadProfilePicture);

// Delete profile picture (protected route)
router.delete('/delete-picture', authenticate, requireActiveSubscription, deleteProfilePicture);

// Change password (protected route)
router.put('/change-password', authenticate, requireActiveSubscription, changePassword);

// Delete user account (protected route)
router.delete('/', authenticate, requireActiveSubscription, deleteUserAccount);

export default router;
