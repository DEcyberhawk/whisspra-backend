
const express = require('express');
const router = express.Router();
const {
    createCommunity,
    getCommunities,
    joinCommunity
} = require('../controllers/communityController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
    .get(getCommunities)
    .post(createCommunity);

router.route('/:id/join').post(joinCommunity);

module.exports = router;