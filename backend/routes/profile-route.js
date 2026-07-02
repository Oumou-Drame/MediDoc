import express from 'express';
import bcrypt from 'bcryptjs';
import { protect, effectiveRoles } from '../middleware/auth-middleware.js';
import { queryOne, query } from '../config/db.js';

const router = express.Router();

// GET /api/profile — infos du compte connecté (commun aux 3 rôles)
router.get('/', protect, async (req, res) => {
    try {
        const user = await queryOne(
            `SELECT id, email, full_name, phone, role, hospital_id, is_technician, active_view, created_at
             FROM users WHERE id = $1`,
            [req.user.id]
        );
        let hospital = null;
        if (user.hospital_id) {
            hospital = await queryOne('SELECT id, name FROM hospitals WHERE id = $1', [user.hospital_id]);
        }
        res.json({
            success: true,
            data: { ...user, roles: effectiveRoles(req.user), hospital }
        });
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/profile — modifier les infos personnelles (email non modifiable, c'est l'identifiant de connexion)
router.put('/', protect, async (req, res) => {
    const { full_name, phone } = req.body;
    if (!full_name) {
        return res.status(400).json({ error: 'Le nom complet est requis' });
    }
    try {
        await query(
            'UPDATE users SET full_name = $1, phone = $2, updated_at = NOW() WHERE id = $3',
            [full_name, phone || null, req.user.id]
        );
        res.json({ success: true, message: 'Profil mis à jour avec succès' });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/profile/password — changement de mot de passe (mot de passe actuel + nouveau + confirmation)
router.put('/password', protect, async (req, res) => {
    const { current_password, new_password, confirm_password } = req.body;
    if (!current_password || !new_password || !confirm_password) {
        return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    if (new_password !== confirm_password) {
        return res.status(400).json({ error: 'Les mots de passe ne correspondent pas' });
    }
    if (new_password.length < 8) {
        return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
    }

    try {
        const user = await queryOne('SELECT password FROM users WHERE id = $1', [req.user.id]);
        const isMatch = await bcrypt.compare(current_password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await query(
            'UPDATE users SET password = $1, must_change_password = false, updated_at = NOW() WHERE id = $2',
            [hashedPassword, req.user.id]
        );
        res.json({ success: true, message: 'Mot de passe modifié avec succès' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/profile/technician-capacity — un responsable de labo active/désactive lui-même
// sa capacité à agir aussi comme technicien (cadrage section 3.4). Réservé au rôle lab_manager :
// un technicien ou l'admin plateforme n'ont pas de capacité à cumuler.
router.put('/technician-capacity', protect, async (req, res) => {
    if (req.user.role !== 'lab_manager') {
        return res.status(403).json({ error: 'Réservé aux responsables de labo' });
    }
    const active = !!req.body.active;
    try {
        // Si on désactive la capacité, on retombe automatiquement sur la vue responsable de labo.
        const newActiveView = active ? (req.user.active_view || 'lab_manager') : 'lab_manager';
        await query(
            'UPDATE users SET is_technician = $1, active_view = $2, updated_at = NOW() WHERE id = $3',
            [active, newActiveView, req.user.id]
        );
        res.json({
            success: true,
            message: active ? 'Capacité technicien activée' : 'Capacité technicien désactivée',
            is_technician: active,
            active_view: newActiveView
        });
    } catch (err) {
        console.error('Toggle technician capacity error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/profile/view — switch de vue (responsable de labo / technicien) pour les comptes à double capacité
// Le choix est mémorisé en base, pas redemandé à chaque connexion.
router.put('/view', protect, async (req, res) => {
    const { view } = req.body;
    if (!['lab_manager', 'technician'].includes(view)) {
        return res.status(400).json({ error: "Vue invalide (attendu: 'lab_manager' ou 'technician')" });
    }
    if (!effectiveRoles(req.user).includes(view)) {
        return res.status(403).json({ error: "Vous n'avez pas accès à cette vue" });
    }

    try {
        await query('UPDATE users SET active_view = $1, updated_at = NOW() WHERE id = $2', [view, req.user.id]);
        res.json({ success: true, message: 'Vue mise à jour', active_view: view });
    } catch (err) {
        console.error('Switch view error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
