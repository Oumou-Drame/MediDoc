import nodemailer from 'nodemailer';
import fs from 'fs';
import * as whatsapp from './whatsapp.js';

// Coût forfaitaire utilisé pour la déduction du solde virtuel par hôpital (section 7.1 du cadrage),
// en attendant le choix définitif du fournisseur SMS/WhatsApp (Twilio vs Africa's Talking, section 7) :
// une fois le fournisseur retenu, ces coûts devront venir de sa réponse API (prix exact par message envoyé)
// plutôt que de cette estimation fixe.
export const ESTIMATED_SMS_COST = parseFloat(process.env.ESTIMATED_SMS_COST || '15');
export const ESTIMATED_WHATSAPP_COST = parseFloat(process.env.ESTIMATED_WHATSAPP_COST || '15');

// Transporteur SMTP plateforme par défaut (utilisé si l'hôpital n'a pas sa propre config email)
const platformTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-app-password'
    }
});

// Cache léger des transporteurs par hôpital pour éviter de recréer une connexion à chaque envoi
const hospitalTransporters = new Map();

/**
 * Teste une configuration SMTP sans envoyer de vrai email (transporter.verify()) —
 * utilisé par la page "Config. d'envoi" du responsable de labo pour vérifier tout de suite
 * si l'adresse + mot de passe d'application fonctionnent, plutôt que de le découvrir plus
 * tard via un envoi silencieusement échoué.
 */
export async function testSmtpConnection({ host, port, user, pass }) {
    const transporter = nodemailer.createTransport({
        host: host || 'smtp.gmail.com',
        port: port || 587,
        secure: false,
        auth: { user, pass }
    });
    try {
        await transporter.verify();
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
}

/**
 * Traduit les erreurs techniques nodemailer/SMTP les plus courantes en message compréhensible
 * pour un responsable de labo non technique.
 */
export function explainSmtpError(error) {
    const msg = (error?.response || error?.message || '').toString();
    if (error?.code === 'EAUTH' || /invalid login|username and password not accepted/i.test(msg)) {
        return "Adresse email ou mot de passe d'application incorrect. Vérifie que tu as bien collé le mot de passe d'application (16 caractères), pas ton mot de passe Gmail habituel.";
    }
    if (error?.code === 'ENOTFOUND' || /getaddrinfo/i.test(msg)) {
        return "Serveur SMTP introuvable. Vérifie l'adresse du serveur SMTP (dans les options avancées).";
    }
    if (error?.code === 'ECONNREFUSED' || /econnrefused/i.test(msg)) {
        return "Connexion refusée par le serveur. Vérifie le port SMTP (587 en général).";
    }
    if (error?.code === 'ETIMEDOUT' || /timeout/i.test(msg)) {
        return "Le serveur ne répond pas (délai dépassé). Vérifie ta connexion internet et réessaie.";
    }
    return "Échec de connexion : " + (msg || 'erreur inconnue');
}

function getHospitalTransporter(sendConfig) {
    if (!sendConfig || !sendConfig.smtp_host || !sendConfig.smtp_user || !sendConfig.smtp_pass) {
        return null;
    }
    const cacheKey = `${sendConfig.hospital_id}:${sendConfig.smtp_host}:${sendConfig.smtp_user}`;
    if (hospitalTransporters.has(cacheKey)) {
        return hospitalTransporters.get(cacheKey);
    }
    const transporter = nodemailer.createTransport({
        host: sendConfig.smtp_host,
        port: sendConfig.smtp_port || 587,
        secure: false,
        auth: { user: sendConfig.smtp_user, pass: sendConfig.smtp_pass }
    });
    hospitalTransporters.set(cacheKey, transporter);
    return transporter;
}

/**
 * Send WhatsApp message via Baileys (compte plateforme partagé, voir cadrage section 7)
 */
export async function sendWhatsApp(phone, message) {
    try {
        if (whatsapp.isConfigured()) {
            console.log(`📱 [Baileys] Envoi WhatsApp à ${phone}...`);
            await whatsapp.sendTextMessage(phone, message);
            console.log(`✅ WhatsApp envoyé à ${phone} via Baileys`);
            return true;
        }
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
 */
export async function sendWhatsAppDocument(phone, documentUrl, filename = 'document.pdf', caption = '') {
    try {
        if (whatsapp.isConfigured()) {
            console.log(`📄 [Baileys] Envoi document WhatsApp à ${phone}...`);
            await whatsapp.sendDocument(phone, documentUrl, filename, caption);
            console.log(`✅ Document WhatsApp envoyé à ${phone} via Baileys`);
            return true;
        }
        console.log(`📱 [SIMULATION] Document WhatsApp à ${phone}: ${documentUrl}`);
        return true;
    } catch (error) {
        console.error('❌ Erreur Document WhatsApp:', error.message);
        return false;
    }
}

/**
 * Format phone number for Twilio (E.164, avec +)
 */
export function formatPhoneForTwilio(phone) {
    let formatted = phone.replace(/\s/g, '');
    if (formatted.startsWith('00221')) {
        formatted = '+' + formatted.substring(2);
    } else if (formatted.startsWith('+')) {
        // déjà au bon format
    } else if (formatted.startsWith('221')) {
        formatted = '+' + formatted;
    } else {
        formatted = '+221' + formatted;
    }
    return formatted;
}

/**
 * Send SMS via Twilio (fournisseur essayé en priorité, voir cadrage section 7)
 */
export async function sendSMSViaTwilio(phone, message) {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER ? process.env.TWILIO_PHONE_NUMBER.replace(/\s/g, '') : null;

        if (!accountSid || !authToken || !fromNumber) {
            return false;
        }

        // Le SID de compte Twilio commence toujours par "AC" (34 caractères). Un SID commençant
        // par "SK" est une clé API (API Key), pas le Account SID — mauvaise valeur pour cet usage.
        if (!accountSid.startsWith('AC')) {
            console.error("❌ TWILIO_ACCOUNT_SID invalide : doit commencer par 'AC' (le Account SID du tableau de bord Twilio), pas par 'SK' (une clé API).");
            return false;
        }

        const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const body = new URLSearchParams({
            To: formatPhoneForTwilio(phone),
            From: fromNumber,
            Body: message
        });

        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        const result = await response.json();

        if (response.ok && result.sid) {
            console.log(` SMS Twilio envoyé à ${phone} (sid: ${result.sid})`);
            return true;
        }

        console.error('❌ Erreur Twilio:', result.message || result);
        return false;
    } catch (error) {
        console.error('❌ Erreur SMS Twilio:', error.message);
        return false;
    }
}

/**
 * Format phone number for Termii (international, sans +)
 */
export function formatPhoneForTermii(phone) {
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
 * Send SMS via Termii (compte plateforme partagé, voir cadrage section 7)
 */
export async function sendSMSViaTermii(phone, message) {
    try {
        const apiKey = process.env.TERMII_API_KEY;
        const senderId = process.env.TERMII_SENDER_ID;
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
 * Send SMS — essaie Twilio en premier (fournisseur en cours d'essai), puis Termii
 * en repli si Twilio n'est pas configuré, puis simulation si aucun des deux n'est actif.
 */
export async function sendSMS(phone, message) {
    const twilioResult = await sendSMSViaTwilio(phone, message);
    if (twilioResult) return true;

    const termiiResult = await sendSMSViaTermii(phone, message);
    if (termiiResult) return true;

    console.log(`📱 [SIMULATION SMS] À ${phone}: ${message}`);
    console.log(`💡 Pour envoyer de vrais SMS, configurez Twilio (ou à défaut Termii) dans .env`);
    return true;
}

/**
 * Send email — utilise la config SMTP propre de l'hôpital si elle est définie,
 * sinon retombe sur le compte SMTP plateforme (comportement historique).
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string|null} attachmentPath
 * @param {string|null} html
 * @param {object|null} hospitalSendConfig - ligne de la table hospital_send_config (optionnelle)
 */
export async function sendEmail(to, subject, text, attachmentPath = null, html = null, hospitalSendConfig = null) {
    try {
        const transporter = getHospitalTransporter(hospitalSendConfig) || platformTransporter;
        const fromAddress = hospitalSendConfig?.smtp_user || process.env.SMTP_USER || 'noreply@medidoc.sn';
        const fromName = hospitalSendConfig?.smtp_from_name || 'MediDoc';

        const mailOptions = {
            from: `${fromName} <${fromAddress}>`,
            to,
            subject,
            text
        };

        if (html) {
            mailOptions.html = html;
        }

        if (attachmentPath && fs.existsSync(attachmentPath)) {
            mailOptions.attachments = [{ filename: 'resultats_medicaux.pdf', path: attachmentPath }];
        }

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email envoyé à ${to}`);
        return true;
    } catch (error) {
        console.error('❌ Erreur Email:', error.message);
        return false;
    }
}
