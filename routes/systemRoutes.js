
const express = require('express');
const router = express.Router();
const { getHealth } = require('../controllers/systemController');

// @desc    Get system health status
// @route   GET /api/system/health
// @access  Public
router.get('/health', getHealth);

module.exports = router;
