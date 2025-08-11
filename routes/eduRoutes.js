
const express = require('express');
const router = express.Router();
const { 
    getQuizQuestions, 
    getExplanation, 
    getStudyTasks, 
    createStudyTask, 
    updateStudyTask,
    getFlashcardDecks,
    createFlashcardDeck,
    addFlashcard,
    getNotices,
    createNotice,
    getCommunityResources,
    createCommunityResource,
    getSmartFeed,
    getVibeMatches
} = require('../controllers/eduController');
const { protect, admin } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');


router.use(protect);

// Smart Feed & Matching
router.get('/feed', getSmartFeed);
router.get('/vibe-matches', getVibeMatches);

// AI Study Tools
router.post('/quiz', getQuizQuestions);
router.post('/explain', getExplanation);

// Study Planner
router.route('/tasks/:conversationId')
    .get(getStudyTasks)
    .post(createStudyTask);
router.put('/tasks/:taskId', updateStudyTask);

// Flashcards
router.route('/flashcards/:conversationId')
    .get(getFlashcardDecks)
    .post(createFlashcardDeck);
router.post('/flashcards/deck/:deckId/card', addFlashcard);

// Noticeboard
router.route('/notices')
    .get(getNotices)
    .post(admin, createNotice); // Only admins can create notices

// Resource Exchange & Lecture Replays
router.route('/communities/:communityId/resources')
    .get(getCommunityResources)
    .post(upload, createCommunityResource);

module.exports = router;
