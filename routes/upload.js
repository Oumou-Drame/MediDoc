const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { requireAuth, requireTechnician, queryOne, query } = require('../middleware/auth');
const { protectPdf } = require('../utils/pdf');
const { sendWhatsApp, sendWhatsAppDocument, sendSMS, sendEmail } = require('../utils/sms');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont acceptés'), false);
    }
  }
});

// Generate 6-digit access code
function generateAccessCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate access token for link (not containing the code)
function generateAccessToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Upload PDF and create medical result
router.post('/', requireAuth, requireTechnician, upload.single('pdf'), async (req, res) => {
  const { patient_name, patient_phone, patient_email, channel } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier PDF uploadé' });
  }

  if (!patient_name || !patient_phone) {
    return res.status(400).json({ error: 'Nom du patient et téléphone requis' });
  }

  if (!patient_email) {
    return res.status(400).json({ error: 'Email du patient requis pour tous les modes d\'envoi' });
  }

  // Validate channel
  const allowedChannels = ['email_whatsapp', 'email_sms'];
  if (!channel || !allowedChannels.includes(channel)) {
    return res.status(400).json({ error: 'Mode d\'envoi invalide. Choisissez WhatsApp+Email ou Email+SMS.' });
  }

  try {
    const accessCode = generateAccessCode();
    const accessToken = generateAccessToken();

    // Protect PDF with password
    const protectedFilename = `protected_${Date.now()}_${path.basename(req.file.filename)}`;
    const protectedPath = path.join(__dirname, '..', 'protected', protectedFilename);

    await protectPdf(req.file.path, protectedPath, accessCode);

    // Calculate expiration (48 hours from now)
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // Insert into database
    const result = await queryOne(
      `INSERT INTO medical_results 
       (technician_id, patient_name, patient_phone, patient_email, original_filename, 
        protected_filename, access_code, access_token, channel, status, whatsapp_sent, sms_sent, 
        email_sent, code_accessed, access_count, attempt_count, is_locked, created_at, sent_at, accessed_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 0, 0, 0, 0, 0, 0, 0, NOW(), NULL, NULL, $10)
       RETURNING id`,
      [req.session.user.id, patient_name, patient_phone, patient_email,
       req.file.filename, protectedFilename, accessCode, accessToken, channel, expiresAt]
    );

    const resultId = result.id;
    // Link contains only the access token, NOT the code
    const accessUrl = `${req.protocol}://${req.get('host')}/access/${accessToken}`;

    // === Messages séparés : lien dans un canal, code dans l'autre ===

    // -- WhatsApp --
    const whatsappMessage = `Bonjour ${patient_name},\n\nVos résultats médicaux sont disponibles.\n\n🔗 Lien d'accès:\n${accessUrl}\n\n⚠️ Ce lien expire dans 48 heures.\n\nUtilisez le code que vous recevrez par un autre canal pour accéder à vos résultats.`;

    // -- SMS --
    const smsMessage = `Bonjour ${patient_name},\n\n🔐 Votre code d'accès MediDoc: ${accessCode}\n\nUtilisez le lien que vous avez reçu par email pour accéder à vos résultats.\n⚠️ Expire dans 48h. Max 3 tentatives.`;

    // -- Email (code only) --
    const emailSubject = '🔐 Code d\'accès - Résultats médicaux MediDoc';
    const emailText = `Bonjour ${patient_name},\n\n🔐 Votre code d'accès: ${accessCode}\n\nUtilisez le lien que vous avez reçu via WhatsApp pour accéder à vos résultats.\n\n⚠️ Ce code expire dans 48 heures.\n⚠️ Maximum 3 tentatives d'accès.\n\nNe partagez ce code avec personne.`;
    const emailHtml = `
      <h2>🏥 MediDoc - Code d'accès</h2>
      <p>Bonjour <strong>${patient_name}</strong>,</p>
      <p>Voici votre code d'accès pour consulter vos résultats médicaux :</p>
      <div style="background: #f0fdf4; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
        <p style="margin: 0;"><strong>🔐 Code d'accès:</strong></p>
        <p style="font-size: 32px; font-weight: 700; color: #065f46; margin: 8px 0; letter-spacing: 6px;">${accessCode}</p>
      </div>
      <p>📌 Utilisez le lien que vous avez reçu via <strong>WhatsApp</strong> pour accéder à vos résultats, puis entrez ce code.</p>
      <p style="color: #dc2626;">⚠️ Ce code expire dans 48 heures.</p>
      <p style="color: #dc2626;">⚠️ Maximum 3 tentatives d'accès.</p>
      <p>Ne partagez ce code avec personne.</p>
      <hr>
      <p style="color: #9ca3af; font-size: 12px;">MediDoc - Plateforme sécurisée de résultats médicaux</p>
    `;

    // -- Email (link only, used for email_sms mode) --
    const emailLinkSubject = '🔗 Lien d\'accès - Résultats médicaux MediDoc';
    const emailLinkText = `Bonjour ${patient_name},\n\nVos résultats médicaux sont disponibles.\n\n🔗 Lien d'accès: ${accessUrl}\n\nUtilisez le code que vous recevrez par SMS pour accéder à vos résultats.\n\n⚠️ Ce lien expire dans 48 heures.\n\nNe partagez ce lien avec personne.`;
    const emailLinkHtml = `
      <h2>🏥 MediDoc - Lien d'accès</h2>
      <p>Bonjour <strong>${patient_name}</strong>,</p>
      <p>Vos résultats médicaux sont disponibles.</p>
      <div style="background: #f0fdf4; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p><strong>🔗 Lien d'accès:</strong></p>
        <p><a href="${accessUrl}" style="font-size: 16px; color: #065f46; word-break: break-all;">${accessUrl}</a></p>
      </div>
      <p>📌 Entrez le code que vous recevrez par <strong>SMS</strong> pour consulter vos résultats.</p>
      <p style="color: #dc2626;">⚠️ Ce lien expire dans 48 heures.</p>
      <p>Ne partagez ce lien avec personne.</p>
      <hr>
      <p style="color: #9ca3af; font-size: 12px;">MediDoc - Plateforme sécurisée de résultats médicaux</p>
    `;

    // Send via channels based on mode
    let whatsappSent = false;
    let smsSent = false;
    let emailSent = false;

    try {
      if (channel === 'email_whatsapp') {
        // WhatsApp → Lien uniquement
        whatsappSent = await sendWhatsApp(patient_phone, whatsappMessage);
        // Email → Code d'accès uniquement
        emailSent = await sendEmail(patient_email, emailSubject, emailText, protectedPath, emailHtml);
      } else if (channel === 'email_sms') {
        // Email → Lien uniquement
        emailSent = await sendEmail(patient_email, emailLinkSubject, emailLinkText, protectedPath, emailLinkHtml);
        // SMS → Code d'accès uniquement
        smsSent = await sendSMS(patient_phone, smsMessage);
      }
    } catch (sendErr) {
      console.error('Send error:', sendErr);
    }

    // Determine if at least one channel succeeded
    let anySent = false;
    if (channel === 'email_whatsapp') {
      anySent = whatsappSent || emailSent;
    } else if (channel === 'email_sms') {
      anySent = smsSent || emailSent;
    }

    // Update status
    const newStatus = anySent ? 'sent' : 'pending';
    await query(
      `UPDATE medical_results 
       SET status = $1, whatsapp_sent = $2, sms_sent = $3, email_sent = $4, sent_at = $5
       WHERE id = $6`,
      [newStatus, whatsappSent ? 1 : 0, smsSent ? 1 : 0, emailSent ? 1 : 0,
       newStatus === 'sent' ? new Date().toISOString() : null, resultId]
    );

    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [req.session.user.id, 'upload', `Upload PDF pour ${patient_name} (code: ${accessCode}, mode: ${channel})`, req.ip]
    );

    res.json({
      success: true,
      message: 'PDF uploadé et envoyé avec succès',
      data: {
        id: resultId,
        patient_name,
        patient_phone,
        patient_email,
        access_code: accessCode,
        channel,
        status: newStatus,
        whatsapp_sent: whatsappSent,
        sms_sent: smsSent,
        email_sent: emailSent,
        expires_at: expiresAt,
        access_url: accessUrl
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'upload: ' + err.message });
  }
});

// Get upload form data
router.get('/form-data', requireAuth, requireTechnician, (req, res) => {
  res.json({
    channels: [
      { value: 'email_whatsapp', label: '📱 WhatsApp + 📧 Email', description: 'Lien envoyé par WhatsApp, code envoyé par Email' },
      { value: 'email_sms', label: '📧 Email + 📱 SMS', description: 'Lien envoyé par Email, code envoyé par SMS' }
    ]
  });
});

module.exports = router;