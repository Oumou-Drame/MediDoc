import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { protect, requireTechnician } from '../middleware/auth-middleware.js';
import { queryOne, query } from '../config/db.js';
import { protectPdf } from '../utils/pdf.js';
import { sendWhatsApp, sendSMS, sendEmail, ESTIMATED_SMS_COST, ESTIMATED_WHATSAPP_COST } from '../utils/sms.js';
import { getBalance, deduct } from '../utils/credits.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

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

function generateAccessCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateAccessToken() {
    return crypto.randomBytes(32).toString('hex');
}

router.post('/', protect, requireTechnician, upload.single('pdf'), async (req, res) => {
    const { patient_name, patient_phone, patient_email, channel } = req.body;
    const hospitalId = req.user.hospital_id;

    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier PDF uploadé' });
    }
    if (!patient_name || !patient_phone) {
        return res.status(400).json({ error: 'Nom du patient et téléphone requis' });
    }
    if (!patient_email) {
        return res.status(400).json({ error: "Email du patient requis pour tous les modes d'envoi" });
    }

    const allowedChannels = ['email_whatsapp', 'email_sms'];
    if (!channel || !allowedChannels.includes(channel)) {
        return res.status(400).json({ error: "Mode d'envoi invalide. Choisissez WhatsApp+Email ou Email+SMS." });
    }

    // Le canal SMS/WhatsApp consomme le solde de crédits de l'hôpital ; l'email reste toujours disponible (section 7.1)
    const requiresCredit = channel === 'email_whatsapp' || channel === 'email_sms';
    if (requiresCredit) {
        const balance = await getBalance(hospitalId);
        if (balance <= 0) {
            return res.status(402).json({
                error: "Solde de crédits SMS/WhatsApp épuisé pour votre établissement. Contactez votre administrateur pour une recharge.",
                code: 'CREDIT_EXHAUSTED'
            });
        }
    }

    try {
        const hospital = await queryOne('SELECT name FROM hospitals WHERE id = $1', [hospitalId]);
        const sendConfig = await queryOne('SELECT * FROM hospital_send_config WHERE hospital_id = $1', [hospitalId]);
        const hospitalName = hospital ? hospital.name : 'MediDoc';

        const accessCode = generateAccessCode();
        const accessToken = generateAccessToken();

        const protectedFilename = `protected_${Date.now()}_${path.basename(req.file.filename)}`;
        const protectedPath = path.join(__dirname, '..', 'protected', protectedFilename);

        if (!fs.existsSync(path.join(__dirname, '..', 'protected'))) {
            fs.mkdirSync(path.join(__dirname, '..', 'protected'), { recursive: true });
        }

        await protectPdf(req.file.path, protectedPath, accessCode);

        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        const result = await queryOne(
            `INSERT INTO medical_results
       (technician_id, hospital_id, patient_name, patient_phone, patient_email, original_filename,
        protected_filename, access_code, access_token, channel, status, whatsapp_sent, sms_sent,
        email_sent, code_accessed, access_count, attempt_count, is_locked, created_at, sent_at, accessed_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', 0, 0, 0, 0, 0, 0, 0, NOW(), NULL, NULL, $11)
       RETURNING id`,
            [req.user.id, hospitalId, patient_name, patient_phone, patient_email,
            req.file.filename, protectedFilename, accessCode, accessToken, channel, expiresAt]
        );

        const resultId = result.id;
        const accessUrl = `${process.env.CLIENT_URL}/access/${accessToken}`;

        const whatsappMessage = `Bonjour ${patient_name},\n\nVos résultats médicaux de ${hospitalName} sont disponibles.\n\n🔗 Lien d'accès:\n${accessUrl}\n\n⚠️ Ce lien expire dans 48 heures.\n\nUtilisez le code que vous recevrez par un autre canal pour accéder à vos résultats.`;
        const smsMessage = `Bonjour ${patient_name},\n\n Votre code d'accès ${hospitalName}: ${accessCode}\n\nUtilisez le lien que vous avez reçu par email pour accéder à vos résultats.\n⚠️ Expire dans 48h. Max 3 tentatives.`;

        const emailSubject = ` Code d'accès - Résultats médicaux ${hospitalName}`;
        const emailText = `Bonjour ${patient_name},\n\n Votre code d'accès: ${accessCode}\n\nUtilisez le lien que vous avez reçu via WhatsApp pour accéder à vos résultats.\n\n⚠️ Ce code expire dans 48 heures.\n⚠️ Maximum 3 tentatives d'accès.\n\nNe partagez ce code avec personne.`;
        const emailHtml = `
      <h2> ${hospitalName} - Code d'accès</h2>
      <p>Bonjour <strong>${patient_name}</strong>,</p>
      <p>Voici votre code d'accès pour consulter vos résultats médicaux :</p>
      <div style="background: #f0fdf4; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
        <p style="margin: 0;"><strong> Code d'accès:</strong></p>
        <p style="font-size: 32px; font-weight: 700; color: #065f46; margin: 8px 0; letter-spacing: 6px;">${accessCode}</p>
      </div>
      <p>📌 Utilisez le lien que vous avez reçu via <strong>WhatsApp</strong> pour accéder à vos résultats, puis entrez ce code.</p>
      <p style="color: #dc2626;">⚠️ Ce code expire dans 48 heures.</p>
      <p style="color: #dc2626;">⚠️ Maximum 3 tentatives d'accès.</p>
      <p>Ne partagez ce code avec personne.</p>
      <hr>
      <p style="color: #9ca3af; font-size: 12px;">${hospitalName} via MediDoc - Plateforme sécurisée de résultats médicaux</p>
    `;

        const emailLinkSubject = `🔗 Lien d'accès - Résultats médicaux ${hospitalName}`;
        const emailLinkText = `Bonjour ${patient_name},\n\nVos résultats médicaux de ${hospitalName} sont disponibles.\n\n🔗 Lien d'accès: ${accessUrl}\n\nUtilisez le code que vous recevrez par SMS pour accéder à vos résultats.\n\n⚠️ Ce lien expire dans 48 heures.\n\nNe partagez ce lien avec personne.`;
        const emailLinkHtml = `
      <h2> ${hospitalName} - Lien d'accès</h2>
      <p>Bonjour <strong>${patient_name}</strong>,</p>
      <p>Vos résultats médicaux de <strong>${hospitalName}</strong> sont disponibles.</p>
      <div style="background: #f0fdf4; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p><strong>🔗 Lien d'accès:</strong></p>
        <p><a href="${accessUrl}" style="font-size: 16px; color: #065f46; word-break: break-all;">${accessUrl}</a></p>
      </div>
      <p> Entrez le code que vous recevrez par <strong>SMS</strong> pour consulter vos résultats.</p>
      <p style="color: #dc2626;"> Ce lien expire dans 48 heures.</p>
      <p>Ne partagez ce lien avec personne.</p>
      <hr>
      <p style="color: #9ca3af; font-size: 12px;">${hospitalName} via MediDoc - Plateforme sécurisée de résultats médicaux</p>
    `;

        let whatsappSent = false;
        let smsSent = false;
        let emailSent = false;

        try {
            if (channel === 'email_whatsapp') {
                whatsappSent = await sendWhatsApp(patient_phone, whatsappMessage);
                emailSent = await sendEmail(patient_email, emailSubject, emailText, null, emailHtml, sendConfig);
            } else if (channel === 'email_sms') {
                emailSent = await sendEmail(patient_email, emailLinkSubject, emailLinkText, null, emailLinkHtml, sendConfig);
                smsSent = await sendSMS(patient_phone, smsMessage);
            }
        } catch (sendErr) {
            console.error('Send error:', sendErr);
        }

        // L'envoi n'est valide que si TOUS les canaux du mode choisi ont réussi (le patient a besoin du lien ET
        // du code, envoyés séparément) : si un seul échoue, on annule l'envoi entièrement plutôt que de le
        // laisser à moitié fait (section demandée : pas d'envoi partiel).
        const toutesLesPartiesEnvoyees = channel === 'email_whatsapp'
            ? (whatsappSent && emailSent)
            : (smsSent && emailSent);

        if (!toutesLesPartiesEnvoyees) {
            await query('DELETE FROM medical_results WHERE id = $1', [resultId]);
            try { fs.unlinkSync(req.file.path); } catch (e) { /* déjà absent */ }
            try { fs.unlinkSync(protectedPath); } catch (e) { /* déjà absent */ }

            const canalEnEchec = channel === 'email_whatsapp'
                ? (!whatsappSent ? 'WhatsApp' : 'Email')
                : (!smsSent ? 'SMS' : 'Email');

            await query(
                'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
                [req.user.id, 'upload_failed', `Échec envoi pour ${patient_name} (canal en échec: ${canalEnEchec})`, req.ip]
            );

            return res.status(502).json({
                error: `L'envoi a échoué (canal ${canalEnEchec} indisponible). Aucun message n'a été envoyé au patient, veuillez réessayer.`
            });
        }

        // Déduction du solde de crédits de l'hôpital pour les envois SMS/WhatsApp (section 7.1)
        if (whatsappSent) {
            await deduct(hospitalId, ESTIMATED_WHATSAPP_COST, { resultId, note: `Envoi WhatsApp résultat #${resultId}` });
        }
        if (smsSent) {
            await deduct(hospitalId, ESTIMATED_SMS_COST, { resultId, note: `Envoi SMS résultat #${resultId}` });
        }

        await query(
            `UPDATE medical_results
       SET status = 'sent', whatsapp_sent = $1, sms_sent = $2, email_sent = $3, sent_at = $4
       WHERE id = $5`,
            [whatsappSent ? 1 : 0, smsSent ? 1 : 0, emailSent ? 1 : 0, new Date().toISOString(), resultId]
        );

        await query(
            'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
            [req.user.id, 'upload', `Upload PDF pour ${patient_name} (mode: ${channel})`, req.ip]
        );

        res.json({
            success: true,
            message: 'PDF uploadé et envoyé avec succès',
            data: {
                id: resultId, patient_name, patient_phone, patient_email,
                channel, status: 'sent',
                whatsapp_sent: whatsappSent, sms_sent: smsSent, email_sent: emailSent,
                expires_at: expiresAt, access_url: accessUrl
            }
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: "Erreur lors de l'upload: " + err.message });
    }
});

router.get('/form-data', protect, requireTechnician, (req, res) => {
    res.json({
        channels: [
            { value: 'email_whatsapp', label: ' WhatsApp +  Email', description: 'Lien envoyé par WhatsApp, code envoyé par Email' },
            { value: 'email_sms', label: ' Email +  SMS', description: 'Lien envoyé par Email, code envoyé par SMS' }
        ]
    });
});

export default router;
