const { db, admin } = require('../config/firebase');

const toPlain = (data) => {
  if (!data) return data;
  const result = { ...data };
  for (const key of Object.keys(result)) {
    if (result[key] && typeof result[key].toDate === 'function') {
      result[key] = result[key].toDate().toISOString();
    }
  }
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications
// Returns the last 30 notifications for the logged-in user
// ─────────────────────────────────────────────────────────────────────────────
const getMyNotifications = async (req, res) => {
  try {
    const { uid } = req.user;

    const snapshot = await db.collection('notifications')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();

    const notifications = snapshot.docs.map(doc => ({
      notificationId: doc.id,
      ...toPlain(doc.data()),
    }));

    const unreadCount = notifications.filter(n => !n.isRead).length;

    res.json({ unreadCount, count: notifications.length, notifications });
  } catch (error) {
    console.error('getMyNotifications error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/:notifId
// ─────────────────────────────────────────────────────────────────────────────
const markAsRead = async (req, res) => {
  try {
    const { notifId } = req.params;

    const doc = await db.collection('notifications').doc(notifId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Notification not found' });
    if (doc.data().userId !== req.user.uid) {
      return res.status(403).json({ error: 'Not your notification' });
    }

    await db.collection('notifications').doc(notifId).update({ isRead: true });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('markAsRead error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications  (mark ALL as read)
// ─────────────────────────────────────────────────────────────────────────────
const markAllAsRead = async (req, res) => {
  try {
    const { uid } = req.user;

    const snapshot = await db.collection('notifications')
      .where('userId', '==', uid)
      .where('isRead', '==', false)
      .get();

    // Batch update for efficiency
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { isRead: true });
    });
    await batch.commit();

    res.json({ message: `Marked ${snapshot.size} notifications as read` });
  } catch (error) {
    console.error('markAllAsRead error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getMyNotifications, markAsRead, markAllAsRead };