import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
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

const seedBranches = async () => {
  try {
    await connectDB();

    // Clear existing branches
    await Branch.deleteMany({});
    console.log('🗑️  Cleared existing branches');

    // Define branches based on the image
    const branches = [
      // Math Branches
      {
        name: 'Algebra',
        description: 'Master algebraic concepts including linear equations, quadratic functions, and polynomial operations',
        icon: 'fx', // Stylized "fx" representing functions
        category: 'math'
      },
      {
        name: 'Problem Solving & Data Analysis',
        description: 'Develop analytical thinking skills for solving complex problems and analyzing data patterns',
        icon: 'analytics', // Head with gear icon for analytical thinking
        category: 'math'
      },
      {
        name: 'Advance Maths',
        description: 'Explore advanced mathematical concepts including calculus, trigonometry, and exponential functions',
        icon: 'exponential', // Stylized "e^x" representing exponential functions
        category: 'math'
      },
      {
        name: 'Geometry',
        description: 'Learn geometric principles, shapes, measurements, and spatial reasoning',
        icon: 'geometry', // Compass and ruler icon
        category: 'math'
      },
      // Reading and Writing Branches
      {
        name: 'SAT Grammar and Vocabulary',
        description: 'Master essential grammar rules and vocabulary for SAT success',
        icon: 'grammar', // Stylized "G" for Grammar
        category: 'reading_writing'
      },
      {
        name: 'Expression of Ideas + Standard English Conventions',
        description: 'Learn to express ideas clearly and follow standard English writing conventions',
        icon: 'expression', // Regular expression pattern "(.*)"
        category: 'reading_writing'
      },
      {
        name: 'Information and Ideas',
        description: 'Develop skills in understanding, analyzing, and synthesizing information from various sources',
        icon: 'information', // Speech bubbles with head silhouette
        category: 'reading_writing'
      },
      {
        name: 'Craft and Structure',
        description: 'Master the craft of writing including structure, organization, and literary techniques',
        icon: 'craft', // Overlapping speech bubbles with "abc"
        category: 'reading_writing'
      }
    ];

    console.log('\n📚 Creating branches...');

    for (const branchData of branches) {
      const branch = new Branch(branchData);
      await branch.save();
      console.log(`   ✅ Created: ${branchData.name} (${branchData.category})`);
    }

    console.log(`\n🎉 Successfully created ${branches.length} branches!`);
    console.log(`📊 Breakdown:`);
    
    const mathBranches = branches.filter(b => b.category === 'math');
    const readingWritingBranches = branches.filter(b => b.category === 'reading_writing');
    
    console.log(`   - Math Branches: ${mathBranches.length}`);
    mathBranches.forEach(branch => console.log(`     • ${branch.name}`));
    
    console.log(`   - Reading and Writing Branches: ${readingWritingBranches.length}`);
    readingWritingBranches.forEach(branch => console.log(`     • ${branch.name}`));

    console.log('\n✨ Branch seeding completed successfully!');
    console.log('💡 You can now run the question seeding script to populate questions for these branches.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding branches:', error);
    process.exit(1);
  }
};

seedBranches();
