
const express = require('express');
const router = express.Router();
const { rewardRelay } = require('../controllers/whisperNetController');
const { protect } = require('../middleware/authMiddleware');

// All routes are protected as they relate to user actions
router.use(protect);

router.post('/relay-success', rewardRelay);

module.exports = router;
