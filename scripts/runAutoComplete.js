#!/usr/bin/env node

import { autoCompleteBranch } from './autoCompleteBranch.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/khan-academy');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Interactive script to help users find the right IDs
const runInteractive = async () => {
  try {
    await connectDB();
    
    console.log('🔍 Let me help you find the right IDs...\n');
    
    // Import models
    const User = (await import('../models/User.js')).default;
    const Branch = (await import('../models/Branch.js')).default;
    
    // List all users
    console.log('👥 Available Users:');
    const users = await User.find({}, 'name email').limit(10);
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name || user.email} (ID: ${user._id})`);
    });
    
    console.log('\n📚 Available Branches:');
    const branches = await Branch.find({}, 'name category').limit(20);
    branches.forEach((branch, index) => {
      console.log(`   ${index + 1}. ${branch.name} (${branch.category}) - ID: ${branch._id}`);
    });
    
    console.log('\n💡 Usage Examples:');
    console.log('   node scripts/runAutoComplete.js <userId> <branchId> <category>');
    console.log('   node scripts/runAutoComplete.js 507f1f77bcf86cd799439011 507f1f77bcf86cd799439012 math');
    
    console.log('\n🎯 Quick Start:');
    if (users.length > 0 && branches.length > 0) {
      console.log(`   node scripts/runAutoComplete.js ${users[0]._id} ${branches[0]._id} ${branches[0].category}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
};

// Main execution
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    await runInteractive();
    return;
  }
  
  if (args.length < 3) {
    console.log('❌ Usage: node scripts/runAutoComplete.js <userId> <branchId> <category>');
    console.log('   Run without arguments to see available options');
    process.exit(1);
  }

  const [userId, branchId, category] = args;
  
  try {
    await connectDB();
    await autoCompleteBranch(userId, branchId, category);
    console.log('\n🎉 Auto-completion completed successfully!');
  } catch (error) {
    console.error('💥 Auto-completion failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

main();
