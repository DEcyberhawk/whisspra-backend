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
const FeatureFlag = require('./models/featureFlagModel');
const { GoogleGenAI } = require('@google/genai');
const { performSafetyScan, getAiTwinReplySuggestion } = require('./controllers/aiController');

const app = express();
const server = http.createServer(app);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    logger.info('Created uploads directory.');
}

// --- CORS Configuration ---
const corsOptions = {
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200 
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));


const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const seedFeatureFlags = async () => {
    try {
        const features = [
            { name: 'LiveStage', description: 'Enables live streaming capabilities for creators.', isEnabled: true },
            { name: 'Echoes', description: 'Allows creators to make interactive, branching video content.', isEnabled: true },
            { name: 'Dreamscapes', description: 'Enables AI-generated immersive worlds for users to explore.', isEnabled: false },
            { name: 'EDU_Mode', description: 'Activates the full suite of academic and student tools.', isEnabled: true },
            { name: 'WhisperNet', description: 'Enables offline peer-to-peer mesh networking capabilities.', isEnabled: false },
            { name: 'Wallet', description: 'Enables the Whispr Token wallet and transaction features.', isEnabled: false },
            { name: 'Marketplace', description: 'Allows creators to list and sell digital items.', isEnabled: true },
        ];

        for (const feature of features) {
            await FeatureFlag.updateOne({ name: feature.name }, { $setOnInsert: feature }, { upsert: true });
        }
        logger.info('Feature flags seeded successfully.');
    } catch (error) {
        logger.error('Error seeding feature flags:', error);
    }
};

// Connect to Database
connectDB().then(() => {
    seedFeatureFlags();
});

// --- Global State ---
global.MAINTENANCE_MODE = false;
global.START_TIME = Date.now();
const userSocketMap = new Map();
const ai = process.env.API_KEY ? new GoogleGenAI({ apiKey: process.env.API_KEY }) : null;


// --- Middleware ---
app.use(express.json());
app.use(checkMaintenanceMode);

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
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

// --- Routes ---
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
app.use('/api/admin/forge', require('./routes/forgeRoutes'));

app.use('/api/v1/conversations', require('./routes/api_v1/chatApiRoutes'));


io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error: No token provided'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return next(new Error('Authentication error: User not found'));
        }
        socket.user = user;
        next();
    } catch (err) {
        next(new Error('Authentication error: Invalid token'));
    }
});

io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user.name} (${socket.id})`);
    userSocketMap.set(socket.user._id.toString(), socket.id);

    Conversation.find({ participants: socket.user._id }).then(convos => {
        convos.forEach(convo => socket.join(convo._id.toString()));
    });
    
    io.emit('userStatus', { userId: socket.user._id, isOnline: true });

    socket.on('disconnect', async () => {
        logger.info(`User disconnected: ${socket.user.name} (${socket.id})`);
        userSocketMap.delete(socket.user._id.toString());
        const lastSeenTime = new Date();
        await User.findByIdAndUpdate(socket.user._id, { lastSeen: lastSeenTime });
        io.emit('userStatus', { userId: socket.user._id, isOnline: false, lastSeen: lastSeenTime });
    });

    socket.on('sendMessage', async (data) => {
        try {
            const { conversationId, content, messageType = 'text', duration, fileName, fileSize, releaseAt } = data;
            
            const conversation = await Conversation.findById(conversationId).populate('participants');
            if (!conversation) return;

            const needsScan = messageType === 'image' || (messageType === 'text' && /https?:\/\//.test(content));

            const messageData = {
                conversationId,
                senderId: socket.user._id,
                content,
                messageType,
                duration,
                fileName,
                fileSize,
                releaseAt,
                readStatus: 'sent',
                safetyAnalysis: { status: needsScan ? 'pending' : 'safe' },
            };

            let message = await Message.create(messageData);
            await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });

            message = await message.populate('senderId', 'name avatar');
            io.to(conversationId).emit('newMessage', message);
            
            if (ai && needsScan) {
                performSafetyScan(message, io).catch(err => {
                    logger.error(`Caught an error from performSafetyScan promise for message ${message._id}:`, err);
                });
            } else if (needsScan) {
                // ... (existing safety scan fallback)
            }

            // AI Twin Auto-Reply Logic
            const recipient = conversation.participants.find(p => p._id.toString() !== socket.user._id.toString());
            if (recipient && recipient.isAiTwinAutoReplyEnabled && (recipient.presence?.status === 'away' || recipient.presence?.status === 'busy')) {
                // Trigger AI Twin
                getAiTwinReplySuggestion(conversationId, recipient)
                    .then(async (suggestion) => {
                        if (suggestion) {
                            let aiMessageData = { ...messageData, senderId: recipient._id, content: suggestion, isAiTwinMessage: true };
                            let aiMessage = await Message.create(aiMessageData);
                            await Conversation.findByIdAndUpdate(conversationId, { lastMessage: aiMessage._id });
                            aiMessage = await aiMessage.populate('senderId', 'name avatar');
                            io.to(conversationId).emit('newMessage', aiMessage);
                        }
                    })
                    .catch(err => logger.error(`AI Twin auto-reply failed for user ${recipient._id}:`, err));
            }

        } catch (error) {
            logger.error('Error sending message:', error);
        }
    });

    const updateMessageStatus = async (conversationId, newStatus) => {
        // ... existing implementation
    };
    
    socket.on('glimpseMessages', ({ conversationId }) => updateMessageStatus(conversationId, 'glimpsed'));
    socket.on('readMessages', ({ conversationId }) => updateMessageStatus(conversationId, 'read'));
    
    socket.on('typing', ({ conversationId }) => {
        socket.to(conversationId).emit('typing', { conversationId, userName: socket.user.name });
    });
    socket.on('stopTyping', ({ conversationId }) => {
        socket.to(conversationId).emit('stopTyping', { conversationId });
    });
    
    // ... all other socket event handlers (WebRTC, Watch Party, etc.)
    
});


app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}, accessible on the local network.`));