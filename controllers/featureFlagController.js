const FeatureFlag = require('../models/featureFlagModel');
const logger = require('../config/logger');

// @desc    Get all feature flags (for admin)
// @route   GET /api/admin/features
// @access  Private/Admin
exports.getFeatureFlagsAdmin = async (req, res, next) => {
    try {
        const features = await FeatureFlag.find({}).sort({ name: 1 });
        res.status(200).json(features);
    } catch (error) {
        next(error);
    }
};

// @desc    Update a feature flag
// @route   PUT /api/admin/features/:id
// @access  Private/Admin
exports.updateFeatureFlag = async (req, res, next) => {
    try {
        const { isEnabled } = req.body;
        const feature = await FeatureFlag.findById(req.params.id);

        if (!feature) {
            res.status(404);
            return next(new Error('Feature flag not found.'));
        }

        feature.isEnabled = isEnabled;
        await feature.save();

        logger.info(`Feature flag '${feature.name}' updated to ${isEnabled} by ${req.user.name}`);
        res.status(200).json(feature);
    } catch (error) {
        next(error);
    }
};

// @desc    Get all feature flags (for public/clients)
// @route   GET /api/settings/features
// @access  Public
exports.getFeatureFlagsPublic = async (req, res, next) => {
    try {
        const features = await FeatureFlag.find({}).select('name isEnabled');
        res.status(200).json(features);
    } catch (error) {
        next(error);
    }
};
