// Test script for getUserDetailedProgress API
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
const TEST_BRANCH_ID = '64f8a1b2c3d4e5f6a7b8c9d0'; // Replace with actual branch ID
const TEST_TOKEN = 'your-jwt-token-here'; // Replace with actual token

async function testAPI() {
  try {
    console.log('Testing getUserDetailedProgress API...\n');

    // Test 1: Get all levels
    console.log('1. Testing all levels:');
    const allLevelsResponse = await axios.get(`${BASE_URL}/levels/detailed-progress`, {
      params: { branchId: TEST_BRANCH_ID },
      headers: { Authorization: `Bearer ${TEST_TOKEN}` }
    });
    
    console.log('Status:', allLevelsResponse.status);
    console.log('Success:', allLevelsResponse.data.success);
    console.log('Message:', allLevelsResponse.data.message);
    console.log('Level Details Count:', allLevelsResponse.data.data?.levelDetails?.length || 0);
    console.log('Overall Stats:', allLevelsResponse.data.data?.overallStats);
    console.log('');

    // Test 2: Get specific level
    console.log('2. Testing specific level (level 1):');
    const level1Response = await axios.get(`${BASE_URL}/levels/detailed-progress`, {
      params: { branchId: TEST_BRANCH_ID, level: 1 },
      headers: { Authorization: `Bearer ${TEST_TOKEN}` }
    });
    
    console.log('Status:', level1Response.status);
    console.log('Success:', level1Response.data.success);
    console.log('Message:', level1Response.data.message);
    console.log('Level Details Count:', level1Response.data.data?.levelDetails?.length || 0);
    console.log('Level 1 Questions:', level1Response.data.data?.levelDetails?.[0]?.questions?.length || 0);
    console.log('');

    // Test 3: Test with invalid level
    console.log('3. Testing invalid level (level 15):');
    try {
      const invalidLevelResponse = await axios.get(`${BASE_URL}/levels/detailed-progress`, {
        params: { branchId: TEST_BRANCH_ID, level: 15 },
        headers: { Authorization: `Bearer ${TEST_TOKEN}` }
      });
      console.log('Unexpected success:', invalidLevelResponse.data);
    } catch (error) {
      console.log('Expected error:', error.response?.data?.message || error.message);
    }
    console.log('');

    // Test 4: Test without branchId
    console.log('4. Testing without branchId:');
    try {
      const noBranchResponse = await axios.get(`${BASE_URL}/levels/detailed-progress`, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` }
      });
      console.log('Unexpected success:', noBranchResponse.data);
    } catch (error) {
      console.log('Expected error:', error.response?.data?.message || error.message);
    }

  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testAPI();
