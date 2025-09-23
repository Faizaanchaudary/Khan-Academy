import crypto from 'crypto';
import Invitation from '../models/Invitation.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { normalizeEmail } from '../utils/emailUtils.js';

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'jwt-key-12345', {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

export const generateSignupLink = async (req, res) => {
  try {
    const { email, expiresInDays = 7, metadata = {} } = req.body;
    const createdBy = req.user._id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can generate signup links'
      });
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create invitation
    const invitation = await Invitation.create({
      token,
      createdBy,
      email: email ? normalizeEmail(email) : null,
      expiresAt,
      role: 'student',
      metadata
    });

    // Generate the signup link
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const signupLink = `${baseUrl}/signup?invitation=${token}`;

    res.json({
      success: true,
      message: 'Signup link generated successfully',
      data: {
        invitation: {
          id: invitation._id,
          token: invitation.token,
          email: invitation.email,
          expiresAt: invitation.expiresAt,
          role: invitation.role,
          metadata: invitation.metadata
        },
        signupLink,
        expiresInDays
      }
    });
  } catch (error) {
    console.error('Generate signup link error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while generating signup link'
    });
  }
};

export const validateInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token is required'
      });
    }

    const invitation = await Invitation.findOne({ 
      token,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    }).populate('createdBy', 'firstName lastName email');

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation link'
      });
    }

    res.json({
      success: true,
      message: 'Invitation is valid',
      data: {
        invitation: {
          id: invitation._id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          createdBy: invitation.createdBy,
          metadata: invitation.metadata
        }
      }
    });
  } catch (error) {
    console.error('Validate invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while validating invitation'
    });
  }
};

export const signupWithInvitation = async (req, res) => {
  try {
    const { token, firstName, lastName, email, password } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token is required'
      });
    }

    // Validate invitation
    const invitation = await Invitation.findOne({ 
      token,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation link'
      });
    }

    // If invitation has specific email, validate it matches
    if (invitation.email && invitation.email !== normalizeEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'This invitation is for a different email address'
      });
    }

    // Check if user already exists
    const normalizedEmail = normalizeEmail(email);
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email address'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user with student role
    const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      provider: 'email',
      role: invitation.role || 'student'
    });

    // Mark invitation as used
    invitation.isUsed = true;
    invitation.usedBy = user._id;
    invitation.usedAt = new Date();
    await invitation.save();

    // Generate JWT token
    const jwtToken = generateToken(user._id);
    user.lastLogin = new Date();
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'Account created successfully with invitation',
      data: {
        user: userResponse,
        token: jwtToken
      }
    });
  } catch (error) {
    console.error('Signup with invitation error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during signup with invitation'
    });
  }
};

export const getInvitations = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    const createdBy = req.user._id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view invitations'
      });
    }

    const query = { createdBy };
    
    if (status === 'used') {
      query.isUsed = true;
    } else if (status === 'unused') {
      query.isUsed = false;
    } else if (status === 'expired') {
      query.expiresAt = { $lt: new Date() };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const invitations = await Invitation.find(query)
      .populate('usedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invitation.countDocuments(query);

    res.json({
      success: true,
      message: 'Invitations retrieved successfully',
      data: {
        invitations,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalInvitations: total,
          hasNextPage: skip + invitations.length < total,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving invitations'
    });
  }
};
