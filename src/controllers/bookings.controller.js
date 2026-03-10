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
// POST /api/bookings
// Called when user clicks "Book Now" on any service card
// Body: { serviceId, providerId, scheduledDate, scheduledTime, address, notes }
// ─────────────────────────────────────────────────────────────────────────────
const createBooking = async (req, res) => {
  try {
    const { uid } = req.user;
    const { serviceId, providerId, scheduledDate, scheduledTime, address, notes } = req.body;

    if (!serviceId || !providerId || !scheduledDate || !scheduledTime || !address) {
      return res.status(400).json({
        error: 'serviceId, providerId, scheduledDate, scheduledTime, and address are required',
      });
    }

    // Fetch service details
    const serviceDoc = await db.collection('services').doc(serviceId).get();
    if (!serviceDoc.exists) return res.status(404).json({ error: 'Service not found' });
    const service = serviceDoc.data();

    // Fetch customer details
    const customerDoc = await db.collection('users').doc(uid).get();
    if (!customerDoc.exists) return res.status(404).json({ error: 'Customer profile not found. Please register first.' });
    const customer = customerDoc.data();

    // Fetch provider details
    const providerDoc = await db.collection('users').doc(providerId).get();
    if (!providerDoc.exists) return res.status(404).json({ error: 'Provider not found' });
    const provider = providerDoc.data();

    const now = admin.firestore.FieldValue.serverTimestamp();

    const bookingData = {
      customerId:      uid,
      customerName:    customer.fullName,
      customerPhone:   customer.phone || '',
      customerEmail:   customer.email,

      providerId,
      providerName:    provider.fullName,

      serviceId,
      serviceName:     service.name,
      serviceCategory: service.category,
      serviceImage:    service.image || '',

      scheduledDate,            // 'YYYY-MM-DD'
      scheduledTime,            // 'HH:MM'
      address,
      notes: notes || '',

      totalAmount:   service.price,

      // Booking lifecycle
      status: 'pending',
      // 'pending'     → waiting for provider to confirm
      // 'confirmed'   → provider accepted
      // 'in_progress' → provider is working
      // 'completed'   → job done
      // 'cancelled'   → cancelled

      // Payment lifecycle (no real payment — just status tracking)
      paymentStatus: 'payment_pending',
      // 'payment_pending'  → not yet paid
      // 'payment_accepted' → confirmed as paid
      // 'payment_failed'   → payment attempt failed

      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('bookings').add(bookingData);
    await docRef.update({ bookingId: docRef.id });

    // Notify the provider about the new booking
    await db.collection('notifications').add({
      userId:    providerId,
      title:     '🔔 New Booking Request!',
      body:      `${customer.fullName} booked ${service.name} on ${scheduledDate} at ${scheduledTime}`,
      type:      'new_booking',
      relatedId: docRef.id,
      isRead:    false,
      createdAt: now,
    });

    res.status(201).json({
      message:   'Booking created successfully',
      bookingId: docRef.id,
    });
  } catch (error) {
    console.error('createBooking error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bookings/my?role=customer  OR  ?role=provider
// ─────────────────────────────────────────────────────────────────────────────
const getMyBookings = async (req, res) => {
  try {
    const { uid } = req.user;
    const { role } = req.query;

    const filterField = role === 'provider' ? 'providerId' : 'customerId';

    const snapshot = await db.collection('bookings')
      .where(filterField, '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    const bookings = snapshot.docs.map(doc => toPlain(doc.data()));
    res.json({ count: bookings.length, bookings });
  } catch (error) {
    console.error('getMyBookings error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bookings/:bookingId
// ─────────────────────────────────────────────────────────────────────────────
const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const doc = await db.collection('bookings').doc(bookingId).get();

    if (!doc.exists) return res.status(404).json({ error: 'Booking not found' });

    const booking = toPlain(doc.data());

    // Security: only the customer or provider of this booking can view it
    if (booking.customerId !== req.user.uid && booking.providerId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ booking });
  } catch (error) {
    console.error('getBookingById error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/bookings/:bookingId/status
// Body: { status: 'confirmed'|'in_progress'|'completed'|'cancelled' }
// ─────────────────────────────────────────────────────────────────────────────
const updateBookingStatus = async (req, res) => {
  try {
    const { uid } = req.user;
    const { bookingId } = req.params;
    const { status } = req.body;

    const validStatuses = ['confirmed', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const doc = await db.collection('bookings').doc(bookingId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Booking not found' });

    const booking = doc.data();
    if (booking.customerId !== uid && booking.providerId !== uid) {
      return res.status(403).json({ error: 'Not authorized to update this booking' });
    }

    await db.collection('bookings').doc(bookingId).update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify the other party
    const notifyUid = uid === booking.providerId ? booking.customerId : booking.providerId;
    const statusMessages = {
      confirmed:   `Your booking for ${booking.serviceName} has been confirmed! ✅`,
      in_progress: `${booking.providerName} has started working on ${booking.serviceName} 🔧`,
      completed:   `${booking.serviceName} has been completed. Please leave a review! ⭐`,
      cancelled:   `Your booking for ${booking.serviceName} has been cancelled.`,
    };

    await db.collection('notifications').add({
      userId:    notifyUid,
      title:     'Booking Update',
      body:      statusMessages[status],
      type:      `booking_${status}`,
      relatedId: bookingId,
      isRead:    false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: `Booking status updated to '${status}'` });
  } catch (error) {
    console.error('updateBookingStatus error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/bookings/:bookingId/payment
// Body: { paymentStatus: 'payment_pending'|'payment_accepted'|'payment_failed' }
// ─────────────────────────────────────────────────────────────────────────────
const updatePaymentStatus = async (req, res) => {
  try {
    const { uid } = req.user;
    const { bookingId } = req.params;
    const { paymentStatus } = req.body;

    const validStatuses = ['payment_pending', 'payment_accepted', 'payment_failed'];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        error: `paymentStatus must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const doc = await db.collection('bookings').doc(bookingId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Booking not found' });

    const booking = doc.data();
    if (booking.customerId !== uid && booking.providerId !== uid) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.collection('bookings').doc(bookingId).update({
      paymentStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify customer about payment status
    await db.collection('notifications').add({
      userId:    booking.customerId,
      title:     'Payment Status Update',
      body:      `Payment for ${booking.serviceName}: ${paymentStatus.replace(/_/g, ' ')}`,
      type:      paymentStatus,
      relatedId: bookingId,
      isRead:    false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: `Payment status updated to '${paymentStatus}'` });
  } catch (error) {
    console.error('updatePaymentStatus error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  updateBookingStatus,
  updatePaymentStatus,
};