import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import connectDB from './config/database.js';
import { initializeFirebase } from './config/firebase.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import branchRoutes from './routes/branch.js';
import questionRoutes from './routes/question.js';
import achievementRoutes from './routes/achievement.js';
import levelRoutes from './routes/level.js';
import planRoutes from './routes/plan.js';
import subscriptionRoutes from './routes/subscription.js';
import aboutUsRoutes from './routes/aboutUs.js';
import chatRoutes from './routes/chat.js';
import invitationRoutes from './routes/invitation.js';
import reviewRoutes from './routes/review.js';
import questionPacketRoutes from './routes/questionPacket.js';
import paypalRoutes from './routes/paypal.js';
import stripeRoutes from './routes/stripe.js';
import planSelectionRoutes from './routes/planSelection.js';
import profileRoutes from './routes/profile.js';
import dashboardRoutes from './routes/dashboard.js';


const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use((req, res, next) => {

  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

// Main endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Gnosis API',
    project: 'Gnosis',
    status: 'Server is running successfully',
    version: '1.0.0'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/levels', levelRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/about-us', aboutUsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/questionPacket', questionPacketRoutes);
app.use('/api/paypal', paypalRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/plan-selection', planSelectionRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/dashboard', dashboardRoutes);





const startServer = async () => {
  try {
    await connectDB();
    initializeFirebase();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      
    });
  } catch (error) {
    console.error('Server error:', error);
    process.exit(1);
  }
};



startServer();
