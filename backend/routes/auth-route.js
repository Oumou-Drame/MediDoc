import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool, { queryOne, query } from '../config/db.js';
import { protect } from '../middleware/auth-middleware.js';
import { sendPlatformEmail } from '../utils/platformMailer.js';

const router = express.Router();
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30j
};

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

// Verrouillage temporaire après plusieurs mots de passe erronés (anti brute-force)
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MINUTES = 15;
const LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MINUTES * 60 * 1000;

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// POST /api/auth/login — Connexion par email (l'email sert d'identifiant, plus de username)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Veuillez fournir un email et un mot de passe' });
    }
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (user.rows.length === 0) {
        return res.status(400).json({ message: 'Email ou mot de passe incorrects' });
    }

    const userData = user.rows[0];
    if (!userData.is_active) {
        return res.status(403).json({ message: 'Ce compte est désactivé' });
    }

    // Compte temporairement verrouillé après trop de mots de passe erronés
    if (userData.locked_until && new Date(userData.locked_until) > new Date()) {
        const minutesRestantes = Math.ceil((new Date(userData.locked_until) - new Date()) / 60000);
        return res.status(403).json({ message: `Trop de tentatives échouées. Réessayez dans ${minutesRestantes} minute(s).` });
    }

    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
        const nouvellesTentatives = (userData.failed_login_attempts || 0) + 1;

        if (nouvellesTentatives >= MAX_LOGIN_ATTEMPTS) {
            const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
            await query('UPDATE users SET failed_login_attempts = 0, locked_until = $1 WHERE id = $2', [lockedUntil, userData.id]);
            return res.status(403).json({ message: `Trop de tentatives échouées. Compte bloqué ${LOCKOUT_DURATION_MINUTES} minutes.` });
        }

        await query('UPDATE users SET failed_login_attempts = $1 WHERE id = $2', [nouvellesTentatives, userData.id]);
        return res.status(400).json({ message: 'Email ou mot de passe incorrects' });
    }

    // Connexion réussie : on réinitialise le compteur de tentatives
    if (userData.failed_login_attempts > 0 || userData.locked_until) {
        await query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [userData.id]);
    }

    const token = generateToken(userData.id);
    res.cookie('token', token, cookieOptions);
    res.json({
        user: {
            id: userData.id,
            email: userData.email,
            role: userData.role,
            full_name: userData.full_name,
            hospital_id: userData.hospital_id,
            is_technician: userData.is_technician,
            active_view: userData.active_view,
            must_change_password: userData.must_change_password
        }
    });
});

//  Me // GET /api/auth/me — Récupère les infos de l'utilisateur connecté
router.get('/me', protect, async (req, res) => {
    res.json(req.user);
});

// Logout // POST /api/auth/logout — Déconnexion (supprime le cookie token)
router.post('/logout', (req, res) => {
    res.cookie('token', '', { ...cookieOptions, maxAge: 1 });
    res.json({ message: 'Déconnexion réussie' });
});

// POST /api/auth/forgot-password — Demande de réinitialisation (email système fixe)
// Réponse volontairement identique que le compte existe ou non, pour ne pas révéler les emails enregistrés.
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email requis' });
    }
    const genericResponse = { success: true, message: 'Si ce compte existe, un email de réinitialisation a été envoyé.' };

    try {
        const user = await queryOne('SELECT id, email, full_name FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase()]);
        if (!user) {
            return res.json(genericResponse);
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

        await query(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, token, expiresAt]
        );

        const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;
        const subject = 'MediDoc - Réinitialisation de votre mot de passe';
        const text = `Bonjour ${user.full_name},\n\nUne demande de réinitialisation de mot de passe a été faite pour votre compte.\n\nLien (valable 1 heure) : ${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;
        const html = `
      <h2>MediDoc - Réinitialisation de mot de passe</h2>
      <p>Bonjour <strong>${user.full_name}</strong>,</p>
      <p>Une demande de réinitialisation de mot de passe a été faite pour votre compte.</p>
      <p><a href="${resetUrl}">Cliquez ici pour choisir un nouveau mot de passe</a></p>
      <p style="color:#dc2626;">⚠️ Ce lien expire dans 1 heure.</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `;

        await sendPlatformEmail(user.email, subject, text, html);
        res.json(genericResponse);
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/auth/reset-password — Confirme la réinitialisation avec le token reçu par email
router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    try {
        const resetToken = await queryOne(
            'SELECT * FROM password_reset_tokens WHERE token = $1',
            [token]
        );
        if (!resetToken || resetToken.used || new Date(resetToken.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Lien invalide ou expiré' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await query('UPDATE users SET password = $1, must_change_password = false, updated_at = NOW() WHERE id = $2', [hashedPassword, resetToken.user_id]);
        await query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetToken.id]);

        res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
