import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

// Test configuration
const TEST_CONFIG = {
  // You'll need to replace these with actual values
  authToken: 'your_auth_token_here',
  planId: 'your_plan_id_here',
  testEmail: 'test@example.com'
};

// Test data
const testBillingInfo = {
  firstName: 'John',
  lastName: 'Doe',
  email: TEST_CONFIG.testEmail,
  country: 'US',
  phoneNumber: '+1234567890',
  address: {
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US'
  }
};

// Helper function to make API requests
const apiRequest = async (method, endpoint, data = null, headers = {}) => {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
};

// Test functions
const testGetPlans = async () => {
  console.log('\n🧪 Testing: Get Available Plans');
  console.log('=' .repeat(50));
  
  const result = await apiRequest('GET', '/payments/plans');
  
  if (result.success) {
    console.log('✅ Successfully retrieved plans');
    console.log(`📊 Found ${result.data.data.length} plans:`);
    result.data.data.forEach(plan => {
      console.log(`   - ${plan.name}: $${plan.price}/${plan.billingCycle} (${plan.trialDays} days trial)`);
    });
  } else {
    console.log('❌ Failed to retrieve plans');
    console.log('Error:', result.error);
  }
  
  return result;
};

const testGetPlanDetails = async (planId) => {
  console.log('\n🧪 Testing: Get Plan Details');
  console.log('=' .repeat(50));
  
  const result = await apiRequest('GET', `/payments/plans/${planId}`);
  
  if (result.success) {
    console.log('✅ Successfully retrieved plan details');
    console.log(`📋 Plan: ${result.data.data.name}`);
    console.log(`💰 Price: $${result.data.data.price}/${result.data.data.billingCycle}`);
    console.log(`🎯 Features: ${result.data.data.features.length} features`);
  } else {
    console.log('❌ Failed to retrieve plan details');
    console.log('Error:', result.error);
  }
  
  return result;
};

const testCreatePayPalOrder = async (planId) => {
  console.log('\n🧪 Testing: Create PayPal Order');
  console.log('=' .repeat(50));
  
  const orderData = {
    planId,
    billingInfo: testBillingInfo,
    promoCode: 'TEST10',
    discountAmount: 5.00
  };
  
  const result = await apiRequest('POST', '/payments/paypal/create-order', orderData);
  
  if (result.success) {
    console.log('✅ Successfully created PayPal order');
    console.log(`🆔 Order ID: ${result.data.data.orderId}`);
    console.log(`💳 Payment ID: ${result.data.data.paymentId}`);
    console.log(`💰 Amount: $${result.data.data.amount}`);
    console.log(`🔗 Approval URL: ${result.data.data.approvalUrl}`);
    
    // Store order ID for capture test
    TEST_CONFIG.orderId = result.data.data.orderId;
    TEST_CONFIG.paymentId = result.data.data.paymentId;
  } else {
    console.log('❌ Failed to create PayPal order');
    console.log('Error:', result.error);
  }
  
  return result;
};

const testGetPaymentStatus = async (paymentId) => {
  console.log('\n🧪 Testing: Get Payment Status');
  console.log('=' .repeat(50));
  
  const result = await apiRequest('GET', `/payments/status/${paymentId}`);
  
  if (result.success) {
    console.log('✅ Successfully retrieved payment status');
    console.log(`📊 Status: ${result.data.data.status}`);
    console.log(`💰 Amount: $${result.data.data.amount}`);
    console.log(`💳 Payment Method: ${result.data.data.paymentMethod}`);
  } else {
    console.log('❌ Failed to retrieve payment status');
    console.log('Error:', result.error);
  }
  
  return result;
};

const testGetPaymentHistory = async () => {
  console.log('\n🧪 Testing: Get Payment History');
  console.log('=' .repeat(50));
  
  const result = await apiRequest('GET', '/payments/history?page=1&limit=5');
  
  if (result.success) {
    console.log('✅ Successfully retrieved payment history');
    console.log(`📊 Total Payments: ${result.data.data.pagination.totalPayments}`);
    console.log(`📄 Current Page: ${result.data.data.pagination.currentPage}`);
    console.log(`📋 Payments: ${result.data.data.payments.length} in this page`);
  } else {
    console.log('❌ Failed to retrieve payment history');
    console.log('Error:', result.error);
  }
  
  return result;
};

const testGetPaymentStats = async () => {
  console.log('\n🧪 Testing: Get Payment Statistics');
  console.log('=' .repeat(50));
  
  const result = await apiRequest('GET', '/payments/stats');
  
  if (result.success) {
    console.log('✅ Successfully retrieved payment statistics');
    console.log(`📊 Total Payments: ${result.data.data.totalPayments}`);
    console.log(`💰 Total Spent: $${result.data.data.totalSpent}`);
    console.log('📈 Status Breakdown:', result.data.data.statusBreakdown);
  } else {
    console.log('❌ Failed to retrieve payment statistics');
    console.log('Error:', result.error);
  }
  
  return result;
};

const testPayPalWebhook = async () => {
  console.log('\n🧪 Testing: PayPal Webhook Endpoint');
  console.log('=' .repeat(50));
  
  const webhookData = {
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: {
      id: 'test_capture_id',
      status: 'COMPLETED',
      amount: {
        currency_code: 'USD',
        value: '40.00'
      },
      supplementary_data: {
        related_ids: {
          order_id: TEST_CONFIG.orderId || 'test_order_id'
        }
      }
    }
  };
  
  const result = await apiRequest('POST', '/payments/webhook/paypal', webhookData);
  
  if (result.success) {
    console.log('✅ Webhook endpoint is working');
    console.log('📨 Webhook response:', result.data);
  } else {
    console.log('❌ Webhook endpoint failed');
    console.log('Error:', result.error);
  }
  
  return result;
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting Payment System Tests');
  console.log('=' .repeat(60));
  console.log(`🌐 API Base URL: ${API_URL}`);
  console.log(`🔑 Auth Token: ${TEST_CONFIG.authToken ? 'Set' : 'Not Set'}`);
  console.log(`📋 Plan ID: ${TEST_CONFIG.planId || 'Not Set'}`);
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  // Test 1: Get Plans
  results.total++;
  const plansResult = await testGetPlans();
  if (plansResult.success) {
    results.passed++;
    // Use the first plan for subsequent tests
    if (plansResult.data.data.length > 0) {
      TEST_CONFIG.planId = plansResult.data.data[0]._id;
    }
  } else {
    results.failed++;
  }
  
  // Test 2: Get Plan Details (if we have a plan ID)
  if (TEST_CONFIG.planId) {
    results.total++;
    const planDetailsResult = await testGetPlanDetails(TEST_CONFIG.planId);
    if (planDetailsResult.success) {
      results.passed++;
    } else {
      results.failed++;
    }
  }
  
  // Test 3: Create PayPal Order (if we have a plan ID and auth token)
  if (TEST_CONFIG.planId && TEST_CONFIG.authToken !== 'your_auth_token_here') {
    results.total++;
    const orderResult = await testCreatePayPalOrder(TEST_CONFIG.planId);
    if (orderResult.success) {
      results.passed++;
    } else {
      results.failed++;
    }
  } else {
    console.log('\n⚠️  Skipping PayPal order creation test (missing plan ID or auth token)');
  }
  
  // Test 4: Get Payment Status (if we have a payment ID)
  if (TEST_CONFIG.paymentId) {
    results.total++;
    const statusResult = await testGetPaymentStatus(TEST_CONFIG.paymentId);
    if (statusResult.success) {
      results.passed++;
    } else {
      results.failed++;
    }
  } else {
    console.log('\n⚠️  Skipping payment status test (no payment ID available)');
  }
  
  // Test 5: Get Payment History (if we have auth token)
  if (TEST_CONFIG.authToken !== 'your_auth_token_here') {
    results.total++;
    const historyResult = await testGetPaymentHistory();
    if (historyResult.success) {
      results.passed++;
    } else {
      results.failed++;
    }
  } else {
    console.log('\n⚠️  Skipping payment history test (no auth token)');
  }
  
  // Test 6: Get Payment Stats (if we have auth token)
  if (TEST_CONFIG.authToken !== 'your_auth_token_here') {
    results.total++;
    const statsResult = await testGetPaymentStats();
    if (statsResult.success) {
      results.passed++;
    } else {
      results.failed++;
    }
  } else {
    console.log('\n⚠️  Skipping payment stats test (no auth token)');
  }
  
  // Test 7: PayPal Webhook
  results.total++;
  const webhookResult = await testPayPalWebhook();
  if (webhookResult.success) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  // Test Summary
  console.log('\n📊 Test Summary');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total: ${results.total}`);
  console.log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! Payment system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
  }
  
  console.log('\n📝 Next Steps:');
  console.log('1. Set up PayPal credentials in your .env file');
  console.log('2. Get an auth token by logging in through /api/auth/login');
  console.log('3. Run the plan seeder: npm run seed:plans');
  console.log('4. Test with real PayPal sandbox transactions');
};

// Run the tests
runTests().catch(console.error);
