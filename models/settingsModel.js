const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    logoUrl: { type: String },
    primaryColor: { type: String, default: '#6366f1' }, // Default: indigo-500
    accentColor: { type: String, default: '#818cf8' }, // Default: indigo-400
    companyName: { type: String, default: 'Whisspra Inc.' },
    contactEmail: { type: String },
    contactPhone: { type: String },
    address: { type: String },
    // New fields
    aboutUs: { type: String },
    founderName: { type: String },
    founderInfo: { type: String },
    founderContact: { type: String },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Settings', settingsSchema);
