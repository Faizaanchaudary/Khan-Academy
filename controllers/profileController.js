import User from '../models/User.js';
import { sendSuccess, sendError } from '../utils/response.js';
import bcrypt from 'bcryptjs';

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('-resetPasswordOTP -password');
    
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

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
        updatedAt: user.updatedAt
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

    // Update user fields
    user.firstName = firstName.trim();
    user.lastName = lastName.trim();
    user.profilePic = profilePic || null;

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
