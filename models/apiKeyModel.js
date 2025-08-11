
const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
    keyHash: {
        type: String,
        required: true,
        unique: true,
    },
    keyPrefix: {
        type: String,
        required: true,
        unique: true,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    permissions: [{
        type: String,
        default: ['read:all']
    }],
    usageCount: {
        type: Number,
        default: 0
    },
    lastUsedAt: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ApiKey', apiKeySchema);
