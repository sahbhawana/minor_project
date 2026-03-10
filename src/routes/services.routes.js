const express = require('express');
const router  = express.Router();
const {
  getAllServices,
  getServiceById,
  getServicesByCategory,
  addService,
  updateService,
  deleteService,
} = require('../controllers/services.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Public routes (no login needed — customers browsing)
// GET /api/services                   — all available services
router.get('/', getAllServices);

// GET /api/services/category/plumbing — filter by category
// Matches the service pages: /services/plumber, /services/electrical, etc.
router.get('/category/:category', getServicesByCategory);

// GET /api/services/:serviceId        — single service detail
router.get('/:serviceId', getServiceById);

// Protected routes (provider must be logged in)
// POST   /api/services                — provider adds a service
router.post('/', verifyToken, addService);

// PUT    /api/services/:serviceId     — provider edits their service
router.put('/:serviceId', verifyToken, updateService);

// DELETE /api/services/:serviceId     — provider removes their service
router.delete('/:serviceId', verifyToken, deleteService);

module.exports = router;