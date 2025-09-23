import paypal from '@paypal/checkout-server-sdk';
import dotenv from 'dotenv';

dotenv.config();

// PayPal environment configuration
const environment = () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not found. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in your environment variables.');
  }

  try {
    if (environment === 'production') {
      return new paypal.core.LiveEnvironment(clientId, clientSecret);
    } else {
      return new paypal.core.SandboxEnvironment(clientId, clientSecret);
    }
  } catch (error) {
    console.error('PayPal environment creation error:', error);
    throw new Error('Failed to create PayPal environment. Please check your credentials.');
  }
};

// PayPal client
const client = () => {
  return new paypal.core.PayPalHttpClient(environment());
};

// Create order request
export const createOrderRequest = (amount, currency = 'USD', planName = 'Gnosis Peak') => {
  return {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: currency,
          value: amount.toString()
        },
        description: `Subscription for ${planName}`,
        custom_id: `plan_${Date.now()}`,
        soft_descriptor: 'GNOSIS'
      }
    ],
    application_context: {
      brand_name: 'Gnosis',
      landing_page: 'NO_PREFERENCE',
      user_action: 'PAY_NOW',
      return_url: process.env.PAYPAL_RETURN_URL || 'http://localhost:3000/payment/success',
      cancel_url: process.env.PAYPAL_CANCEL_URL || 'http://localhost:3000/payment/cancel'
    }
  };
};

// Capture order request
export const captureOrderRequest = (orderId) => {
  return {
    orderId: orderId
  };
};

// Get order details request
export const getOrderRequest = (orderId) => {
  return {
    orderId: orderId
  };
};

// Refund request
export const createRefundRequest = (captureId, amount, currency = 'USD', reason = 'requested_by_customer') => {
  return {
    captureId: captureId,
    amount: {
      currency_code: currency,
      value: amount.toString()
    },
    note_to_payer: `Refund for ${reason}`
  };
};

// PayPal client instance
export const paypalClient = client;

// PayPal environment info
export const getPayPalEnvironment = () => {
  return {
    environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
    clientId: process.env.PAYPAL_CLIENT_ID,
    hasCredentials: !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
  };
};

export default {
  createOrderRequest,
  captureOrderRequest,
  getOrderRequest,
  createRefundRequest,
  paypalClient,
  getPayPalEnvironment
};
