import Plan from '../models/Plan.js';
import UserSubscription from '../models/UserSubscription.js';
import User from '../models/User.js';
import { sendSuccess, sendError } from '../utils/response.js';

// Get all available plans for selection
export const getAvailablePlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true })
      .select('name tagline price currency billingCycle features trialDays')
      .sort({ price: 1 }); // Sort by price ascending (free first)

    res.json({
      success: true,
      message: 'Plans retrieved successfully',
      data: {
        plans: plans.map(plan => ({
          id: plan._id,
          name: plan.name,
          tagline: plan.tagline,
          price: plan.price,
          currency: plan.currency,
          billingCycle: plan.billingCycle,
          features: plan.features,
          trialDays: plan.trialDays,
          isFree: plan.price === 0
        }))
      }
    });
  } catch (error) {
    console.error('Get plans error:', error);
    sendError(res, 'Internal server error while retrieving plans');
  }
};

// Select a plan (free or paid)
export const selectPlan = async (req, res) => {
  try {
    const { planId, billingInfo } = req.body;
    const userId = req.user.id;

    if (!planId) {
      return sendError(res, 'Plan ID is required', 400);
    }

    // Get the selected plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      return sendError(res, 'Plan not found', 404);
    }

    if (!plan.isActive) {
      return sendError(res, 'Plan is not available for selection', 400);
    }

    // Check for existing subscription
    const existingSubscription = await UserSubscription.findOne({
      userId,
      status: { $in: ['active', 'trial'] }
    });

    // Handle existing subscription
    if (existingSubscription) {
      // Allow upgrade from free trial to paid plan
      const isUpgradingFromFreeTrial = existingSubscription.paymentMethod === 'free' && 
                                       existingSubscription.planId.toString() !== planId && 
                                       plan.price > 0;
      
      if (!isUpgradingFromFreeTrial) {
        return sendError(res, 'You already have an active subscription', 400);
      }
      
      // Cancel the existing free trial subscription
      existingSubscription.status = 'cancelled';
      existingSubscription.cancelledAt = new Date();
      existingSubscription.cancellationReason = 'Upgraded to paid plan';
      await existingSubscription.save();
    }

    // Handle free plan selection (no payment required)
    if (plan.price === 0) {
      // Validate minimal billing info for free plan
      if (!billingInfo || !billingInfo.firstName || !billingInfo.lastName) {
        return sendError(res, 'First name and last name are required for free trial', 400);
      }

      const now = new Date();
      const trialEndDate = new Date(now.getTime() + (plan.trialDays * 24 * 60 * 60 * 1000));
      const endDate = new Date(now.getTime() + (plan.trialDays * 24 * 60 * 60 * 1000));

      const subscription = new UserSubscription({
        userId,
        planId: plan._id,
        status: 'trial',
        startDate: now,
        endDate: endDate,
        trialEndDate: trialEndDate,
        isTrialActive: true,
        paymentMethod: 'free',
        billingInfo: {
          firstName: billingInfo.firstName,
          lastName: billingInfo.lastName,
          country: billingInfo.country || 'US',
          phoneNumber: billingInfo.phoneNumber || '',
          isCompany: false
        },
        pricing: {
          subtotal: 0,
          amountDueNow: 0,
          nextBillingAmount: 0,
          currency: plan.currency
        },
        nextBillingDate: trialEndDate
      });

      await subscription.save();
      await subscription.populate('planId', 'name tagline price currency billingCycle features');

      return sendSuccess(res, 'Free trial activated successfully', {
        subscription: {
          ...subscription.toObject(),
          daysRemaining: subscription.daysRemaining,
          isExpired: subscription.isExpired,
          isTrialExpired: subscription.isTrialExpired
        },
        isFreePlan: true,
        message: `Your ${plan.trialDays}-day free trial has started!`
      });
    }

    // Handle paid plan selection (redirect to payment)
    if (plan.price > 0) {
      // Validate billing info for paid plans
      if (!billingInfo || !billingInfo.firstName || !billingInfo.lastName || !billingInfo.country) {
        return sendError(res, 'Complete billing information (firstName, lastName, country) is required for paid plans', 400);
      }

      // Return payment options for paid plans
      return sendSuccess(res, 'Plan selected, payment required', {
        plan: {
          id: plan._id,
          name: plan.name,
          tagline: plan.tagline,
          price: plan.price,
          currency: plan.currency,
          billingCycle: plan.billingCycle,
          features: plan.features,
          trialDays: plan.trialDays
        },
        billingInfo: {
          firstName: billingInfo.firstName,
          lastName: billingInfo.lastName,
          country: billingInfo.country,
          phoneNumber: billingInfo.phoneNumber || '',
          isCompany: billingInfo.isCompany || false,
          companyName: billingInfo.companyName || ''
        },
        paymentOptions: {
          stripe: {
            enabled: true,
            description: 'Pay with credit/debit card via Stripe'
          },
          paypal: {
            enabled: true,
            description: 'Pay with PayPal account'
          }
        },
        nextSteps: {
          message: 'Choose your preferred payment method to complete the subscription',
          endpoints: {
            stripe: '/api/stripe/create-payment-intent',
            paypal: '/api/paypal/create-order'
          }
        }
      });
    }

  } catch (error) {
    console.error('Select plan error:', error);
    sendError(res, 'Internal server error while selecting plan');
  }
};

// Get user's current subscription status
export const getCurrentSubscription = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscription = await UserSubscription.findOne({ 
      userId, 
      status: { $in: ['active', 'trial'] } 
    }).populate('planId', 'name tagline price currency billingCycle features trialDays');

    if (!subscription) {
      return sendSuccess(res, 'No active subscription found', {
        hasSubscription: false,
        subscription: null
      });
    }

    const subscriptionData = {
      planId: subscription.planId,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      trialEndDate: subscription.trialEndDate,
      isTrialActive: subscription.isTrialCurrentlyActive(),
      autoRenew: subscription.autoRenew,
      nextBillingDate: subscription.nextBillingDate,
      paymentMethod: subscription.paymentMethod,
      trialStatus: {
        isTrialActive: subscription.isTrialCurrentlyActive(),
        isTrialExpired: subscription.isTrialExpired,
        daysRemaining: subscription.daysRemaining,
        isExpired: subscription.isExpired,
        trialEndDate: subscription.trialEndDate,
        endDate: subscription.endDate
      },
      plan: {
        name: subscription.planId?.name,
        tagline: subscription.planId?.tagline,
        price: subscription.planId?.price,
        currency: subscription.planId?.currency,
        billingCycle: subscription.planId?.billingCycle,
        features: subscription.planId?.features,
        trialDays: subscription.planId?.trialDays
      }
    };

    sendSuccess(res, 'Current subscription retrieved successfully', {
      hasSubscription: true,
      subscription: subscriptionData
    });

  } catch (error) {
    console.error('Get current subscription error:', error);
    sendError(res, 'Internal server error while retrieving subscription');
  }
};
