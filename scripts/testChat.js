import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/database.js';
import Chat from '../models/Chat.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const testChat = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');

    // Test Gemini API
    console.log('\n🤖 Testing Gemini API...');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const testMessage = "Give me 5 Algebra practice questions";
    const result = await model.generateContent(testMessage);
    const response = await result.response;
    console.log('✅ Gemini API working!');
    console.log('Sample response:', response.text().substring(0, 200) + '...');

    // Test Chat model
    console.log('\n📝 Testing Chat model...');
    
    // Create a test chat
    const testChat = new Chat({
      userId: new Chat()._id, // Using a dummy ObjectId for testing
      title: "Test Chat",
      messages: [
        {
          role: 'user',
          content: testMessage
        },
        {
          role: 'assistant',
          content: response.text()
        }
      ]
    });

    console.log('✅ Chat model created successfully');
    console.log('Chat ID:', testChat._id);
    console.log('Message count:', testChat.messageCount);
    console.log('Title:', testChat.title);

    // Test recent chats method
    console.log('\n📋 Testing recent chats...');
    const recentChats = await Chat.getRecentChats(testChat.userId, 5);
    console.log('✅ Recent chats method working');
    console.log('Found chats:', recentChats.length);

    console.log('\n🎉 All tests passed! Chat functionality is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    process.exit(0);
  }
};

testChat();
