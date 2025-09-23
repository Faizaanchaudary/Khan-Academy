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

const testLevelProgression = async () => {
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

    // Find Algebra branch
    const algebraBranch = await Branch.findOne({ name: 'Algebra' });
    if (!algebraBranch) {
      console.log('❌ Algebra branch not found. Please run seed:branches first.');
      process.exit(1);
    }

    // Get questions for levels 1 and 2
    const level1Questions = await Question.find({
      branchId: algebraBranch._id,
      category: 'math',
      level: 1
    }).limit(10);

    const level2Questions = await Question.find({
      branchId: algebraBranch._id,
      category: 'math',
      level: 2
    }).limit(10);

    if (level1Questions.length === 0) {
      console.log('❌ No questions found. Please run seed:questions first.');
      process.exit(1);
    }

    console.log(`\n📚 Testing Level Progression for Algebra Branch`);
    console.log(`   - Level 1: ${level1Questions.length} questions`);
    console.log(`   - Level 2: ${level2Questions.length} questions`);

    // Clear existing data for this user
    await UserAnswer.deleteMany({ userId: testUser._id, branchId: algebraBranch._id });
    await UserLevel.deleteMany({ userId: testUser._id, branchId: algebraBranch._id });
    await UserAchievement.deleteMany({ userId: testUser._id });

    console.log('🗑️  Cleared existing test data');

    // Test Level 1 progression
    console.log('\n🎯 Testing Level 1 Progression...');
    
    // Answer 5 questions correctly
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
      
      console.log(`   ✅ Answered question ${i + 1}/10 correctly`);
    }

    // Check progress after 5 questions
    let userLevel = await UserLevel.findOne({ userId: testUser._id, branchId: algebraBranch._id });
    console.log(`\n📊 Progress after 5 questions:`);
    console.log(`   - Current Level: ${userLevel.currentLevel}`);
    console.log(`   - Questions Answered: ${userLevel.totalQuestionsAnswered}`);
    console.log(`   - Correct Answers: ${userLevel.totalCorrectAnswers}`);
    console.log(`   - Levels Completed: ${userLevel.completedLevels.length}`);

    // Answer 3 more questions (total 8)
    for (let i = 5; i < 8; i++) {
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
      
      console.log(`   ✅ Answered question ${i + 1}/10 correctly`);
    }

    // Check progress after 8 questions
    userLevel = await UserLevel.findOne({ userId: testUser._id, branchId: algebraBranch._id });
    console.log(`\n📊 Progress after 8 questions:`);
    console.log(`   - Current Level: ${userLevel.currentLevel}`);
    console.log(`   - Questions Answered: ${userLevel.totalQuestionsAnswered}`);
    console.log(`   - Correct Answers: ${userLevel.totalCorrectAnswers}`);
    console.log(`   - Levels Completed: ${userLevel.completedLevels.length}`);

    // Answer 2 more questions to complete level 1 (total 10)
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
      
      console.log(`   ✅ Answered question ${i + 1}/10 correctly`);
    }

    // Check progress after completing level 1
    userLevel = await UserLevel.findOne({ userId: testUser._id, branchId: algebraBranch._id });
    console.log(`\n🎉 Level 1 Completed! Progress:`);
    console.log(`   - Current Level: ${userLevel.currentLevel} (should be 2)`);
    console.log(`   - Questions Answered: ${userLevel.totalQuestionsAnswered}`);
    console.log(`   - Correct Answers: ${userLevel.totalCorrectAnswers}`);
    console.log(`   - Levels Completed: ${userLevel.completedLevels.length} (should be 1)`);
    console.log(`   - Can Advance: ${userLevel.currentLevel > 1}`);

    // Test Level 2 progression
    console.log('\n🎯 Testing Level 2 Progression...');
    
    // Answer 3 questions from level 2
    for (let i = 0; i < 3; i++) {
      const question = level2Questions[i];
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
      
      console.log(`   ✅ Answered question ${i + 1}/10 in level 2 correctly`);
    }

    // Check final progress
    userLevel = await UserLevel.findOne({ userId: testUser._id, branchId: algebraBranch._id });
    console.log(`\n📊 Final Progress:`);
    console.log(`   - Current Level: ${userLevel.currentLevel}`);
    console.log(`   - Questions Answered: ${userLevel.totalQuestionsAnswered}`);
    console.log(`   - Correct Answers: ${userLevel.totalCorrectAnswers}`);
    console.log(`   - Levels Completed: ${userLevel.completedLevels.length}`);

    // Check achievements
    console.log('\n🏆 Achievement Progress:');
    const achievements = await Achievement.find({
      category: 'math',
      branchId: algebraBranch._id,
      isActive: true
    });

    for (const achievement of achievements) {
      const userAchievement = await UserAchievement.findOne({
        userId: testUser._id,
        achievementId: achievement._id
      });

      if (userAchievement) {
        const percentage = Math.round((userAchievement.progress.levelsCompleted / userAchievement.progress.totalRequired) * 100);
        console.log(`   - ${achievement.name}: ${userAchievement.progress.levelsCompleted}/${userAchievement.progress.totalRequired} levels (${percentage}%)`);
      }
    }

    console.log('\n✨ Level progression test completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing level progression:', error);
    process.exit(1);
  }
};

testLevelProgression();
