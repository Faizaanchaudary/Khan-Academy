# API Usage Examples

## Getting User Progress Data

### 1. Get All Levels for a Branch
```bash
GET /api/levels/detailed-progress?branchId=64f8a1b2c3d4e5f6a7b8c9d0
Authorization: Bearer <jwt_token>
```

**Response:** Returns data for all 10 levels with complete statistics.

### 2. Get Specific Level (e.g., Level 3)
```bash
GET /api/levels/detailed-progress?branchId=64f8a1b2c3d4e5f6a7b8c9d0&level=3
Authorization: Bearer <jwt_token>
```

**Response:** Returns data only for level 3 with statistics calculated only from that level.

### 3. Get Level 1 Data
```bash
GET /api/levels/detailed-progress?branchId=64f8a1b2c3d4e5f6a7b8c9d0&level=1
Authorization: Bearer <jwt_token>
```

**Response:** Returns data only for level 1.

## Frontend Integration Examples

### JavaScript/React Example
```javascript
// Get all levels
const getAllLevels = async (branchId) => {
  const response = await fetch(`/api/levels/detailed-progress?branchId=${branchId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return await response.json();
};

// Get specific level
const getLevelData = async (branchId, level) => {
  const response = await fetch(`/api/levels/detailed-progress?branchId=${branchId}&level=${level}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return await response.json();
};

// Usage
const allLevels = await getAllLevels('64f8a1b2c3d4e5f6a7b8c9d0');
const level3Data = await getLevelData('64f8a1b2c3d4e5f6a7b8c9d0', 3);
```

### Axios Example
```javascript
import axios from 'axios';

// Get all levels
const getAllLevels = async (branchId) => {
  try {
    const response = await axios.get(`/api/levels/detailed-progress`, {
      params: { branchId },
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching all levels:', error);
  }
};

// Get specific level
const getLevelData = async (branchId, level) => {
  try {
    const response = await axios.get(`/api/levels/detailed-progress`, {
      params: { branchId, level },
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching level data:', error);
  }
};
```

## Response Comparison

### All Levels Response
```json
{
  "data": {
    "levelDetails": [
      { "level": 1, "totalQuestions": 5, "questionsAnswered": 5 },
      { "level": 2, "totalQuestions": 5, "questionsAnswered": 3 },
      { "level": 3, "totalQuestions": 5, "questionsAnswered": 0 },
      // ... levels 4-10
    ],
    "overallStats": {
      "totalQuestionsAnswered": 8,  // From all levels
      "accuracyPercentage": 75
    }
  }
}
```

### Specific Level Response (level=2)
```json
{
  "data": {
    "levelDetails": [
      { "level": 2, "totalQuestions": 5, "questionsAnswered": 3 }
    ],
    "overallStats": {
      "totalQuestionsAnswered": 3,  // Only from level 2
      "accuracyPercentage": 67
    }
  }
}
```

## Use Cases

### 1. Progress Dashboard
```javascript
// Show overall progress
const allLevels = await getAllLevels(branchId);
const completedLevels = allLevels.data.levelDetails.filter(level => level.isCompleted);
console.log(`Completed: ${completedLevels.length}/10 levels`);
```

### 2. Level Review Page
```javascript
// Show specific level details
const levelData = await getLevelData(branchId, 3);
const questions = levelData.data.levelDetails[0].questions;
questions.forEach(q => {
  console.log(`Question: ${q.questionText}`);
  console.log(`User Answer: ${q.userAnswer?.selectedOption || 'Not answered'}`);
  console.log(`Correct: ${q.userAnswer?.isCorrect || false}`);
});
```

### 3. Performance Analytics
```javascript
// Analyze performance across levels
const allLevels = await getAllLevels(branchId);
const performance = allLevels.data.levelDetails.map(level => ({
  level: level.level,
  accuracy: level.accuracyPercentage,
  timeSpent: level.averageTimeSpent,
  completed: level.isCompleted
}));
```

### 4. Question Review
```javascript
// Review specific questions
const levelData = await getLevelData(branchId, 1);
const questions = levelData.data.levelDetails[0].questions;
const incorrectAnswers = questions.filter(q => q.userAnswer && !q.userAnswer.isCorrect);
console.log(`Incorrect answers: ${incorrectAnswers.length}`);
```
