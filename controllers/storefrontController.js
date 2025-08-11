
const User = require('../models/userModel');
const MarketplaceItem = require('../models/marketplaceItemModel');
const logger = require('../config/logger');

// @desc    Get public storefront data for a creator
// @route   GET /api/store/:userId
// @access  Public
exports.getStorefront = async (req, res, next) => {
    try {
        const { userId } = req.params;

        const creator = await User.findById(userId).select('name avatar bio isCreator isVerified storefrontSettings');
        if (!creator || !creator.isCreator) {
            res.status(404);
            return next(new Error('Creator storefront not found.'));
        }

        const items = await MarketplaceItem.find({ creator: userId })
            .populate('creator', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            creator,
            items
        });
    } catch (error) {
        next(error);
    }
};
