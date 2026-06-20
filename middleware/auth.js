const { query, queryOne, queryAll } = require('../database');

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: 'Authentification requise' });
}

// Middleware to check if user is admin
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
}

// Middleware to check if user is technician
function requireTechnician(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'technician') {
    return next();
  }
  return res.status(403).json({ error: 'Accès réservé aux techniciens' });
}

module.exports = { requireAuth, requireAdmin, requireTechnician, query, queryOne, queryAll };