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
  createRecurringSubscription,
  createPrice,
  getSubscriptionDetails,
  cancelSubscription,
  refundPayment,
  verifyWebhookSignature,
  getStripeEnvironment,
  getStripeInstance
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
    const { planId } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!planId) {
      return sendError(res, 'Plan ID is required', 400);
    }

    // Get user information from authenticated user
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Prepare billing information from user data
    const billingInfo = {
      firstName: user.firstName || 'User',
      lastName: user.lastName || 'User',
      email: user.email
    };

    // Get plan details
    const plan = await Plan.findById(planId);
    if (!plan) {
      return sendError(res, 'Plan not found', 404);
    }

    if (!plan.isActive) {
      return sendError(res, 'Plan is not available for purchase', 400);
    }

    // Check if user already has an active subscription
    const existingActiveSubscription = await UserSubscription.findOne({
      userId,
      status: { $in: ['active', 'trial'] }
    });

    // Check if user already has a pending subscription for the same plan
    const existingPendingSubscription = await UserSubscription.findOne({
      userId,
      planId,
      status: 'pending'
    });

    // If there's already a pending subscription for this plan, return the existing payment intent
    if (existingPendingSubscription) {
      // Check if the existing pending subscription has a valid payment intent
      if (existingPendingSubscription.stripeDetails?.paymentIntentId) {
        // Get the payment intent details from Stripe
        const stripe = getStripeInstance();
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            existingPendingSubscription.stripeDetails.paymentIntentId
          );
          
          if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'requires_confirmation') {
            return sendSuccess(res, 'Existing payment intent found', {
              clientSecret: paymentIntent.client_secret,
              paymentIntentId: paymentIntent.id,
              customerId: existingPendingSubscription.stripeDetails.customerId,
              localSubscriptionId: existingPendingSubscription._id,
              amount: existingPendingSubscription.pricing.amountDueNow,
              currency: plan.currency,
              plan: {
                name: plan.name,
                features: plan.features
              }
            });
          } else if (paymentIntent.status === 'succeeded') {
            // Payment already succeeded, update subscription and return success
            existingPendingSubscription.status = plan.trialDays > 0 ? 'trial' : 'active';
            existingPendingSubscription.stripeDetails.paymentStatus = 'succeeded';
            existingPendingSubscription.lastPaymentDate = new Date();
            await existingPendingSubscription.save();
            
            return sendSuccess(res, 'Payment already processed successfully', {
              subscription: {
                ...existingPendingSubscription.toObject(),
                daysRemaining: existingPendingSubscription.daysRemaining,
                isExpired: existingPendingSubscription.isExpired,
                isTrialExpired: existingPendingSubscription.isTrialExpired
              },
              paymentAlreadyProcessed: true
            });
          }
        } catch (error) {
          console.log('Payment intent not found or invalid, cleaning up and creating new one');
          // Clean up the invalid pending subscription
          await UserSubscription.findByIdAndDelete(existingPendingSubscription._id);
        }
      } else {
        // Clean up pending subscription without payment intent
        await UserSubscription.findByIdAndDelete(existingPendingSubscription._id);
      }
    }

    // Clean up any other old pending subscriptions for this user
    await UserSubscription.deleteMany({
      userId,
      status: 'pending',
      planId: { $ne: planId }
    });

    // Allow upgrade from free trial to paid plan
    if (existingActiveSubscription) {
      // Check if user is trying to upgrade from free trial to paid plan
      const isUpgradingFromFreeTrial = existingActiveSubscription.paymentMethod === 'free' && 
                                       existingActiveSubscription.planId.toString() !== planId && 
                                       plan.price > 0;
      
      if (!isUpgradingFromFreeTrial) {
        return sendError(res, 'User already has an active subscription', 400);
      }
      
      // Cancel the existing free trial subscription
      existingActiveSubscription.status = 'cancelled';
      existingActiveSubscription.cancelledAt = new Date();
      existingActiveSubscription.cancellationReason = 'Upgraded to paid plan';
      await existingActiveSubscription.save();
    }

    // Calculate pricing
    const subtotal = plan.price;
    const amountDueNow = plan.trialDays > 0 ? 0 : subtotal;
    const nextBillingAmount = subtotal;

    // For free plans or trial-only plans, create subscription directly without Stripe
    if (subtotal === 0 || (plan.trialDays > 0 && amountDueNow === 0)) {
      // Create subscription directly for free plans or trial-only plans
      const freePlanDate = new Date();
      const trialEndDate = new Date(freePlanDate.getTime() + (plan.trialDays * 24 * 60 * 60 * 1000));
      const endDate = new Date(freePlanDate.getTime() + (30 * 24 * 60 * 60 * 1000));

      // Use the same cleanBillingInfo format as the paid plan
      const cleanBillingInfo = {
        firstName: billingInfo.firstName,
        lastName: billingInfo.lastName,
        email: billingInfo.email
      };

      const subscription = new UserSubscription({
        userId,
        planId,
        status: plan.trialDays > 0 ? 'trial' : 'active',
        startDate: freePlanDate,
        endDate,
        trialEndDate,
        isTrialActive: plan.trialDays > 0,
        paymentMethod: 'free',
        billingInfo: cleanBillingInfo,
        pricing: {
          subtotal,
          amountDueNow: 0,
          nextBillingAmount,
          currency: plan.currency
        },
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
        planId: planId.toString()
      }
    );

    if (!customerResult.success) {
      return sendError(res, `Failed to create Stripe customer: ${customerResult.error}`, 500);
    }

    // For monthly plans, we'll create a Stripe subscription for auto-renewal
    // This ensures user gets charged today AND automatically every month
    const priceResult = await createPrice(
      nextBillingAmount, // $40/month
      plan.currency.toLowerCase(),
      'month', // Monthly billing
      {
        planId: planId.toString(),
        planName: plan.name,
        userId: userId.toString(),
        billingCycle: plan.billingCycle
      }
    );

    if (!priceResult.success) {
      return sendError(res, `Failed to create Stripe price: ${priceResult.error}`, 500);
    }

    // Create payment intent for frontend checkout
    const paymentIntentResult = await createPaymentIntent(
      amountDueNow, // Amount in dollars
      plan.currency.toLowerCase(),
      {
        userId: userId.toString(),
        planId: planId.toString(),
        planName: plan.name,
        customerId: customerResult.customer.id
      }
    );

    if (!paymentIntentResult.success) {
      return sendError(res, `Failed to create payment intent: ${paymentIntentResult.error}`, 500);
    }

    const paymentIntent = paymentIntentResult.paymentIntent;

    // Store pending subscription
    const subscriptionDate = new Date();
    const trialEndDate = new Date(subscriptionDate.getTime() + (plan.trialDays * 24 * 60 * 60 * 1000));
    const endDate = new Date(subscriptionDate.getTime() + (30 * 24 * 60 * 60 * 1000));

    // Prepare billing info without card details
    const cleanBillingInfo = {
      firstName: billingInfo.firstName,
      lastName: billingInfo.lastName,
      email: billingInfo.email
    };

    const subscription = new UserSubscription({
      userId,
      planId,
      status: 'pending',
      startDate: subscriptionDate,
      endDate,
      trialEndDate,
      isTrialActive: plan.trialDays > 0,
      paymentMethod: 'stripe',
      billingInfo: cleanBillingInfo,
      stripeDetails: {
        customerId: customerResult.customer.id,
        paymentIntentId: paymentIntent.id,
        paymentStatus: 'pending'
      },
      pricing: {
        subtotal,
        amountDueNow,
        nextBillingAmount,
        currency: plan.currency
      },
      nextBillingDate: plan.trialDays > 0 ? trialEndDate : endDate
    });

    try {
      await subscription.save();
    } catch (error) {
      // Handle duplicate key error - user already has a pending subscription for this plan
      if (error.code === 11000) {
        console.log('Duplicate subscription detected, finding existing one...');
        
        // Find the existing pending subscription
        const existingPendingSubscription = await UserSubscription.findOne({
          userId,
          planId,
          status: 'pending'
        });

        if (existingPendingSubscription) {
          // Update the existing subscription with new payment intent details
          existingPendingSubscription.stripeDetails = {
            customerId: customerResult.customer.id,
            paymentIntentId: paymentIntent.id,
            paymentStatus: 'pending'
          };
          existingPendingSubscription.pricing = {
            subtotal,
            amountDueNow,
            nextBillingAmount,
            currency: plan.currency
          };
          await existingPendingSubscription.save();

          // Return the existing subscription's payment intent
          return sendSuccess(res, 'Payment intent updated for existing subscription', {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            customerId: customerResult.customer.id,
            localSubscriptionId: existingPendingSubscription._id,
            amount: amountDueNow,
            currency: plan.currency,
            plan: {
              name: plan.name,
              features: plan.features
            }
          });
        }
      }
      throw error; // Re-throw if it's not a duplicate key error
    }

    // Return payment intent details for frontend checkout
    sendSuccess(res, 'Stripe payment intent created successfully', {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      customerId: customerResult.customer.id,
      localSubscriptionId: subscription._id,
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
      $or: [
        { 'stripeDetails.paymentIntentId': paymentIntentId },
        { 'stripeDetails.subscriptionId': paymentIntentId } // For subscription-based lookup
      ],
      userId,
      status: 'pending'
    }).populate('planId');

    if (!subscription) {
      return sendError(res, 'Subscription not found or already processed', 404);
    }

    // IMPORTANT: Check if this subscription is already being processed to prevent race conditions
    if (subscription.stripeDetails.paymentStatus === 'succeeded') {
      return sendError(res, 'Payment already processed', 400);
    }

    // Check if using subscription-based payment
    if (subscription.stripeDetails.subscriptionId && subscription.stripeDetails.subscriptionId === paymentIntentId) {
      // Handle subscription-based confirmation
      const subscriptionResult = await getSubscriptionDetails(subscription.stripeDetails.subscriptionId);
      
      if (!subscriptionResult.success) {
        return sendError(res, `Failed to get subscription details: ${subscriptionResult.error}`, 500);
      }

      const stripeSubscription = subscriptionResult.subscription;
      
      // Check subscription status
      if (stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing') {
        subscription.status = subscription.planId.trialDays > 0 ? 'trial' : 'active';
        subscription.stripeDetails = {
          ...subscription.stripeDetails,
          paymentStatus: 'succeeded'
        };
        subscription.lastPaymentDate = new Date();
        subscription.autoRenew = true; // Enable auto-renewal

        await subscription.save();
        
        // Populate plan details for response
        await subscription.populate('planId', 'name tagline price currency billingCycle features');

        sendSuccess(res, 'Recurring subscription confirmed and activated successfully (auto-renewal enabled)', {
          subscription: {
            ...subscription.toObject(),
            daysRemaining: subscription.daysRemaining,
            isExpired: subscription.isExpired,
            isTrialExpired: subscription.isTrialExpired,
            autoRenew: subscription.autoRenew,
            stripeSubscription: {
              id: stripeSubscription.id,
              status: stripeSubscription.status,
              current_period_start: stripeSubscription.current_period_start,
              current_period_end: stripeSubscription.current_period_end
            }
          }
        });
        return;
      } else {
        return sendError(res, `Subscription status: ${stripeSubscription.status}`, 400);
      }
    }

    // Fallback to payment intent confirmation (for backwards compatibility)
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
    
    console.log('✅ SUBSCRIPTION ACTIVATED SUCCESSFULLY:', {
      subscriptionId: subscription._id,
      userId: subscription.userId,
      planId: subscription.planId,
      status: subscription.status,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100
    });

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
      // Auto-renewal subscription events
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
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

// Handle invoice payment succeeded (RECURRING BILLING SUCCESS)
const handleInvoicePaymentSucceeded = async (invoice) => {
  try {
    console.log('Invoice payment succeeded:', invoice.id);
    
    if (invoice.subscription) {
      // Find the subscription by Stripe subscription ID
      const subscription = await UserSubscription.findOne({
        'stripeDetails.subscriptionId': invoice.subscription
      }).populate('planId');

      if (subscription) {
        // Update subscription for successful renewal
        const newEndDate = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // Add 30 days
        
        subscription.status = 'active';
        subscription.endDate = newEndDate;
        subscription.nextBillingDate = newEndDate;
        subscription.lastPaymentDate = new Date();
        subscription.stripeDetails.paymentStatus = 'succeeded';
        
        await subscription.save();
        
        console.log('💳 AUTOMATIC RENEWAL SUCCESS - User subscription renewed:', {
          subscriptionId: subscription._id,
          userId: subscription.userId,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency,
          newEndDate: newEndDate
        });
      }
    }
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
  }
};

// Handle invoice payment failed (RECURRING BILLING FAILURE)
const handleInvoicePaymentFailed = async (invoice) => {
  try {
    console.log('Invoice payment failed:', invoice.id);
    
    if (invoice.subscription) {
      // Find the subscription by Stripe subscription ID
      const subscription = await UserSubscription.findOne({
        'stripeDetails.subscriptionId': invoice.subscription
      });

      if (subscription) {
        // Mark subscription as failed but give grace period
        subscription.stripeDetails.paymentStatus = 'failed';
        subscription.lastPaymentDate = new Date();
        
        await subscription.save();
        
        console.log('⚠️ AUTOMATIC RENEWAL FAILED - Payment rejected:', {
          subscriptionId: subscription._id,
          userId: subscription.userId,
          amount: invoice.amount_due / 100,
          currency: invoice.currency,
          reason: 'Payment method declined'
        });
      }
    }
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
  }
};

// Handle subscription updates
const handleSubscriptionUpdated = async (stripeSubscription) => {
  try {
    const subscription = await UserSubscription.findOne({
      'stripeDetails.subscriptionId': stripeSubscription.id
    });

    if (subscription) {
      // Update based on Stripe subscription status
      switch (stripeSubscription.status) {
        case 'active':
          subscription.status = 'active';
          break;
        case 'past_due':
          subscription.status = 'expired'; // Grace period ended
          break;
        case 'canceled':
          subscription.status = 'cancelled';
          subscription.autoRenew = false;
          break;
      }
      
      await subscription.save();
      console.log('Subscription updated:', subscription._id, 'Status:', subscription.status);
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
};

// Handle subscription deleted (cancellation)
const handleSubscriptionDeleted = async (stripeSubscription) => {
  try {
    const subscription = await UserSubscription.findOne({
      'stripeDetails.subscriptionId': stripeSubscription.id
    });

    if (subscription) {
      subscription.status = 'cancelled';
      subscription.autoRenew = false;
      subscription.cancelledAt = new Date();
      subscription.cancellationReason = 'Subscription cancelled on Stripe';
      
      await subscription.save();
      console.log('Subscription cancelled:', subscription._id);
    }
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
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
