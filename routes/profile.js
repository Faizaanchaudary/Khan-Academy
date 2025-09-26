import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  uploadProfilePicture,
  deleteProfilePicture,
  changePassword,
  deleteUserAccount
} from '../controllers/profileController.js';
import { authenticate } from '../middleware/auth.js';
import { uploadProfilePicture as uploadMiddleware } from '../middleware/upload.js';

const router = express.Router();

// Get user profile (protected route)
router.get('/', authenticate, getUserProfile);

// Update user profile (protected route)
router.put('/', authenticate, updateUserProfile);

// Upload profile picture (protected route)
router.post('/upload-picture', authenticate, uploadMiddleware, uploadProfilePicture);

// Delete profile picture (protected route)
router.delete('/delete-picture', authenticate, deleteProfilePicture);

// Change password (protected route)
router.put('/change-password', authenticate, changePassword);

// Delete user account (protected route)
router.delete('/', authenticate, deleteUserAccount);

export default router;
