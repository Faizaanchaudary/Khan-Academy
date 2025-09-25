import UserSubscription from '../models/UserSubscription.js';
import Plan from '../models/Plan.js';
import User from '../models/User.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const createSubscription = async (req, res) => {
  try {
    const { 
      planId, 
      paymentMethod = 'card',
      billingInfo,
      paymentDetails,
      promoCode,
      discountAmount = 0
    } = req.body;
    const userId = req.user.id;

    const plan = await Plan.findById(planId);
    if (!plan) {
      return sendError(res, 'Plan not found', 404);
    }

    const existingSubscription = await UserSubscription.findOne({
      userId,
      status: { $in: ['active', 'trial'] }
    });

    // Allow upgrade from free trial to paid plan
    if (existingSubscription) {
      // Check if user is trying to upgrade from free trial to paid plan
      const isUpgradingFromFreeTrial = existingSubscription.paymentMethod === 'free' && 
                                       existingSubscription.planId.toString() !== planId && 
                                       plan.price > 0;
      
      if (!isUpgradingFromFreeTrial) {
        return sendError(res, 'User already has an active subscription', 400);
      }
      
      // Cancel the existing free trial subscription
      existingSubscription.status = 'cancelled';
      existingSubscription.cancelledAt = new Date();
      existingSubscription.cancellationReason = 'Upgraded to paid plan';
      await existingSubscription.save();
    }

    if (!billingInfo || !billingInfo.firstName || !billingInfo.lastName || !billingInfo.country) {
      return sendError(res, 'Billing information (firstName, lastName, country) is required', 400);
    }

    const subtotal = plan.price;
    const amountDueNow = plan.trialDays > 0 ? 0 : subtotal - discountAmount;
    const nextBillingAmount = subtotal - discountAmount;

    const now = new Date();
    const trialEndDate = new Date(now.getTime() + (plan.trialDays * 24 * 60 * 60 * 1000));
    const endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    const nextBillingDate = plan.trialDays > 0 ? trialEndDate : endDate;

    const subscription = new UserSubscription({
      userId,
      planId,
      status: plan.trialDays > 0 ? 'trial' : 'active',
      startDate: now,
      endDate,
      trialEndDate,
      isTrialActive: plan.trialDays > 0,
      paymentMethod,
      billingInfo,
      paymentDetails: paymentDetails || {},
      pricing: {
        subtotal,
        amountDueNow,
        nextBillingAmount,
        currency: plan.currency
      },
      promoCode,
      discountAmount,
      nextBillingDate
    });

    await subscription.save();

    await subscription.populate('planId', 'name tagline price currency billingCycle features');

    sendSuccess(res, 'Subscription created successfully', { subscription }, 201);
  } catch (error) {
    console.error('Create subscription error:', error);
    sendError(res, 'Internal server error while creating subscription');
  }
};

export const getUserSubscription = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscription = await UserSubscription.findOne({
      userId,
      status: { $in: ['active', 'trial'] }
    }).populate('planId', 'name tagline price currency billingCycle features');

    if (!subscription) {
      return sendError(res, 'No active subscription found', 404);
    }

    const subscriptionData = {
      ...subscription.toObject(),
      daysRemaining: subscription.daysRemaining,
      isExpired: subscription.isExpired,
      isTrialExpired: subscription.isTrialExpired
    };

    sendSuccess(res, 'Subscription retrieved successfully', { subscription: subscriptionData });
  } catch (error) {
    console.error('Get user subscription error:', error);
    sendError(res, 'Internal server error while retrieving subscription');
  }
};

export const getSubscriptionById = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    const subscription = await UserSubscription.findById(subscriptionId)
      .populate('userId', 'name email')
      .populate('planId', 'name tagline price currency billingCycle features');

    if (!subscription) {
      return sendError(res, 'Subscription not found', 404);
    }

    const subscriptionData = {
      ...subscription.toObject(),
      daysRemaining: subscription.daysRemaining,
      isExpired: subscription.isExpired,
      isTrialExpired: subscription.isTrialExpired
    };

    sendSuccess(res, 'Subscription retrieved successfully', { subscription: subscriptionData });
  } catch (error) {
    console.error('Get subscription by ID error:', error);
    sendError(res, 'Internal server error while retrieving subscription');
  }
};

export const getAllSubscriptions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }

    const subscriptions = await UserSubscription.find(query)
      .populate('userId', 'name email')
      .populate('planId', 'name tagline price currency billingCycle')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await UserSubscription.countDocuments(query);

    const subscriptionsData = subscriptions.map(sub => ({
      ...sub.toObject(),
      daysRemaining: sub.daysRemaining,
      isExpired: sub.isExpired,
      isTrialExpired: sub.isTrialExpired
    }));

    sendSuccess(res, 'Subscriptions retrieved successfully', {
      subscriptions: subscriptionsData,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get all subscriptions error:', error);
    sendError(res, 'Internal server error while retrieving subscriptions');
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const subscription = await UserSubscription.findOne({
      _id: subscriptionId,
      userId
    });

    if (!subscription) {
      return sendError(res, 'Subscription not found', 404);
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = reason;

    await subscription.save();

    sendSuccess(res, 'Subscription cancelled successfully', { subscription });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    sendError(res, 'Internal server error while cancelling subscription');
  }
};

export const renewSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user.id;

    const subscription = await UserSubscription.findOne({
      _id: subscriptionId,
      userId
    }).populate('planId');

    if (!subscription) {
      return sendError(res, 'Subscription not found', 404);
    }

    if (subscription.status !== 'expired') {
      return sendError(res, 'Subscription is not expired', 400);
    }

    const now = new Date();
    const newEndDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    const newNextBillingDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    subscription.status = 'active';
    subscription.startDate = now;
    subscription.endDate = newEndDate;
    subscription.nextBillingDate = newNextBillingDate;
    subscription.lastPaymentDate = now;

    await subscription.save();

    sendSuccess(res, 'Subscription renewed successfully', { subscription });
  } catch (error) {
    console.error('Renew subscription error:', error);
    sendError(res, 'Internal server error while renewing subscription');
  }
};

export const getSubscriptionAnalytics = async (req, res) => {
  try {
    const totalSubscriptions = await UserSubscription.countDocuments();
    const activeSubscriptions = await UserSubscription.countDocuments({ status: 'active' });
    const trialSubscriptions = await UserSubscription.countDocuments({ status: 'trial' });
    const expiredSubscriptions = await UserSubscription.countDocuments({ status: 'expired' });
    const cancelledSubscriptions = await UserSubscription.countDocuments({ status: 'cancelled' });

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiringSoon = await UserSubscription.find({
      endDate: { $lte: sevenDaysFromNow },
      status: { $in: ['active', 'trial'] }
    }).populate('userId', 'name email').populate('planId', 'name');

    const analytics = {
      totalSubscriptions,
      activeSubscriptions,
      trialSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      expiringSoon: expiringSoon.map(sub => ({
        ...sub.toObject(),
        daysRemaining: sub.daysRemaining
      }))
    };

    sendSuccess(res, 'Subscription analytics retrieved successfully', { analytics });
  } catch (error) {
    console.error('Get subscription analytics error:', error);
    sendError(res, 'Internal server error while retrieving analytics');
  }
};

export const checkSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscription = await UserSubscription.findOne({
      userId,
      status: { $in: ['active', 'trial'] }
    }).populate('planId', 'name features');

    if (!subscription) {
      return sendSuccess(res, 'No active subscription', { 
        hasActiveSubscription: false,
        subscription: null 
      });
    }

    const isActive = subscription.isActive();
    const isTrialActive = subscription.isTrialCurrentlyActive();

    sendSuccess(res, 'Subscription status checked', {
      hasActiveSubscription: isActive || isTrialActive,
      subscription: {
        ...subscription.toObject(),
        daysRemaining: subscription.daysRemaining,
        isExpired: subscription.isExpired,
        isTrialExpired: subscription.isTrialExpired,
        isActive,
        isTrialActive
      }
    });
  } catch (error) {
    console.error('Check subscription status error:', error);
    sendError(res, 'Internal server error while checking subscription status');
  }
};