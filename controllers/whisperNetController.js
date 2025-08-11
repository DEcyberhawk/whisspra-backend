
const User = require('../models/userModel');
const logger = require('../config/logger');

// @desc    Confirm successful relay of messages and reward users
// @route   POST /api/whispernet/relay-success
// @access  Private
exports.rewardRelay = async (req, res, next) => {
    // This is a placeholder for a complex future implementation.
    // In a real scenario, a gateway node (a peer that comes online) would
    // submit a batch of relayed message IDs. The server would then verify these
    // and distribute token rewards to the users who acted as relays.
    const { relayedMessageIds } = req.body;
    const currentUser = req.user;

    try {
        // For demonstration, we'll just award the current user a small amount of tokens.
        const rewardAmount = 0.5; // Example: 0.5 Whispr Tokens per successful batch
        
        await User.findByIdAndUpdate(currentUser._id, {
            $inc: { whisprTokenBalance: rewardAmount }
        });

        logger.info(`User ${currentUser.name} was rewarded ${rewardAmount} Whispr Tokens for relaying messages.`);
        
        const updatedUser = await User.findById(currentUser._id);

        res.status(200).json({
            success: true,
            message: `Successfully rewarded for relaying messages.`,
            newBalance: updatedUser.whisprTokenBalance
        });

    } catch (error) {
        next(error);
    }
};
