import Chat from '../models/Chat.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendSuccess, sendError } from '../utils/response.js';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Create a new chat
export const createNewChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return sendError(res, 'Message is required', 400);
    }

    // Generate a title from the first message (first 50 characters)
    const title = message.length > 50 ? message.substring(0, 50) + '...' : message;

    // Create new chat
    const newChat = new Chat({
      userId,
      title,
      messages: [{
        role: 'user',
        content: message.trim()
      }]
    });

    // Get AI response from Gemini
    const aiResponse = await getGeminiResponse(message);
    
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
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return sendError(res, 'Message is required', 400);
    }

    // Find the chat
    const chat = await Chat.findOne({ _id: chatId, userId, isActive: true });
    if (!chat) {
      return sendError(res, 'Chat not found', 404);
    }

    // Add user message
    await chat.addMessage('user', message.trim());

    // Get AI response from Gemini
    const aiResponse = await getGeminiResponse(message, chat.messages);

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

// Helper function to get Gemini AI response
const getGeminiResponse = async (userMessage, chatHistory = []) => {
  try {
    // Try different model names in order of preference
    let model;
    try {
      model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    } catch (error) {
      console.log('Trying gemini-1.5-pro...');
      model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    }

    // Build conversation context
    let conversationContext = `You are Gnosis AI, an educational AI assistant that helps students with practice questions, explanations, and learning. 
    
    Your responses should be:
    - Educational and helpful
    - Clear and well-structured
    - Encouraging and supportive
    - Formatted nicely with proper numbering for lists
    - Include tips when appropriate
    
    Current user message: ${userMessage}`;

    // Add recent conversation history for context (last 10 messages)
    if (chatHistory.length > 0) {
      const recentMessages = chatHistory.slice(-10);
      const historyContext = recentMessages.map(msg => 
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n');
      
      conversationContext += `\n\nRecent conversation:\n${historyContext}`;
    }

    const result = await model.generateContent(conversationContext);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error('Error getting Gemini response:', error);
    return "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.";
  }
};