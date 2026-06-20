require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const { initDatabase } = require('./database');
const whatsapp = require('./utils/whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDatabase().catch(err => {
  console.error('❌ Impossible d\'initialiser la base de données:', err.message);
  console.error('Vérifiez que PostgreSQL est démarré et que la base de données "medidoc" existe.');
  process.exit(1);
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'medidoc_session',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/protected', express.static(path.join(__dirname, 'protected')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/patient', require('./routes/patient'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/history', require('./routes/history'));
app.use('/api/whatsapp', require('./routes/whatsapp'));

// Serve SPA pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/technician', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'technician.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/patient', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient.html'));
});

app.get('/access/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient.html'));
});

// Create necessary directories
const fs = require('fs');
['uploads', 'protected', 'public/css', 'public/js', 'whatsapp_auth'].forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║         🏥 MediDoc Server Started        ║
╠══════════════════════════════════════════╣
║  URL: http://localhost:${PORT}              ║
║  Admin: admin / admin123                 ║
║  Tech:  tech01 / tech123                 ║
╚══════════════════════════════════════════╝
  `);

  // Initialize WhatsApp Baileys connection
  whatsapp.initConnection().catch(err => {
    console.error('⚠️ WhatsApp initialization error:', err.message);
  });
});

module.exports = app;