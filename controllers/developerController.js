const crypto = require('crypto');
const ApiKey = require('../models/apiKeyModel');
const logger = require('../config/logger');

// @desc    Get all API keys
// @route   GET /api/developer/keys
// @access  Private/Admin
exports.getApiKeys = async (req, res, next) => {
    try {
        // Don't send keyHash to the client
        const keys = await ApiKey.find({ owner: req.user._id }).select('-keyHash').sort({ createdAt: -1 });
        res.status(200).json(keys);
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new API key
// @route   POST /api/developer/keys
// @access  Private/Admin
exports.createApiKey = async (req, res, next) => {
    try {
        let apiKey;
        let keyPrefix;
        let isUnique = false;
        
        // Loop to ensure keyPrefix is unique, though collision is highly unlikely
        while (!isUnique) {
            apiKey = `whisspra_sk_${crypto.randomBytes(24).toString('hex')}`;
            keyPrefix = apiKey.substring(0, 19); // e.g., 'whisspra_sk_...'
            const existingKey = await ApiKey.findOne({ keyPrefix });
            if (!existingKey) {
                isUnique = true;
            } else {
                 logger.warn(`API key prefix collision for ${keyPrefix}. Retrying.`);
            }
        }

        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        await ApiKey.create({
            owner: req.user._id,
            keyHash,
            keyPrefix,
        });

        logger.info(`API Key created for user ${req.user.name}`);
        // Send the unhashed key back to the user ONCE.
        res.status(201).json({
            message: 'API Key created successfully. This is the only time you will see the full key.',
            apiKey: apiKey
        });
    } catch (error) {
        next(error); // Pass error to the handler
    }
};


// @desc    Revoke an API key
// @route   DELETE /api/developer/keys/:id
// @access  Private/Admin
exports.revokeApiKey = async (req, res, next) => {
    try {
        const key = await ApiKey.findById(req.params.id);

        if (!key) {
            return res.status(404).json({ message: 'API Key not found.' });
        }
        
        // Middleware already ensures user is admin, so this is an extra check
        // for ownership if you want admins to only revoke their own keys, but
        // for this app, we'll assume admins can manage all keys.

        key.isActive = false;
        await key.save();

        logger.info(`API Key ${key.keyPrefix}... revoked by ${req.user.name}`);

        res.status(200).json({ message: 'API Key successfully revoked.' });
    } catch (error) {
        next(error);
    }
};
