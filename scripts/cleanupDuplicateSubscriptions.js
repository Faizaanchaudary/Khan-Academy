import mongoose from 'mongoose';
import UserSubscription from '../models/UserSubscription.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function cleanupDuplicateSubscriptions() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find users with multiple active/trial subscriptions
    const duplicateActiveSubscriptions = await UserSubscription.aggregate([
      {
        $match: {
          status: { $in: ['active', 'trial'] }
        }
      },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          subscriptions: { $push: '$$ROOT' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log(`Found ${duplicateActiveSubscriptions.length} users with duplicate active/trial subscriptions`);

    for (const userGroup of duplicateActiveSubscriptions) {
      const userId = userGroup._id;
      const subscriptions = userGroup.subscriptions;

      // Sort subscriptions by creation date (keep the newest one)
      subscriptions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Keep the first (newest) subscription, mark others as cancelled
      const keepSubscription = subscriptions[0];
      const toCancel = subscriptions.slice(1);

      console.log(`\nUser ${userId}:`);
      console.log(`  Keeping subscription: ${keepSubscription._id} (created: ${keepSubscription.createdAt})`);

      for (const sub of toCancel) {
        sub.status = 'cancelled';
        sub.cancelledAt = new Date();
        sub.cancellationReason = 'Duplicate subscription cleanup';
        await UserSubscription.findByIdAndUpdate(sub._id, {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: 'Duplicate subscription cleanup'
        });
        console.log(`  Cancelled duplicate subscription: ${sub._id} (created: ${sub.createdAt})`);
      }
    }

    // Find users with multiple pending subscriptions for the same plan
    const duplicatePendingSubscriptions = await UserSubscription.aggregate([
      {
        $match: {
          status: 'pending'
        }
      },
      {
        $group: {
          _id: { userId: '$userId', planId: '$planId' },
          count: { $sum: 1 },
          subscriptions: { $push: '$$ROOT' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log(`\nFound ${duplicatePendingSubscriptions.length} users with duplicate pending subscriptions for the same plan`);

    for (const group of duplicatePendingSubscriptions) {
      const subscriptions = group.subscriptions;

      // Sort subscriptions by creation date (keep the newest one)
      subscriptions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Keep the first (newest) subscription, delete others
      const keepSubscription = subscriptions[0];
      const toDelete = subscriptions.slice(1);

      console.log(`\nUser ${group._id.userId}, Plan ${group._id.planId}:`);
      console.log(`  Keeping pending subscription: ${keepSubscription._id} (created: ${keepSubscription.createdAt})`);

      for (const sub of toDelete) {
        await UserSubscription.findByIdAndDelete(sub._id);
        console.log(`  Deleted duplicate pending subscription: ${sub._id} (created: ${sub.createdAt})`);
      }
    }

    console.log('\n✅ Cleanup completed successfully!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupDuplicateSubscriptions();
