
const express = require('express');
const router = express.Router();
const {
    getApiKeys,
    createApiKey,
    revokeApiKey
} = require('../controllers/developerController');
const { protect, admin } = require('../middleware/authMiddleware');

// All routes here are for admins only
router.use(protect, admin);

router.route('/keys')
    .get(getApiKeys)
    .post(createApiKey);

router.route('/keys/:id')
    .delete(revokeApiKey);

module.exports = router;
