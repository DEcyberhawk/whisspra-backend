const Conversation = require('../../models/conversationModel');
const Message = require('../../models/messageModel');
const logger = require('../../config/logger');

// @desc    Get all conversations for the authenticated user
// @route   GET /api/v1/conversations
// @access  Private (API Key)
exports.getConversations = async (req, res, next) => {
    try {
        const conversations = await Conversation.find({ participants: req.user._id })
            .populate('participants', 'name email')
            .populate('admin', 'name email')
            .sort({ updatedAt: -1 });
        
        // Sanitize for API response
        const sanitizedConversations = conversations.map(c => {
            const convoObject = c.toObject();
            return {
                id: convoObject._id,
                name: convoObject.name,
                isGroup: convoObject.isGroup,
                participants: convoObject.participants.map(p => ({ id: p._id, name: p.name, email: p.email })),
                admin: convoObject.isGroup ? { id: convoObject.admin._id, name: convoObject.admin.name } : null,
                createdAt: convoObject.createdAt,
                updatedAt: convoObject.updatedAt
            };
        });

        res.status(200).json({
            success: true,
            count: sanitizedConversations.length,
            data: sanitizedConversations
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Send a message to a conversation
// @route   POST /api/v1/conversations/:id/messages
// @access  Private (API Key)
exports.sendMessage = async (req, res, next) => {
    const { content } = req.body;
    const conversationId = req.params.id;

    if (!content) {
        return res.status(400).json({ success: false, message: 'Message content is required.' });
    }

    try {
        // Verify user is a participant of the conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: req.user._id
        });

        if (!conversation) {
            return res.status(403).json({ success: false, message: 'You are not a member of this conversation.' });
        }

        const messageData = {
            conversationId,
            senderId: req.user._id,
            content,
            messageType: 'text',
        };

        let message = await Message.create(messageData);
        await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });

        message = await message.populate('senderId', 'name avatar');
        
        // Emit to connected clients via Socket.IO
        req.io.to(conversationId).emit('newMessage', message);
        
        logger.info(`API message sent by ${req.user.name} to conversation ${conversationId}`);

        res.status(201).json({
            success: true,
            data: message
        });

    } catch (error) {
        next(error);
    }
};
