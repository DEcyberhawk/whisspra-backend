require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const logger = require('./config/logger');
const { errorHandler } = require('./middleware/errorMiddleware');
const { checkMaintenanceMode } = require('./middleware/maintenanceMiddleware');
const jwt = require('jsonwebtoken');
const User = require('./models/userModel');
const Message = require('./models/messageModel');
const Conversation = require('./models/conversationModel');
const { GoogleGenAI } = require('@google/genai');
const { performSafetyScan } = require('./controllers/aiController');

const app = express();
const server = http.createServer(app);

// 🌍 ENV Logging
console.log("🔄 Starting Whisspra Backend...");
console.log("✅ NODE_ENV:", process.env.NODE_ENV);
console.log("✅ PORT:", process.env.PORT || 5000);
console.log("✅ JWT_SECRET:", process.env.JWT_SECRET ? "✔️ Present" : "❌ Missing");
console.log("✅ API_KEY:", process.env.API_KEY ? "✔️ Present" : "❌ Missing");
console.log("✅ MONGO_URI:", process.env.MONGO_URI ? "✔️ Present" : "❌ Missing");


// 🛑 Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    logger.info('Created uploads directory.');
}

// 🌐 CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));
app.options('*', cors());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 📦 Global Variables
global.MAINTENANCE_MODE = false;
global.START_TIME = Date.now();
const userSocketMap = new Map();
const ai = process.env.API_KEY ? new GoogleGenAI({ apiKey: process.env.API_KEY }) : null;

// 🧠 Connect to MongoDB
connectDB().then(() => {
    logger.info("✅ MongoDB connected successfully");
}).catch((err) => {
    logger.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
});

// 🔐 Middleware
app.use(express.json());
app.use(checkMaintenanceMode);

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

app.use((req, res, next) => {
    req.io = io;
    req.userSocketMap = userSocketMap;
    next();
});

// 📁 Routes
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));
app.use('/api/system', require('./routes/systemRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/creators', require('./routes/creatorRoutes'));
app.use('/api/store', require('./routes/storefrontRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/marketplace', require('./routes/marketplaceRoutes'));
app.use('/api/developer', require('./routes/developerRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/edu', require('./routes/eduRoutes'));
app.use('/api/whispernet', require('./routes/whisperNetRoutes'));
app.use('/api/dreamscapes', require('./routes/dreamscapeRoutes'));
app.use('/api/v1/conversations', require('./routes/api_v1/chatApiRoutes'));

// 🧠 Add your Socket.IO authentication and real-time logic below (unchanged from previous version)
// io.use(...) and io.on(...) — as already implemented

// ⚠️ Error Handler
app.use(errorHandler);

// 🌍 Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
