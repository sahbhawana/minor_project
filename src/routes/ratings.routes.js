const express = require('express');
const router  = express.Router();
const { submitRating, getProviderRatings } = require('../controllers/ratings.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// POST /api/ratings                  — customer submits a review after job completes
router.post('/', verifyToken, submitRating);

// GET  /api/ratings/:providerId      — get all reviews for a provider (public)
router.get('/:providerId', getProviderRatings);

module.exports = router;