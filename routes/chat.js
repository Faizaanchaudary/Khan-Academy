import express from 'express';
import { 
  createNewChat, 
  sendMessage, 
  getRecentChats, 
  getChatById, 
  deleteChat,
  testGeminiAPI,
  testOpenAIAPI,
  upload
} from '../controllers/chatController.js';
import { authenticate, requireActiveSubscription } from '../middleware/auth.js';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Test Gemini API
router.get('/test-gemini',
  authenticate,
  requireActiveSubscription,
  testGeminiAPI
);

// Test OpenAI API
router.get('/test-openai',
  authenticate,
  requireActiveSubscription,
  testOpenAIAPI
);

// Get recent chats (must come before /:chatId route)
router.get('/recent',
  authenticate,
  requireActiveSubscription,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  validateRequest,
  getRecentChats
);

// Create a new chat (must come before /:chatId route)
router.post('/new', 
  authenticate,
  requireActiveSubscription,
  upload.single('image'),
  [
    body('message')
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message must be between 1 and 1000 characters')
      .trim()
  ],
  validateRequest,
  createNewChat
);

// Send message to existing chat
router.post('/:chatId/message',
  authenticate,
  requireActiveSubscription,
  upload.single('image'),
  [
    param('chatId')
      .isMongoId()
      .withMessage('Invalid chat ID'),
    body('message')
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message must be between 1 and 1000 characters')
      .trim()
  ],
  validateRequest,
  sendMessage
);

// Get specific chat by ID
router.get('/:chatId',
  authenticate,
  requireActiveSubscription,
  [
    param('chatId')
      .isMongoId()
      .withMessage('Invalid chat ID')
  ],
  validateRequest,
  getChatById
);

// Delete a chat
router.delete('/:chatId',
  authenticate,
  requireActiveSubscription,
  [
    param('chatId')
      .isMongoId()
      .withMessage('Invalid chat ID')
  ],
  validateRequest,
  deleteChat
);

export default router;
