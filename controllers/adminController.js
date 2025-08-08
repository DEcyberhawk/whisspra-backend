

const User = require('../models/userModel');
const ActivityLog = require('../models/activityLogModel');
const Transaction = require('../models/transactionModel');
const Message = require('../models/messageModel');
const logActivity = require('../utils/logActivity');

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
    try {
        const users = await User.find({});
        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a user's role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
exports.updateUserRole = async (req, res, next) => {
    try {
        const { role } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            res.status(404);
            return next(new Error('User not found'));
        }

        if (!['user', 'creator', 'admin'].includes(role)) {
            res.status(400);
            return next(new Error('Invalid role specified.'));
        }

        user.role = role;
        user.isCreator = (role === 'creator' || role === 'admin');

        await user.save();
        
        logActivity(req.user.id, 'ADMIN_ACTION_UPDATE_ROLE', user._id, { newRole: role });

        const updatedUser = user.toObject();
        delete updatedUser.password;
        delete updatedUser.twoFactorSecret;
        res.status(200).json(updatedUser);
    } catch (error) {
        next(error);
    }
};


// @desc    Get all activity logs
// @route   GET /api/admin/logs
// @access  Private/Admin
exports.getActivityLogs = async (req, res, next) => {
    try {
        const logs = await ActivityLog.find({}).sort({ timestamp: -1 }).populate('actor', 'name email');
        res.status(200).json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        next(error);
    }
};


// @desc    Toggle maintenance mode
// @route   POST /api/admin/maintenance
// @access  Private/Admin
exports.toggleMaintenanceMode = async (req, res, next) => {
    try {
        global.MAINTENANCE_MODE = !global.MAINTENANCE_MODE;
        const status = global.MAINTENANCE_MODE ? 'enabled' : 'disabled';
        
        await logActivity(req.user.id, 'ADMIN_ACTION_TOGGLE_MAINTENANCE', null, { status });

        res.status(200).json({
            success: true,
            message: `Maintenance mode has been ${status}.`
        });
    } catch (error) {
        next(error);
    }
};


// @desc    Get platform-wide statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
exports.getStats = async (req, res, next) => {
    try {
        const totalUsers = await User.countDocuments();

        const totalRevenueData = await Transaction.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalRevenue = totalRevenueData[0]?.total || 0;

        const totalTipsData = await Transaction.aggregate([
            { $match: { 'details.type': 'tip' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalTips = totalTipsData[0]?.total || 0;

        const totalMarketplaceSales = totalRevenue - totalTips;

        // Get daily revenue for the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

        const dailyRevenue = await Transaction.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    dailyTotal: { $sum: "$amount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        const labels = [];
        const data = [];
        const dateMap = new Map(dailyRevenue.map(item => [item._id, item.dailyTotal]));

        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            labels.push(dateString);
            data.push(dateMap.get(dateString) || 0);
        }

        res.status(200).json({
            success: true,
            stats: {
                totalUsers,
                totalRevenue,
                totalTips,
                totalMarketplaceSales,
                dailyRevenueChartData: { labels, data }
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all flagged content
// @route   GET /api/admin/reports/flagged
// @access  Private/Admin
exports.getFlaggedContent = async (req, res, next) => {
    try {
        const flaggedMessages = await Message.find({
            'safetyAnalysis.status': 'warning',
            'adminAction.action': { $ne: 'dismissed' } // Don't show already dismissed reports
        })
        .populate('senderId', 'name avatar')
        .sort({ createdAt: -1 });
        res.status(200).json(flaggedMessages);
    } catch (error) {
        next(error);
    }
};

// @desc    Take moderation action on flagged content
// @route   POST /api/admin/reports/flagged/:id
// @access  Private/Admin
exports.moderateFlaggedContent = async (req, res, next) => {
    try {
        const { action } = req.body; // 'dismiss' or 'delete'
        const message = await Message.findById(req.params.id);

        if (!message) {
            res.status(404);
            return next(new Error('Message not found.'));
        }

        if (action === 'dismiss') {
            message.adminAction = {
                action: 'dismissed',
                adminId: req.user._id,
                timestamp: new Date()
            };
            await message.save();
            res.status(200).json({ success: true, message: 'Report dismissed.' });
        } else if (action === 'delete') {
            const conversationId = message.conversationId.toString();
            await message.remove();
            
            // Emit a socket event to inform clients to remove the message
            req.io.to(conversationId).emit('messageDeleted', { messageId: req.params.id, conversationId });
            
            res.status(200).json({ success: true, message: 'Message deleted.' });
        } else {
            res.status(400);
            return next(new Error('Invalid action.'));
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Get recent transactions
// @route   GET /api/admin/transactions
// @access  Private/Admin
exports.getTransactions = async (req, res, next) => {
    try {
        const transactions = await Transaction.find({})
            .sort({ createdAt: -1 })
            .limit(50) // Limit to recent 50
            .populate('fromUser', 'name avatar')
            .populate('toUser', 'name avatar');
        res.status(200).json(transactions);
    } catch (error) {
        next(error);
    }
};

// @desc    Get pending verification requests
// @route   GET /api/admin/verifications/pending
// @access  Private/Admin
exports.getPendingVerifications = async (req, res, next) => {
    try {
        const users = await User.find({ verificationStatus: 'pending' });
        res.status(200).json(users);
    } catch (error) {
        next(error);
    }
};

// @desc    Process a verification request
// @route   POST /api/admin/verifications/:userId
// @access  Private/Admin
exports.processVerificationRequest = async (req, res, next) => {
    const { userId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'
    try {
        const user = await User.findById(userId);
        if (!user) {
            res.status(404);
            return next(new Error('User not found'));
        }
        if (action === 'approve') {
            user.isVerified = true;
            user.verificationStatus = 'verified';
        } else if (action === 'reject') {
            user.isVerified = false;
            user.verificationStatus = 'rejected';
        } else {
            res.status(400);
            return next(new Error('Invalid action provided.'));
        }
        await user.save();
        
        // Notify the user via Socket.IO
        const userSocketId = req.userSocketMap.get(userId.toString());
        if (userSocketId) {
            req.io.to(userSocketId).emit('verificationStatusUpdate', { status: user.verificationStatus });
        }

        res.status(200).json({
            message: `User verification has been ${action === 'approve' ? 'approved' : 'rejected'}.`,
            user
        });
    } catch (error) {
        next(error);
    }
};