# Stripe Integration Testing Guide

This guide will help you test the Stripe integration for credit/debit card payments using Postman.

## Prerequisites

1. **Stripe Account**: Create an account at [stripe.com](https://stripe.com)
2. **Stripe API Keys**: Get your test API keys from Stripe Dashboard
3. **Environment Variables**: Set up your `.env` file with Stripe credentials
4. **Postman**: Install Postman for API testing

## Environment Setup

### 1. Stripe Dashboard Setup

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Log in with your Stripe account
3. Navigate to "Developers" → "API keys"
4. Copy your **Publishable key** and **Secret key** (test mode)
5. For webhooks, go to "Developers" → "Webhooks" and create a new endpoint

### 2. Environment Variables

Add these to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_ENVIRONMENT=test
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 3. Stripe Test Cards

Stripe provides test card numbers for testing:

**Successful Payments:**
- `4242424242424242` - Visa
- `4000056655665556` - Visa (debit)
- `5555555555554444` - Mastercard
- `2223003122003222` - Mastercard (2-series)
- `378282246310005` - American Express
- `6011111111111117` - Discover

**Declined Payments:**
- `4000000000000002` - Card declined
- `4000000000009995` - Insufficient funds
- `4000000000009987` - Lost card
- `4000000000009979` - Stolen card

**3D Secure Authentication:**
- `4000002500003155` - Requires authentication
- `4000002760003184` - Authentication required

## Postman Collection Setup

### 1. Create Environment Variables in Postman

Create a new environment in Postman with these variables:

```
base_url: http://localhost:5000
auth_token: (will be set after login)
plan_id: (will be set after getting plans)
payment_intent_id: (will be set after creating payment intent)
subscription_id: (will be set after creating subscription)
```

### 2. Authentication Setup

First, you need to authenticate to get a JWT token:

**POST** `{{base_url}}/api/auth/login`
```json
{
  "email": "test@example.com",
  "password": "your_password"
}
```

Copy the `token` from the response and set it as `auth_token` in your environment.

## API Endpoints Testing

### 1. Get Available Plans

**GET** `{{base_url}}/api/plans/active`

**Headers:**
```
Content-Type: application/json
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Active plans retrieved successfully",
  "data": {
    "plans": [
      {
        "_id": "plan_id_here",
        "name": "Peak Tier",
        "tagline": "Unlock the SAT prep experience",
        "price": 40,
        "currency": "USD",
        "billingCycle": "monthly",
        "trialDays": 7,
        "features": ["Feature 1", "Feature 2"]
      }
    ]
  }
}
```

**Action:** Copy a plan `_id` and set it as `plan_id` in your environment.

### 2. Get Stripe Environment Info

**GET** `{{base_url}}/api/stripe/info`

**Headers:**
```
Content-Type: application/json
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Stripe environment info retrieved",
  "data": {
    "environment": "test",
    "hasSecretKey": true,
    "hasPublishableKey": true,
    "publishableKey": "pk_test_..."
  }
}
```

### 3. Create Stripe Payment Intent

**POST** `{{base_url}}/api/stripe/create-payment-intent`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body:**
```json
{
  "planId": "{{plan_id}}",
  "billingInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "country": "US",
    "phoneNumber": "+1234567890",
    "isCompany": false
  },
  "promoCode": "WELCOME10",
  "discountAmount": 0
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Stripe payment intent created successfully",
  "data": {
    "clientSecret": "pi_xxx_secret_xxx",
    "paymentIntentId": "pi_xxx",
    "customerId": "cus_xxx",
    "subscriptionId": "subscription_id_here",
    "amount": 40,
    "currency": "usd",
    "plan": {
      "name": "Peak Tier",
      "features": ["Feature 1", "Feature 2"]
    }
  }
}
```

**Action:** 
1. Copy the `paymentIntentId` and set it as `payment_intent_id` in your environment
2. Copy the `subscriptionId` and set it as `subscription_id` in your environment
3. **IMPORTANT**: Use the `clientSecret` in your frontend to complete the payment

### 4. Complete Payment (Frontend Integration)

For testing purposes, you can use Stripe's test page or implement a simple frontend. The `clientSecret` is used with Stripe.js to complete the payment.

**Frontend Code Example (for testing):**
```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://js.stripe.com/v3/"></script>
</head>
<body>
    <div id="payment-element">
        <!-- Stripe Elements will create form elements here -->
    </div>
    <button id="submit">Pay</button>

    <script>
        const stripe = Stripe('pk_test_your_publishable_key');
        const clientSecret = 'pi_xxx_secret_xxx'; // From API response
        
        const elements = stripe.elements({ clientSecret });
        const paymentElement = elements.create('payment');
        paymentElement.mount('#payment-element');
        
        document.querySelector('#submit').addEventListener('click', async () => {
            const {error} = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: 'http://localhost:5000/payment/success',
                },
            });
            
            if (error) {
                console.error('Payment failed:', error);
            } else {
                console.log('Payment succeeded!');
            }
        });
    </script>
</body>
</html>
```

### 5. Confirm Stripe Payment

**POST** `{{base_url}}/api/stripe/confirm-payment/{{payment_intent_id}}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body:** (empty - no body needed)

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment confirmed and subscription activated successfully",
  "data": {
    "subscription": {
      "_id": "subscription_id_here",
      "userId": "user_id_here",
      "planId": {
        "_id": "plan_id_here",
        "name": "Peak Tier",
        "features": ["Feature 1", "Feature 2"]
      },
      "status": "active",
      "paymentMethod": "stripe",
      "stripeDetails": {
        "customerId": "cus_xxx",
        "paymentIntentId": "pi_xxx",
        "paymentStatus": "succeeded",
        "last4": "4242",
        "brand": "visa",
        "expiryMonth": "12",
        "expiryYear": "2025"
      },
      "pricing": {
        "subtotal": 40,
        "amountDueNow": 40,
        "nextBillingAmount": 40,
        "currency": "USD"
      },
      "daysRemaining": 30,
      "isExpired": false
    },
    "paymentDetails": {
      "paymentIntentId": "pi_xxx",
      "chargeId": "ch_xxx",
      "amount": 40,
      "currency": "usd",
      "status": "succeeded",
      "paymentMethod": {
        "last4": "4242",
        "brand": "visa",
        "expiryMonth": 12,
        "expiryYear": 2025
      }
    }
  }
}
```

### 6. Get Payment Intent Details

**GET** `{{base_url}}/api/stripe/payment-intent/{{payment_intent_id}}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

### 7. Get User's Stripe Subscriptions

**GET** `{{base_url}}/api/stripe/subscriptions`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

### 8. Cancel Stripe Payment (if needed)

**POST** `{{base_url}}/api/stripe/cancel-payment/{{payment_intent_id}}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

### 9. Refund Stripe Payment

**POST** `{{base_url}}/api/stripe/refund/{{subscription_id}}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body:**
```json
{
  "amount": 20,
  "reason": "requested_by_customer"
}
```

## Testing Scenarios

### Scenario 1: Successful Payment Flow

1. Create a Stripe payment intent
2. Complete payment using test card `4242424242424242`
3. Confirm the payment
4. Verify subscription is active
5. Check subscription details

### Scenario 2: Payment Failure

1. Create a Stripe payment intent
2. Try to complete payment using declined card `4000000000000002`
3. Verify payment fails
4. Check subscription status remains pending

### Scenario 3: 3D Secure Authentication

1. Create a Stripe payment intent
2. Use card `4000002500003155` (requires authentication)
3. Complete 3D Secure authentication
4. Verify payment succeeds

### Scenario 4: Free Plan

1. Create payment intent for free plan ($0)
2. Verify subscription is created immediately without payment
3. Check status is 'trial' or 'active'

### Scenario 5: Invalid Plan

1. Try to create payment intent with invalid plan ID
2. Verify error response

## Error Testing

### Common Error Responses

**Invalid Plan ID:**
```json
{
  "success": false,
  "message": "Plan not found",
  "statusCode": 404
}
```

**Missing Billing Info:**
```json
{
  "success": false,
  "message": "Billing information (firstName, lastName, country) is required",
  "statusCode": 400
}
```

**Existing Active Subscription:**
```json
{
  "success": false,
  "message": "User already has an active subscription",
  "statusCode": 400
}
```

**Payment Failed:**
```json
{
  "success": false,
  "message": "Payment failed with status: requires_payment_method",
  "statusCode": 400
}
```

## Webhook Testing

### Stripe Webhook Simulator

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to "Developers" → "Webhooks"
3. Create a new webhook with URL: `http://your-domain.com/api/stripe/webhook`
4. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
5. Use the webhook simulator to test different scenarios

### Webhook Test Endpoint

**POST** `{{base_url}}/api/stripe/webhook`

**Headers:**
```
Content-Type: application/json
Stripe-Signature: t=1234567890,v1=signature_here
```

**Body (Payment Intent Succeeded):**
```json
{
  "id": "evt_xxx",
  "object": "event",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_xxx",
      "object": "payment_intent",
      "status": "succeeded",
      "amount": 4000,
      "currency": "usd",
      "payment_method": "pm_xxx"
    }
  }
}
```

## Frontend Integration

### Required Fields for Card Form

Based on your image, you need these fields:
- **Cardholder Name**: `cardholder_name`
- **Card Number**: `card_number`
- **Card Expiry**: `card_expiry` (MM/YY format)
- **CVV**: `card_cvc`

### Stripe Elements Integration

```javascript
// Initialize Stripe
const stripe = Stripe('pk_test_your_publishable_key');

// Create payment element
const elements = stripe.elements({
  mode: 'payment',
  amount: 4000, // Amount in cents
  currency: 'usd',
  clientSecret: 'pi_xxx_secret_xxx'
});

// Create and mount payment element
const paymentElement = elements.create('payment');
paymentElement.mount('#payment-element');

// Handle form submission
const form = document.getElementById('payment-form');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  const {error} = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: 'http://localhost:5000/payment/success',
    },
  });
  
  if (error) {
    console.error('Payment failed:', error);
  } else {
    console.log('Payment succeeded!');
  }
});
```

## Troubleshooting

### Common Issues

1. **"Stripe secret key not found"**
   - Check your `.env` file has correct Stripe credentials
   - Restart your server after updating environment variables

2. **"Failed to create payment intent"**
   - Verify Stripe credentials are correct
   - Check if Stripe API is accessible
   - Ensure plan exists and is active

3. **"Payment failed"**
   - Check if you completed the payment in Stripe
   - Verify the payment intent ID is correct
   - Check if the payment intent hasn't expired

4. **"Webhook signature verification failed"**
   - Ensure webhook secret is correct
   - Check webhook endpoint URL
   - Verify webhook events are properly configured

### Debug Tips

1. Check server logs for detailed error messages
2. Verify all required fields are provided
3. Test with different Stripe test cards
4. Use Stripe Dashboard to monitor payments
5. Check webhook delivery logs in Stripe Dashboard

## Production Considerations

When moving to production:

1. Change `STRIPE_ENVIRONMENT` to `live`
2. Use production Stripe API keys
3. Update webhook endpoints to your production domain
4. Implement proper webhook signature verification
5. Add proper error logging and monitoring
6. Test thoroughly with small amounts first
7. Set up proper security headers

## Support

For Stripe-specific issues:
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Support](https://support.stripe.com)

For API issues:
- Check server logs
- Verify database connections
- Test individual endpoints
