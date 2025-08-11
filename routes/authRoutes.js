
const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getMe,
    createAnonymousUser,
    generateTwoFactorSecret,
    verifyTwoFactorSetup,
    verifyTwoFactorLogin,
    disableTwoFactor
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/anonymous', createAnonymousUser);
router.get('/me', protect, getMe);

// 2FA Routes
router.post('/2fa/generate', protect, generateTwoFactorSecret);
router.post('/2fa/verify-setup', protect, verifyTwoFactorSetup);
router.post('/2fa/verify-login', protect, verifyTwoFactorLogin);
router.post('/2fa/disable', protect, disableTwoFactor);


module.exports = router;