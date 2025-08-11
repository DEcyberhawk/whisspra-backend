
const { GoogleGenAI, Type } = require('@google/genai');
const Message = require('../models/messageModel');
const Conversation = require('../models/conversationModel');
const StudyTask = require('../models/studyTaskModel');
const FlashcardDeck = require('../models/flashcardDeckModel');
const Flashcard = require('../models/flashcardModel');
const Notice = require('../models/noticeModel');
const Resource = require('../models/resourceModel');
const Community = require('../models/communityModel');
const User = require('../models/userModel');
const logger = require('../config/logger');

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getChatHistoryForAI = async (conversationId, limit = 20) => {
    const messages = await Message.find({ conversationId, messageType: 'text' })
        .populate('senderId', 'name')
        .sort({ createdAt: -1 })
        .limit(limit);
    return messages.reverse().map(msg => `${msg.senderId.name}: ${msg.content}`).join('\n');
};

exports.getQuizQuestions = async (req, res, next) => {
    const { conversationId } = req.body;
    try {
        const history = await getChatHistoryForAI(conversationId);
        if (history.length < 100) return res.status(400).json({ message: "Not enough conversation history for a quiz." });

        const prompt = `Based on the following study group conversation, create a JSON array of 3 multiple-choice quiz questions. Each question should be an object with "question", an array of "options", and the "answer" text.
        
        Conversation:
        ${history}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            answer: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        res.status(200).json(JSON.parse(response.text.trim()));
    } catch (error) {
        next(error);
    }
};

exports.getExplanation = async (req, res, next) => {
    const { conversationId, concept } = req.body;
    try {
        const history = await getChatHistoryForAI(conversationId);
        const prompt = `Using the context from the following conversation, explain the concept of "${concept}" in a clear and simple way, suitable for a student.

        Conversation Context:
        ${history}
        
        Explanation of "${concept}":`;

        const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
        res.status(200).json({ explanation: response.text });
    } catch (error) {
        next(error);
    }
};

// Study Planner
exports.getStudyTasks = async (req, res, next) => {
    try {
        const tasks = await StudyTask.find({ conversationId: req.params.conversationId }).sort('dueDate');
        res.status(200).json(tasks);
    } catch (error) {
        next(error);
    }
};

exports.createStudyTask = async (req, res, next) => {
    try {
        const { title, dueDate } = req.body;
        const task = await StudyTask.create({
            title,
            dueDate,
            createdBy: req.user._id,
            conversationId: req.params.conversationId
        });
        res.status(201).json(task);
    } catch (error) {
        next(error);
    }
};

exports.updateStudyTask = async (req, res, next) => {
    try {
        const task = await StudyTask.findById(req.params.taskId);
        if (!task) return res.status(404).json({ message: 'Task not found' });
        
        task.isCompleted = req.body.isCompleted;
        await task.save();
        res.status(200).json(task);
    } catch (error) {
        next(error);
    }
};

// Flashcards
exports.getFlashcardDecks = async (req, res, next) => {
    try {
        const decks = await FlashcardDeck.find({ conversationId: req.params.conversationId }).populate('cards');
        res.status(200).json(decks);
    } catch (error) { next(error); }
};

exports.createFlashcardDeck = async (req, res, next) => {
    try {
        const { name } = req.body;
        const deck = await FlashcardDeck.create({ name, conversationId: req.params.conversationId });
        res.status(201).json(deck);
    } catch (error) { next(error); }
};

exports.addFlashcard = async (req, res, next) => {
    try {
        const { front, back } = req.body;
        const deck = await FlashcardDeck.findById(req.params.deckId);
        if (!deck) return res.status(404).json({ message: "Deck not found" });

        const card = await Flashcard.create({ deck: deck._id, front, back });
        deck.cards.push(card._id);
        await deck.save();
        res.status(201).json(card);
    } catch (error) { next(error); }
};

// Noticeboard
exports.getNotices = async (req, res, next) => {
    try {
        const notices = await Notice.find({}).populate('author', 'name').sort({ createdAt: -1 });
        res.status(200).json(notices);
    } catch (error) { next(error); }
};

exports.createNotice = async (req, res, next) => {
    try {
        const { title, content, category } = req.body;
        const notice = await Notice.create({ title, content, category, author: req.user._id });
        res.status(201).json(notice);
    } catch (error) { next(error); }
};

// Resource Exchange & Lectures
exports.getCommunityResources = async (req, res, next) => {
    try {
        const resources = await Resource.find({ community: req.params.communityId }).populate('uploader', 'name').sort({ createdAt: -1 });
        res.status(200).json(resources);
    } catch (error) { next(error); }
};

exports.createCommunityResource = async (req, res, next) => {
    try {
        const { title, description } = req.body;
        if (!req.file) return res.status(400).json({ message: 'File is required' });

        const fileType = req.file.mimetype.startsWith('video') ? 'video' : (req.file.mimetype.startsWith('image') ? 'image' : 'document');

        const resource = await Resource.create({
            title,
            description,
            fileUrl: `/${req.file.path}`.replace(/\\/g, "/"),
            fileName: req.file.originalname,
            fileType,
            uploader: req.user._id,
            community: req.params.communityId
        });
        res.status(201).json(resource);
    } catch (error) { next(error); }
};

// Smart Feed
exports.getSmartFeed = async (req, res, next) => {
    try {
        const user = req.user;
        let recommendedCommunities = [];
        if (user.academicProfile && user.academicProfile.subjects && user.academicProfile.subjects.length > 0) {
            const subjectsRegex = new RegExp(user.academicProfile.subjects.join('|'), 'i');
            recommendedCommunities = await Community.find({
                _id: { $nin: user.communities }, // Don't recommend communities user is already in
                $or: [
                    { name: { $regex: subjectsRegex } },
                    { description: { $regex: subjectsRegex } }
                ]
            }).limit(5).populate('creator', 'name');
        } else {
            // Fallback for users with no subjects
            recommendedCommunities = await Community.find({
                 _id: { $nin: user.communities }
            }).sort({ memberCount: -1 }).limit(5).populate('creator', 'name');
        }

        const relevantNotices = await Notice.find({}).sort({ createdAt: -1 }).limit(3).populate('author', 'name');
        
        const feed = {
            recommendedCommunities: recommendedCommunities.map(c => ({...c.toObject(), memberCount: c.members.length })),
            relevantNotices
        };
        
        res.status(200).json(feed);
    } catch (error) { next(error); }
};

// @desc    Get AI-powered study buddy matches
// @route   GET /api/edu/vibe-matches
// @access  Private
exports.getVibeMatches = async (req, res, next) => {
    try {
        // In a real app, this would involve a complex AI query to Gemini
        // comparing study profiles. For now, we'll simulate it.
        const otherStudents = await User.find({
            _id: { $ne: req.user._id },
            'academicProfile.status': 'Student' // Find other students
        }).limit(10);

        const matches = otherStudents.map(student => ({
            user: student,
            vibeScore: Math.floor(Math.random() * (98 - 70 + 1) + 70), // Random score between 70-98%
        }));
        
        res.status(200).json(matches);

    } catch (error) {
        next(error);
    }
};
