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

const testQuestionTracking = async () => {
  try {
    await connectDB();

    // Find a test user
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

    // Get questions for levels 1 and 2
    const level1Questions = await Question.find({
      branchId: mathBranch._id,
      category: 'math',
      level: 1
    }).limit(10);

    const level2Questions = await Question.find({
      branchId: mathBranch._id,
      category: 'math',
      level: 2
    }).limit(10);

    if (level1Questions.length === 0) {
      console.log('❌ No questions found. Please run seed:questions first.');
      process.exit(1);
    }

    console.log(`\n📚 Found ${level1Questions.length} questions for level 1 and ${level2Questions.length} for level 2`);

    // Clear existing data for this user
    await UserAnswer.deleteMany({ userId: testUser._id, branchId: mathBranch._id });
    await UserLevel.deleteMany({ userId: testUser._id, branchId: mathBranch._id });
    await UserAchievement.deleteMany({ userId: testUser._id });

    console.log('🗑️  Cleared existing test data');

    // Answer questions one by one and show progress
    console.log('\n📝 Answering questions and tracking progress...\n');

    // Answer 3 questions from level 1
    for (let i = 0; i < 3; i++) {
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
      
      // Check achievement progress after each question
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
          const percentage = Math.round((userAchievement.progress.questionsAnswered / (userAchievement.progress.totalRequired * 10)) * 100);
          console.log(`      🏆 ${achievement.name}: ${userAchievement.progress.questionsAnswered}/${userAchievement.progress.totalRequired * 10} questions (${percentage}%)`);
        }
      }
      console.log('');
    }

    // Answer 5 more questions from level 1 (total 8)
    for (let i = 3; i < 8; i++) {
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

    console.log('\n📊 Progress after 8 questions:');
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
        const percentage = Math.round((userAchievement.progress.questionsAnswered / (userAchievement.progress.totalRequired * 10)) * 100);
        console.log(`   🏆 ${achievement.name}: ${userAchievement.progress.questionsAnswered}/${userAchievement.progress.totalRequired * 10} questions (${percentage}%)`);
        console.log(`      - Levels completed: ${userAchievement.progress.levelsCompleted}`);
        console.log(`      - Correct answers: ${userAchievement.progress.correctAnswers}`);
        console.log(`      - Is completed: ${userAchievement.isCompleted}`);
      }
    }

    // Answer 2 more questions to complete level 1
    for (let i = 8; i < 10; i++) {
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

    console.log('\n🎉 Level 1 completed! Progress:');
    const finalAchievements = await Achievement.find({
      category: 'math',
      branchId: mathBranch._id,
      isActive: true
    });

    for (const achievement of finalAchievements) {
      const userAchievement = await UserAchievement.findOne({
        userId: testUser._id,
        achievementId: achievement._id
      });

      if (userAchievement) {
        const percentage = Math.round((userAchievement.progress.questionsAnswered / (userAchievement.progress.totalRequired * 10)) * 100);
        console.log(`   🏆 ${achievement.name}: ${userAchievement.progress.questionsAnswered}/${userAchievement.progress.totalRequired * 10} questions (${percentage}%)`);
        console.log(`      - Levels completed: ${userAchievement.progress.levelsCompleted}`);
        console.log(`      - Correct answers: ${userAchievement.progress.correctAnswers}`);
        console.log(`      - Is completed: ${userAchievement.isCompleted}`);
      }
    }

    console.log('\n✨ Question tracking test completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing question tracking:', error);
    process.exit(1);
  }
};

testQuestionTracking();
