

const express = require('express');
const router = express.Router();
const {
    getUsers,
    getActivityLogs,
    toggleMaintenanceMode,
    getStats,
    updateUserRole,
    getFlaggedContent,
    moderateFlaggedContent,
    getTransactions,
    getPendingVerifications,
    processVerificationRequest
} = require('../controllers/adminController');
const { updateSettings } = require('../controllers/settingsController');
const { protect, admin } = require('../middleware/authMiddleware');
const { getFeatureFlagsAdmin, updateFeatureFlag } = require('../controllers/featureFlagController');

// All routes in this file are protected and require admin access
router.use(protect, admin);

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', getUsers);

// @desc    Update a user's role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
router.put('/users/:id/role', updateUserRole);

// @desc    Get all activity logs
// @route   GET /api/admin/logs
// @access  Private/Admin
router.get('/logs', getActivityLogs);

// @desc    Get all flagged content
// @route   GET /api/admin/reports/flagged
// @access  Private/Admin
router.get('/reports/flagged', getFlaggedContent);

// @desc    Moderate flagged content
// @route   POST /api/admin/reports/flagged/:id
// @access  Private/Admin
router.post('/reports/flagged/:id', moderateFlaggedContent);

// @desc    Get platform statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
router.get('/stats', getStats);

// @desc    Get recent transactions
// @route   GET /api/admin/transactions
// @access  Private/Admin
router.get('/transactions', getTransactions);

// @desc    Get pending verification requests
// @route   GET /api/admin/verifications/pending
// @access  Private/Admin
router.get('/verifications/pending', getPendingVerifications);

// @desc    Process a verification request
// @route   POST /api/admin/verifications/:userId
// @access  Private/Admin
router.post('/verifications/:userId', processVerificationRequest);

// @desc    Toggle maintenance mode
// @route   POST /api/admin/maintenance
// @access  Private/Admin
router.post('/maintenance', toggleMaintenanceMode);

// @desc    Update application settings
// @route   PUT /api/admin/settings
// @access  Private/Admin
router.put('/settings', updateSettings);

// @desc    Feature Flag Management
// @route   GET /api/admin/features
// @access  Private/Admin
router.get('/features', getFeatureFlagsAdmin);

// @desc    Update a feature flag
// @route   PUT /api/admin/features/:id
// @access  Private/Admin
router.put('/features/:id', updateFeatureFlag);


module.exports = router;