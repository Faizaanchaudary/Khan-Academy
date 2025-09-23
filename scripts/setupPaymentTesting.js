import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import Plan from '../models/Plan.js';
import User from '../models/User.js';

dotenv.config();

const setupPaymentTesting = async () => {
  try {
    console.log('🚀 Setting up Payment System Testing Environment...\n');

    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');

    // Check if plans exist
    const planCount = await Plan.countDocuments();
    if (planCount === 0) {
      console.log('📦 Seeding sample plans...');
      
      const samplePlans = [
        {
          name: 'Gnosis Peak',
          tagline: 'THE FRUIT OF KNOWLEDGE REWARDS THE MIND',
          price: 40.00,
          currency: 'USD',
          billingCycle: 'monthly',
          trialDays: 7,
          features: [
            'Full access to all practice sets',
            'Complete Skill Tree with real-time progress tracking',
            'Unlimited chatbot access for SAT-style practice',
            'Earn badges & milestones',
            'Priority updates with new content'
          ],
          isActive: true
        },
        {
          name: 'Gnosis Peak Annual',
          tagline: 'THE FRUIT OF KNOWLEDGE REWARDS THE MIND',
          price: 400.00,
          currency: 'USD',
          billingCycle: 'annual',
          trialDays: 14,
          features: [
            'Full access to all practice sets',
            'Complete Skill Tree with real-time progress tracking',
            'Unlimited chatbot access for SAT-style practice',
            'Earn badges & milestones',
            'Priority updates with new content',
            '2 months free (save $80)',
            'Priority customer support'
          ],
          isActive: true
        }
      ];

      await Plan.insertMany(samplePlans);
      console.log('✅ Sample plans created');
    } else {
      console.log('✅ Plans already exist');
    }

    // Display available plans
    const plans = await Plan.find({ isActive: true }).select('_id name price currency billingCycle trialDays');
    console.log('\n📋 Available Plans:');
    plans.forEach(plan => {
      console.log(`   - ${plan.name}: $${plan.price}/${plan.billingCycle} (${plan.trialDays} days trial) - ID: ${plan._id}`);
    });

    // Check if test user exists
    const testUser = await User.findOne({ email: 'test@example.com' });
    if (!testUser) {
      console.log('\n👤 Creating test user...');
      
      const newUser = new User({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Test123!', // This will be hashed by the model
        provider: 'local',
        isEmailVerified: true
      });

      await newUser.save();
      console.log('✅ Test user created (test@example.com / Test123!)');
    } else {
      console.log('✅ Test user already exists');
    }

    // Display environment check
    console.log('\n🔧 Environment Check:');
    console.log(`   - PAYPAL_CLIENT_ID: ${process.env.PAYPAL_CLIENT_ID ? '✅ Set' : '❌ Not set'}`);
    console.log(`   - PAYPAL_CLIENT_SECRET: ${process.env.PAYPAL_CLIENT_SECRET ? '✅ Set' : '❌ Not set'}`);
    console.log(`   - PAYPAL_ENVIRONMENT: ${process.env.PAYPAL_ENVIRONMENT || 'sandbox'}`);

    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      console.log('\n⚠️  PayPal credentials not set!');
      console.log('   Add these to your .env file:');
      console.log('   PAYPAL_CLIENT_ID=your_paypal_client_id');
      console.log('   PAYPAL_CLIENT_SECRET=your_paypal_client_secret');
      console.log('   PAYPAL_ENVIRONMENT=sandbox');
    }

    console.log('\n🎯 Testing Instructions:');
    console.log('1. Start the server: npm start');
    console.log('2. Import the Postman collection: Payment_System_API.postman_collection.json');
    console.log('3. Set the base_url variable to: http://localhost:5000/api');
    console.log('4. Login with test user to get auth token');
    console.log('5. Copy a plan ID and start testing!');
    
    console.log('\n📚 For detailed instructions, see: PAYMENT_TESTING_GUIDE.md');
    console.log('\n✅ Setup complete!');

  } catch (error) {
    console.error('❌ Setup error:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run the setup
setupPaymentTesting();
