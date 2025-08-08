
const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    content: {
        type: String,
        required: true,
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    category: {
        type: String,
        enum: ['Event', 'News', 'Alert'],
        default: 'News'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Notice', noticeSchema);
