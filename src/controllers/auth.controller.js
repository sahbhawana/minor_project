const { db, admin } = require('../config/firebase');

// ── Helper: convert Firestore Timestamps to plain JS dates ───────────────────
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
// POST /api/auth/register
// Body: { fullName, phone, role: 'customer'|'provider', address?, category? }
//
// Called right after Firebase createUserWithEmailAndPassword succeeds in the
// Next.js SignUpPage — saves the extra profile data to Firestore.
// ─────────────────────────────────────────────────────────────────────────────
const registerUser = async (req, res) => {
  try {
    const { uid, email } = req.user;
    const { fullName, phone, role, address, category } = req.body;

    // Validation
    if (!fullName || !role) {
      return res.status(400).json({ error: 'fullName and role are required' });
    }
    if (!['customer', 'provider', 'admin'].includes(role)) {
      return res.status(400).json({ error: "role must be 'customer', 'provider', or 'admin'" });
    }

    // Check if profile already exists
    const existing = await db.collection('users').doc(uid).get();
    if (existing.exists) {
      return res.status(409).json({ error: 'Profile already exists for this user' });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    const userData = {
      uid,
      fullName,           // matches SignUpPage field name
      email,
      phone:       phone    || '',
      role,
      address:     address  || '',
      category:    category || '',   // only for providers: 'plumbing'|'electrical'|'painting'|'beautician'
      profileImage: '',
      isActive:    true,
      isVerified:  false,
      isOnline:    false,
      rating:      0,
      reviewCount: 0,
      completedJobs: 0,
      hourlyRate:  0,
      experience:  0,
      skills:      [],
      bio:         '',
      fcmToken:    '',
      createdAt:   now,
      updatedAt:   now,
    };

    await db.collection('users').doc(uid).set(userData);

    res.status(201).json({
      message: 'User registered successfully',
      uid,
      role,
    });
  } catch (error) {
    console.error('registerUser error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/profile
// ─────────────────────────────────────────────────────────────────────────────
const getUserProfile = async (req, res) => {
  try {
    const { uid } = req.user;
    const doc = await db.collection('users').doc(uid).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Profile not found. Please register first.' });
    }

    res.json({ user: toPlain(doc.data()) });
  } catch (error) {
    console.error('getUserProfile error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/profile
// Body: any subset of { fullName, phone, address, bio, skills, hourlyRate,
//                       experience, category, isOnline, fcmToken }
// ─────────────────────────────────────────────────────────────────────────────
const updateUserProfile = async (req, res) => {
  try {
    const { uid } = req.user;

    const allowedFields = [
      'fullName', 'phone', 'address', 'bio', 'skills',
      'hourlyRate', 'experience', 'category', 'isOnline', 'fcmToken',
    ];

    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    await db.collection('users').doc(uid).update(updates);
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('updateUserProfile error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/providers?category=plumbing
// Returns all users with role='provider' — replaces the static providers-data.ts
// ─────────────────────────────────────────────────────────────────────────────
const getAllProviders = async (req, res) => {
  try {
    const { category } = req.query;

    let query = db.collection('users').where('role', '==', 'provider').where('isActive', '==', true);

    // Filter by category (matches the categories in providers-data.ts)
    if (category && category !== 'all') {
      query = query.where('category', '==', category);
    }

    const snapshot = await query.get();
    const providers = snapshot.docs.map(doc => toPlain(doc.data()));

    res.json({ count: providers.length, providers });
  } catch (error) {
    console.error('getAllProviders error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { registerUser, getUserProfile, updateUserProfile, getAllProviders };