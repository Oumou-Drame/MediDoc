const nodemailer = require('nodemailer');
const whatsapp = require('./whatsapp');

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'your-email@gmail.com',
    pass: process.env.SMTP_PASS || 'your-app-password'
  }
});

/**
 * Send WhatsApp message via Baileys
 * @param {string} phone - Phone number
 * @param {string} message - Message content
 * @returns {boolean} - Success status
 */
async function sendWhatsApp(phone, message) {
  try {
    // Use Baileys if connected
    if (whatsapp.isConfigured()) {
      console.log(`📱 [Baileys] Envoi WhatsApp à ${phone}...`);
      await whatsapp.sendTextMessage(phone, message);
      console.log(`✅ WhatsApp envoyé à ${phone} via Baileys`);
      return true;
    }

    // Simulation mode if not connected
    console.log(`📱 [SIMULATION] WhatsApp à ${phone}: ${message}`);
    console.log(`💡 Pour envoyer de vrais WhatsApp, scannez le QR code via GET /api/whatsapp/qr`);
    return true;
  } catch (error) {
    console.error('❌ Erreur WhatsApp:', error.message);
    return false;
  }
}

/**
 * Send WhatsApp document via Baileys
 * @param {string} phone - Phone number
 * @param {string} documentUrl - Document URL
 * @param {string} filename - Document filename
 * @param {string} caption - Caption
 * @returns {boolean} - Success status
 */
async function sendWhatsAppDocument(phone, documentUrl, filename = 'document.pdf', caption = '') {
  try {
    if (whatsapp.isConfigured()) {
      console.log(`📄 [Baileys] Envoi document WhatsApp à ${phone}...`);
      await whatsapp.sendDocument(phone, documentUrl, filename, caption);
      console.log(`✅ Document WhatsApp envoyé à ${phone} via Baileys`);
      return true;
    }
    console.log(`📱 [SIMULATION] Document WhatsApp à ${phone}: ${documentUrl}`);
    console.log(`💡 Pour envoyer de vrais documents, scannez le QR code via GET /api/whatsapp/qr`);
    return true;
  } catch (error) {
    console.error('❌ Erreur Document WhatsApp:', error.message);
    return false;
  }
}

/**
 * Format phone number for Termii (international, sans +)
 * Ex: +221771234567 → 221771234567
 * @param {string} phone - Phone number
 * @returns {string} - Formatted phone number
 */
function formatPhoneForTermii(phone) {
  let formatted = phone.replace(/\s/g, '');
  if (formatted.startsWith('00221')) {
    formatted = formatted.substring(2);
  } else if (formatted.startsWith('+')) {
    formatted = formatted.substring(1);
  } else if (!formatted.startsWith('221')) {
    formatted = '221' + formatted;
  }
  return formatted;
}

/**
 * Send SMS via Termii (https://termii.com)
 * @param {string} phone - Phone number (format: +221XXXXXXXXX or 221XXXXXXXXX)
 * @param {string} message - Message content
 * @returns {boolean} - Success status
 */
async function sendSMSViaTermii(phone, message) {
  try {
    const apiKey = process.env.TERMII_API_KEY;
    const senderId = process.env.TERMII_SENDER_ID ;
    const channel = process.env.TERMII_CHANNEL || 'dnd';

    if (!apiKey || apiKey === 'your_termii_api_key') {
      return false;
    }

    const response = await fetch('https://v3.api.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        to: formatPhoneForTermii(phone),
        from: senderId,
        sms: message,
        type: 'plain',
        channel
      })
    });

    const result = await response.json();

    if (result.message === 'Successfully Sent' || result.code === 'ok') {
      console.log(`✅ SMS Termii envoyé à ${phone}`);
      return true;
    }

    console.error('❌ Erreur Termii:', result.message || result);
    return false;
  } catch (error) {
    console.error('❌ Erreur SMS Termii:', error.message);
    return false;
  }
}

/**
 * Send SMS using Termii, fallback to simulation
 * @param {string} phone - Phone number
 * @param {string} message - Message content
 * @returns {boolean} - Success status
 */
async function sendSMS(phone, message) {
  const termiiResult = await sendSMSViaTermii(phone, message);
  if (termiiResult) return true;

  console.log(`📱 [SIMULATION SMS] À ${phone}: ${message}`);
  console.log(`💡 Pour envoyer de vrais SMS, configurez Termii dans .env`);
  return true;
}

/**
 * Send email via SMTP
 * @param {string} to - Email address
 * @param {string} subject - Email subject
 * @param {string} text - Email text content
 * @param {string} attachmentPath - Path to PDF attachment (optional)
 * @param {string} html - HTML content (optional)
 * @returns {boolean} - Success status
 */
async function sendEmail(to, subject, text, attachmentPath = null, html = null) {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER || 'MediDoc <noreply@medidoc.sn>',
      to,
      subject,
      text
    };

    if (html) {
      mailOptions.html = html;
    }

    if (attachmentPath) {
      const fs = require('fs');
      if (fs.existsSync(attachmentPath)) {
        mailOptions.attachments = [{
          filename: 'resultats_medicaux.pdf',
          path: attachmentPath
        }];
      }
    }

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email envoyé à ${to}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur Email:', error.message);
    return false;
  }
}

module.exports = {
  sendWhatsApp,
  sendWhatsAppDocument,
  sendSMS,
  sendEmail,
  sendSMSViaTermii,
  formatPhoneForTermii
};
