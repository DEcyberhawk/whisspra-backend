
const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);

    logger.error(err.message, { stack: err.stack, path: req.path });

    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = {
    errorHandler
};
