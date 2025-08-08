
const multer = require('multer');
const path = require('path');
const logger = require('../config/logger');

// Set storage engine
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Check file type
function checkFileType(file, cb) {
    // Allowed extensions and mimetypes
    const allowedExts = /jpeg|jpg|png|gif|mp3|wav|webm|ogg|pdf|doc|docx/;
    const allowedMimes = /image|audio|pdf|msword|vnd.openxmlformats-officedocument.wordprocessingml.document/;

    // Check extension and mime type
    const extname = allowedExts.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        logger.warn('File upload blocked: Invalid file type', { mimetype: file.mimetype, originalname: file.originalname });
        cb(new Error('Error: Invalid file type! Only images, audio, and documents are allowed.'));
    }
}

// Init upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 10000000 }, // 10MB limit
    fileFilter: function(req, file, cb) {
        checkFileType(file, cb);
    }
}).single('file'); // 'file' is the field name from the frontend form

module.exports = upload;