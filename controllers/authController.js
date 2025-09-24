import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import jwksClient from 'jwks-client';
import User from '../models/User.js';
import TokenBlacklist from '../models/TokenBlacklist.js';
import { admin } from '../config/firebase.js';
import { sendPasswordResetEmail } from '../config/email.js';
import { normalizeEmail } from '../utils/emailUtils.js';

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'jwt-key-12345', {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

export const register = async (req, res) => {
  try {
    const { email, password, confirmPassword, role} = req.body;

    const normalizedEmail = normalizeEmail(email);

    // Validate password confirmation
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password confirmation does not match'
      });
    }
  
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email address'
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      provider: 'email' ,
      role ,
    });

    const token = generateToken(user._id);
    user.lastLogin = new Date();
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = normalizeEmail(email);
   
  const user = await User.findOne({ email: normalizedEmail });
  
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User Not Found'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = generateToken(user._id);

    user.lastLogin = new Date();
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};

export const googleSignIn = async (req, res) => {
  try {
    console.log('Google Sign-in request received:', { body: req.body, headers: req.headers });
    const { idToken } = req.body;

    if (!idToken) {
      console.log('No ID token provided');
      return res.status(400).json({
        success: false,
        message: 'ID token is required'
      });
    }
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      user = await User.create({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        firstName: decodedToken.name?.split(' ')[0] || 'User',
        lastName: decodedToken.name?.split(' ').slice(1).join(' ') || '',
        provider: 'google',
        isEmailVerified: decodedToken.email_verified || false,
        profilePicture: decodedToken.picture || null
      });
    } else {
      user.lastLogin = new Date();
      await user.save();
    }

    const token = generateToken(user._id);
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Google sign-in successful',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Google sign-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during Google sign-in'
    });
  }
};

const verifyAppleIdToken = async (idToken) => {
  try {
    const decodedHeader = jwt.decode(idToken, { complete: true });
    if (!decodedHeader || !decodedHeader.header.kid) {
      throw new Error('Invalid token header');
    }

    const client = jwksClient({
      jwksUri: 'https://appleid.apple.com/auth/keys',
      cache: true,
      cacheMaxAge: 600000,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: 'https://appleid.apple.com/auth/keys'
    });

    const key = await client.getSigningKey(decodedHeader.header.kid);
    const signingKey = key.getPublicKey();

    const decoded = jwt.verify(idToken, signingKey, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience: process.env.APPLE_CLIENT_ID || 'your.app.bundle.id'
    });

    return decoded;
  } catch (error) {
    console.error('Apple token verification error:', error);
    throw new Error('Invalid Apple ID token');
  }
};

export const appleSignIn = async (req, res) => {
  try {
    console.log('Apple Sign-in request received:', { body: req.body, headers: req.headers });
    const { idToken, user } = req.body;

    if (!idToken) {
      console.log('No Apple ID token provided');
      return res.status(400).json({
        success: false,
        message: 'Apple ID token is required'
      });
    }

    const decodedToken = await verifyAppleIdToken(idToken);
    
    const appleId = decodedToken.sub;
    const email = decodedToken.email;
    
    let firstName = 'User';
    let lastName = '';
    
    if (user && user.name) {
      firstName = user.name.firstName || 'User';
      lastName = user.name.lastName || '';
    }

    let existingUser = await User.findOne({ 
      $or: [
        { appleId: appleId },
        { email: email }
      ]
    });
    
    if (!existingUser) {
      existingUser = await User.create({
        appleId: appleId,
        email: email,
        firstName: firstName,
        lastName: lastName,
        provider: 'apple',
        isEmailVerified: decodedToken.email_verified || false
      });
    } else {
      if (!existingUser.appleId) {
        existingUser.appleId = appleId;
        existingUser.provider = 'apple';
      }
      
      existingUser.lastLogin = new Date();
      await existingUser.save();
    }

    const token = generateToken(existingUser._id);
    const userResponse = existingUser.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Apple sign-in successful',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Apple sign-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during Apple sign-in'
    });
  }
};

const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

export const sendPasswordResetOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email address'
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google sign-in. Please use Google to reset your password.'
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

    user.resetPasswordOTP = {
      code: otp,
      expiresAt: expiresAt,
      attempts: 0
    };
    await user.save();

    const emailResult = await sendPasswordResetEmail(normalizedEmail, otp);
    
    if (!emailResult.success) {
      console.error('Failed to send email:', emailResult.error);
    }

    res.json({
      success: true,
      message: 'Verification code sent to your email address',
      data: {
        email: normalizedEmail,
        expiresIn: 180 
      }
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while sending verification code'
    });
  }
};

export const verifyPasswordResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email address'
      });
    }

    if (!user.resetPasswordOTP || !user.resetPasswordOTP.code) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new one.'
      });
    }

    if (user.resetPasswordOTP.expiresAt < new Date()) {
      user.resetPasswordOTP = {
        code: null,
        expiresAt: null,
        attempts: 0
      };
      await user.save();

      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.'
      });
    }

    if (user.resetPasswordOTP.attempts >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new verification code.'
      });
    }

    if (user.resetPasswordOTP.code !== otp) {
      user.resetPasswordOTP.attempts += 1;
      await user.save();

      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please try again.'
      });
    }

    const resetToken = generateToken(user._id);
    
    user.resetPasswordOTP = {
      code: null,
      expiresAt: null,
      attempts: 0
    };
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        resetToken: resetToken,
        email: normalizedEmail
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while verifying code'
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    const normalizedEmail = normalizeEmail(email);

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password confirmation does not match'
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email address'
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while resetting password'
    });
  }
};

export const resendPasswordResetOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email address'
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google sign-in. Please use Google to reset your password.'
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

    user.resetPasswordOTP = {
      code: otp,
      expiresAt: expiresAt,
      attempts: 0
    };
    await user.save();

    const emailResult = await sendPasswordResetEmail(normalizedEmail, otp);
    
    if (!emailResult.success) {
      console.error('Failed to send email:', emailResult.error);
    }

    res.json({
      success: true,
      message: 'New verification code sent to your email address',
      data: {
        email: normalizedEmail,
        expiresIn: 180 
      }
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while resending verification code'
    });
  }
};

export const sendEmailVerificationOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email address'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    user.resetPasswordOTP = {
      code: otp,
      expiresAt: expiresAt,
      attempts: 0
    };
    await user.save();

    const emailResult = await sendPasswordResetEmail(normalizedEmail, otp);
    
    if (!emailResult.success) {
      console.error('Failed to send email:', emailResult.error);
    }

    res.json({
      success: true,
      message: 'Email verification code sent to your email address',
      data: {
        email: normalizedEmail,
        expiresIn: 300 
      }
    });
  } catch (error) {
    console.error('Send email verification OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while sending verification code'
    });
  }
};

export const verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email address'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    if (!user.resetPasswordOTP || !user.resetPasswordOTP.code) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new one.'
      });
    }

    if (user.resetPasswordOTP.expiresAt < new Date()) {
      user.resetPasswordOTP = {
        code: null,
        expiresAt: null,
        attempts: 0
      };
      await user.save();

      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.'
      });
    }

    if (user.resetPasswordOTP.attempts >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new verification code.'
      });
    }

    if (user.resetPasswordOTP.code !== otp) {
      user.resetPasswordOTP.attempts += 1;
      await user.save();

      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please try again.'
      });
    }

    user.isEmailVerified = true;
   
    user.resetPasswordOTP = {
      code: null,
      expiresAt: null,
      attempts: 0
    };
    
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        email: normalizedEmail,
        isEmailVerified: true
      }
    });
  } catch (error) {
    console.error('Verify email OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while verifying email'
    });
  }
};

export const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.substring(7); 
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
     
      const expiresAt = new Date(decoded.exp * 1000);
      
      await TokenBlacklist.create({
        token: token,
        userId: decoded.userId,
        expiresAt: expiresAt
      });
      
      console.log(`User ${req.user.email} logged out and token blacklisted at ${new Date().toISOString()}`);
    } catch (jwtError) {
      console.log(`User ${req.user.email} logged out at ${new Date().toISOString()}`);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
};