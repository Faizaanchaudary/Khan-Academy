import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Achievement from '../models/Achievement.js';
import UserAchievement from '../models/UserAchievement.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import Question from '../models/Question.js';
import UserAnswer from '../models/UserAnswer.js';
import { checkAchievementProgress } from '../controllers/achievementController.js';

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

const testAchievementSystem = async () => {
  try {
    await connectDB();

    console.log('🧪 Testing Achievement System...\n');

    const achievements = await Achievement.find({});
    console.log(`📊 Found ${achievements.length} achievements in database`);

    if (achievements.length === 0) {
      console.log('❌ No achievements found. Please run the seed script first:');
      console.log('   node scripts/seedAchievements.js');
      process.exit(1);
    }

    console.log('\n🏆 Available Achievements:');
    achievements.forEach(achievement => {
      console.log(`   - ${achievement.name} (${achievement.category})`);
    });

    let testUser = await User.findOne({ email: 'test@example.com' });
    if (!testUser) {
      console.log('\n👤 Creating test user...');
      testUser = new User({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'password123',
        isEmailVerified: true
      });
      await testUser.save();
      console.log('✅ Test user created');
    } else {
      console.log('\n👤 Using existing test user');
    }

    const sampleQuestion = await Question.findOne({ isActive: true });
    if (!sampleQuestion) {
      console.log('❌ No questions found. Please create some questions first.');
      process.exit(1);
    }

    console.log(`\n📝 Using sample question: ${sampleQuestion.questionText.substring(0, 50)}...`);

    console.log('\n🎯 Testing achievement progress tracking...');
    
    await UserAnswer.deleteOne({ userId: testUser._id, questionId: sampleQuestion._id });

    for (let i = 1; i <= 12; i++) {
      console.log(`   Answering question ${i}...`);
      
      const isCorrect = Math.random() > 0.3;
      const selectedOptionIndex = isCorrect ? sampleQuestion.correctAnswerIndex : 
        (sampleQuestion.correctAnswerIndex + 1) % sampleQuestion.options.length;

      const userAnswer = new UserAnswer({
        userId: testUser._id,
        questionId: sampleQuestion._id,
        branchId: sampleQuestion.branchId,
        category: sampleQuestion.category,
        selectedOptionIndex,
        isCorrect,
        pointsEarned: isCorrect ? 10 : 0,
        timeSpent: Math.floor(Math.random() * 60) + 10
      });
      await userAnswer.save();

      await checkAchievementProgress(
        testUser._id, 
        sampleQuestion._id, 
        sampleQuestion.branchId, 
        sampleQuestion.category, 
        isCorrect
      );

      const completedAchievements = await UserAchievement.find({
        userId: testUser._id,
        isCompleted: true
      }).populate('achievementId');

      if (completedAchievements.length > 0) {
        console.log(`   🎉 Achievement completed: ${completedAchievements[0].achievementId.name}`);
        break;
      }
    }

    console.log('\n📈 Final Achievement Status:');
    const userAchievements = await UserAchievement.find({ userId: testUser._id })
      .populate('achievementId');

    if (userAchievements.length === 0) {
      console.log('   No achievements started yet');
    } else {
      userAchievements.forEach(ua => {
        const progress = Math.round((ua.progress.questionsAnswered / ua.progress.totalRequired) * 100);
        const status = ua.isCompleted ? '✅ COMPLETED' : `📊 ${progress}%`;
        console.log(`   ${ua.achievementId.name}: ${status} (${ua.progress.questionsAnswered}/${ua.progress.totalRequired})`);
      });
    }

    console.log('\n✅ Achievement system test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

testAchievementSystem();
