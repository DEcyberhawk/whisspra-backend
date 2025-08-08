const express = require('express');
const router = express.Router();
const { getConversations, sendMessage } = require('../../controllers/api_v1/chatApiController');
const { apiKeyAuth } = require('../../middleware/apiKeyAuthMiddleware');

// All routes in this file are protected by API Key authentication
router.use(apiKeyAuth);

router.route('/')
    .get(getConversations);

router.route('/:id/messages')
    .post(sendMessage);

module.exports = router;
