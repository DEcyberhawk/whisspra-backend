
const mongoose = require('mongoose');

const marketplaceItemSchema = new mongoose.Schema({
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    title: {
        type: String,
        required: [true, 'Please add a title'],
        trim: true,
    },
    description: {
        type: String,
        required: [true, 'Please add a description'],
    },
    price: {
        type: Number,
        required: [true, 'Please set a price'],
        default: 0
    },
    thumbnailUrl: {
        type: String,
        required: [true, 'Please provide a thumbnail image URL']
    },
    assetUrl: {
        type: String,
        required: [true, 'Please provide the asset URL']
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('MarketplaceItem', marketplaceItemSchema);
