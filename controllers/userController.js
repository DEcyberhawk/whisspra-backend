

const User = require('../models/userModel');
const logger = require('../config/logger');

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateUserProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.theme = req.body.theme || user.theme;
            user.language = req.body.language || user.language;
            if (req.body.avatar) {
                user.avatar = req.body.avatar;
            }
            if (req.body.password) {
                user.password = req.body.password;
            }
            if (req.body.academicProfile) {
                user.academicProfile = req.body.academicProfile;
            }

            const updatedUser = await user.save();
            
            logger.info(`User profile updated for ${user._id}`);
            
            const responseUser = { ...updatedUser.toObject(), id: updatedUser._id };
            delete responseUser.password;
            
            res.json(responseUser);
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Update user presence
// @route   PUT /api/users/presence
// @access  Private
exports.updateUserPresence = async (req, res, next) => {
    try {
        const { status, message } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }

        const validStatuses = ['online', 'away', 'busy', 'driving', 'sleeping'];
        if (status && !validStatuses.includes(status)) {
            res.status(400);
            throw new Error('Invalid status value');
        }
        
        user.presence = {
            status: status || 'online',
            message: message || '',
        };

        await user.save();
        
        // Broadcast change via socket
        req.io.emit('presenceUpdate', { userId: user._id, presence: user.presence });

        res.status(200).json(user.presence);

    } catch (error) {
        next(error);
    }
};


// @desc    Get all users for creating groups etc.
// @route   GET /api/users
// @access  Private
exports.getUsers = async (req, res, next) => {
    try {
        // Find all users except the current logged-in user
        const users = await User.find({ _id: { $ne: req.user._id } }).select('id name avatar');
        const usersWithId = users.map(u => ({...u.toObject(), id: u._id}));
        res.status(200).json(usersWithId);
    } catch (error) {
        next(error);
    }
};

// @desc    Submit for identity verification
// @route   POST /api/users/verification/submit
// @access  Private
exports.submitForVerification = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            res.status(404);
            return next(new Error('User not found.'));
        }
        if (user.isAnonymous) {
            res.status(400);
            return next(new Error('Anonymous users cannot be verified.'));
        }
        if (user.verificationStatus === 'pending' || user.verificationStatus === 'verified') {
            res.status(400);
            return next(new Error('Verification is already in progress or completed.'));
        }
        
        user.verificationStatus = 'pending';
        await user.save();
        
        const userObject = user.toObject();
        delete userObject.password;
        delete userObject.twoFactorSecret;

        res.status(200).json({
            message: 'Your verification request has been submitted for review.',
            user: userObject
        });

    } catch (error) {
        next(error);
    }
};