

const Conversation = require('../models/conversationModel');
const Message = require('../models/messageModel');
const User = require('../models/userModel');
const { GoogleGenAI, Type } = require('@google/genai');
const logger = require('../config/logger');

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const populateConversation = [
    { path: 'participants', select: 'name avatar email role isCreator followers bio theme createdAt isOnline lastSeen' },
    { path: 'lastMessage', populate: { path: 'senderId', select: 'name avatar' } },
    { path: 'admin', select: 'name avatar email role' },
    { path: 'roleplaySettings.characterRoles.userId', select: 'name avatar' },
    { path: 'communityId', select: 'category' } // Correctly populate the communityId field
];

const mapConvo = (c, userSocketMap) => {
    const convoObject = c.toObject();
    convoObject.id = convoObject._id;
    if (convoObject.admin) convoObject.admin.id = convoObject.admin._id;
    convoObject.participants = convoObject.participants.map(p => {
        const participant = {...p, id: p._id};
        if (userSocketMap.has(p._id.toString())) {
            participant.socketId = userSocketMap.get(p._id.toString());
        }
        return participant;
    });
    if (convoObject.roleplaySettings && convoObject.roleplaySettings.characterRoles) {
        convoObject.roleplaySettings.characterRoles = convoObject.roleplaySettings.characterRoles.map(r => ({
            ...r,
            userId: r.userId._id
        }));
    }
    return convoObject;
};


// @desc    Get all conversations for a user
// @route   GET /api/chats
// @access  Private
exports.getConversations = async (req, res, next) => {
    try {
        const conversations = await Conversation.find({ participants: req.user._id })
            .populate(populateConversation)
            .sort({ updatedAt: -1 });
        
        const conversationsWithId = conversations.map(c => mapConvo(c, req.userSocketMap));

        res.status(200).json(conversationsWithId);
    } catch (error) {
        next(error);
    }
};

// @desc    Get messages for a conversation
// @route   GET /api/chats/:conversationId/messages
// @access  Private
exports.getMessages = async (req, res, next) => {
    try {
        const conversation = await Conversation.findOne({
            _id: req.params.conversationId,
            participants: req.user._id
        });

        if (!conversation) {
            res.status(403);
            return next(new Error('User not authorized to access this chat'));
        }
        
        const messages = await Message.find({ conversationId: req.params.conversationId })
            .populate('senderId', 'name avatar')
            .sort({ createdAt: 1 });

        res.status(200).json(messages);
    } catch (error) {
        next(error);
    }
};

// @desc    Create or access a conversation
// @route   POST /api/chats
// @access  Private
exports.accessConversation = async (req, res, next) => {
    const { participants, name, isCognitive, isRoleplayRoom } = req.body;
    
    if (!participants || participants.length === 0) {
        return res.status(400).json({ message: 'Participant IDs are required.' });
    }

    const allParticipants = [...new Set([...participants, req.user._id.toString()])];
    
    const isGroupChat = allParticipants.length > 2;

    try {
        if (isGroupChat) {
             if (!name) {
                return res.status(400).json({ message: 'Group name is required for group chats.'});
            }

            let convoData = {
                name: name,
                isGroup: true,
                participants: allParticipants,
                admin: req.user._id,
                isCognitive: isRoleplayRoom ? false : (isCognitive || false), // Roleplay rooms are not cognitive
                isRoleplayRoom: isRoleplayRoom || false
            };

            if (isRoleplayRoom) {
                try {
                    const response = await ai.models.generateContent({
                        model: "gemini-2.5-flash",
                        contents: `For a group chat named "${name}", create a roleplay. Provide a brief, one-paragraph scenario and ${allParticipants.length} distinct character names.`,
                        config: {
                            responseMimeType: "application/json",
                            responseSchema: {
                                type: Type.OBJECT,
                                properties: {
                                    scenario: { type: Type.STRING, description: 'A one-paragraph roleplay scenario.' },
                                    roles: {
                                        type: Type.ARRAY,
                                        description: `A list of exactly ${allParticipants.length} unique character names.`,
                                        items: { type: Type.STRING }
                                    }
                                }
                            },
                        }
                    });
                    const parsed = JSON.parse(response.text.trim());
                    if (parsed.scenario && parsed.roles && parsed.roles.length === allParticipants.length) {
                         const characterRoles = allParticipants.map((id, index) => ({
                            userId: id,
                            characterName: parsed.roles[index] || `Character ${index + 1}`
                        }));
                        convoData.roleplaySettings = {
                            scenario: parsed.scenario,
                            characterRoles
                        };
                    } else {
                        logger.warn("AI did not return valid roleplay data, creating a standard group.");
                        convoData.isRoleplayRoom = false;
                    }
                } catch(aiError) {
                    logger.error("Error generating roleplay scenario from AI:", aiError);
                    convoData.isRoleplayRoom = false; // Fallback to standard group on AI error
                }
            }
            
            let groupConversation = await Conversation.create(convoData);
            const fullGroupConversation = await Conversation.findById(groupConversation._id).populate(populateConversation);
            return res.status(201).json(mapConvo(fullGroupConversation, req.userSocketMap));
        } else {
             let conversation = await Conversation.findOne({
                isGroup: false,
                participants: { $all: allParticipants, $size: 2 }
            }).populate(populateConversation);

            if (conversation) {
                return res.status(200).json(mapConvo(conversation, req.userSocketMap));
            }

            conversation = await Conversation.create({
                isGroup: false,
                participants: allParticipants
            });
            const fullConversation = await Conversation.findById(conversation._id).populate(populateConversation);
            return res.status(201).json(mapConvo(fullConversation, req.userSocketMap));
        }

    } catch (error) {
        next(error);
    }
};

// @desc    Update a group chat (rename, add/remove members)
// @route   PUT /api/chats/:conversationId/group
// @access  Private
exports.updateGroup = async (req, res, next) => {
    const { name, participants } = req.body;
    const { conversationId } = req.params;

    try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            res.status(404);
            return next(new Error('Conversation not found'));
        }
        // Check if user is admin
        if (conversation.admin.toString() !== req.user._id.toString()) {
            res.status(403);
            return next(new Error('Not authorized to update this group'));
        }

        if (name) conversation.name = name;
        if (participants) conversation.participants = [...new Set(participants)];

        await conversation.save();
        const updatedConversation = await Conversation.findById(conversationId).populate(populateConversation);
        
        res.status(200).json(mapConvo(updatedConversation, req.userSocketMap));
    } catch(error) {
        next(error);
    }
};

// @desc    Create a private whisper thread from a group chat
// @route   POST /api/chats/:conversationId/whisper
// @access  Private
exports.startWhisperThread = async (req, res, next) => {
    const { recipientId } = req.body;
    const { conversationId: parentConversationId } = req.params;
    const initiatorId = req.user._id;

    try {
        const parentConvo = await Conversation.findById(parentConversationId);
        if (!parentConvo || !parentConvo.participants.includes(initiatorId) || !parentConvo.participants.includes(recipientId)) {
            res.status(403);
            return next(new Error("Participants not in the parent conversation."));
        }

        let thread = await Conversation.findOne({
            parentConversationId,
            isWhisperThread: true,
            participants: { $all: [initiatorId, recipientId], $size: 2 }
        }).populate(populateConversation);

        if (thread) {
            return res.status(200).json(mapConvo(thread, req.userSocketMap));
        }
        
        const recipient = await User.findById(recipientId).select('name');

        const newThread = await Conversation.create({
            name: `Whisper: ${req.user.name} & ${recipient.name}`,
            isGroup: true, // Treated as a group technically
            isWhisperThread: true,
            parentConversationId,
            participants: [initiatorId, recipientId],
            admin: initiatorId
        });

        // Create a system message in the parent chat, but only send to participants
        const systemMessage = await Message.create({
            conversationId: parentConversationId,
            senderId: initiatorId,
            messageType: 'system',
            content: `${req.user.name} started a whisper thread with ${recipient.name}.`,
            relatedConversationId: newThread._id,
        });

        const populatedSystemMessage = await Message.findById(systemMessage._id).populate('senderId', 'name avatar');

        const initiatorSocketId = req.userSocketMap.get(initiatorId.toString());
        const recipientSocketId = req.userSocketMap.get(recipientId.toString());
        
        if (initiatorSocketId) req.io.to(initiatorSocketId).emit('newMessage', populatedSystemMessage);
        if (recipientSocketId) req.io.to(recipientSocketId).emit('newMessage', populatedSystemMessage);
        
        const fullThread = await Conversation.findById(newThread._id).populate(populateConversation);
        res.status(201).json(mapConvo(fullThread, req.userSocketMap));

    } catch (error) {
        next(error);
    }
};
