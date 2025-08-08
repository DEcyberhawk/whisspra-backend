
const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');
const logger = require('../config/logger');

// @desc    Upload a file
// @route   POST /api/upload
// @access  Private
router.post('/', protect, (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            logger.error('Upload Error:', err);
            return res.status(400).json({ message: err.message });
        }
        if (req.file == undefined) {
            return res.status(400).json({ message: 'No file selected!' });
        }
        
        logger.info(`File uploaded successfully: ${req.file.path}`);
        // Return the path to the file, which the frontend will use.
        res.status(200).json({
            message: 'File uploaded successfully',
            url: `/${req.file.path}`.replace(/\\/g, "/") // Ensure forward slashes
        });
    });
});

module.exports = router;
