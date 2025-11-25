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
const PORT = process.env.PORT || 8081;


// CORS configuration
const corsOptions = {
  origin: [
    'https://khan-academy-frontend.vercel.app',
    'https://main.d2ufsd6814v2kq.amplifyapp.com',
    'http://localhost:3000',
    'https://main.d2ufsd6814v2kq.amplifyapp.com/',
    'https://khan-academy-frontend-git-main.vercel.app', // Vercel preview deployments
    'https://khan-academy-frontend-*.vercel.app' // Wildcard for all Vercel deployments
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded images statically
app.use('/uploads', express.static('uploads'));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.sendStatus(200);
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
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

// Special CORS handling for auth routes
app.use('/api/auth', (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://khan-academy-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'https://khan-academy-frontend-git-main.vercel.app'
  ];
  
  if (allowedOrigins.includes(origin) || origin?.includes('vercel.app')) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  }
  next();
}, authRoutes);
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
