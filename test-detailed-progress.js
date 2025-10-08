// Simple test for getUserDetailedProgress API
const axios = require('axios');

async function testDetailedProgress() {
  try {
    console.log('Testing getUserDetailedProgress API...\n');
    
    // Replace with your actual values
    const BASE_URL = 'http://localhost:5000/api';
    const BRANCH_ID = '68c94dee6a8baa87596270d4'; // Your branch ID
    const TOKEN = 'your-jwt-token-here'; // Your JWT token
    
    // Test with level 1
    console.log('Testing with level 1:');
    const response = await axios.get(`${BASE_URL}/levels/detailed-progress`, {
      params: { 
        branchId: BRANCH_ID,
        level: 1 
      },
      headers: { 
        Authorization: `Bearer ${TOKEN}` 
      }
    });
    
    console.log('Response Status:', response.status);
    console.log('Success:', response.data.success);
    console.log('Level Details Count:', response.data.data?.levelDetails?.length || 0);
    
    if (response.data.data?.levelDetails?.length > 0) {
      const level1 = response.data.data.levelDetails[0];
      console.log('Level 1 Stats:');
      console.log('- Total Questions:', level1.totalQuestions);
      console.log('- Questions Answered:', level1.questionsAnswered);
      console.log('- Correct Answers:', level1.correctAnswers);
      console.log('- Is Completed:', level1.isCompleted);
      
      if (level1.questions?.length > 0) {
        const firstQuestion = level1.questions[0];
        console.log('First Question:');
        console.log('- Question Text:', firstQuestion.questionText);
        console.log('- Has User Answer:', firstQuestion.userAnswer ? 'YES' : 'NO');
        if (firstQuestion.userAnswer) {
          console.log('- Selected Option:', firstQuestion.userAnswer.selectedOption);
          console.log('- Is Correct:', firstQuestion.userAnswer.isCorrect);
        }
      }
    }
    
    console.log('\nOverall Stats:');
    console.log('- Total Questions Answered:', response.data.data?.overallStats?.totalQuestionsAnswered);
    console.log('- Accuracy Percentage:', response.data.data?.overallStats?.accuracyPercentage);
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testDetailedProgress();
