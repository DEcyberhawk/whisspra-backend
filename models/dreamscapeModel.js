
const mongoose = require('mongoose');

const dreamscapeSchema = new mongoose.Schema({
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    prompt: {
        text: { type: String, required: true },
        voiceMemoUrl: { type: String },
        imageUrl: { type: String }
    },
    assetUrl: {
        type: String,
        required: true, // URL to the 360-degree environment file
    },
    soundscapeUrl: {
        type: String, // URL to the ambient audio file
    },
    aiPersonaContext: {
        type: String, // Context for the AI Twin's behavior within this Dreamscape
        required: true,
    },
    isPublic: {
        type: Boolean,
        default: false,
    },
    accessKeys: {
        price: { type: Number, default: 0 },
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Dreamscape', dreamscapeSchema);