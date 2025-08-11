const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const academicProfileSchema = new mongoose.Schema({
    institution: { type: String },
    status: { type: String, enum: ['Student', 'Faculty', 'Alumni', 'Staff'] },
    subjects: [{ type: String }],
}, { _id: false });

const studyProfileSchema = new mongoose.Schema({
    studyHabits: [{ type: String }],
    learningGoals: { type: String },
    availability: { type: String },
}, { _id: false });

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        unique: true,
        sparse: true, // Allows multiple null values for anonymous users
    },
    password: {
        type: String,
        select: false // Exclude by default
    },
    avatar: {
        type: String,
        default: 'A'
    },
    isAnonymous: {
        type: Boolean,
        default: false
    },
    isCreator: {
        type: Boolean,
        default: false
    },
    bio: {
        type: String
    },
    followers: {
        type: Number,
        default: 0
    },
    role: {
        type: String,
        enum: ['user', 'creator', 'admin'],
        default: 'user'
    },
    theme: {
        type: String,
        enum: ['light', 'dark'],
        default: 'dark'
    },
    language: {
        type: String,
        default: 'en', // ISO 639-1 code
    },
    lastSeen: {
        type: Date
    },
    purchasedItems: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketplaceItem'
    }],
    aiTwinStyleProfile: {
        type: String
    },
    aiTwinLastTrained: {
        type: Date
    },
    isAiTwinAutoReplyEnabled: {
        type: Boolean,
        default: false,
    },
    isTwoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: {
        type: String,
        select: false // Always exclude from queries
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationStatus: {
        type: String,
        enum: ['none', 'pending', 'verified', 'rejected'],
        default: 'none'
    },
    academicProfile: academicProfileSchema,
    studyProfile: studyProfileSchema,
    presence: {
        status: {
            type: String,
            enum: ['online', 'away', 'busy', 'driving', 'sleeping'],
            default: 'online'
        },
        message: { type: String }
    },
    currency: {
        type: String,
        default: 'usd', // Default to USD, creators can change this
    },
    storefrontSettings: {
        bannerUrl: { type: String },
        socialLinks: {
            twitter: { type: String },
            instagram: { type: String },
            website: { type: String }
        }
    },
    whisprTokenBalance: {
        type: Number,
        default: 0
    },
}, {
    timestamps: true
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password') || !this.password) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.matchPassword = async function(enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);