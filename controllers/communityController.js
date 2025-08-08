
const Community = require('../models/communityModel');
const Conversation = require('../models/conversationModel');
const logger = require('../config/logger');

// @desc    Create a new community
// @route   POST /api/communities
// @access  Private
exports.createCommunity = async (req, res, next) => {
    const { name, description, category } = req.body;
    const creatorId = req.user._id;

    try {
        // 1. Create the associated group chat conversation
        const conversation = await Conversation.create({
            name,
            isGroup: true,
            participants: [creatorId], // Creator is the first member
            admin: creatorId,
            isCommunityChat: true,
        });

        // 2. Create the community and link it to the conversation
        const community = await Community.create({
            name,
            description,
            category,
            creator: creatorId,
            conversation: conversation._id,
            members: [creatorId]
        });

        // 3. Link the conversation back to the community
        conversation.communityId = community._id;
        await conversation.save();

        logger.info(`Community created by ${req.user.name}: ${name}`);
        res.status(201).json(community);

    } catch (error) {
        // Handle potential unique name error
        if (error.code === 11000) {
            return res.status(400).json({ message: 'A community with this name already exists.' });
        }
        next(error);
    }
};

// @desc    Get all public communities
// @route   GET /api/communities
// @access  Private
exports.getCommunities = async (req, res, next) => {
    try {
        const communities = await Community.find({})
            .populate('creator', 'name')
            .sort({ createdAt: -1 });

        // Add member count to each community
        const communitiesWithCount = communities.map(c => ({
            ...c.toObject(),
            memberCount: c.members.length,
        }));
        
        res.status(200).json(communitiesWithCount);
    } catch (error) {
        next(error);
    }
};

// @desc    Join a community
// @route   POST /api/communities/:id/join
// @access  Private
exports.joinCommunity = async (req, res, next) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) {
            res.status(404);
            return next(new Error('Community not found.'));
        }

        const userId = req.user._id;

        // Add user to community members if not already there
        if (!community.members.includes(userId)) {
            community.members.push(userId);
            await community.save();
        }

        // Add user to the conversation participants if not already there
        await Conversation.findByIdAndUpdate(community.conversation, {
            $addToSet: { participants: userId }
        });
        
        // Let the user's client know to join the socket room
        const userSocketId = req.userSocketMap.get(userId.toString());
        if (userSocketId) {
             const socket = req.io.sockets.sockets.get(userSocketId);
             if (socket) {
                 socket.join(community.conversation.toString());
             }
        }
        
        logger.info(`${req.user.name} joined community: ${community.name}`);
        res.status(200).json({ message: 'Successfully joined community.' });

    } catch (error) {
        next(error);
    }
};