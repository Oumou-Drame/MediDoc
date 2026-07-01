import express from 'express';
import bcrypt from 'bcryptjs';
import { protect, requireResponsableLabo, requireAdmin } from '../middleware/auth-middleware.js';
import { queryOne, queryAll, query } from '../config/db.js';

const router = express.Router();

// Helper pour filtrer par hôpital (sauf pour l'admin global)
const getHospitalFilter = (req, prefix = '') => {
    if (req.user.role === 'admin') return '1=1';
    return `${prefix}hospital_id = ${req.user.hospital_id}`;
};

// GET /api/admin/users — Liste des techniciens et responsables
router.get('/users', protect, requireResponsableLabo, async (req, res) => {
    try {
        const users = await queryAll(
            `SELECT id, email, full_name, role, phone, is_active, created_at 
             FROM users WHERE role IN ('technicien', 'responsable_labo') 
             AND ${getHospitalFilter(req, '')}
             ORDER BY created_at DESC`
        );
        res.json({ success: true, data: users });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/admin/users — Créer un technicien ou responsable de laboratoire
router.post('/users', protect, requireResponsableLabo, async (req, res) => {
    const { email, full_name, phone, role } = req.body;

    if (!email || !full_name) {
        return res.status(400).json({ error: 'Email et nom complet requis' });
    }

    const userRole = role || 'technicien';
    if (!['technicien', 'responsable_labo'].includes(userRole)) {
        return res.status(400).json({ error: 'Rôle invalide. Choisissez technicien ou responsable_labo' });
    }

    try {
        const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
        if (existing) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre compte' });
        }

        const hospital_id = req.user.role === 'admin' && req.body.hospital_id ? req.body.hospital_id : req.user.hospital_id;

        // Générer un mot de passe temporaire
        const tempPassword = Math.random().toString(36).slice(-8).toUpperCase() + Math.random().toString(36).slice(-4);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const result = await query(
            `INSERT INTO users (email, password, full_name, role, phone, hospital_id, is_active, created_at, updated_at, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NOW(), true) RETURNING id`,
            [email, hashedPassword, full_name, userRole, phone || null, hospital_id]
        );

        await query(
            'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
            [req.user.id, 'create_user', `Création ${userRole}: ${email}`, req.ip]
        );
        
        res.json({ 
            success: true, 
            message: `Compte créé pour ${full_name}`,
            data: { id: result.rows[0].id, temp_password: tempPassword }
        });
    } catch (err) {
        console.error('Create user error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/admin/users/:id/toggle — Activer/désactiver un compte
router.put('/users/:id/toggle', protect, requireResponsableLabo, async (req, res) => {
    try {
        const user = await queryOne(`SELECT * FROM users WHERE id = $1 AND ${getHospitalFilter(req)}`, [req.params.id]);
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const newStatus = user.is_active ? 0 : 1;
        await query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2', [newStatus, req.params.id]);

        res.json({ success: true, message: `Utilisateur ${newStatus ? 'activé' : 'désactivé'}` });
    } catch (err) {
        console.error('Toggle user error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/admin/users/:id — Modifier un technicien existant
router.put('/users/:id', protect, requireResponsableLabo, async (req, res) => {
    const { full_name, email, phone, role } = req.body;

    if (!full_name || !email) {
        return res.status(400).json({ error: 'Nom complet et email sont obligatoires' });
    }

    try {
        const user = await queryOne(`SELECT id, role FROM users WHERE id = $1 AND role IN ($2, $3) AND ${getHospitalFilter(req)}`, 
            [req.params.id, 'technicien', 'responsable_labo']);
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const emailTaken = await queryOne('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.params.id]);
        if (emailTaken) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre compte' });
        }

        const newRole = role && ['technicien', 'responsable_labo'].includes(role) ? role : user.role;

        await query(
            `UPDATE users SET full_name = $1, email = $2, phone = $3, role = $4, updated_at = NOW() WHERE id = $5`,
            [full_name, email, phone || null, newRole, req.params.id]
        );

        res.json({ success: true, message: 'Utilisateur modifié avec succès' });
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/admin/users/:id — Supprimer un technicien
router.delete('/users/:id', protect, requireResponsableLabo, async (req, res) => {
    try {
        const result = await query(`DELETE FROM users WHERE id = $1 AND role IN ($2, $3) AND ${getHospitalFilter(req)} RETURNING id`, 
            [req.params.id, 'technicien', 'responsable_labo']);
            
        if (result.rowCount === 0) {
             return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        res.json({ success: true, message: 'Utilisateur supprimé' });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/admin/stats — Statistiques pour le dashboard
router.get('/stats', protect, requireResponsableLabo, async (req, res) => {
    try {
        const totalResults = await queryOne(`SELECT COUNT(*) as count FROM medical_results WHERE ${getHospitalFilter(req)}`, []);
        const sentResults = await queryOne(`SELECT COUNT(*) as count FROM medical_results WHERE status IN ('sent', 'accessed') AND ${getHospitalFilter(req)}`, []);
        const pendingResults = await queryOne(`SELECT COUNT(*) as count FROM medical_results WHERE status = 'pending' AND ${getHospitalFilter(req)}`, []);
        const accessedResults = await queryOne(`SELECT COUNT(*) as count FROM medical_results WHERE status = 'accessed' AND ${getHospitalFilter(req)}`, []);
        const expiredResults = await queryOne(`SELECT COUNT(*) as count FROM medical_results WHERE status = 'expired' AND ${getHospitalFilter(req)}`, []);
        const totalTechnicians = await queryOne(`SELECT COUNT(*) as count FROM users WHERE role IN ('technicien', 'responsable_labo') AND ${getHospitalFilter(req)}`, []);
        const emailSms = await queryOne(`SELECT COUNT(*) as count FROM medical_results WHERE channel = 'email_sms' AND ${getHospitalFilter(req)}`, []);
        const emailWhatsapp = await queryOne(`SELECT COUNT(*) as count FROM medical_results WHERE channel = 'email_whatsapp' AND ${getHospitalFilter(req)}`, []);

        // Optional: scope activity logs? Let's leave them for now or join users.

        res.json({
            success: true,
            data: {
                total_results: parseInt(totalResults.count),
                sent_results: parseInt(sentResults.count),
                pending_results: parseInt(pendingResults.count),
                accessed_results: parseInt(accessedResults.count),
                expired_results: parseInt(expiredResults.count),
                total_technicians: parseInt(totalTechnicians.count),
                channels: {
                    email_sms: parseInt(emailSms.count),
                    email_whatsapp: parseInt(emailWhatsapp.count)
                }
            }
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/admin/settings — Lire les paramètres globaux (ADMIN UNIQUEMENT)
router.get('/settings', protect, requireAdmin, async (req, res) => {
    try {
        const settings = await queryAll('SELECT * FROM settings', []);
        const settingsObj = {};
        settings.forEach(s => { settingsObj[s.setting_key] = s.setting_value; });
        res.json({ success: true, data: settingsObj });
    } catch (err) {
        console.error('Get settings error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/admin/settings — Modifier les paramètres globaux (ADMIN UNIQUEMENT)
router.put('/settings', protect, requireAdmin, async (req, res) => {
    try {
        const updates = req.body;
        for (const [key, value] of Object.entries(updates)) {
            const existing = await queryOne('SELECT id FROM settings WHERE setting_key = $1', [key]);
            if (existing) {
                await query('UPDATE settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = $2', [String(value), key]);
            } else {
                await query('INSERT INTO settings (setting_key, setting_value, updated_at) VALUES ($1, $2, NOW())', [key, String(value)]);
            }
        }
        res.json({ success: true, message: 'Paramètres mis à jour' });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;