
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    isGroup: {
        type: Boolean,
        default: false
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isCognitive: {
        type: Boolean,
        default: false,
    },
    isRoleplayRoom: {
        type: Boolean,
        default: false
    },
    roleplaySettings: {
        scenario: String,
        characterRoles: [{
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            characterName: String
        }]
    },
    isWhisperThread: {
        type: Boolean,
        default: false,
    },
    parentConversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation'
    },
    isCommunityChat: {
        type: Boolean,
        default: false,
    },
    communityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Community'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Conversation', conversationSchema);