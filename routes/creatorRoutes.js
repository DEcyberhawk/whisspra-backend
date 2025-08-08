
const express = require('express');
const router = express.Router();
const { createTip, getEarnings } = require('../controllers/creatorController');
const { protect, creator } = require('../middleware/authMiddleware');

// @desc    Create a tip for a creator
// @route   POST /api/creators/tip
// @access  Private (any authenticated user can tip)
router.post('/tip', protect, createTip);

// @desc    Get earnings for the logged-in creator
// @route   GET /api/creators/earnings
// @access  Private/Creator
router.get('/earnings', protect, creator, getEarnings);

module.exports = router;