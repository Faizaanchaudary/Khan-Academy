import express from 'express';
const router = express.Router();
import {
  register,
  login,
  googleSignIn,
  appleSignIn,
  sendPasswordResetOTP,
  verifyPasswordResetOTP,
  resetPassword,
  resendPasswordResetOTP,
  sendEmailVerificationOTP,
  verifyEmailOTP,
  logout,
} from '../controllers/authController.js';
import { verifyFirebaseToken, verifyJWT, authenticate } from '../middleware/auth.js';
import {
  validateUserRegistration,
  validateUserLogin,
  validatePasswordResetRequest,
  validateOTPVerification,
  validatePasswordReset,
} from '../middleware/validation.js';

router.post('/register', validateUserRegistration, register);
router.post('/login', validateUserLogin, login);
router.post('/google-signin', googleSignIn);
router.post('/apple-signin', appleSignIn);
router.post('/logout', authenticate, logout);

router.post('/forgot-password', validatePasswordResetRequest, sendPasswordResetOTP);
router.post('/resend-otp', validatePasswordResetRequest, resendPasswordResetOTP);
router.post('/verify-otp', validateOTPVerification, verifyPasswordResetOTP);
router.post('/reset-password', validatePasswordReset, resetPassword);

router.post('/send-email-verification', validatePasswordResetRequest, sendEmailVerificationOTP);
router.post('/verify-email', validateOTPVerification, verifyEmailOTP);

export default router;