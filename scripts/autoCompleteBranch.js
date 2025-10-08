import mongoose from 'mongoose';
import dotenv from 'dotenv';
import UserLevel from '../models/UserLevel.js';
import Question from '../models/Question.js';
import UserAnswer from '../models/UserAnswer.js';
import Branch from '../models/Branch.js';
import User from '../models/User.js';

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

// Auto-complete all levels for a specific branch
const autoCompleteBranch = async (userId, branchId, category) => {
  try {
    console.log(`🚀 Starting auto-completion for user ${userId}, branch ${branchId}, category ${category}`);
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Verify branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      throw new Error(`Branch with ID ${branchId} not found`);
    }

    console.log(`📚 Branch: ${branch.name} (${branch.category})`);

    // Initialize or get user level for this branch
    let userLevel = await UserLevel.findOne({ userId, branchId });
    if (!userLevel) {
      console.log('🆕 Creating new user level record...');
      userLevel = new UserLevel({
        userId,
        branchId,
        category,
        currentLevel: 1,
        completedLevels: [],
        totalQuestionsAnswered: 0,
        totalCorrectAnswers: 0,
        isUnlocked: true
      });
      await userLevel.save();
    }

    console.log(`📊 Current progress: Level ${userLevel.currentLevel}, Completed levels: ${userLevel.completedLevels.length}`);

    // Process each level from 1 to 10
    for (let level = 1; level <= 10; level++) {
      console.log(`\n🎯 Processing Level ${level}...`);
      
      // Get all questions for this level
      const questions = await Question.find({
        branchId,
        level,
        isActive: true
      }).sort({ questionNumber: 1 });

      if (questions.length === 0) {
        console.log(`⚠️  No questions found for level ${level}, skipping...`);
        continue;
      }

      console.log(`📝 Found ${questions.length} questions for level ${level}`);

      // Answer all questions correctly
      let levelQuestionsAnswered = 0;
      let levelCorrectAnswers = 0;

      for (const question of questions) {
        // Check if already answered
        const existingAnswer = await UserAnswer.findOne({
          userId,
          questionId: question._id
        });

        if (existingAnswer) {
          console.log(`  ✅ Question ${question.questionNumber} already answered correctly`);
          if (existingAnswer.isCorrect) {
            levelCorrectAnswers++;
          }
          levelQuestionsAnswered++;
          continue;
        }

        // Answer correctly using the correct answer index
        const correctAnswerIndex = question.correctAnswerIndex;
        const userAnswer = new UserAnswer({
          userId,
          questionId: question._id,
          branchId: question.branchId,
          category: question.category,
          selectedOptionIndex: correctAnswerIndex,
          isCorrect: true,
          pointsEarned: 10,
          timeSpent: Math.floor(Math.random() * 30) + 10 // Random time between 10-40 seconds
        });

        await userAnswer.save();
        levelQuestionsAnswered++;
        levelCorrectAnswers++;
        
        console.log(`  ✅ Answered question ${question.questionNumber} correctly`);
      }

      // Update user level progress
      userLevel.totalQuestionsAnswered += levelQuestionsAnswered;
      userLevel.totalCorrectAnswers += levelCorrectAnswers;

      // Check if level is complete
      const isLevelComplete = levelQuestionsAnswered >= questions.length;
      
      if (isLevelComplete && level === userLevel.currentLevel) {
        // Add level completion record
        const levelCompletion = {
          level: level,
          completedAt: new Date(),
          questionsAnswered: levelQuestionsAnswered,
          correctAnswers: levelCorrectAnswers,
          totalQuestions: questions.length
        };

        userLevel.completedLevels.push(levelCompletion);
        userLevel.currentLevel = Math.min(userLevel.currentLevel + 1, 10);
        
        console.log(`🎉 Level ${level} completed! Advanced to level ${userLevel.currentLevel}`);
      } else if (isLevelComplete) {
        console.log(`✅ Level ${level} completed (already at higher level)`);
      }

      // Save user level after each level
      await userLevel.save();
    }

    // Final summary
    console.log(`\n🎊 Auto-completion finished!`);
    console.log(`📊 Final Stats:`);
    console.log(`   - Current Level: ${userLevel.currentLevel}`);
    console.log(`   - Completed Levels: ${userLevel.completedLevels.length}`);
    console.log(`   - Total Questions Answered: ${userLevel.totalQuestionsAnswered}`);
    console.log(`   - Total Correct Answers: ${userLevel.totalCorrectAnswers}`);
    console.log(`   - Success Rate: ${userLevel.totalQuestionsAnswered > 0 ? Math.round((userLevel.totalCorrectAnswers / userLevel.totalQuestionsAnswered) * 100) : 0}%`);

    return {
      success: true,
      userLevel,
      completedLevels: userLevel.completedLevels.length,
      totalQuestions: userLevel.totalQuestionsAnswered,
      totalCorrect: userLevel.totalCorrectAnswers
    };

  } catch (error) {
    console.error('❌ Error during auto-completion:', error);
    throw error;
  }
};

// Main execution function
const main = async () => {
  try {
    await connectDB();

    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
      console.log('Usage: node autoCompleteBranch.js <userId> <branchId> <category>');
      console.log('Example: node autoCompleteBranch.js 507f1f77bcf86cd799439011 507f1f77bcf86cd799439012 math');
      process.exit(1);
    }

    const [userId, branchId, category] = args;

    // Validate category
    const validCategories = ['math', 'reading_writing'];
    if (!validCategories.includes(category)) {
      console.error(`❌ Invalid category. Must be one of: ${validCategories.join(', ')}`);
      process.exit(1);
    }

    console.log('🤖 Auto-Complete Branch Script');
    console.log('================================');
    console.log(`User ID: ${userId}`);
    console.log(`Branch ID: ${branchId}`);
    console.log(`Category: ${category}`);
    console.log('================================\n');

    const result = await autoCompleteBranch(userId, branchId, category);
    
    if (result.success) {
      console.log('\n✅ Script completed successfully!');
      console.log(`📈 Branch completion: ${result.completedLevels}/10 levels`);
    }

  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
};

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { autoCompleteBranch };
