const crypto = require('crypto');
const ApiKey = require('../models/apiKeyModel');
const User = require('../models/userModel');
const logger = require('../config/logger');

const apiKeyAuth = async (req, res, next) => {
    let providedKey;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        providedKey = req.headers.authorization.split(' ')[1];
    }

    if (!providedKey) {
        return res.status(401).json({ success: false, message: 'API Key is required.' });
    }

    try {
        const keyHash = crypto.createHash('sha256').update(providedKey).digest('hex');
        
        const apiKey = await ApiKey.findOne({ keyHash: keyHash });

        if (!apiKey) {
            return res.status(401).json({ success: false, message: 'Invalid API Key.' });
        }

        if (!apiKey.isActive) {
            return res.status(403).json({ success: false, message: 'API Key is disabled.' });
        }

        // Get user from the API key's owner
        req.user = await User.findById(apiKey.owner).select('-password');
        
        if (!req.user) {
            logger.error(`API key ${apiKey._id} has an invalid owner: ${apiKey.owner}`);
            return res.status(401).json({ success: false, message: 'Invalid API Key owner.' });
        }
        
        // Update usage statistics asynchronously
        ApiKey.updateOne(
            { _id: apiKey._id },
            { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }
        ).catch(err => logger.error(`Failed to update API key usage stats for key ${apiKey._id}`, err));

        next();
    } catch (error) {
        logger.error('API Key authentication error', { error: error.message });
        res.status(500).json({ success: false, message: 'Server error during API Key authentication.' });
    }
};

module.exports = { apiKeyAuth };
