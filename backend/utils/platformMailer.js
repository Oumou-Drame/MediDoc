import nodemailer from 'nodemailer';

// Mailer "système" : configuration fixe au niveau plateforme (variables d'environnement),
// totalement indépendante de la configuration d'envoi de chaque hôpital.
// Utilisé uniquement pour les emails sensibles/transverses (ex: mot de passe oublié),
// afin de ne jamais dépendre d'une config hôpital potentiellement mal réglée (voir cadrage, section 8).
const platformTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

export async function sendPlatformEmail(to, subject, text, html = null) {
    try {
        await platformTransporter.sendMail({
            from: process.env.SMTP_USER ? `MediDoc <${process.env.SMTP_USER}>` : 'MediDoc <noreply@medidoc.sn>',
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
