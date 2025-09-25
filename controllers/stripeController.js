import Plan from '../models/Plan.js';
import UserSubscription from '../models/UserSubscription.js';
import User from '../models/User.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { 
  createPaymentIntent,
  confirmPaymentIntent,
  createCustomer,
  createSetupIntent,
  createSubscription,
  cancelSubscription,
  refundPayment,
  verifyWebhookSignature,
  getStripeEnvironment
} from '../config/stripe.js';
import { 
  validatePaymentAmount, 
  validateBillingInfo, 
  createPaymentError,
  createPaymentSuccess,
  generatePaymentId
} from '../utils/paymentUtils.js';

// Create Stripe payment intent for subscription purchase
export const createStripePaymentIntent = async (req, res) => {
  try {
    const { planId, billingInfo, promoCode, discountAmount = 0 } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!planId) {
      return sendError(res, 'Plan ID is required', 400);
    }

    if (!billingInfo || !billingInfo.firstName || !billingInfo.lastName || !billingInfo.country) {
      return sendError(res, 'Billing information (firstName, lastName, country) is required', 400);
    }

    // Validate billing information
    const billingValidation = validateBillingInfo(billingInfo);
    if (!billingValidation.valid) {
      return sendError(res, `Billing validation failed: ${billingValidation.errors.join(', ')}`, 400);
    }

    // Get plan details
    const plan = await Plan.findById(planId);
    if (!plan) {
      return sendError(res, 'Plan not found', 404);
    }

    if (!plan.isActive) {
      return sendError(res, 'Plan is not available for purchase', 400);
    }

    // Check if user already has an active subscription
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

    // Calculate pricing
    const subtotal = plan.price;
    const amountDueNow = plan.trialDays > 0 ? 0 : subtotal - discountAmount;
    const nextBillingAmount = subtotal - discountAmount;

    // For free plans or trial-only plans, create subscription directly without Stripe
    if (subtotal === 0 || (plan.trialDays > 0 && amountDueNow === 0)) {
      // Create subscription directly for free plans or trial-only plans
      const now = new Date();
      const trialEndDate = new Date(now.getTime() + (plan.trialDays * 24 * 60 * 60 * 1000));
      const endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

      const subscription = new UserSubscription({
        userId,
        planId,
        status: plan.trialDays > 0 ? 'trial' : 'active',
        startDate: now,
        endDate,
        trialEndDate,
        isTrialActive: plan.trialDays > 0,
        paymentMethod: 'free',
        billingInfo,
        pricing: {
          subtotal,
          amountDueNow: 0,
          nextBillingAmount,
          currency: plan.currency
        },
        promoCode,
        discountAmount,
        nextBillingDate: plan.trialDays > 0 ? trialEndDate : endDate
      });

      await subscription.save();
      await subscription.populate('planId', 'name tagline price currency billingCycle features');

      return sendSuccess(res, 'Free subscription created successfully', {
        subscription: {
          ...subscription.toObject(),
          daysRemaining: subscription.daysRemaining,
          isExpired: subscription.isExpired,
          isTrialExpired: subscription.isTrialExpired
        },
        isFreePlan: true
      });
    }

    // Validate payment amount for paid plans
    const amountValidation = validatePaymentAmount(amountDueNow);
    if (!amountValidation.valid) {
      return sendError(res, amountValidation.error, 400);
    }

    // Create Stripe customer
    const customerResult = await createCustomer(
      billingInfo.email || `${billingInfo.firstName}.${billingInfo.lastName}@example.com`,
      `${billingInfo.firstName} ${billingInfo.lastName}`,
      {
        userId: userId.toString(),
        planId: planId.toString(),
        billingCountry: billingInfo.country
      }
    );

    if (!customerResult.success) {
      return sendError(res, `Failed to create Stripe customer: ${customerResult.error}`, 500);
    }

    // Create payment intent
    const paymentIntentResult = await createPaymentIntent(
      amountDueNow,
      plan.currency.toLowerCase(),
      {
        userId: userId.toString(),
        planId: planId.toString(),
        planName: plan.name,
        subscriptionType: 'one_time'
      }
    );

    if (!paymentIntentResult.success) {
      return sendError(res, `Failed to create payment intent: ${paymentIntentResult.error}`, 500);
    }

    // Store pending subscription
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + (plan.trialDays * 24 * 60 * 60 * 1000));
    const endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    const subscription = new UserSubscription({
      userId,
      planId,
      status: 'pending',
      startDate: now,
      endDate,
      trialEndDate,
      isTrialActive: plan.trialDays > 0,
      paymentMethod: 'stripe',
      billingInfo,
      stripeDetails: {
        customerId: customerResult.customer.id,
        paymentIntentId: paymentIntentResult.paymentIntent.id,
        paymentStatus: 'pending'
      },
      pricing: {
        subtotal,
        amountDueNow,
        nextBillingAmount,
        currency: plan.currency
      },
      promoCode,
      discountAmount,
      nextBillingDate: plan.trialDays > 0 ? trialEndDate : endDate
    });

    await subscription.save();

    // Return payment intent details for frontend
    sendSuccess(res, 'Stripe payment intent created successfully', {
      clientSecret: paymentIntentResult.paymentIntent.client_secret,
      paymentIntentId: paymentIntentResult.paymentIntent.id,
      customerId: customerResult.customer.id,
      subscriptionId: subscription._id,
      amount: amountDueNow,
      currency: plan.currency,
      plan: {
        name: plan.name,
        features: plan.features
      }
    });

  } catch (error) {
    console.error('Create Stripe payment intent error:', error);
    sendError(res, 'Internal server error while creating payment intent');
  }
};

// Confirm Stripe payment and activate subscription
export const confirmStripePayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const userId = req.user.id;

    if (!paymentIntentId) {
      return sendError(res, 'Payment Intent ID is required', 400);
    }

    // Find the subscription with this payment intent ID
    const subscription = await UserSubscription.findOne({
      'stripeDetails.paymentIntentId': paymentIntentId,
      userId,
      status: 'pending'
    }).populate('planId');

    if (!subscription) {
      return sendError(res, 'Subscription not found or already processed', 404);
    }

    // Confirm the payment intent with Stripe
    const confirmResult = await confirmPaymentIntent(paymentIntentId);
    
    if (!confirmResult.success) {
      return sendError(res, `Failed to confirm payment: ${confirmResult.error}`, 500);
    }

    const paymentIntent = confirmResult.paymentIntent;

    // Check if payment was successful
    if (paymentIntent.status !== 'succeeded') {
      return sendError(res, `Payment failed with status: ${paymentIntent.status}`, 400);
    }

    // Extract payment method details
    const paymentMethod = paymentIntent.payment_method;
    const charges = paymentIntent.charges?.data?.[0];

    // Update subscription with payment details and activate
    subscription.status = subscription.planId.trialDays > 0 ? 'trial' : 'active';
    subscription.stripeDetails = {
      ...subscription.stripeDetails,
      paymentMethodId: paymentMethod?.id,
      chargeId: charges?.id,
      paymentStatus: 'succeeded',
      last4: paymentMethod?.card?.last4,
      brand: paymentMethod?.card?.brand,
      expiryMonth: paymentMethod?.card?.exp_month?.toString(),
      expiryYear: paymentMethod?.card?.exp_year?.toString()
    };
    subscription.lastPaymentDate = new Date();

    await subscription.save();

    // Populate plan details for response
    await subscription.populate('planId', 'name tagline price currency billingCycle features');

    sendSuccess(res, 'Payment confirmed and subscription activated successfully', {
      subscription: {
        ...subscription.toObject(),
        daysRemaining: subscription.daysRemaining,
        isExpired: subscription.isExpired,
        isTrialExpired: subscription.isTrialExpired
      },
      paymentDetails: {
        paymentIntentId: paymentIntent.id,
        chargeId: charges?.id,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        paymentMethod: {
          last4: paymentMethod?.card?.last4,
          brand: paymentMethod?.card?.brand,
          expiryMonth: paymentMethod?.card?.exp_month,
          expiryYear: paymentMethod?.card?.exp_year
        }
      }
    });

  } catch (error) {
    console.error('Confirm Stripe payment error:', error);
    sendError(res, 'Internal server error while confirming payment');
  }
};

// Get Stripe payment intent details
export const getStripePaymentIntent = async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const userId = req.user.id;

    if (!paymentIntentId) {
      return sendError(res, 'Payment Intent ID is required', 400);
    }

    // Find the subscription
    const subscription = await UserSubscription.findOne({
      'stripeDetails.paymentIntentId': paymentIntentId,
      userId
    }).populate('planId', 'name tagline price currency billingCycle features');

    if (!subscription) {
      return sendError(res, 'Payment intent not found', 404);
    }

    // Get payment intent details from Stripe
    const confirmResult = await confirmPaymentIntent(paymentIntentId);
    
    if (!confirmResult.success) {
      return sendError(res, `Failed to get payment intent details: ${confirmResult.error}`, 500);
    }

    sendSuccess(res, 'Payment intent details retrieved successfully', {
      paymentIntent: confirmResult.paymentIntent,
      subscription: {
        ...subscription.toObject(),
        daysRemaining: subscription.daysRemaining,
        isExpired: subscription.isExpired,
        isTrialExpired: subscription.isTrialExpired
      }
    });

  } catch (error) {
    console.error('Get Stripe payment intent error:', error);
    sendError(res, 'Internal server error while retrieving payment intent details');
  }
};

// Cancel Stripe payment intent
export const cancelStripePayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const userId = req.user.id;

    if (!paymentIntentId) {
      return sendError(res, 'Payment Intent ID is required', 400);
    }

    // Find the subscription
    const subscription = await UserSubscription.findOne({
      'stripeDetails.paymentIntentId': paymentIntentId,
      userId,
      status: 'pending'
    });

    if (!subscription) {
      return sendError(res, 'Payment intent not found or already processed', 404);
    }

    // Update subscription status
    subscription.status = 'cancelled';
    subscription.stripeDetails.paymentStatus = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = 'User cancelled Stripe payment';

    await subscription.save();

    sendSuccess(res, 'Payment cancelled successfully', {
      paymentIntentId,
      subscriptionId: subscription._id,
      status: 'cancelled'
    });

  } catch (error) {
    console.error('Cancel Stripe payment error:', error);
    sendError(res, 'Internal server error while cancelling payment');
  }
};

// Stripe webhook handler
export const handleStripeWebhook = async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const payload = req.body;

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // Verify webhook signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const verifyResult = verifyWebhookSignature(payload, signature, webhookSecret);
    
    if (!verifyResult.success) {
      console.error('Webhook signature verification failed:', verifyResult.error);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = verifyResult.event;

    console.log('Stripe webhook received:', event.type);

    // Handle different webhook events
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object);
        break;
      default:
        console.log('Unhandled webhook event:', event.type);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Handle payment intent succeeded
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    const subscription = await UserSubscription.findOne({
      'stripeDetails.paymentIntentId': paymentIntent.id,
      status: 'pending'
    });

    if (subscription) {
      subscription.status = subscription.planId.trialDays > 0 ? 'trial' : 'active';
      subscription.stripeDetails.paymentStatus = 'succeeded';
      subscription.lastPaymentDate = new Date();

      await subscription.save();
      console.log('Subscription activated via webhook:', subscription._id);
    }
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
  }
};

// Handle payment intent failed
const handlePaymentIntentFailed = async (paymentIntent) => {
  try {
    const subscription = await UserSubscription.findOne({
      'stripeDetails.paymentIntentId': paymentIntent.id,
      status: 'pending'
    });

    if (subscription) {
      subscription.status = 'cancelled';
      subscription.stripeDetails.paymentStatus = 'failed';
      subscription.cancelledAt = new Date();
      subscription.cancellationReason = 'Payment failed';

      await subscription.save();
      console.log('Subscription cancelled due to payment failure:', subscription._id);
    }
  } catch (error) {
    console.error('Error handling payment intent failed:', error);
  }
};

// Handle payment intent canceled
const handlePaymentIntentCanceled = async (paymentIntent) => {
  try {
    const subscription = await UserSubscription.findOne({
      'stripeDetails.paymentIntentId': paymentIntent.id,
      status: 'pending'
    });

    if (subscription) {
      subscription.status = 'cancelled';
      subscription.stripeDetails.paymentStatus = 'cancelled';
      subscription.cancelledAt = new Date();
      subscription.cancellationReason = 'Payment cancelled';

      await subscription.save();
      console.log('Subscription cancelled due to payment cancellation:', subscription._id);
    }
  } catch (error) {
    console.error('Error handling payment intent canceled:', error);
  }
};

// Get Stripe environment info
export const getStripeInfo = async (req, res) => {
  try {
    const environment = getStripeEnvironment();
    
    sendSuccess(res, 'Stripe environment info retrieved', {
      environment: environment.environment,
      hasSecretKey: environment.hasSecretKey,
      hasPublishableKey: environment.hasPublishableKey,
      publishableKey: environment.publishableKey
    });
  } catch (error) {
    console.error('Get Stripe info error:', error);
    sendError(res, 'Internal server error while retrieving Stripe info');
  }
};

// Get user's Stripe subscriptions
export const getUserStripeSubscriptions = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscriptions = await UserSubscription.find({
      userId,
      paymentMethod: 'stripe'
    })
    .populate('planId', 'name tagline price currency billingCycle features')
    .sort({ createdAt: -1 });

    const subscriptionsData = subscriptions.map(sub => ({
      ...sub.toObject(),
      daysRemaining: sub.daysRemaining,
      isExpired: sub.isExpired,
      isTrialExpired: sub.isTrialExpired
    }));

    sendSuccess(res, 'Stripe subscriptions retrieved successfully', {
      subscriptions: subscriptionsData
    });

  } catch (error) {
    console.error('Get user Stripe subscriptions error:', error);
    sendError(res, 'Internal server error while retrieving Stripe subscriptions');
  }
};

// Refund Stripe payment
export const refundStripePayment = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { amount, reason = 'requested_by_customer' } = req.body;
    const userId = req.user.id;

    const subscription = await UserSubscription.findOne({
      _id: subscriptionId,
      userId,
      paymentMethod: 'stripe'
    });

    if (!subscription) {
      return sendError(res, 'Stripe subscription not found', 404);
    }

    if (!subscription.stripeDetails.chargeId) {
      return sendError(res, 'No charge ID found for refund', 400);
    }

    const refundResult = await refundPayment(
      subscription.stripeDetails.chargeId,
      amount,
      reason
    );

    if (!refundResult.success) {
      return sendError(res, `Refund failed: ${refundResult.error}`, 500);
    }

    // Update subscription status
    subscription.stripeDetails.paymentStatus = 'refunded';
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = `Refunded: ${reason}`;

    await subscription.save();

    sendSuccess(res, 'Payment refunded successfully', {
      refund: refundResult.refund,
      subscription: subscription
    });

  } catch (error) {
    console.error('Refund Stripe payment error:', error);
    sendError(res, 'Internal server error while processing refund');
  }
};
