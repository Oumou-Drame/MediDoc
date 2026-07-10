import nodemailer from 'nodemailer';
import { queryAll } from '../config/db.js';

// Mailer "système" : configuration au niveau plateforme, totalement indépendante de la
// configuration d'envoi de chaque hôpital (hospital_send_config, utilisée uniquement pour
// les envois aux patients). Utilisé pour les emails sensibles/transverses (mot de passe
// oublié, demande approuvée/refusée) — voir cadrage, section 8.
//
// La config est lue dans la table `settings` (hospital_id IS NULL, clés platform_smtp_*),
// modifiable depuis Paramètres plateforme > Configuration SMTP plateforme. Si rien n'a
// encore été enregistré en base, on retombe sur les variables d'environnement SMTP_* (.env)
// pour ne rien casser tant que l'admin n'a pas rempli le formulaire au moins une fois.
async function getPlatformSmtpConfig() {
    const rows = await queryAll(
        `SELECT setting_key, setting_value FROM settings
     WHERE hospital_id IS NULL AND setting_key IN
       ('platform_smtp_host', 'platform_smtp_port', 'platform_smtp_user', 'platform_smtp_pass', 'platform_smtp_from_name')`,
        []
    );
    const map = {};
    rows.forEach(r => { map[r.setting_key] = r.setting_value; });

    return {
        host: map.platform_smtp_host || process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(map.platform_smtp_port) || parseInt(process.env.SMTP_PORT) || 587,
        user: map.platform_smtp_user || process.env.SMTP_USER,
        pass: map.platform_smtp_pass || process.env.SMTP_PASS,
        fromName: map.platform_smtp_from_name || 'MediDoc'
    };
}

export async function sendPlatformEmail(to, subject, text, html = null) {
    try {
        const cfg = await getPlatformSmtpConfig();
        const transporter = nodemailer.createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: false,
            auth: { user: cfg.user, pass: cfg.pass }
        });

        await transporter.sendMail({
            from: cfg.user ? `${cfg.fromName} <${cfg.user}>` : 'MediDoc <noreply@medidoc.sn>',
            to,
            subject,
            text,
            ...(html ? { html } : {})
        });
        console.log(`✅ Email plateforme envoyé à ${to}`);
        return true;
    } catch (error) {
        console.error('❌ Erreur email plateforme:', error.message);
        return false;
    }
}
