import crypto from 'crypto';

// Generate unique payment ID
export const generatePaymentId = () => {
  return `pay_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
};

// Generate unique order ID
export const generateOrderId = () => {
  return `order_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
};

// Calculate tax amount
export const calculateTax = (amount, taxRate = 0) => {
  return Math.round(amount * taxRate * 100) / 100;
};

// Calculate total amount
export const calculateTotal = (amount, tax = 0, discount = 0) => {
  const subtotal = amount - discount;
  const total = subtotal + tax;
  return Math.round(total * 100) / 100;
};

// Validate payment amount
export const validatePaymentAmount = (amount, minAmount = 0.01) => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: 'Amount must be a valid number' };
  }
  
  if (amount < minAmount) {
    return { valid: false, error: `Amount must be at least $${minAmount}` };
  }
  
  if (amount > 10000) {
    return { valid: false, error: 'Amount cannot exceed $10,000' };
  }
  
  return { valid: true };
};

// Validate billing information
export const validateBillingInfo = (billingInfo) => {
  const errors = [];
  
  if (!billingInfo || typeof billingInfo !== 'object') {
    errors.push('Billing information is required');
    return { valid: false, errors };
  }
  
  if (!billingInfo.firstName || billingInfo.firstName.trim().length < 2) {
    errors.push('First name must be at least 2 characters long');
  }
  
  if (!billingInfo.lastName || billingInfo.lastName.trim().length < 2) {
    errors.push('Last name must be at least 2 characters long');
  }
  
  if (!billingInfo.email || !isValidEmail(billingInfo.email)) {
    errors.push('Valid email address is required');
  }
  
  if (!billingInfo.country || billingInfo.country.trim().length < 2) {
    errors.push('Country is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Validate email format
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Format currency
export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

// Generate payment summary
export const generatePaymentSummary = (plan, billingInfo, discountAmount = 0) => {
  const taxRate = 0; // No tax for now
  const tax = calculateTax(plan.price, taxRate);
  const total = calculateTotal(plan.price, tax, discountAmount);
  
  return {
    plan: {
      name: plan.name,
      price: plan.price,
      currency: plan.currency,
      billingCycle: plan.billingCycle
    },
    pricing: {
      subtotal: plan.price,
      discount: discountAmount,
      tax: tax,
      total: total
    },
    billing: {
      name: `${billingInfo.firstName} ${billingInfo.lastName}`,
      email: billingInfo.email,
      country: billingInfo.country
    },
    features: plan.features || []
  };
};

// Create payment metadata
export const createPaymentMetadata = (userId, planId, subscriptionId, additionalData = {}) => {
  return {
    userId: userId.toString(),
    planId: planId.toString(),
    subscriptionId: subscriptionId ? subscriptionId.toString() : null,
    timestamp: new Date().toISOString(),
    ...additionalData
  };
};

// Validate PayPal webhook signature (placeholder - implement based on PayPal webhook requirements)
export const validatePayPalWebhook = (headers, body, webhookId) => {
  // This is a placeholder implementation
  // In production, you should implement proper webhook signature validation
  // according to PayPal's webhook verification requirements
  
  const requiredHeaders = ['paypal-transmission-id', 'paypal-cert-id', 'paypal-transmission-sig'];
  const hasRequiredHeaders = requiredHeaders.every(header => headers[header]);
  
  return {
    valid: hasRequiredHeaders,
    error: hasRequiredHeaders ? null : 'Missing required PayPal webhook headers'
  };
};

// Extract payment details from PayPal response
export const extractPayPalPaymentDetails = (paypalResponse) => {
  try {
    const purchaseUnit = paypalResponse.purchase_units?.[0];
    const payer = paypalResponse.payer;
    
    return {
      orderId: paypalResponse.id,
      status: paypalResponse.status,
      amount: purchaseUnit?.amount?.value,
      currency: purchaseUnit?.amount?.currency_code,
      payerId: payer?.payer_id,
      payerEmail: payer?.email_address,
      captureId: purchaseUnit?.payments?.captures?.[0]?.id,
      transactionId: purchaseUnit?.payments?.captures?.[0]?.id
    };
  } catch (error) {
    console.error('Error extracting PayPal payment details:', error);
    return null;
  }
};

// Create error response
export const createPaymentError = (message, code = 'PAYMENT_ERROR', details = {}) => {
  return {
    success: false,
    error: {
      message,
      code,
      details,
      timestamp: new Date().toISOString()
    }
  };
};

// Create success response
export const createPaymentSuccess = (data, message = 'Payment processed successfully') => {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
};

export default {
  generatePaymentId,
  generateOrderId,
  calculateTax,
  calculateTotal,
  validatePaymentAmount,
  validateBillingInfo,
  isValidEmail,
  formatCurrency,
  generatePaymentSummary,
  createPaymentMetadata,
  validatePayPalWebhook,
  extractPayPalPaymentDetails,
  createPaymentError,
  createPaymentSuccess
};
