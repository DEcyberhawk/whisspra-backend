
const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    description: {
        type: String,
        required: true,
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    category: {
        type: String,
        enum: ['Study Group', 'Social Club', 'Campus Event', 'Resource Hub'],
        default: 'Social Club'
    },
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Conversation'
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
}, {
    timestamps: true
});

// Ensure member count is updated
communitySchema.pre('save', function(next) {
    if (this.isModified('members')) {
        // This is a simple way, could also be a virtual
    }
    next();
});


module.exports = mongoose.model('Community', communitySchema);