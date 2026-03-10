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
// POST /api/ratings
// Body: { bookingId, rating (1-5), comment }
// Only allowed after booking status is 'completed'
// ─────────────────────────────────────────────────────────────────────────────
const submitRating = async (req, res) => {
  try {
    const { uid } = req.user;
    const { bookingId, rating, comment } = req.body;

    if (!bookingId || !rating) {
      return res.status(400).json({ error: 'bookingId and rating are required' });
    }
    if (Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }

    // Validate booking
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) return res.status(404).json({ error: 'Booking not found' });

    const booking = bookingDoc.data();

    if (booking.customerId !== uid) {
      return res.status(403).json({ error: 'Only the customer who booked can submit a rating' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ error: 'You can only rate a completed booking' });
    }

    // Prevent duplicate ratings — use bookingId as the rating document ID
    const existingRating = await db.collection('ratings').doc(bookingId).get();
    if (existingRating.exists) {
      return res.status(409).json({ error: 'You have already rated this booking' });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Save rating
    await db.collection('ratings').doc(bookingId).set({
      ratingId:    bookingId,
      bookingId,
      customerId:  uid,
      customerName: booking.customerName,
      providerId:  booking.providerId,
      serviceId:   booking.serviceId,
      serviceName: booking.serviceName,
      rating:      Number(rating),
      comment:     comment || '',
      createdAt:   now,
    });

    // Recalculate provider's average rating
    const allRatings = await db.collection('ratings')
      .where('providerId', '==', booking.providerId)
      .get();

    const total      = allRatings.docs.reduce((sum, d) => sum + d.data().rating, 0);
    const average    = parseFloat((total / allRatings.size).toFixed(1));
    const totalCount = allRatings.size;

    await db.collection('users').doc(booking.providerId).update({
      rating:      average,
      reviewCount: totalCount,
    });

    // Also update the service rating
    const serviceRatings = await db.collection('ratings')
      .where('serviceId', '==', booking.serviceId)
      .get();

    const svcTotal = serviceRatings.docs.reduce((sum, d) => sum + d.data().rating, 0);
    const svcAvg   = parseFloat((svcTotal / serviceRatings.size).toFixed(1));

    await db.collection('services').doc(booking.serviceId).update({
      rating:  svcAvg,
      reviews: serviceRatings.size,
    });

    res.status(201).json({ message: 'Rating submitted successfully. Thank you!' });
  } catch (error) {
    console.error('submitRating error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ratings/:providerId
// Used by ProviderCard to show reviews
// ─────────────────────────────────────────────────────────────────────────────
const getProviderRatings = async (req, res) => {
  try {
    const { providerId } = req.params;

    const snapshot = await db.collection('ratings')
      .where('providerId', '==', providerId)
      .orderBy('createdAt', 'desc')
      .get();

    const ratings = snapshot.docs.map(doc => toPlain(doc.data()));
    res.json({ count: ratings.length, ratings });
  } catch (error) {
    console.error('getProviderRatings error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { submitRating, getProviderRatings };