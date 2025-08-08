

const express = require('express');
const router = express.Router();
const { updateUserProfile, getUsers, submitForVerification, updateUserPresence } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// This route is protected, so only a logged-in user can update their own profile.
router.put('/profile', protect, updateUserProfile);
router.put('/presence', protect, updateUserPresence);
router.get('/', protect, getUsers);
router.post('/verification/submit', protect, submitForVerification);

module.exports = router;