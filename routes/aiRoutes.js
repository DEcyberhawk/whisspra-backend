

const express = require('express');
const router = express.Router();
const { getRoomSummary, askRoomMemory, trainAiTwin, getAiTwinReplySuggestion, getRoleplayPrompt, generateContract, translateTextMessage, generateAvatar, transcribeAudioChunk, generateSuggestions, generateSummary, generateVibeReplies, translateText } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');
const audioUpload = require('../middleware/audioUploadMiddleware');

router.use(protect);

// --- New Secure AI Routes ---
router.post('/suggestions', generateSuggestions);
router.post('/summary', generateSummary);
router.post('/vibe-replies', generateVibeReplies);
router.post('/translate', translateText);


// C-Room Routes
router.post('/:conversationId/summary', getRoomSummary);
router.post('/:conversationId/ask', askRoomMemory);

// AI Twin Routes
router.post('/twin/train', trainAiTwin);
router.post('/twin/:conversationId/suggest', getAiTwinReplySuggestion);

// Roleplay Room Route
router.post('/:conversationId/roleplay-prompt', getRoleplayPrompt);

// Contract Generator Route
router.post('/:conversationId/generate-contract', generateContract);

// Mood Translator Route
router.post('/text-mood', translateTextMessage);

// Avatar Generator Route
router.post('/generate-avatar', generateAvatar);

// Voice Room Transcription
router.post('/transcribe-audio', audioUpload.single('file'), transcribeAudioChunk);


module.exports = router;
