
const express = require('express');
const router = express.Router();
const { getSettings } = require('../controllers/settingsController');
const { getFeatureFlagsPublic } = require('../controllers/featureFlagController');

// @desc    Get application settings
// @route   GET /api/settings
// @access  Public
router.get('/', getSettings);

// @desc    Get all enabled feature flags
// @route   GET /api/settings/features
// @access  Public
router.get('/features', getFeatureFlagsPublic);


module.exports = router;