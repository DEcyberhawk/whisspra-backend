
const express = require('express');
const router = express.Router();
const { getStorefront } = require('../controllers/storefrontController');

// @desc    Get public storefront data for a creator
// @route   GET /api/store/:userId
// @access  Public
router.get('/:userId', getStorefront);

module.exports = router;
