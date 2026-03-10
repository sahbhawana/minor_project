const express = require('express');
const router  = express.Router();
const { getMyNotifications, markAsRead, markAllAsRead } = require('../controllers/notifications.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// All notification routes require login
router.use(verifyToken);

// GET   /api/notifications        — get all notifications for the logged-in user
router.get('/', getMyNotifications);

// PATCH /api/notifications/:id    — mark one notification as read
router.patch('/:notifId', markAsRead);

// PATCH /api/notifications/read-all — mark all notifications as read
router.patch('/', markAllAsRead);

module.exports = router;