const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');

const authRoutes          = require('./routes/auth.routes');
const servicesRoutes      = require('./routes/services.routes');
const bookingsRoutes      = require('./routes/bookings.routes');
const ratingsRoutes       = require('./routes/ratings.routes');
const notificationsRoutes = require('./routes/notifications.routes');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: '🔧 HomeFix API is running!', version: '1.0.0' });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/services',      servicesRoutes);
app.use('/api/bookings',      bookingsRoutes);
app.use('/api/ratings',       ratingsRoutes);
app.use('/api/notifications', notificationsRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;