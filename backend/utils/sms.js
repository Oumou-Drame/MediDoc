/**
 * MediDoc - Service d'envoi de messages
 * 
 * Utilise Baileys (WhatsApp Web) pour les messages WhatsApp.
 * Utilise Twilio pour les SMS.
 * Utilise Nodemailer pour l'envoi d'emails.
 */

import nodemailer from 'nodemailer';
import * as twilio from './twilio.js';
import * as baileys from './whatsapp.js';

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
 * Envoie un message WhatsApp via Baileys (WhatsApp Web)
 * Fallback: simulation si Baileys n'est pas connecté
 * @param {string} phone - Numéro de téléphone
 * @param {string} message - Contenu du message
 * @returns {boolean} - Succès ou échec
 */
async function sendWhatsApp(phone, message) {
  try {
    if (baileys.isConfigured()) {
      const result = await baileys.sendTextMessage(phone, message);
      if (result && result.id) {
        console.log(`✅ WhatsApp envoyé à ${baileys.formatPhoneNumber(phone)} via Baileys`);
        return true;
      }
      console.error('❌ Erreur WhatsApp Baileys: pas de réponse');
      return false;
    } else {
      // Fallback simulation si Baileys non connecté
      console.log(`📱 [SIMULATION] WhatsApp à ${baileys.formatPhoneNumber(phone)}: ${message.substring(0, 50)}...`);
      console.log('⚠️ WhatsApp non connecté via Baileys. Scannez le QR code via GET /api/whatsapp/qr');
      return true; // Retourne true pour ne pas bloquer le flux
    }
  } catch (error) {
    console.error('❌ Erreur WhatsApp Baileys:', error.message);
    // Fallback simulation
    console.log(`📱 [SIMULATION] WhatsApp à ${baileys.formatPhoneNumber(phone)} (fallback): ${message.substring(0, 50)}...`);
    return true;
  }
}

/**
 * Envoie un document via WhatsApp (envoie le lien en texte via Baileys)
 * @param {string} phone - Numéro de téléphone
 * @param {string} documentUrl - URL du document
 * @param {string} filename - Nom du fichier
 * @param {string} caption - Légende
 * @returns {boolean} - Succès ou échec
 */
async function sendWhatsAppDocument(phone, documentUrl, filename = 'document.pdf', caption = '') {
  try {
    if (baileys.isConfigured()) {
      const result = await baileys.sendDocument(phone, documentUrl, filename, caption);
      if (result && result.id) {
        console.log(`✅ Document WhatsApp envoyé à ${baileys.formatPhoneNumber(phone)} via Baileys`);
        return true;
      }
    }
    
    // Fallback: send as text message
    const message = caption
      ? `${caption}\n\n📄 Document: ${documentUrl}`
      : `📄 Vos résultats médicaux: ${documentUrl}`;
    
    return sendWhatsApp(phone, message);
  } catch (error) {
    console.error('❌ Erreur Document WhatsApp:', error.message);
    return sendWhatsApp(phone, `📄 Vos résultats médicaux: ${documentUrl}`);
  }
}

/**
 * Envoie un SMS via Twilio
 * @param {string} phone - Numéro de téléphone
 * @param {string} message - Contenu du message
 * @returns {boolean} - Succès ou échec
 */
async function sendSMS(phone, message) {
  try {
    const result = await twilio.sendSMS(phone, message);
    if (result.success) {
      console.log(`✅ SMS envoyé à ${twilio.formatPhone(phone)}`);
      return true;
    }
    console.error('❌ Erreur SMS:', result.error);
    return false;
  } catch (error) {
    console.error('❌ Erreur SMS:', error.message);
    return false;
  }
}

/**
 * Envoie un email via SMTP
 * @param {string} to - Adresse email du destinataire
 * @param {string} subject - Sujet de l'email
 * @param {string} text - Contenu texte
 * @param {string} attachmentPath - Chemin du fichier joint (optionnel)
 * @param {string} html - Contenu HTML (optionnel)
 * @returns {boolean} - Succès ou échec
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
      const fs = await import('fs');
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

export {
  sendWhatsApp,
  sendWhatsAppDocument,
  sendSMS,
  sendEmail
};