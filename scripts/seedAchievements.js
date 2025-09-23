import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Achievement from '../models/Achievement.js';
import Branch from '../models/Branch.js';

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

const seedAchievements = async () => {
  try {
    await connectDB();

    const mathBranches = await Branch.find({ category: 'math' });
    const readingWritingBranches = await Branch.find({ category: 'reading_writing' });

    let algebraBranch, geometryBranch, advancedMathBranch, problemSolvingBranch, grammarBranch;

    if (mathBranches.length === 0) {
      algebraBranch = new Branch({
        name: 'Algebra',
        description: 'Master algebraic concepts and problem-solving techniques',
        icon: 'fx',
        category: 'math'
      });
      await algebraBranch.save();

      geometryBranch = new Branch({
        name: 'Geometry',
        description: 'Learn geometric shapes, angles, and spatial reasoning',
        icon: 'compass',
        category: 'math'
      });
      await geometryBranch.save();

      advancedMathBranch = new Branch({
        name: 'Advanced Mathematics',
        description: 'Advanced mathematical concepts and applications',
        icon: 'calculator',
        category: 'math'
      });
      await advancedMathBranch.save();

      problemSolvingBranch = new Branch({
        name: 'Problem Solving',
        description: 'Develop critical thinking and problem-solving skills',
        icon: 'brain',
        category: 'math'
      });
      await problemSolvingBranch.save();
    } else {
      algebraBranch = mathBranches.find(b => b.name.toLowerCase().includes('algebra')) || mathBranches[0];
      geometryBranch = mathBranches.find(b => b.name.toLowerCase().includes('geometry')) || mathBranches[0];
      advancedMathBranch = mathBranches.find(b => b.name.toLowerCase().includes('advanced')) || mathBranches[0];
      problemSolvingBranch = mathBranches.find(b => b.name.toLowerCase().includes('problem')) || mathBranches[0];
    }

    if (readingWritingBranches.length === 0) {
      grammarBranch = new Branch({
        name: 'Grammar and Vocabulary',
        description: 'Master grammar rules and expand vocabulary',
        icon: 'anchor',
        category: 'reading_writing'
      });
      await grammarBranch.save();
    } else {
      grammarBranch = readingWritingBranches.find(b => b.name.toLowerCase().includes('grammar')) || readingWritingBranches[0];
    }

    await Achievement.deleteMany({});

    const achievements = [
      {
        name: 'Algebra Pro Badge',
        description: 'Complete all 10 levels in Algebra to earn this badge',
        icon: 'fx',
        category: 'math',
        branchId: algebraBranch._id,
        requirements: {
          levelsCompleted: 10,
          questionsAnswered: null,
          correctAnswers: null,
          isDaily: false,
          timeFrame: 'lifetime'
        },
        pointsReward: 100
      },
      {
        name: 'Problem Solver Badge',
        description: 'Complete all 10 levels in Problem Solving to earn this badge',
        icon: 'brain',
        category: 'math',
        branchId: problemSolvingBranch._id,
        requirements: {
          levelsCompleted: 10,
          questionsAnswered: null,
          correctAnswers: null,
          isDaily: false,
          timeFrame: 'lifetime'
        },
        pointsReward: 100
      },
      {
        name: 'Geometry Pro Badge',
        description: 'Complete all 10 levels in Geometry to earn this badge',
        icon: 'compass',
        category: 'math',
        branchId: geometryBranch._id,
        requirements: {
          levelsCompleted: 10,
          questionsAnswered: null,
          correctAnswers: null,
          isDaily: false,
          timeFrame: 'lifetime'
        },
        pointsReward: 100
      },
      {
        name: 'Advance Maths Pro Badge',
        description: 'Complete all 10 levels in Advanced Mathematics to earn this badge',
        icon: 'calculator',
        category: 'math',
        branchId: advancedMathBranch._id,
        requirements: {
          levelsCompleted: 10,
          questionsAnswered: null,
          correctAnswers: null,
          isDaily: false,
          timeFrame: 'lifetime'
        },
        pointsReward: 100
      },
      {
        name: 'Grammar and Vocabulary Pro Badge',
        description: 'Complete all 10 levels in Grammar and Vocabulary to earn this badge',
        icon: 'anchor',
        category: 'reading_writing',
        branchId: grammarBranch._id,
        requirements: {
          levelsCompleted: 10,
          questionsAnswered: null,
          correctAnswers: null,
          isDaily: false,
          timeFrame: 'lifetime'
        },
        pointsReward: 100
      }
    ];

    const createdAchievements = await Achievement.insertMany(achievements);
    console.log(`Successfully created ${createdAchievements.length} achievements`);

    createdAchievements.forEach(achievement => {
      console.log(`- ${achievement.name} (${achievement.category})`);
    });

    console.log('\nAchievements seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding achievements:', error);
    process.exit(1);
  }
};

seedAchievements();
