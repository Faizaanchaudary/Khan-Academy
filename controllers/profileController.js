import User from '../models/User.js';
import UserLevel from '../models/UserLevel.js';
import QuestionPacketAnswer from '../models/QuestionPacketAnswer.js';
import { sendSuccess, sendError } from '../utils/response.js';
import bcrypt from 'bcryptjs';
import cloudinary from '../config/cloudinary.js';

// Calculate overall level for a user
const calculateUserOverallLevel = async (userId) => {
  try {
    // Get all user levels to check branch completions
    const userLevels = await UserLevel.find({ userId }).populate('branchId', 'name category');
    
    // Count completed branches (branches where all 10 levels are completed)
    const completedBranches = userLevels.filter(userLevel => 
      userLevel.completedLevels.length === 10
    );

    // Get completed question packets
    const completedQuestionPackets = await QuestionPacketAnswer.find({
      userId,
      isCompleted: true
    });

    let overallLevel = 0;

    // Calculate overall level based on the specified flow
    if (completedBranches.length >= 1) {
      overallLevel = 1;
    }

    if (completedBranches.length >= 3) {
      overallLevel = 2;
    }

    if (completedBranches.length >= 6) {
      overallLevel = 3;
    }

    // After level 3, question packets start counting
    if (overallLevel >= 3) {
      const questionPacketLevels = Math.floor(completedQuestionPackets.length / 3);
      if (questionPacketLevels >= 1) {
        overallLevel = 3 + questionPacketLevels;
      }
    }

    return overallLevel;
  } catch (error) {
    console.error('Error calculating overall level:', error);
    return 0; // Default to 0 if calculation fails
  }
};

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('-resetPasswordOTP -password');
    
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Calculate overall level
    const overallLevel = await calculateUserOverallLevel(userId);

    sendSuccess(res, 'Profile retrieved successfully', {
      user: {
        profilePic: user.profilePic,
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        password: '', // Return empty string for password field (frontend will provide new password in edit)
        _id: user._id,
        provider: user.provider,
        isEmailVerified: user.isEmailVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        overallLevel: overallLevel
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    sendError(res, 'Internal server error while retrieving profile');
  }
};

// Update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, profilePic, password } = req.body;

    // Validate required fields
    if (!firstName || !lastName) {
      return sendError(res, 'First name and last name are required', 400);
    }

    if (firstName.trim().length < 2) {
      return sendError(res, 'First name must be at least 2 characters long', 400);
    }

    if (lastName.trim().length < 2) {
      return sendError(res, 'Last name must be at least 2 characters long', 400);
    }

    // Validate password if provided
    if (password && password.trim()) {
      if (password.length < 6) {
        return sendError(res, 'Password must be at least 6 characters long', 400);
      }
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Handle profile picture URL (could be Cloudinary or external)
    if (profilePic !== undefined) {
      // If a new Cloudinary URL is being set but already have one, delete the old one
      if (profilePic && user.profilePic && user.profilePic.includes('cloudinary.com')) {
        if (user.profilePic !== profilePic) {
          await deleteCloudinaryImage(user.profilePic);
        }
      }
      user.profilePic = profilePic || null;
    } else {
      // If no profilePic in request, don't modify existing profilePic
    }

    // Update user fields
    user.firstName = firstName.trim();
    user.lastName = lastName.trim();

    // Hash and update password if provided
    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password.trim(), salt);
      user.password = hashedPassword;
    }

    await user.save();

    // Return updated user data (excluding sensitive fields)
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.resetPasswordOTP;

    sendSuccess(res, 'Profile updated successfully', {
      user: {
        _id: userResponse._id,
        firstName: userResponse.firstName,
        lastName: userResponse.lastName,
        email: userResponse.email,
        role: userResponse.role,
        provider: userResponse.provider,
        profilePic: userResponse.profilePic,
        password: '', // Return empty string for password field
        isEmailVerified: userResponse.isEmailVerified,
        lastLogin: userResponse.lastLogin,
        createdAt: userResponse.createdAt,
        updatedAt: userResponse.updatedAt
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    sendError(res, 'Internal server error while updating profile');
  }
};

// Upload profile picture using Cloudinary
export const uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return sendError(res, 'No image file provided', 400);
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Delete old profile picture from Cloudinary if exists
    if (user.profilePic && user.profilePic.includes('cloudinary.com')) {
      await deleteCloudinaryImage(user.profilePic);
    }

    // Convert file to base64 for Cloudinary upload
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(dataURI, {
      public_id: `profile_pictures/${userId}_${Date.now()}`,
      folder: 'khan-academy/profile_pictures',
      resource_type: 'image',
      transformation: [
        { width: 500, height: 500, crop: 'fill', gravity: 'center' },
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });

    // Update user profilePic with new Cloudinary URL
    user.profilePic = uploadResult.secure_url;
    await user.save();

    sendSuccess(res, 'Profile picture uploaded successfully', {
      profilePic: uploadResult.secure_url
    });

  } catch (error) {
    console.error('Upload profile picture error:', error);
    sendError(res, 'Internal server error while uploading profile picture');
  }
};

// Delete profile picture
export const deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    if (!user.profilePic) {
      return sendError(res, 'No profile picture to delete', 400);
    }

    // Delete from Cloudinary if it's a Cloudinary URL
    if (user.profilePic.includes('cloudinary.com')) {
      await deleteCloudinaryImage(user.profilePic);
    }

    // Clear profile picture from user record
    user.profilePic = null;
    await user.save();

    sendSuccess(res, 'Profile picture deleted successfully');

  } catch (error) {
    console.error('Delete profile picture error:', error);
    sendError(res, 'Internal server error while deleting profile picture');
  }
};

// Helper function to delete image from Cloudinary
const deleteCloudinaryImage = async (imageUrl) => {
  try {
    // Extract public_id from the URL
    const splitUrl = imageUrl.split('/');
    const publicIdWithFormat = splitUrl[splitUrl.length - 1];
    const publicId = publicIdWithFormat.split('.')[0];
    
    if (splitUrl.length > 3) {
      const folderPart = splitUrl[splitUrl.length - 2];
      const fullPublicId = `${folderPart}/${publicId}`;
      await cloudinary.uploader.destroy(fullPublicId);
    }
  } catch (error) {
    console.log('Error deleting image from Cloudinary:', error);
    throw error;
  }
};

// Change password
export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      return sendError(res, 'Current password, new password, and confirmation are required', 400);
    }

    // Validate password confirmation
    if (newPassword !== confirmPassword) {
      return sendError(res, 'New password confirmation does not match', 400);
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      return sendError(res, 'New password must be at least 6 characters long', 400);
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return sendError(res, 'New password must contain at least one uppercase letter, one lowercase letter, and one number', 400);
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Check if user has a password (not OAuth user)
    if (!user.password) {
      return sendError(res, 'Password change not available for OAuth users', 400);
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return sendError(res, 'Current password is incorrect', 400);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedNewPassword;
    await user.save();

    sendSuccess(res, 'Password changed successfully');

  } catch (error) {
    console.error('Change password error:', error);
    sendError(res, 'Internal server error while changing password');
  }
};

// Delete user account
export const deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    // For OAuth users, no password required
    const user = await User.findById(userId);
    
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // For email users, require password confirmation
    if (user.password) {
      if (!password) {
        return sendError(res, 'Password is required to delete account', 400);
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return sendError(res, 'Incorrect password', 400);
      }
    }

    // Delete user account
    await User.findByIdAndDelete(userId);

    sendSuccess(res, 'Account deleted successfully');

  } catch (error) {
    console.error('Delete account error:', error);
    sendError(res, 'Internal server error while deleting account');
  }
};
