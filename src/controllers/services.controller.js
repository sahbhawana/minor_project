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
// GET /api/services
// Returns all services — used on the services listing pages
// ─────────────────────────────────────────────────────────────────────────────
const getAllServices = async (req, res) => {
  try {
    const snapshot = await db.collection('services')
      .where('isAvailable', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    const services = snapshot.docs.map(doc => toPlain(doc.data()));
    res.json({ count: services.length, services });
  } catch (error) {
    console.error('getAllServices error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/services/category/:category
// Used by /services/plumber, /services/electrical, /services/painter,
//         /services/beautician pages to load real data from Firestore
//
// category must be: 'plumbing' | 'electrical' | 'painting' | 'beautician'
// ─────────────────────────────────────────────────────────────────────────────
const getServicesByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const validCategories = ['plumbing', 'electrical', 'painting', 'beautician'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: `category must be one of: ${validCategories.join(', ')}`,
      });
    }

    const snapshot = await db.collection('services')
      .where('category', '==', category)
      .where('isAvailable', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    const services = snapshot.docs.map(doc => toPlain(doc.data()));
    res.json({ count: services.length, services });
  } catch (error) {
    console.error('getServicesByCategory error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/services/:serviceId
// ─────────────────────────────────────────────────────────────────────────────
const getServiceById = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const doc = await db.collection('services').doc(serviceId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json({ service: toPlain(doc.data()) });
  } catch (error) {
    console.error('getServiceById error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/services
// Body matches the plumbingServices shape from plumber/page.tsx:
// { name, description, price, duration, category, image, features }
// ─────────────────────────────────────────────────────────────────────────────
const addService = async (req, res) => {
  try {
    const { uid } = req.user;
    const { name, description, price, duration, category, image, features } = req.body;

    if (!name || !description || !price || !category) {
      return res.status(400).json({ error: 'name, description, price, and category are required' });
    }

    // Verify the user is a provider
    const providerDoc = await db.collection('users').doc(uid).get();
    if (!providerDoc.exists || providerDoc.data().role !== 'provider') {
      return res.status(403).json({ error: 'Only service providers can add services' });
    }

    const provider = providerDoc.data();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const serviceData = {
      name,
      description,
      price:       Number(price),
      duration:    duration || '60 min',
      category,                          // 'plumbing'|'electrical'|'painting'|'beautician'
      image:       image    || '',
      features:    features || [],        // e.g. ["24/7 Availability", "No hidden fees"]
      rating:      0,
      reviews:     0,
      providerId:   uid,
      providerName: provider.fullName,
      isAvailable:  true,
      createdAt:    now,
      updatedAt:    now,
    };

    const docRef = await db.collection('services').add(serviceData);
    await docRef.update({ serviceId: docRef.id });

    res.status(201).json({ message: 'Service added successfully', serviceId: docRef.id });
  } catch (error) {
    console.error('addService error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/services/:serviceId
// ─────────────────────────────────────────────────────────────────────────────
const updateService = async (req, res) => {
  try {
    const { uid } = req.user;
    const { serviceId } = req.params;

    const doc = await db.collection('services').doc(serviceId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Service not found' });
    if (doc.data().providerId !== uid) {
      return res.status(403).json({ error: 'You can only update your own services' });
    }

    const allowed = ['name', 'description', 'price', 'duration', 'image', 'features', 'isAvailable'];
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    await db.collection('services').doc(serviceId).update(updates);
    res.json({ message: 'Service updated successfully' });
  } catch (error) {
    console.error('updateService error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/services/:serviceId
// ─────────────────────────────────────────────────────────────────────────────
const deleteService = async (req, res) => {
  try {
    const { uid } = req.user;
    const { serviceId } = req.params;

    const doc = await db.collection('services').doc(serviceId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Service not found' });
    if (doc.data().providerId !== uid) {
      return res.status(403).json({ error: 'You can only delete your own services' });
    }

    await db.collection('services').doc(serviceId).delete();
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('deleteService error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllServices,
  getServicesByCategory,
  getServiceById,
  addService,
  updateService,
  deleteService,
};