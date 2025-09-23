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

const testAchievementProgress = async () => {
  try {
    await connectDB();

    // Find a test user (or create one)
    let testUser = await User.findOne({ email: 'test@example.com' });
    if (!testUser) {
      testUser = new User({
        email: 'test@example.com',
        name: 'Test User',
        isEmailVerified: true
      });
      await testUser.save();
      console.log('✅ Created test user');
    }

    // Find a math branch
    const mathBranch = await Branch.findOne({ category: 'math' });
    if (!mathBranch) {
      console.log('❌ No math branch found. Please run seed:branches first.');
      process.exit(1);
    }

    // Get questions for level 1
    const level1Questions = await Question.find({
      branchId: mathBranch._id,
      category: 'math',
      level: 1
    }).limit(10);

    if (level1Questions.length === 0) {
      console.log('❌ No questions found for level 1. Please run seed:questions first.');
      process.exit(1);
    }

    console.log(`\n📚 Found ${level1Questions.length} questions for level 1 in ${mathBranch.name}`);

    // Clear existing data for this user
    await UserAnswer.deleteMany({ userId: testUser._id, branchId: mathBranch._id });
    await UserLevel.deleteMany({ userId: testUser._id, branchId: mathBranch._id });
    await UserAchievement.deleteMany({ userId: testUser._id });

    console.log('🗑️  Cleared existing test data');

    // Answer 5 questions correctly
    console.log('\n📝 Answering 5 questions...');
    for (let i = 0; i < 5; i++) {
      const question = level1Questions[i];
      const correctAnswerIndex = question.correctAnswerIndex;
      
      const userAnswer = new UserAnswer({
        userId: testUser._id,
        questionId: question._id,
        branchId: question.branchId,
        category: question.category,
        selectedOptionIndex: correctAnswerIndex,
        isCorrect: true,
        pointsEarned: question.points,
        timeSpent: 30
      });
      await userAnswer.save();
      
      console.log(`   ✅ Answered question ${i + 1} correctly`);
    }

    // Check achievement progress
    console.log('\n🏆 Checking achievement progress...');
    const achievements = await Achievement.find({
      category: 'math',
      branchId: mathBranch._id,
      isActive: true
    });

    for (const achievement of achievements) {
      const userAchievement = await UserAchievement.findOne({
        userId: testUser._id,
        achievementId: achievement._id
      });

      if (userAchievement) {
        console.log(`   📊 ${achievement.name}:`);
        console.log(`      - Levels completed: ${userAchievement.progress.levelsCompleted}`);
        console.log(`      - Total required: ${userAchievement.progress.totalRequired}`);
        console.log(`      - Percentage: ${Math.round((userAchievement.progress.levelsCompleted / userAchievement.progress.totalRequired) * 100)}%`);
        console.log(`      - Is completed: ${userAchievement.isCompleted}`);
      } else {
        console.log(`   📊 ${achievement.name}: No progress yet`);
      }
    }

    // Check user level
    const userLevel = await UserLevel.findOne({
      userId: testUser._id,
      branchId: mathBranch._id
    });

    if (userLevel) {
      console.log(`\n📈 User Level Status:`);
      console.log(`   - Current level: ${userLevel.currentLevel}`);
      console.log(`   - Completed levels: ${userLevel.completedLevels.length}`);
      console.log(`   - Total questions answered: ${userLevel.totalQuestionsAnswered}`);
      console.log(`   - Total correct answers: ${userLevel.totalCorrectAnswers}`);
    } else {
      console.log('\n❌ No user level found');
    }

    console.log('\n✨ Test completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing achievement progress:', error);
    process.exit(1);
  }
};

testAchievementProgress();
