import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

// Stripe configuration - lazy initialization
let stripeInstance = null;

const getStripeInstance = () => {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not found. Please set STRIPE_SECRET_KEY in your environment variables.');
    }
    stripeInstance = Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeInstance;
};

// Validate Stripe configuration
export const validateStripeConfig = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe secret key not found. Please set STRIPE_SECRET_KEY in your environment variables.');
  }
  if (!process.env.STRIPE_PUBLISHABLE_KEY) {
    throw new Error('Stripe publishable key not found. Please set STRIPE_PUBLISHABLE_KEY in your environment variables.');
  }
  return true;
};

// Get Stripe environment info
export const getStripeEnvironment = () => {
  return {
    environment: process.env.STRIPE_ENVIRONMENT || 'test',
    hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
    hasPublishableKey: !!process.env.STRIPE_PUBLISHABLE_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  };
};

// Create payment intent for subscription
export const createPaymentIntent = async (amount, currency = 'usd', metadata = {}) => {
  try {
    validateStripeConfig();
    const stripe = getStripeInstance();
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });

    return {
      success: true,
      paymentIntent
    };
  } catch (error) {
    console.error('Stripe payment intent creation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Confirm payment intent
export const confirmPaymentIntent = async (paymentIntentId) => {
  try {
    validateStripeConfig();
    const stripe = getStripeInstance();
    
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    return {
      success: true,
      paymentIntent
    };
  } catch (error) {
    console.error('Stripe payment intent confirmation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Create customer
export const createCustomer = async (email, name, metadata = {}) => {
  try {
    validateStripeConfig();
    const stripe = getStripeInstance();
    
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        ...metadata,
        created_at: new Date().toISOString()
      }
    });

    return {
      success: true,
      customer
    };
  } catch (error) {
    console.error('Stripe customer creation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Create setup intent for saving payment method
export const createSetupIntent = async (customerId, metadata = {}) => {
  try {
    validateStripeConfig();
    const stripe = getStripeInstance();
    
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      metadata: {
        ...metadata,
        created_at: new Date().toISOString()
      }
    });

    return {
      success: true,
      setupIntent
    };
  } catch (error) {
    console.error('Stripe setup intent creation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Create subscription
export const createSubscription = async (customerId, priceId, metadata = {}) => {
  try {
    validateStripeConfig();
    const stripe = getStripeInstance();
    
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        ...metadata,
        created_at: new Date().toISOString()
      }
    });

    return {
      success: true,
      subscription
    };
  } catch (error) {
    console.error('Stripe subscription creation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Cancel subscription
export const cancelSubscription = async (subscriptionId) => {
  try {
    validateStripeConfig();
    const stripe = getStripeInstance();
    
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    
    return {
      success: true,
      subscription
    };
  } catch (error) {
    console.error('Stripe subscription cancellation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Refund payment
export const refundPayment = async (paymentIntentId, amount = null, reason = 'requested_by_customer') => {
  try {
    validateStripeConfig();
    const stripe = getStripeInstance();
    
    const refundData = {
      payment_intent: paymentIntentId,
      reason
    };
    
    if (amount) {
      refundData.amount = Math.round(amount * 100); // Convert to cents
    }
    
    const refund = await stripe.refunds.create(refundData);
    
    return {
      success: true,
      refund
    };
  } catch (error) {
    console.error('Stripe refund error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Verify webhook signature
export const verifyWebhookSignature = (payload, signature, secret) => {
  try {
    validateStripeConfig();
    const stripe = getStripeInstance();
    
    const event = stripe.webhooks.constructEvent(payload, signature, secret);
    return {
      success: true,
      event
    };
  } catch (error) {
    console.error('Stripe webhook verification error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default getStripeInstance;
