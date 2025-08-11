
const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
    },
    fileUrl: {
        type: String,
        required: true,
    },
    fileName: {
        type: String,
        required: true,
    },
    fileType: {
        type: String,
        enum: ['document', 'video', 'image'],
        required: true,
    },
    uploader: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    community: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Community'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Resource', resourceSchema);
