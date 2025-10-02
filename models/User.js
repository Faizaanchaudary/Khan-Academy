import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: false,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: false,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: function() {
      return !this.firebaseUid; 
    },
    minlength: [6, 'Password must be at least 6 characters long']
  },
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true 
  },
  appleId: {
    type: String,
    unique: true,
    sparse: true 
  },
  provider: {
    type: String,
    enum: ['email', 'google', 'apple'],
    default: 'email'
  },
  lastLogin: {
    type: Date,
    default: null
  },
  lastOnline: {
    type: Date,
    default: Date.now
  },
  resetPasswordOTP: {
    code: {
      type: String,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    },
    attempts: {
      type: Number,
      default: 0
    }
  },
  role: {
    type: String,
    enum: ['admin', 'student'],
    default: 'student'
  },
  profilePic: {
    type: String,
    default: null
  },
}, {
  timestamps: true
});

userSchema.index({ email: 1 });
userSchema.index({ firebaseUid: 1 });
userSchema.index({ appleId: 1 });

export default mongoose.model('User', userSchema);