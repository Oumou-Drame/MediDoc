import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { protect } from '../middleware/auth-middleware.js';

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
            matricule: userData.matricule,
            date_naissance: userData.date_naissance
        }
    });
});

// GET /api/auth/me — Récupère les infos de l'utilisateur connecté
router.get('/me', protect, async (req, res) => {
    const user = await pool.query(
        'SELECT id, email, full_name, role, phone, matricule, date_naissance, is_active FROM users WHERE id = $1',
        [req.user.id]
    );
    if (user.rows.length === 0) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json(user.rows[0]);
});

// PUT /api/auth/profile — Modifier son profil
router.put('/profile', protect, async (req, res) => {
    const { full_name, phone, date_naissance } = req.body;
    try {
        await pool.query(
            'UPDATE users SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone), date_naissance = COALESCE($3, date_naissance), updated_at = NOW() WHERE id = $4',
            [full_name, phone, date_naissance, req.user.id]
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

// POST /api/auth/logout — Déconnexion
router.post('/logout', (req, res) => {
    res.cookie('token', '', { ...cookieOptions, maxAge: 1 });
    res.json({ message: 'Déconnexion réussie' });
});

export default router;
