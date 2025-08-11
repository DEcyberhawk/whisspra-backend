

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Conversation'
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    content: {
        type: String,
        required: true,
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'audio', 'document', 'capsule', 'system'],
        default: 'text'
    },
    duration: {
        type: Number, // for audio messages
    },
    fileName: {
        type: String, // for document messages
    },
    fileSize: {
        type: Number, // for document messages in bytes
    },
    releaseAt: { // for capsule messages
        type: Date,
    },
    readStatus: {
        type: String,
        enum: ['sent', 'delivered', 'glimpsed', 'read'],
        default: 'sent'
    },
    readAt: {
        type: Date,
    },
    detectedLanguage: { // ISO 639-1 code
        type: String,
    },
    translations: { // Map of language code to translated text
        type: Map,
        of: String,
    },
    safetyAnalysis: {
        status: { type: String, enum: ['pending', 'safe', 'warning'], default: 'safe' },
        type: { type: String, enum: ['deepfake', 'scam_link'] },
        reason: { type: String }
    },
    relatedConversationId: { // For system messages linking to whisper threads
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation'
    },
    systemMetadata: {
        participants: [{ type: String }]
    },
    adminAction: {
        action: { type: String, enum: ['dismissed', 'deleted'] },
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date }
    },
    deliveryMethod: {
        type: String,
        enum: ['server', 'p2p', 'mesh'],
        default: 'server'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);