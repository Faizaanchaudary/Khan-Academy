import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import Question from '../models/Question.js';
import UserAnswer from '../models/UserAnswer.js';
import UserLevel from '../models/UserLevel.js';
import UserAchievement from '../models/UserAchievement.js';
import Achievement from '../models/Achievement.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const debugAchievementProgress = async () => {
  try {
    await connectDB();

    // Find a test user
    const testUser = await User.findOne({ email: 'test@example.com' });
    if (!testUser) {
      console.log('❌ No test user found. Please create a user first.');
      process.exit(1);
    }

    console.log(`\n👤 Debugging for user: ${testUser.email} (${testUser._id})`);

    // Check UserLevel records
    const userLevels = await UserLevel.find({ userId: testUser._id });
    console.log(`\n📊 User Levels (${userLevels.length}):`);
    userLevels.forEach(level => {
      console.log(`   - Branch: ${level.branchId}, Level: ${level.currentLevel}, Completed: ${level.completedLevels.length}`);
    });

    // Check UserAnswer records
    const userAnswers = await UserAnswer.find({ userId: testUser._id });
    console.log(`\n📝 User Answers (${userAnswers.length}):`);
    userAnswers.forEach(answer => {
      console.log(`   - Question: ${answer.questionId}, Correct: ${answer.isCorrect}, Branch: ${answer.branchId}`);
    });

    // Check UserAchievement records
    const userAchievements = await UserAchievement.find({ userId: testUser._id });
    console.log(`\n🏆 User Achievements (${userAchievements.length}):`);
    userAchievements.forEach(ua => {
      console.log(`   - Achievement: ${ua.achievementId}, Levels: ${ua.progress.levelsCompleted}/${ua.progress.totalRequired}, Completed: ${ua.isCompleted}`);
    });

    // Check all achievements
    const allAchievements = await Achievement.find({ isActive: true });
    console.log(`\n🎯 All Achievements (${allAchievements.length}):`);
    allAchievements.forEach(achievement => {
      console.log(`   - ${achievement.name} (${achievement.category}) - Branch: ${achievement.branchId}`);
    });

    // Check if there are any questions for the branches
    const branches = await Branch.find({});
    for (const branch of branches) {
      const questionCount = await Question.countDocuments({ branchId: branch._id });
      console.log(`\n📚 Branch "${branch.name}" has ${questionCount} questions`);
      
      if (questionCount > 0) {
        const level1Questions = await Question.find({ branchId: branch._id, level: 1 });
        console.log(`   - Level 1: ${level1Questions.length} questions`);
      }
    }

    console.log('\n✨ Debug completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error debugging achievement progress:', error);
    process.exit(1);
  }
};

debugAchievementProgress();
