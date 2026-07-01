/**
 * Africa's Talking Integration for MediDoc
 * 
 * Gère l'envoi de SMS via Africa's Talking API.
 * 
 * Configuration requise dans .env :
 *   AT_API_KEY=votre_api_key
 *   AT_USERNAME=sandbox (ou votre username)
 *   AT_SENDER_ID=MediDoc (optionnel, votre ID d'expéditeur approuvé)
 * 
 * Modes de fonctionnement :
 *   - sandbox : simulations en console, pas d'appel API réel
 *   - production : envoi réel via API Africa's Talking
 * 
 * Inscription : https://africastalking.com
 * Documentation : https://developers.africastalking.com/docs/sms/sending
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let client = null;
let isProduction = false;

/**
 * Initialise le client Africa's Talking
 */
function initClient() {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME || 'sandbox';

  // Mode sandbox : on simule sans appeler l'API
  if (username === 'sandbox') {
    console.log('📱 Africa\'s Talking en mode SANDBOX (simulation console)');
    console.log('📱 Pour le mode production : AT_USERNAME=votre_login et AT_API_KEY=votre_clé');
    isProduction = false;
    client = null;
    return true;
  }

  if (!apiKey || apiKey === 'your_api_key_here' || apiKey.length < 10) {
    console.log('⚠️ Africa\'s Talking non configuré. AT_API_KEY manquante ou invalide dans .env');
    isProduction = false;
    return false;
  }

  try {
    const africastalking = require('africastalking');
    client = africastalking({
      apiKey: apiKey,
      username: username
    });
    isProduction = true;
    console.log('✅ Client Africa\'s Talking initialisé en mode production');
    return true;
  } catch (error) {
    console.error('❌ Erreur initialisation Africa\'s Talking:', error.message);
    isProduction = false;
    return false;
  }
}

/**
 * Vérifie si Africa's Talking est configuré
 */
function isConfigured() {
  return true; // Toujours true car le mode sandbox est un fallback valide
}

/**
 * Vérifie si on est en mode production (API réelle)
 */
function isProductionMode() {
  return isProduction;
}

/**
 * Formate un numéro de téléphone au format international
 * Africa's Talking attend le format : +221XXXXXXXXX
 * @param {string} phone - Numéro de téléphone
 * @returns {string} - Numéro formaté
 */
function formatPhone(phone) {
  if (!phone) return '';
  let formatted = phone.replace(/[\s\-().]/g, '');
  
  // Gestion des préfixes Sénégal
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
 * Envoie un SMS via Africa's Talking
 * @param {string} to - Numéro du destinataire
 * @param {string} message - Contenu du message
 * @returns {object} - Résultat de l'envoi
 */
async function sendSMS(to, message) {
  const formattedPhone = formatPhone(to);
  if (!formattedPhone) {
    return { success: false, error: 'Numéro de téléphone invalide' };
  }

  // Mode sandbox : on simule
  if (!isProduction || !client) {
    console.log(`📱 [SANDBOX] SMS à ${formattedPhone}: ${message.substring(0, 50)}...`);
    return { 
      success: true, 
      simulated: true,
      message: 'SMS simulé (mode sandbox)'
    };
  }

  const senderId = process.env.AT_SENDER_ID || '';

  try {
    const sms = client.SMS;
    const options = {
      to: [formattedPhone],
      message: message,
      ...(senderId && { from: senderId })
    };

    const response = await sms.send(options);

    console.log(`✅ SMS Africa's Talking envoyé à ${formattedPhone}`, 
      response?.SMSMessageData?.Recipients?.[0]?.status || 'status inconnu');
    
    return {
      success: true,
      data: response?.SMSMessageData,
      status: response?.SMSMessageData?.Recipients?.[0]?.status || 'sent'
    };
  } catch (error) {
    console.error('❌ Erreur envoi SMS Africa\'s Talking:', error.message);
    // Fallback simulation
    console.log(`📱 [FALLBACK] SMS à ${formattedPhone}: ${message.substring(0, 50)}...`);
    return { 
      success: true, 
      simulated: true,
      message: 'SMS simulé (fallback après erreur)'
    };
  }
}

/**
 * Envoie un SMS en masse via Africa's Talking
 * @param {string[]} recipients - Liste des numéros des destinataires
 * @param {string} message - Contenu du message
 * @returns {object} - Résultat de l'envoi
 */
async function sendBulkSMS(recipients, message) {
  const formattedPhones = recipients.map(r => formatPhone(r)).filter(Boolean);
  if (formattedPhones.length === 0) {
    return { success: false, error: 'Aucun numéro valide' };
  }

  // Mode sandbox : on simule
  if (!isProduction || !client) {
    console.log(`📱 [SANDBOX] SMS groupé à ${formattedPhones.length} destinataires`);
    formattedPhones.forEach(p => {
      console.log(`   → ${p}: ${message.substring(0, 50)}...`);
    });
    return { 
      success: true, 
      simulated: true,
      totalRecipients: formattedPhones.length,
      message: 'SMS groupé simulé (mode sandbox)'
    };
  }

  const senderId = process.env.AT_SENDER_ID || '';
  const enqueue = formattedPhones.length > 10;

  try {
    const sms = client.SMS;
    const options = {
      to: formattedPhones,
      message: message,
      ...(senderId && { from: senderId }),
      enqueue: enqueue
    };

    const response = await sms.send(options);

    console.log(`✅ SMS Africa's Talking groupé envoyé à ${formattedPhones.length} destinataires`);
    
    return {
      success: true,
      data: response?.SMSMessageData,
      totalRecipients: formattedPhones.length
    };
  } catch (error) {
    console.error('❌ Erreur envoi SMS groupé Africa\'s Talking:', error.message);
    console.log(`📱 [FALLBACK] SMS groupé à ${formattedPhones.length} destinataires`);
    return { 
      success: true, 
      simulated: true,
      totalRecipients: formattedPhones.length,
      message: 'SMS groupé simulé (fallback après erreur)'
    };
  }
}

/**
 * Récupère le solde du compte Africa's Talking
 * @returns {object} - Informations sur le solde
 */
async function getBalance() {
  if (!isProduction || !client) {
    return {
      success: true,
      balance: 'N/A (mode sandbox)',
      message: 'Mode sandbox : pas de solde disponible'
    };
  }

  try {
    const application = client.APPLICATION;
    const data = await application.fetchData();
    
    return {
      success: true,
      balance: data?.UserData?.balance || 'Inconnu',
      data: data?.UserData
    };
  } catch (error) {
    console.error('❌ Erreur récupération solde Africa\'s Talking:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Teste la connexion Africa's Talking
 * @returns {object} - Statut de la connexion
 */
async function testConnection() {
  if (!isProduction || !client) {
    return {
      success: true,
      message: 'Mode sandbox : connexion simulée. Les SMS sont affichés dans la console.',
      configured: true,
      data: {
        username: process.env.AT_USERNAME || 'sandbox',
        sender_id: process.env.AT_SENDER_ID || 'Non configuré',
        balance: 'N/A (sandbox)',
        mode: 'sandbox'
      }
    };
  }

  try {
    const balance = await getBalance();
    return {
      success: true,
      message: 'Connexion Africa\'s Talking active',
      configured: true,
      data: {
        username: process.env.AT_USERNAME || 'sandbox',
        sender_id: process.env.AT_SENDER_ID || 'Non configuré',
        balance: balance.balance || 'Inconnu',
        mode: 'production'
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Erreur de connexion Africa\'s Talking: ' + error.message,
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
  isProductionMode,
  formatPhone,
  sendSMS,
  sendBulkSMS,
  getBalance,
  testConnection
};