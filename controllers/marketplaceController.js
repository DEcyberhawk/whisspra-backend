

const MarketplaceItem = require('../models/marketplaceItemModel');
const Transaction = require('../models/transactionModel');
const User = require('../models/userModel');
const logActivity = require('../utils/logActivity');
const logger = require('../config/logger');

// @desc    Create a new marketplace item
// @route   POST /api/marketplace
// @access  Private/Creator
exports.createItem = async (req, res, next) => {
    const { title, description, price, thumbnailUrl, assetUrl } = req.body;
    try {
        const item = await MarketplaceItem.create({
            creator: req.user._id,
            title, description, price, thumbnailUrl, assetUrl
        });
        logger.info(`New marketplace item created by ${req.user.name}: ${title}`);
        res.status(201).json(item);
    } catch (error) {
        next(error);
    }
};

// @desc    Get all marketplace items
// @route   GET /api/marketplace
// @access  Private
exports.getItems = async (req, res, next) => {
    try {
        const items = await MarketplaceItem.find({})
            .populate('creator', 'name avatar')
            .sort({ createdAt: -1 });
        res.status(200).json(items);
    } catch (error) {
        next(error);
    }
};

// @desc    Purchase a marketplace item
// @route   POST /api/marketplace/:id/purchase
// @access  Private
exports.purchaseItem = async (req, res, next) => {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
        res.status(400);
        return next(new Error('Payment information is required.'));
    }
    
    try {
        const item = await MarketplaceItem.findById(req.params.id);
        if (!item) {
            res.status(404);
            return next(new Error('Item not found'));
        }

        const buyer = await User.findById(req.user._id);
        if (buyer.purchasedItems.includes(item._id)) {
            res.status(400);
            return next(new Error('You have already purchased this item.'));
        }

        await Transaction.create({
            fromUser: req.user._id,
            toUser: item.creator,
            amount: item.price,
            currency: 'usd',
            status: 'completed',
            paymentId: paymentIntentId,
            details: { type: 'marketplace_purchase', itemId: item._id, title: item.title }
        });
        
        buyer.purchasedItems.push(item._id);
        await buyer.save();

        await logActivity(req.user._id, 'MARKETPLACE_PURCHASE', item.creator, { amount: item.price, itemId: item._id, title: item.title });

        res.status(200).json({ success: true, message: 'Purchase successful!', user: buyer });

    } catch (error) {
        next(error);
    }
};