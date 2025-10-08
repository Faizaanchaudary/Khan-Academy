# Auto-Complete Branch Script

This script automatically answers all questions correctly for a specific branch and category, completing all levels from 1 to 10.

## 🚀 Quick Start

### Method 1: Using npm script (Recommended)
```bash
npm run auto-complete <userId> <branchId> <category>
```

### Method 2: Direct execution
```bash
node scripts/runAutoComplete.js <userId> <branchId> <category>
```

### Method 3: Interactive mode (to find IDs)
```bash
node scripts/runAutoComplete.js
```

## 📋 Parameters

- **userId**: The ID of the user to complete the branch for
- **branchId**: The ID of the branch to complete
- **category**: The category of the branch (`math` or `reading_writing`)

## 🔍 Finding IDs

### Interactive Mode
Run the script without parameters to see available users and branches:
```bash
npm run auto-complete
```

### Manual Database Query
```javascript
// Find users
db.users.find({}, {name: 1, email: 1, _id: 1})

// Find branches
db.branches.find({}, {name: 1, category: 1, _id: 1})
```

## 📝 Examples

### Complete a Math Branch
```bash
npm run auto-complete 507f1f77bcf86cd799439011 507f1f77bcf86cd799439012 math
```

### Complete a Reading/Writing Branch
```bash
npm run auto-complete 507f1f77bcf86cd799439011 507f1f77bcf86cd799439013 reading_writing
```

## 🎯 What the Script Does

1. **Validates Input**: Checks if user and branch exist
2. **Creates User Level**: Initializes user level record if it doesn't exist
3. **Processes Each Level**: Goes through levels 1-10 sequentially
4. **Answers Questions**: Automatically answers all questions correctly
5. **Updates Progress**: Updates user level and completion records
6. **Provides Feedback**: Shows progress and completion status

## 📊 Output Example

```
🤖 Auto-Complete Branch Script
================================
User ID: 507f1f77bcf86cd799439011
Branch ID: 507f1f77bcf86cd799439012
Category: math
================================

🚀 Starting auto-completion for user 507f1f77bcf86cd799439011, branch 507f1f77bcf86cd799439012, category math
📚 Branch: Algebra (math)
📊 Current progress: Level 1, Completed levels: 0

🎯 Processing Level 1...
📝 Found 10 questions for level 1
  ✅ Answered question 1 correctly
  ✅ Answered question 2 correctly
  ...
🎉 Level 1 completed! Advanced to level 2

🎯 Processing Level 2...
...

🎊 Auto-completion finished!
📊 Final Stats:
   - Current Level: 11
   - Completed Levels: 10
   - Total Questions Answered: 100
   - Total Correct Answers: 100
   - Success Rate: 100%
```

## ⚠️ Important Notes

- **Database Connection**: Make sure your MongoDB is running and accessible
- **Environment Variables**: Ensure your `.env` file has the correct `MONGODB_URI`
- **User Authentication**: The script doesn't require authentication (it's a direct database operation)
- **Idempotent**: Running the script multiple times won't create duplicate answers
- **Progress Tracking**: The script respects existing progress and continues from where it left off

## 🛠️ Troubleshooting

### Common Issues

1. **Connection Error**: Check your MongoDB connection string
2. **User Not Found**: Verify the user ID exists in the database
3. **Branch Not Found**: Verify the branch ID exists and is active
4. **No Questions**: Some levels might not have questions yet

### Debug Mode
Add console logging by modifying the script or check the database directly:
```javascript
// Check user levels
db.userlevels.find({userId: ObjectId("your-user-id")})

// Check user answers
db.useranswers.find({userId: ObjectId("your-user-id")})
```

## 🔧 Customization

You can modify the script to:
- Change the time spent per question
- Add random incorrect answers for testing
- Skip certain levels
- Add custom validation rules

## 📈 Testing Overall Level

After running the script, test the overall level calculation:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/levels/overall
```

This will show the user's overall level based on completed branches and question packets.
