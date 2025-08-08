

const Transaction = require('../models/transactionModel');
const User = require('../models/userModel');
const logActivity = require('../utils/logActivity');

// @desc    Create a tip for a creator
// @route   POST /api/creators/tip
// @access  Private
exports.createTip = async (req, res, next) => {
    const { creatorId, amount, paymentIntentId } = req.body;
    const fromUser = req.user._id;

    if (!creatorId || !amount || !paymentIntentId) {
        res.status(400);
        return next(new Error('Creator ID, amount, and paymentIntentId are required.'));
    }
    
    if (amount <= 0) {
        res.status(400);
        return next(new Error('Tip amount must be positive.'));
    }

    try {
        const creator = await User.findById(creatorId);
        if (!creator || !creator.isCreator) {
            res.status(404);
            return next(new Error('Creator not found.'));
        }

        // In a real app, you would verify the paymentIntentId with Stripe here
        // to ensure it's valid and matches the amount before creating the transaction.

        const transaction = await Transaction.create({
            fromUser,
            toUser: creatorId,
            amount,
            currency: 'usd',
            status: 'completed',
            paymentId: paymentIntentId,
            details: { type: 'tip' }
        });

        await logActivity(fromUser, 'CREATOR_TIP_RECEIVED', creatorId, { amount });

        res.status(201).json({
            success: true,
            message: 'Tip sent successfully!',
            data: transaction
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Get earnings for the logged-in creator
// @route   GET /api/creators/earnings
// @access  Private/Creator
exports.getEarnings = async (req, res, next) => {
    try {
        const transactions = await Transaction.find({ toUser: req.user._id })
            .populate('fromUser', 'name avatar')
            .sort({ createdAt: -1 });
        
        const totalEarnings = transactions.reduce((acc, curr) => acc + curr.amount, 0);

        res.status(200).json({
            success: true,
            count: transactions.length,
            totalEarnings,
            data: transactions
        });

    } catch (error) {
        next(error);
    }
};