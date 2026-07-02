import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
<<<<<<< HEAD
import pool from '../config/db.js';
import { protect } from '../middleware/auth-middleware.js';
import { sendEmail } from '../utils/sms.js';
=======
import pool, { queryOne, query } from '../config/db.js';
import { protect } from '../middleware/auth-middleware.js';
import { sendPlatformEmail } from '../utils/platformMailer.js';
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a

const router = express.Router();
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
<<<<<<< HEAD
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30d
};

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// POST /api/auth/login — Connexion avec email et mot de passe
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email et mot de passe requis' });
    }
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
        return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
    }

    const userData = user.rows[0];
    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
        return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
=======
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30day
};

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// Login // POST /api/auth/login — Connexion par email (l'email sert d'identifiant, plus de username)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Veuillez fournir un email et un mot de passe' });
    }
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (user.rows.length === 0) {
        return res.status(400).json({ message: 'Identifiants invalides' });
    }

    const userData = user.rows[0];
    if (!userData.is_active) {
        return res.status(403).json({ message: 'Ce compte est désactivé' });
    }

    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
        return res.status(400).json({ message: 'Identifiants invalides' });
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
    }

    const token = generateToken(userData.id);
    res.cookie('token', token, cookieOptions);
    res.json({
        user: {
            id: userData.id,
            email: userData.email,
            role: userData.role,
            full_name: userData.full_name,
<<<<<<< HEAD
            phone: userData.phone,
            hospital_id: userData.hospital_id
        }
    });
});

// GET /api/auth/me — Récupère les infos de l'utilisateur connecté
router.get('/me', protect, async (req, res) => {
    const user = await pool.query(
        'SELECT id, email, full_name, role, phone, hospital_id, is_active FROM users WHERE id = $1',
        [req.user.id]
    );
    if (user.rows.length === 0) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json(user.rows[0]);
});

// PUT /api/auth/profile — Modifier son profil
router.put('/profile', protect, async (req, res) => {
    const { full_name, phone } = req.body;
    try {
        await pool.query(
            'UPDATE users SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone), updated_at = NOW() WHERE id = $3',
            [full_name, phone, req.user.id]
        );
        res.json({ success: true, message: 'Profil mis à jour' });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/auth/password — Changer son mot de passe
router.put('/password', protect, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Ancien et nouveau mot de passe requis' });
    }
    if (new_password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    try {
        const user = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
        const isMatch = await bcrypt.compare(current_password, user.rows[0].password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Ancien mot de passe incorrect' });
        }
        const hashed = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashed, req.user.id]);
        res.json({ success: true, message: 'Mot de passe changé avec succès' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/auth/forgot-password — Demander une réinitialisation de mot de passe
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });

    try {
        const user = await pool.query('SELECT id, full_name FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            // Pour des raisons de sécurité, on ne dit pas si l'email existe ou non, on renvoie succès
            return res.json({ success: true, message: 'Si l\'email existe, un lien a été envoyé.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000).toISOString(); // 1 heure

        await pool.query(
            'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE email = $3',
            [resetToken, resetExpires, email]
        );

        const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:4200'}/reset-password?token=${resetToken}`;
        const subject = 'Réinitialisation de votre mot de passe MediDoc';
        const text = `Bonjour ${user.rows[0].full_name},\n\nVous avez demandé la réinitialisation de votre mot de passe.\n\nCliquez sur ce lien pour en définir un nouveau : ${resetUrl}\n\nCe lien est valide pendant 1 heure.\n\nSi vous n'avez pas fait cette demande, ignorez cet email.`;
        const html = `
            <h2>MediDoc - Réinitialisation de mot de passe</h2>
            <p>Bonjour <strong>${user.rows[0].full_name}</strong>,</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
            <p><a href="${resetUrl}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Réinitialiser mon mot de passe</a></p>
            <p>Ou copiez ce lien : <br> <a href="${resetUrl}">${resetUrl}</a></p>
            <p style="color: #dc2626;">⚠️ Ce lien est valide pendant 1 heure.</p>
            <p>Si vous n'avez pas fait cette demande, vous pouvez ignorer cet email.</p>
        `;

        await sendEmail(email, subject, text, null, html);

        res.json({ success: true, message: 'Si l\'email existe, un lien a été envoyé.' });
=======
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
        const user = await queryOne('SELECT id, email, full_name FROM users WHERE email = $1 AND is_active = 1', [email.toLowerCase()]);
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
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

<<<<<<< HEAD
// POST /api/auth/reset-password — Enregistrer le nouveau mot de passe
router.post('/reset-password', async (req, res) => {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'Jeton et nouveau mot de passe requis' });

    if (new_password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    try {
        const user = await pool.query(
            'SELECT id FROM users WHERE reset_token = $1 AND reset_expires > NOW()',
            [token]
        );

        if (user.rows.length === 0) {
            return res.status(400).json({ error: 'Jeton invalide ou expiré' });
        }

        const hashed = await bcrypt.hash(new_password, 10);
        await pool.query(
            'UPDATE users SET password = $1, reset_token = NULL, reset_expires = NULL, updated_at = NOW() WHERE id = $2',
            [hashed, user.rows[0].id]
        );
=======
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
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a

        res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
<<<<<<< HEAD
});

// POST /api/auth/logout — Déconnexion
router.post('/logout', (req, res) => {
    res.cookie('token', '', { ...cookieOptions, maxAge: 1 });
    res.json({ message: 'Déconnexion réussie' });
=======
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
});

export default router;
