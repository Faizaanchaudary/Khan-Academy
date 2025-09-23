import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import Plan from '../models/Plan.js';

dotenv.config();

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
  },
  {
    name: 'Gnosis Basic',
    tagline: 'Essential learning tools',
    price: 19.99,
    currency: 'USD',
    billingCycle: 'monthly',
    trialDays: 3,
    features: [
      'Access to basic practice sets',
      'Limited chatbot access',
      'Basic progress tracking',
      'Standard support'
    ],
    isActive: true
  },
  {
    name: 'Gnosis Pro',
    tagline: 'Advanced learning experience',
    price: 29.99,
    currency: 'USD',
    billingCycle: 'monthly',
    trialDays: 5,
    features: [
      'Access to all practice sets',
      'Advanced Skill Tree tracking',
      'Enhanced chatbot access',
      'Earn badges & milestones',
      'Priority support'
    ],
    isActive: true
  }
];

const seedPlans = async () => {
  try {
    await connectDB();
    console.log('Connected to database');

    // Clear existing plans
    await Plan.deleteMany({});
    console.log('Cleared existing plans');

    // Insert sample plans
    const createdPlans = await Plan.insertMany(samplePlans);
    console.log(`Created ${createdPlans.length} plans:`);
    
    createdPlans.forEach(plan => {
      console.log(`- ${plan.name}: $${plan.price}/${plan.billingCycle} (${plan.trialDays} days trial)`);
    });

    console.log('\nPlans seeded successfully!');
    console.log('\nYou can now test the payment system with these plans.');
    console.log('Use the following API endpoint to get available plans:');
    console.log('GET /api/payments/plans');

  } catch (error) {
    console.error('Error seeding plans:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the seeder
seedPlans();
