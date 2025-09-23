import { admin } from '../config/firebase.js';
import User from '../models/User.js';
import TokenBlacklist from '../models/TokenBlacklist.js';

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

export {
  verifyFirebaseToken,
  verifyJWT,
  optionalAuth,
  authenticate
};