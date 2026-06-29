/**
 * Twilio Integration for MediDoc
 * 
 * Gère l'envoi de messages WhatsApp et SMS via Twilio.
 * 
 * Configuration requise dans .env :
 *   TWILIO_ACCOUNT_SID=votre_account_sid
 *   TWILIO_AUTH_TOKEN=votre_auth_token
 *   TWILIO_WHATSAPP_FROM=+14155238886  (numéro WhatsApp Twilio sandbox)
 *   TWILIO_SMS_FROM=+1XXXXXXXXXX       (numéro SMS Twilio)
 */

import twilio from 'twilio';

let client = null;

/**
 * Initialise le client Twilio
 */
function initClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken || accountSid === 'your_account_sid') {
    console.log('⚠️ Twilio non configuré. Définissez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN dans .env');
    return false;
  }

  try {
    client = twilio(accountSid, authToken);
    console.log('✅ Client Twilio initialisé');
    return true;
  } catch (error) {
    console.error('❌ Erreur initialisation Twilio:', error.message);
    return false;
  }
}

/**
 * Vérifie si Twilio est configuré
 */
function isConfigured() {
  return client !== null;
}

/**
 * Formate un numéro de téléphone au format international
 * @param {string} phone - Numéro de téléphone
 * @returns {string} - Numéro formaté (ex: +221771234567)
 */
function formatPhone(phone) {
  if (!phone) return '';
  let formatted = phone.replace(/[\s\-().]/g, '');
  if (formatted.startsWith('00221')) {
    formatted = '+' + formatted.substring(2);
  } else if (formatted.startsWith('221') && !formatted.startsWith('+')) {
    formatted = '+' + formatted;
  } else if (!formatted.startsWith('+')) {
    formatted = '+221' + formatted;
  }
  return formatted;
}

/**
 * Envoie un message WhatsApp via Twilio
 * @param {string} to - Numéro du destinataire
 * @param {string} body - Contenu du message
 * @returns {object} - Résultat de l'envoi
 */
async function sendWhatsApp(to, body) {
  if (!isConfigured()) {
    console.log(`📱 [SIMULATION] WhatsApp à ${formatPhone(to)}: ${body}`);
    return { success: true, simulated: true };
  }

  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) {
    console.error('❌ TWILIO_WHATSAPP_FROM non défini dans .env');
    return { success: false, error: 'WhatsApp sender not configured' };
  }

  try {
    const message = await client.messages.create({
      from: `whatsapp:${from}`,
      to: `whatsapp:${formatPhone(to)}`,
      body: body
    });

    console.log(`✅ WhatsApp Twilio envoyé à ${formatPhone(to)} (SID: ${message.sid})`);
    return { success: true, sid: message.sid, status: message.status };
  } catch (error) {
    console.error('❌ Erreur envoi WhatsApp Twilio:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Envoie un SMS via Twilio
 * @param {string} to - Numéro du destinataire
 * @param {string} body - Contenu du message
 * @returns {object} - Résultat de l'envoi
 */
async function sendSMS(to, body) {
  if (!isConfigured()) {
    console.log(`📱 [SIMULATION] SMS à ${formatPhone(to)}: ${body}`);
    return { success: true, simulated: true };
  }

  const from = process.env.TWILIO_SMS_FROM;
  if (!from) {
    console.error('❌ TWILIO_SMS_FROM non défini dans .env');
    return { success: false, error: 'SMS sender not configured' };
  }

  try {
    const message = await client.messages.create({
      from: from,
      to: formatPhone(to),
      body: body
    });

    console.log(`✅ SMS Twilio envoyé à ${formatPhone(to)} (SID: ${message.sid})`);
    return { success: true, sid: message.sid, status: message.status };
  } catch (error) {
    console.error('❌ Erreur envoi SMS Twilio:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Envoie un message WhatsApp avec média (image, document) via Twilio
 * @param {string} to - Numéro du destinataire
 * @param {string} body - Texte du message
 * @param {string} mediaUrl - URL du média à joindre
 * @returns {object} - Résultat de l'envoi
 */
async function sendWhatsAppMedia(to, body, mediaUrl) {
  if (!isConfigured()) {
    console.log(`📱 [SIMULATION] WhatsApp Media à ${formatPhone(to)}: ${body} (${mediaUrl})`);
    return { success: true, simulated: true };
  }

  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) {
    return { success: false, error: 'WhatsApp sender not configured' };
  }

  try {
    const message = await client.messages.create({
      from: `whatsapp:${from}`,
      to: `whatsapp:${formatPhone(to)}`,
      body: body,
      mediaUrl: [mediaUrl]
    });

    console.log(`✅ WhatsApp Media Twilio envoyé à ${formatPhone(to)} (SID: ${message.sid})`);
    return { success: true, sid: message.sid, status: message.status };
  } catch (error) {
    console.error('❌ Erreur envoi WhatsApp Media Twilio:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Teste la connexion Twilio
 * @returns {object} - Statut de la connexion
 */
async function testConnection() {
  if (!isConfigured()) {
    return {
      success: false,
      message: 'Twilio non configuré. Vérifiez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN dans .env',
      configured: false
    };
  }

  try {
    // Vérifier le compte en listant les messages récents
    const messages = await client.messages.list({ limit: 1 });
    return {
      success: true,
      message: 'Connexion Twilio active',
      configured: true,
      data: {
        account_sid: process.env.TWILIO_ACCOUNT_SID?.substring(0, 10) + '...',
        whatsapp_from: process.env.TWILIO_WHATSAPP_FROM || 'Non configuré',
        sms_from: process.env.TWILIO_SMS_FROM || 'Non configuré',
        last_message: messages.length > 0 ? messages[0].sid : 'Aucun message'
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Erreur de connexion Twilio: ' + error.message,
      configured: true,
      error: error.message
    };
  }
}

// Initialiser le client au démarrage
initClient();

export {
  initClient,
  isConfigured,
  formatPhone,
  sendWhatsApp,
  sendSMS,
  sendWhatsAppMedia,
  testConnection
};