
const { admin } = require('./authMiddleware');

exports.checkMaintenanceMode = (req, res, next) => {
    // Allow admin users and health checks to bypass maintenance mode
    const isAdminRoute = req.path.startsWith('/api/admin');
    const isHealthCheck = req.path === '/api/system/health';

    if (global.MAINTENANCE_MODE && !isHealthCheck) {
        // A bit of a workaround to see if the user is an admin without fully protecting the route here
        // A better solution might involve more complex middleware ordering
        if (isAdminRoute) {
            return next();
        }
        return res.status(503).json({ 
            success: false, 
            message: 'Service is temporarily unavailable due to maintenance.' 
        });
    }
    next();
};
