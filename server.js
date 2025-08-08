
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
const { performSafetyScan } = require('./controllers/aiController');

const app = express();
const server = http.createServer(app);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    logger.info('Created uploads directory.');
}

// --- CORS Configuration ---
// A more robust and explicit CORS setup to handle various browser behaviors.
const corsOptions = {
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allow standard methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow headers used by the app
  optionsSuccessStatus: 200 // For legacy browser compatibility
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight requests for all routes


const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for Socket.IO
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
	max: 100, // Limit each IP to 100 requests per windowMs
	standardHeaders: true, 
	legacyHeaders: false, 
});
app.use('/api/', apiLimiter);

// Make io and userSocketMap available in requests
app.use((req, res, next) => {
    req.io = io;
    req.userSocketMap = userSocketMap;
    next();
});

// --- Routes ---
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));
app.use('/api/system', require('./routes/systemRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes')); // Public settings route
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

// Developer v1 API Routes
app.use('/api/v1/conversations', require('./routes/api_v1/chatApiRoutes'));


// --- Socket.IO Middleware for Authentication ---
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

// --- Socket.IO Real-time Logic ---
io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user.name} (${socket.id})`);
    userSocketMap.set(socket.user._id.toString(), socket.id);

    // Join rooms for all conversations the user is part of
    Conversation.find({ participants: socket.user._id }).then(convos => {
        convos.forEach(convo => socket.join(convo._id.toString()));
    });
    
    // Broadcast user online status
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

            // Check if a safety scan is needed
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
            
            // Asynchronously perform safety scan if needed
            if (ai && needsScan) {
                performSafetyScan(message, io).catch(err => {
                    logger.error(`Caught an error from performSafetyScan promise for message ${message._id}:`, err);
                });
            } else if (needsScan) {
                // AI is not configured, but we need to resolve the 'pending' status
                const updatedMsg = await Message.findById(message._id);
                if (updatedMsg) {
                    updatedMsg.safetyAnalysis.status = 'safe';
                    await updatedMsg.save();
                    io.to(conversationId).emit('messageSafetyUpdate', {
                        messageId: updatedMsg._id,
                        conversationId,
                        safetyAnalysis: updatedMsg.safetyAnalysis,
                    });
                }
            }

        } catch (error) {
            logger.error('Error sending message:', error);
        }
    });

    // New read status handlers
    const updateMessageStatus = async (conversationId, newStatus) => {
        try {
            const conversation = await Conversation.findById(conversationId).populate('participants');
            if (!conversation) return;
            
            const otherParticipant = conversation.participants.find(p => p._id.toString() !== socket.user._id.toString());
            if (!otherParticipant) return; // No one to notify (or group chat logic needed)

            const updateResult = await Message.updateMany(
                {
                    conversationId,
                    senderId: { $ne: socket.user._id },
                    readStatus: { $ne: 'read' } // Don't update already read messages
                },
                {
                    $set: {
                        readStatus: newStatus,
                        ...(newStatus === 'read' && { readAt: new Date() })
                    }
                }
            );

            if (updateResult.modifiedCount > 0) {
                 const senderSocketId = userSocketMap.get(otherParticipant._id.toString());
                 if (senderSocketId) {
                     io.to(senderSocketId).emit('messageStatusUpdate', {
                         conversationId,
                         newStatus
                     });
                 }
            }
        } catch (error) {
            logger.error(`Error updating message status to ${newStatus}:`, error);
        }
    };
    
    socket.on('glimpseMessages', ({ conversationId }) => {
        updateMessageStatus(conversationId, 'glimpsed');
    });

    socket.on('readMessages', ({ conversationId }) => {
        updateMessageStatus(conversationId, 'read');
    });
    
    // Typing indicators
    socket.on('typing', ({ conversationId }) => {
        socket.to(conversationId).emit('typing', { conversationId, userName: socket.user.name });
    });
    socket.on('stopTyping', ({ conversationId }) => {
        socket.to(conversationId).emit('stopTyping', { conversationId });
    });
    
    // WebRTC Signaling for Video/Audio Calls
    socket.on('call-user', ({ to, from, signal }) => {
        const toSocketId = userSocketMap.get(to);
        if (toSocketId) {
            io.to(toSocketId).emit('receiving-call', { from, signal });
        }
    });
    socket.on('accept-call', ({ to, signal }) => {
        const toSocketId = userSocketMap.get(to);
        if (toSocketId) {
            io.to(toSocketId).emit('call-accepted', { signal });
        }
    });
    socket.on('ice-candidate', ({ to, candidate }) => {
        const toSocketId = userSocketMap.get(to);
        if (toSocketId) {
            io.to(toSocketId).emit('ice-candidate', { candidate });
        }
    });
    socket.on('end-call', ({ to }) => {
        const toSocketId = userSocketMap.get(to);
        if (toSocketId) {
            io.to(toSocketId).emit('call-ended');
        }
    });

    // P2P Data Channel Signaling
    socket.on('p2p-offer', ({ to, offer }) => {
        const toSocketId = userSocketMap.get(to);
        if (toSocketId) {
            io.to(toSocketId).emit('p2p-offer', { from: socket.user._id.toString(), offer });
        }
    });
    socket.on('p2p-answer', ({ to, answer }) => {
        const toSocketId = userSocketMap.get(to);
        if (toSocketId) {
            io.to(toSocketId).emit('p2p-answer', { from: socket.user._id.toString(), answer });
        }
    });
     socket.on('p2p-candidate', ({ to, candidate }) => {
        const toSocketId = userSocketMap.get(to);
        if (toSocketId) {
            io.to(toSocketId).emit('p2p-candidate', { from: socket.user._id.toString(), candidate });
        }
    });

    // Stealth Conference Call Signaling
    socket.on('start-stealth-call', ({ participants, from }) => {
        participants.forEach((participantId) => {
            const toSocketId = userSocketMap.get(participantId);
            if (toSocketId) {
                // Each participant thinks it's a 1-on-1 call from the host
                io.to(toSocketId).emit('receiving-call', { from, signal: null, isStealthCall: true });
            }
        });
    });

    socket.on('stealth-offer', ({ to, from, signal }) => {
        const toSocketId = userSocketMap.get(to);
        if (toSocketId) {
            io.to(toSocketId).emit('stealth-offer', { from, signal });
        }
    });

    socket.on('stealth-answer', ({ to, from, signal }) => {
        const toSocketId = userSocketMap.get(to);
        if (toSocketId) {
            io.to(toSocketId).emit('stealth-answer', { from, signal });
        }
    });

    socket.on('stealth-candidate', ({ to, from, candidate }) => {
        const toSocketId = userSocketMap.get(to);
        if (toSocketId) {
            io.to(toSocketId).emit('stealth-candidate', { from, candidate });
        }
    });

    // Watch Party Signaling
    socket.on('start-watch-party', async ({ conversationId, videoUrl }) => {
        try {
            const youtubeId = new URL(videoUrl).searchParams.get('v');
            if (!youtubeId) return;

            const conversation = await Conversation.findById(conversationId);
            if (conversation && conversation.participants.includes(socket.user._id)) {
                const partyState = { isActive: true, videoId: youtubeId, hostId: socket.user._id.toString(), isPlaying: true, timestamp: 0 };
                // Using a direct update might be better in a real app, but this works
                conversation.watchParty = partyState;
                await conversation.save();
                io.to(conversationId).emit('watch-party-started', { conversationId, partyState });
            }
        } catch (error) {
            logger.error("Error starting watch party", error);
        }
    });

    socket.on('playback-control', async ({ conversationId, control }) => {
        const conversation = await Conversation.findById(conversationId);
        if (conversation && conversation.watchParty && conversation.watchParty.hostId === socket.user._id.toString()) {
            conversation.watchParty.isPlaying = control.type === 'PLAY';
            conversation.watchParty.timestamp = control.timestamp;
            await conversation.save();
            socket.to(conversationId).emit('watch-party-updated', { conversationId, partyState: conversation.watchParty });
        }
    });
    
    socket.on('end-watch-party', async ({ conversationId }) => {
        const conversation = await Conversation.findById(conversationId);
        if (conversation && conversation.watchParty && conversation.watchParty.hostId === socket.user._id.toString()) {
            conversation.watchParty = undefined;
            await conversation.save();
            io.to(conversationId).emit('watch-party-ended', { conversationId });
        }
    });

    // Voice Room Signaling
    const roomState = {}; // This would be more robust in a real app (e.g., Redis)
    socket.on('join-voice-room', ({ conversationId }) => {
        socket.join(`voice:${conversationId}`);
        // Announce new participant to others in the room
        socket.to(`voice:${conversationId}`).emit('voice-new-participant', { userId: socket.user._id.toString() });
    });

    socket.on('leave-voice-room', ({ conversationId }) => {
        socket.leave(`voice:${conversationId}`);
        socket.to(`voice:${conversationId}`).emit('voice-participant-left', { userId: socket.user._id.toString() });
    });

    // Relay voice WebRTC signals
    socket.on('voice-offer', ({ to, offer }) => {
        const toSocketId = userSocketMap.get(to);
        if(toSocketId) io.to(toSocketId).emit('voice-offer', { from: socket.user._id.toString(), offer });
    });
    socket.on('voice-answer', ({ to, answer }) => {
        const toSocketId = userSocketMap.get(to);
        if(toSocketId) io.to(toSocketId).emit('voice-answer', { from: socket.user._id.toString(), answer });
    });
    socket.on('voice-candidate', ({ to, candidate }) => {
        const toSocketId = userSocketMap.get(to);
        if(toSocketId) io.to(toSocketId).emit('voice-candidate', { from: socket.user._id.toString(), candidate });
    });
    
});


// --- Final Error Handler ---
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}, accessible on the local network.`));
