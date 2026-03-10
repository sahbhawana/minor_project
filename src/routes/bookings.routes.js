const express = require('express');
const router  = express.Router();
const {
  createBooking,
  getBookingById,
  getMyBookings,
  updateBookingStatus,
  updatePaymentStatus,
} = require('../controllers/bookings.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// All booking routes require a logged-in user
router.use(verifyToken);

// POST   /api/bookings              — customer creates a booking (clicks "Book Now")
router.post('/', createBooking);

// GET    /api/bookings/my           — get current user's bookings
//        ?role=customer  → bookings the user made
//        ?role=provider  → bookings assigned to this provider
router.get('/my', getMyBookings);

// GET    /api/bookings/:bookingId   — single booking detail
router.get('/:bookingId', getBookingById);

// PATCH  /api/bookings/:bookingId/status
// Body: { status: 'confirmed'|'in_progress'|'completed'|'cancelled' }
router.patch('/:bookingId/status', updateBookingStatus);

// PATCH  /api/bookings/:bookingId/payment
// Body: { paymentStatus: 'payment_pending'|'payment_accepted'|'payment_failed' }
router.patch('/:bookingId/payment', updatePaymentStatus);

module.exports = router;