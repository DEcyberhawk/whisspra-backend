
const express = require('express');
const router = express.Router();
const { createItem, getItems, purchaseItem } = require('../controllers/marketplaceController');
const { protect, creator } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getItems)
    .post(protect, creator, createItem);

router.route('/:id/purchase').post(protect, purchaseItem);

module.exports = router;
