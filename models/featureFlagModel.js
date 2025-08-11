const mongoose = require('mongoose');

const featureFlagSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        description: "The programmatic name of the feature (e.g., 'LiveStage')."
    },
    description: {
        type: String,
        required: true,
        description: "A user-friendly description of what the feature does."
    },
    isEnabled: {
        type: Boolean,
        default: false,
        description: "Whether the feature is globally enabled or not."
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('FeatureFlag', featureFlagSchema);