

const express = require('express');
const router = express.Router();
const { getConversations, getMessages, accessConversation, updateGroup, startWhisperThread } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
    .get(getConversations)
    .post(accessConversation);

router.get('/:conversationId/messages', getMessages);

router.put('/:conversationId/group', updateGroup);

router.post('/:conversationId/whisper', startWhisperThread);


module.exports = router;
