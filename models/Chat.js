import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const chatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Chat title cannot exceed 100 characters']
  },
  messages: [messageSchema],
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
chatSchema.index({ userId: 1, lastMessageAt: -1 });
chatSchema.index({ userId: 1, isActive: 1 });

// Virtual for message count
chatSchema.virtual('messageCount').get(function() {
  return this.messages ? this.messages.length : 0;
});

// Method to add a message
chatSchema.methods.addMessage = function(role, content) {
  this.messages.push({ role, content });
  this.lastMessageAt = new Date();
  return this.save();
};

// Method to get recent chats for a user
chatSchema.statics.getRecentChats = function(userId, limit = 10) {
  return this.find({ userId, isActive: true })
    .select('title lastMessageAt createdAt messages')
    .sort({ lastMessageAt: -1 })
    .limit(limit);
};

export default mongoose.model('Chat', chatSchema);
