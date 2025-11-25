import Chat from '../models/Chat.js';
import { sendSuccess, sendError } from '../utils/response.js';
import OpenAI from 'openai';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Response tuning constants (can be overridden via env)
const MAX_HISTORY_MESSAGES = parseInt(process.env.CHATBOT_HISTORY_LIMIT ?? '6', 10);
const MAX_COMPLETION_TOKENS = parseInt(process.env.CHATBOT_MAX_TOKENS ?? '700', 10);

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

export { upload };

// Initialize OpenAI client
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY is not set in environment variables');
  throw new Error('OpenAI API key is required. Please set OPENAI_API_KEY in your .env file');
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Optimized system prompt for consistent, token-efficient responses
const SYSTEM_PROMPT = `You are Gnosis AI, a professional educational assistant for students.

Core Principles:
1) Provide clear, accurate, and helpful educational content
2) Generate actual practice questions when requested (not generic advice)
3) Use concise, well-structured responses
4) Format lists with numbering like "1)" and simple bullet dashes (-)
5) Be encouraging and supportive

Response Guidelines:
- For practice questions: Generate the exact number requested with specific problems
- For explanations: Provide step-by-step solutions
- For images: Analyze and explain thoroughly
- Keep responses focused, avoid unnecessary verbosity
- Use plain text only (no markdown headings, no **bold**, no # or code fences)`;

// Test function to check if OpenAI API is working
export const testOpenAIAPI = async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return sendError(res, 'OpenAI API key not configured', 400);
    }
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "Hello, can you respond with just 'Hello'?" }
      ],
      max_tokens: 50,
      temperature: 0.3
    });
    
    return sendSuccess(res, 'OpenAI API test successful', { 
      response: completion.choices[0].message.content,
      model: 'gpt-4o-mini',
      usage: completion.usage
    });
  } catch (error) {
    console.error('OpenAI API test failed:', error);
    return sendError(res, `OpenAI API test failed: ${error.message}`, 500);
  }
};

// Create a new chat
export const createNewChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const message = req.body.message;
    const imageFile = req.file;

    if (!message || message.trim().length === 0) {
      return sendError(res, 'Message is required', 400);
    }

    // Generate a title from the first message (first 50 characters)
    const title = message.length > 50 ? message.substring(0, 50) + '...' : message;

    // Create user message object
    const userMessage = {
      role: 'user',
      content: message.trim()
    };

    // Add image URL if image was uploaded
    if (imageFile) {
      userMessage.imageUrl = `/uploads/${imageFile.filename}`;
      userMessage.imageAlt = imageFile.originalname;
    }

    // Create new chat
    const newChat = new Chat({
      userId,
      title,
      messages: [userMessage]
    });

    // Get AI response from available providers
    const aiResponse = await getAIResponse(message, [], imageFile);
    
    // Add AI response to messages
    newChat.messages.push({
      role: 'assistant',
      content: aiResponse
    });

    await newChat.save();

    // Return the chat with the AI response
    return sendSuccess(res, 'New chat created successfully', {
      chat: {
        id: newChat._id,
        title: newChat.title,
        messages: newChat.messages,
        createdAt: newChat.createdAt,
        lastMessageAt: newChat.lastMessageAt
      }
    }, 201);

  } catch (error) {
    console.error('Error creating new chat:', error);
    return sendError(res, 'Failed to create new chat', 500);
  }
};

// Send message to existing chat
export const sendMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;
    const message = req.body.message;
    const imageFile = req.file;

    if (!message || message.trim().length === 0) {
      return sendError(res, 'Message is required', 400);
    }

    // Find the chat
    const chat = await Chat.findOne({ _id: chatId, userId, isActive: true });
    if (!chat) {
      return sendError(res, 'Chat not found', 404);
    }

    // Create user message object
    const userMessageData = {
      role: 'user',
      content: message.trim()
    };

    // Add image URL if image was uploaded
    if (imageFile) {
      userMessageData.imageUrl = `/uploads/${imageFile.filename}`;
      userMessageData.imageAlt = imageFile.originalname;
    }

    // Add user message
    await chat.addMessage('user', message.trim(), userMessageData);

    // Get AI response from available providers
    const aiResponse = await getAIResponse(message, chat.messages, imageFile);

    // Add AI response
    await chat.addMessage('assistant', aiResponse);

    // Return updated chat
    return sendSuccess(res, 'Message sent successfully', {
      chat: {
        id: chat._id,
        title: chat.title,
        messages: chat.messages,
        createdAt: chat.createdAt,
        lastMessageAt: chat.lastMessageAt
      }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return sendError(res, 'Failed to send message', 500);
  }
};

// Get recent chats for a user
export const getRecentChats = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 10 } = req.query;

    const recentChats = await Chat.getRecentChats(userId, parseInt(limit));

    // Format the response for better frontend consumption
    const formattedChats = recentChats.map(chat => ({
      id: chat._id,
      title: chat.title,
      lastMessageAt: chat.lastMessageAt,
      messageCount: chat.messageCount,
      createdAt: chat.createdAt,
      preview: chat.messages && chat.messages.length > 0 ? 
        chat.messages[chat.messages.length - 1].content
          .replace(/\n/g, ' ')  // Replace newlines with spaces
          .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
          .trim()
          .substring(0, 300) + 
        (chat.messages[chat.messages.length - 1].content.length > 300 ? '...' : '') : 
        'No messages',
      lastMessage: chat.messages && chat.messages.length > 0 ? 
        chat.messages[chat.messages.length - 1].content : 
        null
    }));

    return sendSuccess(res, 'Recent chats retrieved successfully', {
      chats: formattedChats,
      total: formattedChats.length
    });

  } catch (error) {
    console.error('Error getting recent chats:', error);
    return sendError(res, 'Failed to get recent chats', 500);
  }
};

// Get a specific chat by ID
export const getChatById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;

    const chat = await Chat.findOne({ _id: chatId, userId, isActive: true });
    if (!chat) {
      return sendError(res, 'Chat not found', 404);
    }

    return sendSuccess(res, 'Chat retrieved successfully', {
      chat: {
        id: chat._id,
        title: chat.title,
        messages: chat.messages,
        createdAt: chat.createdAt,
        lastMessageAt: chat.lastMessageAt,
        messageCount: chat.messageCount
      }
    });

  } catch (error) {
    console.error('Error getting chat:', error);
    return sendError(res, 'Failed to get chat', 500);
  }
};

// Delete a chat
export const deleteChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;

    const chat = await Chat.findOne({ _id: chatId, userId, isActive: true });
    if (!chat) {
      return sendError(res, 'Chat not found', 404);
    }

    chat.isActive = false;
    await chat.save();

    return sendSuccess(res, 'Chat deleted successfully');

  } catch (error) {
    console.error('Error deleting chat:', error);
    return sendError(res, 'Failed to delete chat', 500);
  }
};

// Helper function to get AI response using OpenAI
const getAIResponse = async (userMessage, chatHistory = [], imageFile = null) => {
  try {
    // Build messages array with system prompt
    const messages = [
      { role: "system", content: SYSTEM_PROMPT }
    ];
    
    // Add recent conversation history (limited for token efficiency)
    if (chatHistory.length > 0) {
      const recentMessages = chatHistory.slice(-MAX_HISTORY_MESSAGES);
      recentMessages.forEach(msg => {
        // Skip messages with images in history to save tokens
        if (!msg.imageUrl) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          });
        }
      });
    }
    
    // Handle image analysis if image is provided
    if (imageFile) {
      try {
        // Read and encode image
        const imageBuffer = fs.readFileSync(imageFile.path);
        const imageBase64 = imageBuffer.toString('base64');
        
        // Add user message with image
        messages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: userMessage || "Please analyze this image and help me understand it."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${imageFile.mimetype};base64,${imageBase64}`
              }
            }
          ]
        });
        
        // Use gpt-4o-mini for vision (supports images, cost-effective)
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: messages,
          max_tokens: MAX_COMPLETION_TOKENS,
          temperature: 0.25
        });
        
        return sanitizeAIResponse(completion.choices[0].message.content);
      } catch (imageError) {
        console.error('Image processing error:', imageError);
        // Fall back to text-only - continue to text processing below
        messages.push({ role: "user", content: userMessage || "An image was uploaded but could not be processed. Please describe what you need help with." });
      }
    } else {
      // Text-only message
      messages.push({ role: "user", content: userMessage });
    }
    
    // Use gpt-4o-mini for optimal balance of quality, speed, and cost
    // This handles both text-only and fallback from image errors
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: MAX_COMPLETION_TOKENS, // Optimized token limit
      temperature: 0.25, // Lower temperature for consistent, professional responses
      top_p: 0.85, // Slightly lower nucleus sampling for reliability
    });
    
    const response = completion.choices[0].message.content;
    
    // Log token usage for monitoring
    if (completion.usage) {
      console.log(`Token usage - Prompt: ${completion.usage.prompt_tokens}, Completion: ${completion.usage.completion_tokens}, Total: ${completion.usage.total_tokens}`);
    }
    
    return sanitizeAIResponse(response);
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    
    // Handle specific OpenAI errors
    if (error.status === 401) {
      throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable.');
    } else if (error.status === 429) {
      throw new Error('OpenAI API rate limit exceeded. Please try again in a moment.');
    } else if (error.status === 500) {
      throw new Error('OpenAI API server error. Please try again later.');
    }
    
    // Fallback to educational response
    return getEducationalFallbackResponse(userMessage);
  }
};

// Fallback educational responses when AI is unavailable
const getEducationalFallbackResponse = (userMessage) => {
  const message = userMessage.toLowerCase();
  
  // Generate specific algebra practice questions
  if (message.includes('algebra') && (message.includes('practice') || message.includes('question'))) {
    const questionCount = extractNumber(message) || 1;
    return generateAlgebraQuestions(questionCount);
  }
  
  // Math-related responses
  if (message.includes('algebra') || message.includes('math') || message.includes('equation')) {
    return `I'd love to help you with algebra! Here are some great resources:

📚 **Algebra Topics to Study:**
1. Linear equations and inequalities
2. Quadratic equations
3. Polynomials and factoring
4. Functions and graphs
5. Systems of equations

🔢 **Practice Problems:**
- Start with basic linear equations: 2x + 3 = 7
- Try quadratic equations: x² - 5x + 6 = 0
- Practice word problems with real-world scenarios

💡 **Study Tips:**
- Work through problems step by step
- Check your answers by substituting back
- Practice daily for better retention
- Use graphing to visualize functions

Would you like me to help with a specific algebra topic?`;
  }
  
  // Science-related responses
  if (message.includes('science') || message.includes('physics') || message.includes('chemistry') || message.includes('biology')) {
    return `Science is fascinating! Here's how I can help:

🔬 **Science Subjects:**
- **Physics**: Motion, forces, energy, waves
- **Chemistry**: Atoms, molecules, reactions, bonding
- **Biology**: Cells, genetics, evolution, ecosystems

📖 **Study Strategies:**
- Read actively and take notes
- Create concept maps
- Practice with real examples
- Connect theory to real-world applications

🧪 **Hands-on Learning:**
- Try simple experiments at home
- Use online simulations
- Watch educational videos
- Join study groups

What specific science topic would you like to explore?`;
  }
  
  // General study help
  if (message.includes('study') || message.includes('learn') || message.includes('help')) {
    return `I'm here to help you learn! Here are some effective study strategies:

📝 **Study Techniques:**
1. **Active Reading**: Summarize each paragraph
2. **Spaced Repetition**: Review material over time
3. **Practice Testing**: Quiz yourself regularly
4. **Elaboration**: Explain concepts in your own words

🎯 **Goal Setting:**
- Set specific, achievable goals
- Break large topics into smaller chunks
- Track your progress
- Celebrate small wins

⏰ **Time Management:**
- Use the Pomodoro Technique (25 min focus, 5 min break)
- Create a study schedule
- Find your peak learning times
- Eliminate distractions

What subject are you working on? I can provide more specific guidance!`;
  }
  
  // Default helpful response
  return `I'm currently experiencing technical difficulties, but I'm still here to help you learn! 

🎓 **How I Can Help:**
- Provide study strategies and tips
- Suggest learning resources
- Help break down complex topics
- Offer motivation and encouragement

📚 **Popular Study Topics:**
- Mathematics (Algebra, Calculus, Statistics)
- Sciences (Physics, Chemistry, Biology)
- Languages and Literature
- History and Social Studies

💡 **Quick Tips:**
- Take breaks every 25-30 minutes
- Use active learning techniques
- Practice regularly
- Ask questions when confused

What would you like to learn about today? I'll do my best to help even without the AI assistant!`;
};

// Helper function to extract number from message
const extractNumber = (message) => {
  const numbers = message.match(/\d+/g);
  return numbers ? parseInt(numbers[0]) : null;
};

// Helper function to generate algebra practice questions
const generateAlgebraQuestions = (count) => {
  const questions = [
    {
      problem: "Solve for x: 2x + 5 = 13",
      solution: "x = 4",
      steps: "Subtract 5 from both sides: 2x = 8, then divide by 2: x = 4"
    },
    {
      problem: "Solve for x: 3x - 7 = 14",
      solution: "x = 7",
      steps: "Add 7 to both sides: 3x = 21, then divide by 3: x = 7"
    },
    {
      problem: "Solve for x: 4x + 3 = 2x + 11",
      solution: "x = 4",
      steps: "Subtract 2x from both sides: 2x + 3 = 11, then subtract 3: 2x = 8, divide by 2: x = 4"
    },
    {
      problem: "Solve for x: x² - 5x + 6 = 0",
      solution: "x = 2 or x = 3",
      steps: "Factor: (x - 2)(x - 3) = 0, so x = 2 or x = 3"
    },
    {
      problem: "Solve for x: 2(x + 3) = 4x - 2",
      solution: "x = 4",
      steps: "Distribute: 2x + 6 = 4x - 2, subtract 2x: 6 = 2x - 2, add 2: 8 = 2x, divide by 2: x = 4"
    },
    {
      problem: "Solve for x: (x + 1)/2 = 3",
      solution: "x = 5",
      steps: "Multiply both sides by 2: x + 1 = 6, subtract 1: x = 5"
    },
    {
      problem: "Solve for x: 5x - 3 = 2x + 9",
      solution: "x = 4",
      steps: "Subtract 2x: 3x - 3 = 9, add 3: 3x = 12, divide by 3: x = 4"
    },
    {
      problem: "Solve for x: x² + 2x - 8 = 0",
      solution: "x = 2 or x = -4",
      steps: "Factor: (x - 2)(x + 4) = 0, so x = 2 or x = -4"
    },
    {
      problem: "Solve for x: 3(x - 2) = 2x + 1",
      solution: "x = 7",
      steps: "Distribute: 3x - 6 = 2x + 1, subtract 2x: x - 6 = 1, add 6: x = 7"
    },
    {
      problem: "Solve for x: (2x - 1)/3 = 5",
      solution: "x = 8",
      steps: "Multiply by 3: 2x - 1 = 15, add 1: 2x = 16, divide by 2: x = 8"
    }
  ];

  const selectedQuestions = questions.slice(0, Math.min(count, questions.length));
  
  let response = `Here are ${selectedQuestions.length} Algebra practice question${selectedQuestions.length > 1 ? 's' : ''} for you:\n\n`;
  
  selectedQuestions.forEach((q, index) => {
    response += `${index + 1}. ${q.problem}\n`;
  });
  
  response += `\n💡 **Tip:** Try solving each step by step. Once you're done, type 'Show answers' and I'll check your work! ✔`;
  
  return response;
};

// Remove Markdown artifacts that the frontend doesn't render
const sanitizeAIResponse = (text = '') => {
  return text
    .replace(/^\s*#+\s*/gm, '')        // Remove heading markers
    .replace(/\*\*/g, '')              // Remove bold markers
    .replace(/`{1,3}/g, '')            // Remove inline/code fences
    .trim();
};