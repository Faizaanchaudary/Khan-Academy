import { admin } from '../config/firebase.js';
import User from '../models/User.js';
import TokenBlacklist from '../models/TokenBlacklist.js';
import UserSubscription from '../models/UserSubscription.js';

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7); 

    const decodedToken = await admin.auth().verifyIdToken(token);
    
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
 
    if (!user) {
      // Check if user exists with same email
      user = await User.findOne({ email: decodedToken.email });
      
      if (user) {
        // Link the Google account to existing email/password user
        user.firebaseUid = decodedToken.uid;
        user.provider = 'google';
        user.isEmailVerified = decodedToken.email_verified || user.isEmailVerified;
        user.profilePicture = decodedToken.picture || user.profilePicture;
        await user.save();
      } else {
        // Create new user if no existing user found
        user = await User.create({
          firebaseUid: decodedToken.uid,
          email: decodedToken.email,
          firstName: decodedToken.name?.split(' ')[0] || 'User',
          lastName: decodedToken.name?.split(' ').slice(1).join(' ') || '',
          provider: 'google',
          isEmailVerified: decodedToken.email_verified || false,
          profilePicture: decodedToken.picture || null
        });
      }
    }

    req.user = user;
    req.firebaseUser = decodedToken;
    next();
  } catch (error) {
    console.error('Firebase token verification error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token or token expired.'
    });
  }
};

import jwt from 'jsonwebtoken';

const verifyJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7);
    
    const blacklistedToken = await TokenBlacklist.findOne({ token: token });
    if (blacklistedToken) {
      return res.status(401).json({
        success: false,
        message: 'Token has been invalidated. Please login again.'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    return res.status(401).json({
      success: false,
        message: 'Invalid token or token expired.'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
 
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const user = await User.findOne({ firebaseUid: decodedToken.uid });
        if (user) {
          req.user = user;
          req.firebaseUser = decodedToken;
        }
      } catch (firebaseError) {
  
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
          const user = await User.findById(decoded.userId);
          if (user) {
            req.user = user;
          }
        } catch (jwtError) {
          
        }
      }
    }
    
    next();
  } catch (error) {
    next(); 
  }
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7); 
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      let user = await User.findOne({ firebaseUid: decodedToken.uid });
      
      if (!user) {
        // Check if user exists with same email
        user = await User.findOne({ email: decodedToken.email });
        
        if (user) {
          // Link the Google account to existing email/password user
          user.firebaseUid = decodedToken.uid;
          user.provider = 'google';
          user.isEmailVerified = decodedToken.email_verified || user.isEmailVerified;
          user.profilePicture = decodedToken.picture || user.profilePicture;
          await user.save();
        } else {
          // Create new user if no existing user found
          user = await User.create({
            firebaseUid: decodedToken.uid,
            email: decodedToken.email,
            firstName: decodedToken.name?.split(' ')[0] || 'User',
            lastName: decodedToken.name?.split(' ').slice(1).join(' ') || '',
            provider: 'google',
            isEmailVerified: decodedToken.email_verified || false,
            profilePicture: decodedToken.picture || null
          });
        }
      }

      req.user = user;
      req.firebaseUser = decodedToken;
      next();
      return;
    } catch (firebaseError) {
  
      try {
        const blacklistedToken = await TokenBlacklist.findOne({ token: token });
        if (blacklistedToken) {
          return res.status(401).json({
            success: false,
            message: 'Token has been invalidated. Please login again.'
          });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        const user = await User.findById(decoded.userId);
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'User not found.'
          });
        }

        req.user = user;
        next();
        return;
      } catch (jwtError) {
  
        return res.status(401).json({
          success: false,
          message: 'Invalid token or token expired.'
        });
      }
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token or token expired.'
    });
  }
};

// Middleware to check if user has an active subscription
const requireActiveSubscription = async (req, res, next) => {
  try {
    // Skip subscription check for admin users
    if (req.user.role === 'admin') {
      return next();
    }

    // Fetch user subscription
    let userSubscription = await UserSubscription.findOne({ 
      userId: req.user._id, 
      status: { $in: ['active', 'trial'] } 
    });

    // Check if subscription/trial is expired and update status in database
    if (userSubscription) {
      const now = new Date();
      const isExpired = userSubscription.isExpired;
      const isTrialExpired = userSubscription.isTrialExpired;

      // If subscription or trial is expired, update status to 'expired'
      if (isExpired || isTrialExpired) {
        userSubscription.status = 'expired';
        userSubscription.isTrialActive = false;
        await userSubscription.save();
        userSubscription = null; // Set to null since it's now expired
      }
    }

    // If no active subscription, return error
    if (!userSubscription) {
      return res.status(403).json({
        success: false,
        message: 'Active subscription required',
        requiresSubscription: true,
        redirectTo: '/choose-plan'
      });
    }

    // Attach subscription to request for use in controllers
    req.userSubscription = userSubscription;
    next();
  } catch (error) {
    console.error('Subscription validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating subscription'
    });
  }
};

export {
  verifyFirebaseToken,
  verifyJWT,
  optionalAuth,
  authenticate,
  requireActiveSubscription
};