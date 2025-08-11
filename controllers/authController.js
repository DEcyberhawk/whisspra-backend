const User = require('../models/userModel');
const generateToken = require('../utils/generateToken');
const logActivity = require('../utils/logActivity');
const logger = require('../config/logger');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

const handleAuthSuccess = (res, user) => {
    const token = generateToken(user._id);
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.twoFactorSecret;

    res.status(200).json({
        token,
        user: userObject,
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res, next) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        res.status(400);
        return next(new Error('Please provide all fields'));
    }

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            res.status(400);
            return next(new Error('User already exists'));
        }

        const user = await User.create({ name, email, password, avatar: name.charAt(0).toUpperCase() });

        if (user) {
            res.status(201);
            handleAuthSuccess(res, user);
        } else {
            res.status(400);
            return next(new Error('Invalid user data'));
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email }).select('+password +isTwoFactorEnabled');
        if (user && (await user.matchPassword(password))) {
            
            if (user.isTwoFactorEnabled) {
                // Don't send the full auth success response yet.
                // Send an intermediate response indicating 2FA is needed.
                // A temporary token is sent to authorize the next step.
                const tempToken = generateToken(user._id);
                return res.status(200).json({
                    twoFactorRequired: true,
                    tempToken: tempToken,
                });
            }

            await logActivity(user._id, 'USER_LOGIN', null, { ip: req.ip });
            handleAuthSuccess(res, user);
        } else {
            res.status(401);
            return next(new Error('Invalid credentials'));
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Create an anonymous user
// @route   POST /api/auth/anonymous
// @access  Public
exports.createAnonymousUser = async (req, res, next) => {
    try {
        const randomId = Math.random().toString(36).substring(2, 8);
        const user = await User.create({
            name: `User-${randomId}`,
            isAnonymous: true,
            avatar: 'A'
        });

        if (user) {
            res.status(201);
            handleAuthSuccess(res, user);
        } else {
             res.status(400);
            return next(new Error('Could not create anonymous user'));
        }
    } catch(error) {
        next(error);
    }
};

// @desc    Get current user data
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    res.status(200).json(req.user);
};

// --- 2FA Controllers ---

// @desc    Generate a 2FA secret and QR code for the user
// @route   POST /api/auth/2fa/generate
// @access  Private
exports.generateTwoFactorSecret = async (req, res, next) => {
    try {
        const secret = speakeasy.generateSecret({
            name: `Whisspra (${req.user.email})`
        });

        // Store the temporary secret on the user model without enabling 2FA yet.
        await User.findByIdAndUpdate(req.user._id, { twoFactorSecret: secret.base32 });

        qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
            if (err) {
                return next(new Error('Could not generate QR code.'));
            }
            res.status(200).json({
                secret: secret.base32, // for manual entry
                qrCodeUrl: data_url
            });
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Verify a 2FA token and enable 2FA for the user
// @route   POST /api/auth/2fa/verify-setup
// @access  Private
exports.verifyTwoFactorSetup = async (req, res, next) => {
    const { token } = req.body;
    try {
        const user = await User.findById(req.user._id).select('+twoFactorSecret');
        if (!user || !user.twoFactorSecret) {
            return res.status(400).json({ message: '2FA secret not found. Please generate one first.' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token
        });

        if (verified) {
            user.isTwoFactorEnabled = true;
            await user.save();
            res.status(200).json({ success: true, message: '2FA has been enabled.' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid token. Please try again.' });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Verify a 2FA token during login
// @route   POST /api/auth/2fa/verify-login
// @access  Private (uses temporary token from login)
exports.verifyTwoFactorLogin = async (req, res, next) => {
    const { token } = req.body;
    try {
        // req.user is derived from the tempToken via the protect middleware
        const user = await User.findById(req.user._id).select('+twoFactorSecret');

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token
        });

        if (verified) {
            await logActivity(user._id, 'USER_LOGIN', null, { ip: req.ip, twoFactor: true });
            handleAuthSuccess(res, user);
        } else {
            res.status(401).json({ message: 'Invalid 2FA token.' });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Disable 2FA for the user
// @route   POST /api/auth/2fa/disable
// @access  Private
exports.disableTwoFactor = async (req, res, next) => {
    const { password } = req.body;
    try {
        const user = await User.findById(req.user._id).select('+password');
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ message: 'Invalid password.' });
        }

        user.isTwoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        await user.save();

        res.status(200).json({ success: true, message: '2FA has been disabled.' });
    } catch (error) {
        next(error);
    }
};
