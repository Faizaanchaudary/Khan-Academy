import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Question from '../models/Question.js';
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

const seedQuestionsWithLevels = async () => {
  try {
    await connectDB();

    const branches = await Branch.find({});
    if (branches.length === 0) {
      console.log('❌ No branches found. Please create branches first.');
      process.exit(1);
    }

    await Question.deleteMany({});

    const mathBranches = branches.filter(b => b.category === 'math');
    const readingWritingBranches = branches.filter(b => b.category === 'reading_writing');

    const mathQuestions = [
      { text: "Solve for x:", equation: "2x + 5 = 13", answer: 1, explanation: "Subtract 5 from both sides (2x = 8), then divide by 2 -> x = 4" },
      { text: "Find the value of y:", equation: "3y - 7 = 11", answer: 1, explanation: "Add 7 to both sides (3y = 18), then divide by 3 -> y = 6" },
      { text: "Solve for z:", equation: "4z + 10 = 30", answer: 2, explanation: "Subtract 10 from both sides (4z = 20), then divide by 4 -> z = 5" },
      { text: "Determine the value of p:", equation: "2p - 9 = 15", answer: 2, explanation: "Add 9 to both sides (2p = 24), then divide by 2 -> p = 12" },
      { text: "What is the value of m?", equation: "5m + 8 = 43", answer: 2, explanation: "Subtract 8 from both sides (5m = 35), then divide by 5 -> m = 7" },
      { text: "Solve for n:", equation: "7n - 12 = 23", answer: 2, explanation: "Add 12 to both sides (7n = 35), then divide by 7 -> n = 5" },
      { text: "Find the value of k:", equation: "6k + 4 = 28", answer: 2, explanation: "Subtract 4 from both sides (6k = 24), then divide by 6 -> k = 4" },
      { text: "Calculate the value of r:", equation: "8r - 10 = 54", answer: 2, explanation: "Add 10 to both sides (8r = 64), then divide by 8 -> r = 8" },
      { text: "Determine the value of s:", equation: "9s + 3 = 39", answer: 1, explanation: "Subtract 3 from both sides (9s = 36), then divide by 9 -> s = 4" },
      { text: "What is the value of t?", equation: "10t - 25 = 75", answer: 2, explanation: "Add 25 to both sides (10t = 100), then divide by 10 -> t = 10" }
    ];

    const readingWritingQuestions = [
      { text: "Choose the correct verb form:", sentence: "The students _____ to the library yesterday.", answer: 1, explanation: "The past tense of 'go' is 'went'" },
      { text: "Select the proper noun:", sentence: "The _____ is a beautiful city.", answer: 2, explanation: "Proper nouns are capitalized and refer to specific places" },
      { text: "Identify the adjective:", sentence: "The _____ dog ran quickly.", answer: 0, explanation: "Adjectives describe nouns, 'big' describes the dog" },
      { text: "Choose the correct pronoun:", sentence: "_____ is going to the store.", answer: 1, explanation: "Subject pronouns are used at the beginning of sentences" },
      { text: "Select the correct article:", sentence: "I need _____ apple for the recipe.", answer: 1, explanation: "Use 'an' before words starting with vowel sounds" },
      { text: "Identify the preposition:", sentence: "The book is _____ the table.", answer: 2, explanation: "Prepositions show relationships between words" },
      { text: "Choose the correct conjunction:", sentence: "I like coffee _____ I don't like tea.", answer: 1, explanation: "Conjunctions connect words, phrases, or clauses" },
      { text: "Select the correct tense:", sentence: "She _____ her homework every day.", answer: 0, explanation: "Present tense is used for habitual actions" },
      { text: "Identify the adverb:", sentence: "She sings _____ beautifully.", answer: 1, explanation: "Adverbs modify verbs, adjectives, or other adverbs" },
      { text: "Choose the correct punctuation:", sentence: "What time is it", answer: 2, explanation: "Questions end with question marks" }
    ];

    let totalQuestions = 0;

    for (const branch of branches) {
      console.log(`\n📚 Creating questions for ${branch.name} (${branch.category})...`);
      
      const questions = branch.category === 'math' ? mathQuestions : readingWritingQuestions;
      
      for (let level = 1; level <= 10; level++) {
        for (let qNum = 1; qNum <= 10; qNum++) {
          const questionData = questions[(qNum - 1) % questions.length];
          
          let options, correctAnswerIndex;
          
          if (branch.category === 'math') {
            const correctValue = questionData.answer;
            options = [
              `${correctValue - 1}`,
              `${correctValue}`,
              `${correctValue + 1}`,
              `${correctValue + 2}`
            ];
            correctAnswerIndex = 1;
          } else {
            const optionsList = [
              ['big', 'small', 'tall', 'short'],
              ['She', 'He', 'It', 'They'],
              ['a', 'an', 'the', 'some'],
              ['does', 'do', 'did', 'will do'],
              ['quickly', 'slowly', 'carefully', 'loudly'],
              ['and', 'but', 'or', 'so'],
              ['?', '.', '!', ','],
              ['big', 'small', 'tall', 'short'],
              ['She', 'He', 'It', 'They'],
              ['a', 'an', 'the', 'some']
            ];
            options = optionsList[(qNum - 1) % optionsList.length];
            correctAnswerIndex = questionData.answer;
          }

          const question = new Question({
            branchId: branch._id,
            category: branch.category,
            questionNumber: qNum,
            level: level,
            questionText: questionData.text,
            equation: branch.category === 'math' ? questionData.equation : questionData.sentence,
            options: options.map((option, index) => ({
              optionText: option,
              isCorrect: index === correctAnswerIndex
            })),
            correctAnswerIndex: correctAnswerIndex,
            correctAnswerExplanation: questionData.explanation,
            isActive: true
          });

          await question.save();
          totalQuestions++;
        }
        console.log(`   ✅ Level ${level}: 10 questions created`);
      }
    }

    console.log(`\n🎉 Successfully created ${totalQuestions} questions across all branches and levels!`);
    console.log(`📊 Breakdown:`);
    console.log(`   - Math branches: ${mathBranches.length}`);
    console.log(`   - Reading/Writing branches: ${readingWritingBranches.length}`);
    console.log(`   - Questions per branch: 100 (10 levels × 10 questions)`);
    console.log(`   - Total questions: ${totalQuestions}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding questions:', error);
    process.exit(1);
  }
};

seedQuestionsWithLevels();
