/**
 * WhatsApp API - Baileys Integration
 * 
 * Baileys is a Node.js library for the WhatsApp Web API.
 * It uses the official WhatsApp Web protocol without requiring an official API key.
 * 
 * Session data is persisted in ./whatsapp_auth/ directory.
 * On first run, a QR code will be generated for scanning.
 */

import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import pino from 'pino';
import Boom from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Session directory for Baileys auth state
const AUTH_DIR = path.join(__dirname, '..', 'whatsapp_auth');

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Global WhatsApp socket instance
let sock = null;
let connectionStatus = 'disconnected';
let lastQR = null;
let lastQRImage = null;
let connectionInfo = {};

/**
 * Format phone number to JID (Jabber ID) format for Baileys
 * Baileys uses format: phone@s.whatsapp.net
 * @param {string} phone - Phone number in any format
 * @returns {string} - Formatted JID (e.g., 221771234567@s.whatsapp.net)
 */
function formatChatId(phone) {
  if (!phone) return '';

  let formatted = phone.replace(/[\s\-().]/g, '');

  // Remove leading + 
  if (formatted.startsWith('+')) {
    formatted = formatted.substring(1);
  }

  // Senegal format handling
  if (formatted.startsWith('00221')) {
    formatted = formatted.substring(2);
  } else if (formatted.startsWith('221')) {
    // Already correct
  } else if (!formatted.startsWith('221')) {
    formatted = '221' + formatted;
  }

  return `${formatted}@s.whatsapp.net`;
}

/**
 * Format phone number to international format
 * @param {string} phone - Phone number in any format
 * @returns {string} - Formatted phone number (e.g., +221XXXXXXXXX)
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';

  let formatted = phone.replace(/[\s\-().]/g, '');

  // Senegal format handling
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
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - Is valid
 */
function isValidPhoneNumber(phone) {
  const formatted = formatPhoneNumber(phone);
  return /^\+[1-9]\d{6,14}$/.test(formatted);
}

/**
 * Check if WhatsApp is configured and connected
 */
function isConfigured() {
  return sock !== null && connectionStatus === 'connected';
}

/**
 * Get the current connection status
 * @returns {object} - Connection status info
 */
function getConnectionStatus() {
  return {
    status: connectionStatus,
    configured: isConfigured(),
    hasQR: !!lastQR,
    info: connectionInfo
  };
}

/**
 * Get the current QR code (base64 image)
 * @returns {string|null} - QR code as base64 data URL, or null
 */
function getQRCode() {
  return lastQRImage;
}

/**
 * Initialize the WhatsApp connection using Baileys
 * This should be called once at server startup
 */
async function initConnection() {
  if (sock) {
    console.log('⚠️ WhatsApp already initialized');
    return;
  }

  console.log('📱 Initializing WhatsApp Baileys connection...');

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      printQRInTerminal: true,
      logger: pino({ level: 'silent' }),
      browser: ['MediDoc', 'Chrome', '4.0.0'],
      generateHighQualityLinkPreview: false
    });

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'waiting_qr';
        lastQR = qr;
        console.log('📱 QR Code received. Scan with WhatsApp to connect.');

        // Generate QR code as base64 image
        try {
          lastQRImage = await QRCode.toDataURL(qr, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
          });
          console.log('✅ QR Code image generated. Access via GET /api/whatsapp/qr');
        } catch (qrError) {
          console.error('❌ Error generating QR image:', qrError.message);
        }
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = reason !== DisconnectReason.loggedOut;

        console.log(`📴 WhatsApp connection closed. Reason: ${reason}`);

        if (reason === DisconnectReason.loggedOut) {
          console.log('🔒 WhatsApp logged out. Clearing session...');
          connectionStatus = 'disconnected';
          lastQR = null;
          lastQRImage = null;
          sock = null;

          // Clear auth files on logout
          try {
            const authFiles = fs.readdirSync(AUTH_DIR);
            for (const file of authFiles) {
              fs.unlinkSync(path.join(AUTH_DIR, file));
            }
          } catch (e) {
            // Ignore errors
          }
        } else if (shouldReconnect) {
          console.log('🔄 Reconnecting WhatsApp...');
          connectionStatus = 'reconnecting';
          sock = null;
          setTimeout(() => initConnection(), 3000);
        } else {
          connectionStatus = 'disconnected';
          sock = null;
        }
      } else if (connection === 'open') {
        connectionStatus = 'connected';
        lastQR = null;
        lastQRImage = null;
        connectionInfo = sock.user || {};

        const phoneNumber = sock.user?.id?.replace(/:.*@/, '@')?.split('@')[0] || 'unknown';
        console.log(`✅ WhatsApp connected successfully!`);
        console.log(`📱 Phone: +${phoneNumber}`);
      } else if (connection === 'connecting') {
        connectionStatus = 'connecting';
        console.log('🔄 WhatsApp connecting...');
      }
    });

    // Handle messages (optional: for incoming message processing)
    sock.ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        if (!msg.key.fromMe && msg.message) {
          console.log(`📩 WhatsApp message from ${msg.key.remoteJid}:`, 
            msg.message.conversation || msg.message.extendedTextMessage?.text || '[media]');
        }
      }
    });

  } catch (error) {
    console.error('❌ Error initializing WhatsApp:', error.message);
    connectionStatus = 'error';
    connectionInfo = { error: error.message };
  }
}

/**
 * Send a text message via WhatsApp using Baileys
 * @param {string} to - Recipient phone number (format: +221XXXXXXXXX)
 * @param {string} message - Text message content
 * @returns {object} - Sent message data
 */
async function sendTextMessage(to, message) {
  if (!isConfigured()) {
    throw new Error('WhatsApp non connecté. Scannez le QR code via GET /api/whatsapp/qr');
  }

  const jid = formatChatId(to);
  const phone = formatPhoneNumber(to);
  console.log(`📱 Baileys: Envoi WhatsApp à ${phone}`);

  const result = await sock.sendMessage(jid, { text: message });

  console.log(`✅ WhatsApp envoyé à ${phone} via Baileys`);
  return {
    id: result.key.id,
    remoteJid: result.key.remoteJid,
    fromMe: result.key.fromMe,
    timestamp: result.messageTimestamp
  };
}

/**
 * Send a file/document via WhatsApp using Baileys
 * @param {string} to - Recipient phone number
 * @param {string} fileUrl - URL or local path of the document/file to send
 * @param {string} filename - Document filename
 * @param {string} caption - Caption for the file
 * @returns {object} - Sent message data
 */
async function sendDocument(to, fileUrl, filename = 'document.pdf', caption = '') {
  if (!isConfigured()) {
    throw new Error('WhatsApp non connecté. Scannez le QR code via GET /api/whatsapp/qr');
  }

  const jid = formatChatId(to);
  const phone = formatPhoneNumber(to);
  console.log(`📄 Baileys: Envoi document WhatsApp à ${phone}`);

  try {
    let buffer;

    // Check if it's a local file path or a URL
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      // Download from URL
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Impossible de télécharger le fichier: ${response.status}`);
      }
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      // Local file path
      const filePath = fileUrl.startsWith('/') ? fileUrl : path.join(__dirname, '..', fileUrl);
      buffer = fs.readFileSync(filePath);
    }

    // Determine MIME type
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.txt': 'text/plain'
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    const result = await sock.sendMessage(jid, {
      document: buffer,
      fileName: filename,
      caption: caption || filename,
      mimetype: mimeType
    });

    console.log(`✅ Document WhatsApp envoyé à ${phone} via Baileys`);
    return {
      id: result.key.id,
      remoteJid: result.key.remoteJid,
      fromMe: result.key.fromMe,
      timestamp: result.messageTimestamp
    };
  } catch (error) {
    // Fallback: send as text message with the URL
    console.log(`⚠️ Document send failed, sending as text: ${error.message}`);
    const message = caption
      ? `${caption}\n\nDocument: ${fileUrl}`
      : `Document: ${fileUrl}`;
    return sendTextMessage(to, message);
  }
}

/**
 * Send a media file (image, video, audio) via WhatsApp using Baileys
 * @param {string} to - Recipient phone number
 * @param {string} mediaType - Media type (image, video, audio)
 * @param {string} mediaUrl - URL or local path of the media
 * @param {string} caption - Caption for the media
 * @param {string} filename - Filename
 * @returns {object} - Sent message data
 */
async function sendMediaMessage(to, mediaType, mediaUrl, caption = '', filename = '') {
  if (!isConfigured()) {
    throw new Error('WhatsApp non connecté. Scannez le QR code via GET /api/whatsapp/qr');
  }

  const jid = formatChatId(to);
  const phone = formatPhoneNumber(to);
  const fileName = filename || `${mediaType}_file`;

  console.log(`🎬 Baileys: Envoi media (${mediaType}) WhatsApp à ${phone}`);

  try {
    let buffer;

    // Download from URL or read local file
    if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
      const response = await fetch(mediaUrl);
      if (!response.ok) {
        throw new Error(`Impossible de télécharger le média: ${response.status}`);
      }
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      const filePath = mediaUrl.startsWith('/') ? mediaUrl : path.join(__dirname, '..', mediaUrl);
      buffer = fs.readFileSync(filePath);
    }

    // Build message based on media type
    let message = {};
    switch (mediaType) {
      case 'image':
        message = { image: buffer, caption: caption || fileName };
        break;
      case 'video':
        message = { video: buffer, caption: caption || fileName };
        break;
      case 'audio':
        message = { audio: buffer, mimetype: 'audio/mpeg' };
        break;
      default:
        // Send as document for unknown types
        message = { document: buffer, fileName, caption: caption || fileName, mimetype: 'application/octet-stream' };
    }

    const result = await sock.sendMessage(jid, message);

    console.log(`✅ Media WhatsApp (${mediaType}) envoyé à ${phone} via Baileys`);
    return {
      id: result.key.id,
      remoteJid: result.key.remoteJid,
      fromMe: result.key.fromMe,
      timestamp: result.messageTimestamp
    };
  } catch (error) {
    // Fallback: send as text with the URL
    console.log(`⚠️ Media send failed, sending as text: ${error.message}`);
    const message = caption
      ? `${caption}\n\n${mediaType}: ${mediaUrl}`
      : `${mediaType}: ${mediaUrl}`;
    return sendTextMessage(to, message);
  }
}

/**
 * Send a template message via WhatsApp using Baileys
 * Since Baileys doesn't support official templates, this sends as a formatted text message
 * @param {string} to - Recipient phone number
 * @param {string} templateName - Template name
 * @param {string} languageCode - Language code
 * @param {Array} components - Template components
 * @returns {object} - Sent message data
 */
async function sendTemplateMessage(to, templateName, languageCode = 'fr', components = []) {
  console.log(`📝 Baileys: Template messages are not supported natively. Sending as text.`);

  // Build a formatted text message from components
  let text = '';
  if (components && components.length > 0) {
    for (const comp of components) {
      if (comp.parameters) {
        for (const param of comp.parameters) {
          text += (param.text || param.replacement || '') + ' ';
        }
      }
    }
  }

  const message = text.trim() || `Template: ${templateName}`;
  return sendTextMessage(to, message);
}

/**
 * Disconnect and destroy the WhatsApp session
 * @returns {object} - Result
 */
async function disconnect() {
  if (sock) {
    sock.end();
    sock = null;
    connectionStatus = 'disconnected';
    lastQR = null;
    lastQRImage = null;
    connectionInfo = {};
    console.log('🔒 WhatsApp disconnected');
    return { success: true, message: 'WhatsApp déconnecté' };
  }
  return { success: false, message: 'WhatsApp n\'est pas connecté' };
}

/**
 * Test the WhatsApp connection
 * @returns {object} - Connection test result
 */
async function testConnection() {
  try {
    if (!isConfigured()) {
      return {
        success: false,
        message: 'WhatsApp non connecté. Scannez le QR code pour vous connecter.',
        status: connectionStatus,
        error: 'Not connected'
      };
    }

    const phoneNumber = sock.user?.id?.replace(/:.*@/, '@')?.split('@')[0] || 'unknown';

    return {
      success: true,
      message: 'Connexion WhatsApp Baileys active',
      data: {
        status: connectionStatus,
        phone: `+${phoneNumber}`,
        name: sock.user?.name || 'Unknown',
        platform: sock.user?.platform || 'Unknown'
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Erreur lors du test de connexion WhatsApp',
      error: error.message
    };
  }
}

/**
 * Get the QR code for WhatsApp authentication
 * @returns {object} - QR code data
 */
async function getQR() {
  if (isConfigured()) {
    return {
      success: true,
      connected: true,
      message: 'WhatsApp est déjà connecté',
      phone: sock.user?.id?.replace(/:.*@/, '@')?.split('@')[0] || 'unknown'
    };
  }

  if (lastQRImage) {
    return {
      success: true,
      connected: false,
      qr: lastQRImage,
      message: 'Scannez ce QR code avec WhatsApp'
    };
  }

  return {
    success: false,
    connected: false,
    message: 'QR code pas encore disponible. Attendez ou réessayez.',
    status: connectionStatus
  };
}

/**
 * Reconnect WhatsApp
 * @returns {object} - Reconnect result
 */
async function reconnect() {
  if (sock) {
    sock.end();
    sock = null;
  }
  connectionStatus = 'disconnected';
  lastQR = null;
  lastQRImage = null;

  // Wait a moment before reconnecting
  await new Promise(resolve => setTimeout(resolve, 1000));
  await initConnection();

  return {
    success: true,
    message: 'Tentative de reconnexion en cours...',
    status: connectionStatus
  };
}

export {
  // Config
  isConfigured,
  getConnectionStatus,
  getQRCode,
  initConnection,

  // Messages
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
  sendDocument,

  // Connection management
  testConnection,
  getQR,
  disconnect,
  reconnect,

  // Utilities
  formatPhoneNumber,
  formatChatId,
  isValidPhoneNumber
};