const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const whatsapp = require('../utils/whatsapp');
const { sendWhatsApp, sendWhatsAppDocument } = require('../utils/sms');

// ============================================
// CONNECTION & STATUS
// ============================================

/**
 * Test WhatsApp Baileys connection
 * GET /api/whatsapp/test
 */
router.get('/test', requireAuth, async (req, res) => {
  try {
    const result = await whatsapp.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors du test de connexion',
      error: error.message
    });
  }
});

/**
 * Get WhatsApp service status
 * GET /api/whatsapp/status
 */
router.get('/status', requireAuth, (req, res) => {
  const status = whatsapp.getConnectionStatus();
  res.json({
    success: true,
    data: {
      provider: status.connected ? 'baileys' : 'none',
      configured: status.configured,
      status: status.status,
      hasQR: status.hasQR,
      info: status.configured
        ? 'WhatsApp Baileys connecté'
        : status.status === 'waiting_qr'
          ? 'QR Code disponible - Scannez avec WhatsApp'
          : 'WhatsApp non connecté - QR Code en cours de génération...'
    }
  });
});

/**
 * Get QR code for WhatsApp pairing
 * GET /api/whatsapp/qr
 * Returns an HTML page with the QR code displayed as a scannable image
 */
router.get('/qr', requireAuth, async (req, res) => {
  try {
    const result = await whatsapp.getQR();
    
    // If JSON requested via API header, return JSON
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json(result);
    }

    // Otherwise serve an HTML page with the QR code
    const qrImage = result.qr || '';
    const isConnected = result.connected || false;
    const message = result.message || 'QR code non disponible';

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MediDoc - QR Code WhatsApp</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0fdf4; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      padding: 40px;
      text-align: center;
      max-width: 420px;
      width: 100%;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 24px; color: #1a1a1a; margin-bottom: 8px; }
    .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
    .qr-wrapper {
      background: white;
      border: 3px solid #25D366;
      border-radius: 12px;
      padding: 16px;
      display: inline-block;
      margin: 16px 0;
    }
    .qr-wrapper img { 
      display: block; 
      width: 280px; 
      height: 280px;
      image-rendering: pixelated;
    }
    .status {
      margin-top: 16px;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
    }
    .status.connected { background: #d1fae5; color: #065f46; }
    .status.waiting { background: #fef3c7; color: #92400e; }
    .status.error { background: #fee2e2; color: #991b1b; }
    .instructions {
      margin-top: 20px;
      text-align: left;
      background: #f9fafb;
      border-radius: 8px;
      padding: 16px;
      font-size: 13px;
      color: #374151;
    }
    .instructions h3 { font-size: 14px; margin-bottom: 8px; color: #1a1a1a; }
    .instructions ol { padding-left: 20px; }
    .instructions li { margin-bottom: 6px; }
    .refresh-btn {
      margin-top: 20px;
      background: #25D366;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .refresh-btn:hover { background: #1da851; }
    .no-qr { 
      width: 280px; 
      height: 280px; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      color: #9ca3af;
      font-size: 14px;
      border: 2px dashed #d1d5db;
      border-radius: 8px;
    }
    .spinner {
      width: 40px; height: 40px;
      border: 4px solid #e5e7eb;
      border-top: 4px solid #25D366;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📱</div>
    <h1>WhatsApp QR Code</h1>
    <p class="subtitle">Connectez MediDoc à WhatsApp</p>
    
    <div class="qr-wrapper">
      ${qrImage 
        ? `<img src="${qrImage}" alt="QR Code WhatsApp" />` 
        : isConnected 
          ? '<div class="no-qr">✅ WhatsApp connecté</div>'
          : '<div class="no-qr"><div class="spinner"></div>Génération du QR code...</div>'
      }
    </div>

    <div class="status ${isConnected ? 'connected' : qrImage ? 'waiting' : 'error'}">
      ${message}
    </div>

    <div class="instructions">
      <h3>📋 Comment scanner :</h3>
      <ol>
        <li>Ouvrez <strong>WhatsApp</strong> sur votre téléphone</li>
        <li>Allez dans <strong>Paramètres</strong> → <strong>Appareils connectés</strong></li>
        <li>Appuyez sur <strong>Connecter un appareil</strong></li>
        <li>Scannez le QR code affiché ci-dessus</li>
      </ol>
    </div>

    <button class="refresh-btn" onclick="location.reload()">🔄 Actualiser</button>
  </div>

  ${!qrImage && !isConnected ? '<script>setTimeout(() => location.reload(), 5000);</script>' : ''}
</body>
</html>`);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du QR code',
      error: error.message
    });
  }
});

/**
 * Disconnect WhatsApp session
 * POST /api/whatsapp/disconnect
 */
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    const result = await whatsapp.disconnect();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la déconnexion',
      error: error.message
    });
  }
});

/**
 * Reconnect WhatsApp session
 * POST /api/whatsapp/reconnect
 */
router.post('/reconnect', requireAuth, async (req, res) => {
  try {
    const result = await whatsapp.reconnect();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la reconnexion',
      error: error.message
    });
  }
});

// ============================================
// MESSAGES
// ============================================

/**
 * Send a text message via WhatsApp
 * POST /api/whatsapp/send
 * Body: { phone: "+221XXXXXXXXX", message: "Hello" }
 */
router.post('/send', requireAuth, async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Numéro de téléphone et message requis'
      });
    }

    if (!whatsapp.isValidPhoneNumber(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Numéro de téléphone invalide. Format attendu: +221XXXXXXXXX'
      });
    }

    const success = await sendWhatsApp(phone, message);

    if (success) {
      res.json({
        success: true,
        message: 'Message WhatsApp envoyé avec succès',
        data: {
          phone: whatsapp.formatPhoneNumber(phone),
          sent_at: new Date().toISOString(),
          provider: whatsapp.isConfigured() ? 'baileys' : 'simulation'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Échec de l\'envoi du message WhatsApp'
      });
    }
  } catch (error) {
    console.error('WhatsApp send error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'envoi: ' + error.message
    });
  }
});

/**
 * Send a document via WhatsApp
 * POST /api/whatsapp/send-document
 * Body: { phone: "+221XXXXXXXXX", documentUrl: "https://...", filename: "doc.pdf", caption: "..." }
 */
router.post('/send-document', requireAuth, async (req, res) => {
  try {
    const { phone, documentUrl, filename, caption } = req.body;

    if (!phone || !documentUrl) {
      return res.status(400).json({
        success: false,
        error: 'Numéro de téléphone et URL du document requis'
      });
    }

    if (!whatsapp.isValidPhoneNumber(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Numéro de téléphone invalide'
      });
    }

    const success = await sendWhatsAppDocument(
      phone, 
      documentUrl, 
      filename || 'document.pdf', 
      caption || ''
    );

    if (success) {
      res.json({
        success: true,
        message: 'Document WhatsApp envoyé avec succès',
        data: {
          phone: whatsapp.formatPhoneNumber(phone),
          document_url: documentUrl,
          filename: filename || 'document.pdf',
          sent_at: new Date().toISOString(),
          provider: whatsapp.isConfigured() ? 'baileys' : 'simulation'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Échec de l\'envoi du document WhatsApp'
      });
    }
  } catch (error) {
    console.error('WhatsApp document send error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'envoi du document: ' + error.message
    });
  }
});

module.exports = router;