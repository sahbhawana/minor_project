const admin = require('firebase-admin');

// Only initialize once — prevents "app already exists" error
if (!admin.apps.length) {
  const serviceAccount = require('../../serviceAccountKey.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('🔥 Firebase Admin SDK initialized successfully');
}

const db   = admin.firestore();   // Firestore database
const auth = admin.auth();        // Firebase Authentication

// Use ISO timestamps instead of Firestore Timestamps (easier for frontend)
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db, auth };