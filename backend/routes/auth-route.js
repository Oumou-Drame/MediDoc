import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/db.js';
import { protect } from '../middleware/auth-middleware.js';
import { sendEmail } from '../utils/sms.js';

const router = express.Router();
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
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
    }

    const token = generateToken(userData.id);
    res.cookie('token', token, cookieOptions);
    res.json({
        user: {
            id: userData.id,
            email: userData.email,
            role: userData.role,
            full_name: userData.full_name,
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
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

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

        res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/auth/logout — Déconnexion
router.post('/logout', (req, res) => {
    res.cookie('token', '', { ...cookieOptions, maxAge: 1 });
    res.json({ message: 'Déconnexion réussie' });
});

export default router;
