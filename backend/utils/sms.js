/**
 * MediDoc - Service d'envoi de messages
 * 
 * Utilise Twilio pour l'envoi de messages WhatsApp et SMS.
 * Utilise Nodemailer pour l'envoi d'emails.
 */

import nodemailer from 'nodemailer';
import * as twilio from './twilio.js';

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
 * Envoie un message WhatsApp via Twilio
 * @param {string} phone - Numéro de téléphone
 * @param {string} message - Contenu du message
 * @returns {boolean} - Succès ou échec
 */
async function sendWhatsApp(phone, message) {
  try {
    const result = await twilio.sendWhatsApp(phone, message);
    if (result.success) {
      console.log(`✅ WhatsApp envoyé à ${twilio.formatPhone(phone)}`);
      return true;
    }
    console.error('❌ Erreur WhatsApp:', result.error);
    return false;
  } catch (error) {
    console.error('❌ Erreur WhatsApp:', error.message);
    return false;
  }
}

/**
 * Envoie un document via WhatsApp (envoie le lien en texte)
 * @param {string} phone - Numéro de téléphone
 * @param {string} documentUrl - URL du document
 * @param {string} filename - Nom du fichier
 * @param {string} caption - Légende
 * @returns {boolean} - Succès ou échec
 */
async function sendWhatsAppDocument(phone, documentUrl, filename = 'document.pdf', caption = '') {
  try {
    const message = caption
      ? `${caption}\n\n📄 Document: ${documentUrl}`
      : `📄 Vos résultats médicaux: ${documentUrl}`;
    
    const result = await twilio.sendWhatsApp(phone, message);
    if (result.success) {
      console.log(`✅ Document WhatsApp envoyé à ${twilio.formatPhone(phone)}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Erreur Document WhatsApp:', error.message);
    return false;
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