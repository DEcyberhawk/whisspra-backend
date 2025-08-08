
const ActivityLog = require('../models/activityLogModel');
const logger = require('../config/logger');

/**
 * Logs an activity to the database.
 * @param {string} actorId - The ID of the user performing the action.
 * @param {string} action - The type of action performed.
 * @param {string|null} targetId - The ID of the object being acted upon (e.g., user, chat).
 * @param {object} details - Additional details about the action (e.g., IP address, amount).
 */
const logActivity = async (actorId, action, targetId, details = {}) => {
    try {
        await ActivityLog.create({
            actor: actorId,
            action: action,
            target: targetId,
            details: details,
        });
    } catch (error) {
        logger.error(`Failed to log activity: ${action}`, {
            actorId,
            targetId,
            error: error.message
        });
    }
};

module.exports = logActivity;
