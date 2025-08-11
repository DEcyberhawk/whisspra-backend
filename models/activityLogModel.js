
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    actor: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    action: {
        type: String,
        required: true,
        enum: [
            'USER_LOGIN',
            'ADMIN_ACTION_BAN_USER',
            'ADMIN_ACTION_DELETE_CHAT',
            'ADMIN_ACTION_TOGGLE_MAINTENANCE',
            'CREATOR_TIP_RECEIVED',
            'PAYMENT_DISPUTE'
        ]
    },
    target: { // e.g., The user ID that was banned, or the chat ID that was deleted
        type: String,
    },
    details: { // e.g., IP address for login, tip amount
        type: mongoose.Schema.Types.Mixed
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
