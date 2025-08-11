
const express = require('express');
const router = express.Router();
const {
    createDreamscape,
    getDreamscapes,
    getDreamscapeDetails,
} = require('../controllers/dreamscapeController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
    .get(getDreamscapes)
    .post(createDreamscape);

router.route('/:id')
    .get(getDreamscapeDetails);

module.exports = router;