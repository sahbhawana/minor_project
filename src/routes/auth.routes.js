const express = require('express');
const router  = express.Router();
const {
  registerUser,
  getUserProfile,
  updateUserProfile,
  getAllProviders,
} = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// POST /api/auth/register   — called after Firebase signup; saves profile to Firestore
router.post('/register', verifyToken, registerUser);

// GET  /api/auth/profile    — get the logged-in user's profile
router.get('/profile', verifyToken, getUserProfile);

// PUT  /api/auth/profile    — update name, phone, address, fcmToken
router.put('/profile', verifyToken, updateUserProfile);

// GET  /api/auth/providers  — list all service providers (for serviceproviders page)
router.get('/providers', getAllProviders);

module.exports = router;