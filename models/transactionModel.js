
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    fromUser: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    toUser: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        required: true,
        default: 'usd'
    },
    status: {
        type: String,
        enum: ['completed', 'failed', 'pending'],
        default: 'completed'
    },
    paymentId: { // ID from the payment processor like Stripe
        type: String,
        required: true
    },
    details: {
        type: { type: String }, // e.g., 'tip', 'marketplace_sale'
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketplaceItem' },
        title: { type: String }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);