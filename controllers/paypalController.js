import paypal from '@paypal/checkout-server-sdk';
import Plan from '../models/Plan.js';
import UserSubscription from '../models/UserSubscription.js';
import User from '../models/User.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { 
  createOrderRequest, 
  captureOrderRequest, 
  getOrderRequest, 
  paypalClient,
  getPayPalEnvironment 
} from '../config/paypal.js';
import { 
  validatePaymentAmount, 
  validateBillingInfo, 
  extractPayPalPaymentDetails,
  createPaymentError,
  createPaymentSuccess,
  generatePaymentId
} from '../utils/paymentUtils.js';

// Create PayPal order for subscription purchase
export const createPayPalOrder = async (req, res) => {
  try {
    const { planId, billingInfo, promoCode, discountAmount = 0 } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!planId) {
      return sendError(res, 'Plan ID is required', 400);
    }

    if (!billingInfo || !billingInfo.firstName || !billingInfo.lastName) {
      return sendError(res, 'Billing information (firstName, lastName) is required', 400);
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

    // For free plans or trial-only plans, create subscription directly without PayPal
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

    // Create PayPal order request
    const orderRequest = createOrderRequest(
      amountDueNow,
      plan.currency,
      plan.name
    );

    // Add custom data for tracking
    orderRequest.purchase_units[0].custom_id = `user_${userId}_plan_${planId}`;
    orderRequest.purchase_units[0].invoice_id = generatePaymentId();

    // Create order with PayPal
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody(orderRequest);

    const client = paypalClient();
    const order = await client.execute(request);

    if (!order || !order.result) {
      return sendError(res, 'Failed to create PayPal order', 500);
    }

    // Store pending subscription (will be activated after payment capture)
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + (plan.trialDays * 24 * 60 * 60 * 1000));
    const endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    const subscription = new UserSubscription({
      userId,
      planId,
      status: 'pending', // Will be updated to 'active' or 'trial' after payment capture
      startDate: now,
      endDate,
      trialEndDate,
      isTrialActive: plan.trialDays > 0,
      paymentMethod: 'paypal',
      billingInfo,
      paypalDetails: {
        orderId: order.result.id,
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

    // Return order details for frontend
    const approvalUrl = order.result.links.find(link => link.rel === 'approve')?.href;
    
    sendSuccess(res, 'PayPal order created successfully', {
      orderId: order.result.id,
      approvalUrl,
      subscriptionId: subscription._id,
      amount: amountDueNow,
      currency: plan.currency,
      plan: {
        name: plan.name,
        features: plan.features
      }
    });

  } catch (error) {
    console.error('Create PayPal order error:', error);
    sendError(res, 'Internal server error while creating PayPal order');
  }
};

// Capture PayPal payment and activate subscription
export const capturePayPalPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    if (!orderId) {
      return sendError(res, 'Order ID is required', 400);
    }

    // Find the subscription with this order ID
    const subscription = await UserSubscription.findOne({
      'paypalDetails.orderId': orderId,
      userId,
      status: 'pending'
    }).populate('planId');

    if (!subscription) {
      return sendError(res, 'Subscription not found or already processed', 404);
    }

    // Capture the payment with PayPal
    const captureRequest = new paypal.orders.OrdersCaptureRequest(orderId);
    captureRequest.requestBody({});

    const client = paypalClient();
    const capture = await client.execute(captureRequest);

    if (!capture || !capture.result) {
      return sendError(res, 'Failed to capture PayPal payment', 500);
    }

    // Extract payment details
    const paymentDetails = extractPayPalPaymentDetails(capture.result);
    
    if (!paymentDetails || paymentDetails.status !== 'COMPLETED') {
      return sendError(res, 'Payment capture failed', 400);
    }

    // Update subscription with payment details and activate
    subscription.status = subscription.planId.trialDays > 0 ? 'trial' : 'active';
    subscription.paypalDetails = {
      ...subscription.paypalDetails,
      captureId: paymentDetails.captureId,
      payerId: paymentDetails.payerId,
      payerEmail: paymentDetails.payerEmail,
      transactionId: paymentDetails.transactionId,
      paymentStatus: 'completed'
    };
    subscription.lastPaymentDate = new Date();

    await subscription.save();

    // Populate plan details for response
    await subscription.populate('planId', 'name tagline price currency billingCycle features');

    sendSuccess(res, 'Payment captured and subscription activated successfully', {
      subscription: {
        ...subscription.toObject(),
        daysRemaining: subscription.daysRemaining,
        isExpired: subscription.isExpired,
        isTrialExpired: subscription.isTrialExpired
      },
      paymentDetails: {
        orderId: paymentDetails.orderId,
        transactionId: paymentDetails.transactionId,
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
        status: paymentDetails.status
      }
    });

  } catch (error) {
    console.error('Capture PayPal payment error:', error);
    sendError(res, 'Internal server error while capturing payment');
  }
};

// Get PayPal order details
export const getPayPalOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    if (!orderId) {
      return sendError(res, 'Order ID is required', 400);
    }

    // Find the subscription
    const subscription = await UserSubscription.findOne({
      'paypalDetails.orderId': orderId,
      userId
    }).populate('planId', 'name tagline price currency billingCycle features');

    if (!subscription) {
      return sendError(res, 'Order not found', 404);
    }

    // Get order details from PayPal
    const getOrderRequest = new paypal.orders.OrdersGetRequest(orderId);
    const client = paypalClient();
    const order = await client.execute(getOrderRequest);

    if (!order || !order.result) {
      return sendError(res, 'Failed to get order details from PayPal', 500);
    }

    sendSuccess(res, 'Order details retrieved successfully', {
      order: order.result,
      subscription: {
        ...subscription.toObject(),
        daysRemaining: subscription.daysRemaining,
        isExpired: subscription.isExpired,
        isTrialExpired: subscription.isTrialExpired
      }
    });

  } catch (error) {
    console.error('Get PayPal order error:', error);
    sendError(res, 'Internal server error while retrieving order details');
  }
};

// Cancel PayPal order
export const cancelPayPalOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    if (!orderId) {
      return sendError(res, 'Order ID is required', 400);
    }

    // Find the subscription
    const subscription = await UserSubscription.findOne({
      'paypalDetails.orderId': orderId,
      userId,
      status: 'pending'
    });

    if (!subscription) {
      return sendError(res, 'Order not found or already processed', 404);
    }

    // Update subscription status
    subscription.status = 'cancelled';
    subscription.paypalDetails.paymentStatus = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = 'User cancelled PayPal order';

    await subscription.save();

    sendSuccess(res, 'Order cancelled successfully', {
      orderId,
      subscriptionId: subscription._id,
      status: 'cancelled'
    });

  } catch (error) {
    console.error('Cancel PayPal order error:', error);
    sendError(res, 'Internal server error while cancelling order');
  }
};

// PayPal webhook handler
export const handlePayPalWebhook = async (req, res) => {
  try {
    const { event_type, resource } = req.body;

    console.log('PayPal webhook received:', event_type);

    // Handle different webhook events
    switch (event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCaptureCompleted(resource);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        await handlePaymentCaptureDenied(resource);
        break;
      case 'PAYMENT.CAPTURE.REFUNDED':
        await handlePaymentRefunded(resource);
        break;
      default:
        console.log('Unhandled webhook event:', event_type);
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    res.status(500).json({ status: 'error', message: 'Webhook processing failed' });
  }
};

// Handle payment capture completed
const handlePaymentCaptureCompleted = async (resource) => {
  try {
    const captureId = resource.id;
    const orderId = resource.supplementary_data?.related_ids?.order_id;

    if (!orderId) {
      console.error('No order ID found in payment capture webhook');
      return;
    }

    // Find and update subscription
    const subscription = await UserSubscription.findOne({
      'paypalDetails.orderId': orderId,
      status: 'pending'
    });

    if (subscription) {
      subscription.status = subscription.planId.trialDays > 0 ? 'trial' : 'active';
      subscription.paypalDetails.paymentStatus = 'completed';
      subscription.paypalDetails.captureId = captureId;
      subscription.lastPaymentDate = new Date();

      await subscription.save();
      console.log('Subscription activated via webhook:', subscription._id);
    }
  } catch (error) {
    console.error('Error handling payment capture completed:', error);
  }
};

// Handle payment capture denied
const handlePaymentCaptureDenied = async (resource) => {
  try {
    const orderId = resource.supplementary_data?.related_ids?.order_id;

    if (!orderId) {
      console.error('No order ID found in payment capture denied webhook');
      return;
    }

    // Find and update subscription
    const subscription = await UserSubscription.findOne({
      'paypalDetails.orderId': orderId,
      status: 'pending'
    });

    if (subscription) {
      subscription.status = 'cancelled';
      subscription.paypalDetails.paymentStatus = 'failed';
      subscription.cancelledAt = new Date();
      subscription.cancellationReason = 'Payment capture denied by PayPal';

      await subscription.save();
      console.log('Subscription cancelled due to payment denial:', subscription._id);
    }
  } catch (error) {
    console.error('Error handling payment capture denied:', error);
  }
};

// Handle payment refunded
const handlePaymentRefunded = async (resource) => {
  try {
    const captureId = resource.id;

    // Find and update subscription
    const subscription = await UserSubscription.findOne({
      'paypalDetails.captureId': captureId
    });

    if (subscription) {
      subscription.paypalDetails.paymentStatus = 'refunded';
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
      subscription.cancellationReason = 'Payment refunded';

      await subscription.save();
      console.log('Subscription cancelled due to refund:', subscription._id);
    }
  } catch (error) {
    console.error('Error handling payment refunded:', error);
  }
};

// Get PayPal environment info
export const getPayPalInfo = async (req, res) => {
  try {
    const environment = getPayPalEnvironment();
    
    sendSuccess(res, 'PayPal environment info retrieved', {
      environment: environment.environment,
      hasCredentials: environment.hasCredentials,
      clientId: environment.clientId
    });
  } catch (error) {
    console.error('Get PayPal info error:', error);
    sendError(res, 'Internal server error while retrieving PayPal info');
  }
};

// Get user's PayPal subscriptions
export const getUserPayPalSubscriptions = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscriptions = await UserSubscription.find({
      userId,
      paymentMethod: 'paypal'
    })
    .populate('planId', 'name tagline price currency billingCycle features')
    .sort({ createdAt: -1 });

    const subscriptionsData = subscriptions.map(sub => ({
      ...sub.toObject(),
      daysRemaining: sub.daysRemaining,
      isExpired: sub.isExpired,
      isTrialExpired: sub.isTrialExpired
    }));

    sendSuccess(res, 'PayPal subscriptions retrieved successfully', {
      subscriptions: subscriptionsData
    });

  } catch (error) {
    console.error('Get user PayPal subscriptions error:', error);
    sendError(res, 'Internal server error while retrieving PayPal subscriptions');
  }
};
