
const mongoose = require('mongoose');

// @desc    Get system health status
// @route   GET /api/system/health
// @access  Public
exports.getHealth = (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    const uptime = (Date.now() - global.START_TIME) / 1000; // in seconds

    res.status(200).json({
        success: true,
        status: 'OK',
        database: dbStatus,
        uptime: `${uptime.toFixed(2)} seconds`,
    });
};
