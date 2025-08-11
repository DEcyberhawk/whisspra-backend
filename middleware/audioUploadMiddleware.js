
const multer = require('multer');
const logger = require('../config/logger');

// Store audio in memory for processing as a buffer
const storage = multer.memoryStorage();

// Check that the file is an audio type
function checkAudioFileType(file, cb) {
    const allowedMimes = /audio/;
    const mimetype = allowedMimes.test(file.mimetype);

    if (mimetype) {
        return cb(null, true);
    } else {
        logger.warn('Audio upload blocked: Invalid file type', { mimetype: file.mimetype, originalname: file.originalname });
        cb(new Error('Error: Invalid file type! Only audio files are allowed.'));
    }
}

const audioUpload = multer({
    storage: storage,
    limits: { fileSize: 10000000 }, // 10MB limit
    fileFilter: function(req, file, cb) {
        checkAudioFileType(file, cb);
    }
});

module.exports = audioUpload;
