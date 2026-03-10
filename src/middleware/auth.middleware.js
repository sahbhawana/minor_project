const { auth } = require('../config/firebase');

/**
 * Verifies the Firebase ID token sent from the Next.js frontend.
 * The frontend sends it as:  Authorization: Bearer <token>
 *
 * After this middleware runs, req.user = { uid, email }
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided. Send: Authorization: Bearer <token>',
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(token);

    req.user = {
      uid:   decoded.uid,
      email: decoded.email,
    };

    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
};

module.exports = { verifyToken };