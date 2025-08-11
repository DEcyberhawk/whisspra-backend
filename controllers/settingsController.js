const Settings = require('../models/settingsModel');
const logger = require('../config/logger');

// @desc    Get application settings
// @route   GET /api/settings
// @access  Public
exports.getSettings = async (req, res, next) => {
    try {
        const settings = await Settings.findOne({});
        if (settings) {
            res.status(200).json(settings);
        } else {
            // Return default settings if none are in the DB
            res.status(200).json({
                logoUrl: null,
                primaryColor: '#6366f1',
                accentColor: '#818cf8',
                companyName: 'Whisspra Inc.',
                contactEmail: '',
                contactPhone: '',
                address: '',
                aboutUs: 'Whisspra is a secure, next-generation chat platform supporting anonymous messaging, whistleblower mode, and creator monetization.',
                founderName: 'Max Collins Botchway',
                founderInfo: 'Founder of Whisspra, dedicated to privacy and secure communication for all.',
                founderContact: '+49017635228757',
            });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Update application settings
// @route   PUT /api/admin/settings
// @access  Private/Admin
exports.updateSettings = async (req, res, next) => {
    try {
        const { logoUrl, primaryColor, accentColor, companyName, contactEmail, contactPhone, address, aboutUs, founderName, founderInfo, founderContact } = req.body;
        
        const settings = await Settings.findOneAndUpdate(
            {}, // find one
            { $set: { logoUrl, primaryColor, accentColor, companyName, contactEmail, contactPhone, address, aboutUs, founderName, founderInfo, founderContact } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        logger.info(`Application settings updated by ${req.user.name}`);
        res.status(200).json(settings);
    } catch (error) {
        next(error);
    }
};
