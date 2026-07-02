import express from 'express';
<<<<<<< HEAD
import bcrypt from 'bcryptjs';
import { protect, requireResponsableLabo, requireAdmin } from '../middleware/auth-middleware.js';
=======
import { protect, requireAdmin } from '../middleware/auth-middleware.js';
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
import { queryOne, queryAll, query } from '../config/db.js';
import { getAllBalances, recharge, getTransactions } from '../utils/credits.js';

const router = express.Router();

<<<<<<< HEAD
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
=======
// ===========================================================
// IMPORTANT : l'admin est un rôle plateforme. Il ne doit JAMAIS pouvoir lire
// de données patient (noms, téléphones, résultats) — voir cadrage section 3.1.
// Toutes les routes ci-dessous restent volontairement à l'écart de medical_results.
// ===========================================================

// GET /api/admin/lab-managers — liste des comptes responsables de labo (tous hôpitaux)
router.get('/lab-managers', protect, requireAdmin, async (req, res) => {
    try {
        const users = await queryAll(
            `SELECT u.id, u.email, u.full_name, u.phone, u.is_active, u.is_technician, u.created_at,
              h.id as hospital_id, h.name as hospital_name
       FROM users u
       JOIN hospitals h ON h.id = u.hospital_id
       WHERE u.role = 'lab_manager'
       ORDER BY h.name, u.created_at DESC`,
            []
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
        );
        res.json({ success: true, data: users });
    } catch (err) {
        console.error('List lab managers error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

<<<<<<< HEAD
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
=======
// PUT /api/admin/lab-managers/:id/toggle — suspendre/réactiver un compte responsable de labo
router.put('/lab-managers/:id/toggle', protect, requireAdmin, async (req, res) => {
    try {
        const user = await queryOne("SELECT * FROM users WHERE id = $1 AND role = 'lab_manager'", [req.params.id]);
        if (!user) {
            return res.status(404).json({ error: 'Compte non trouvé' });
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
        }
        const newStatus = user.is_active ? 0 : 1;
        await query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2', [newStatus, req.params.id]);
        res.json({ success: true, message: `Compte ${newStatus ? 'réactivé' : 'suspendu'}` });
    } catch (err) {
        console.error('Toggle lab manager error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

<<<<<<< HEAD
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
=======
// ===========================================================
// Crédits SMS/WhatsApp — vue plateforme (section 7.1)
// ===========================================================

// GET /api/admin/credits — solde virtuel de chaque hôpital (somme = répartition du solde réel plateforme)
router.get('/credits', protect, requireAdmin, async (req, res) => {
    try {
        const balances = await getAllBalances();
        const total = balances.reduce((sum, b) => sum + parseFloat(b.balance), 0);
        res.json({ success: true, data: { hospitals: balances, total_virtual_balance: total } });
    } catch (err) {
        console.error('Get credits overview error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/admin/credits/:hospitalId/transactions — historique des recharges/déductions d'un hôpital
router.get('/credits/:hospitalId/transactions', protect, requireAdmin, async (req, res) => {
    try {
        const transactions = await getTransactions(req.params.hospitalId, 100);
        res.json({ success: true, data: transactions });
    } catch (err) {
        console.error('Get credit transactions error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/admin/credits/:hospitalId/allocate — allocation manuelle après paiement reçu hors plateforme
router.post('/credits/:hospitalId/allocate', protect, requireAdmin, async (req, res) => {
    const { amount, note } = req.body;
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Montant invalide' });
    }
    try {
        const hospital = await queryOne('SELECT id FROM hospitals WHERE id = $1', [req.params.hospitalId]);
        if (!hospital) {
            return res.status(404).json({ error: 'Hôpital non trouvé' });
        }
        const newBalance = await recharge(req.params.hospitalId, parsedAmount, req.user.id, note || null);

        await query(
            'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
            [req.user.id, 'credit_allocation', `Allocation de ${parsedAmount} crédits à l'hôpital #${req.params.hospitalId}`, req.ip]
        );

        res.json({ success: true, message: 'Crédits alloués avec succès', data: { new_balance: newBalance } });
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
    } catch (err) {
        console.error('Allocate credits error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

<<<<<<< HEAD
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
=======
// ===========================================================
// Paramètres techniques globaux de la plateforme (section 3.1)
// (les identifiants sensibles du fournisseur SMS/WhatsApp restent en .env, non exposés ici)
// ===========================================================

// GET /api/admin/settings — paramètres plateforme (hospital_id IS NULL)
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
router.get('/settings', protect, requireAdmin, async (req, res) => {
    try {
        const settings = await queryAll('SELECT * FROM settings WHERE hospital_id IS NULL', []);
        const settingsObj = {};
        settings.forEach(s => { settingsObj[s.setting_key] = s.setting_value; });
        res.json({ success: true, data: settingsObj });
    } catch (err) {
        console.error('Get settings error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

<<<<<<< HEAD
// PUT /api/admin/settings — Modifier les paramètres globaux (ADMIN UNIQUEMENT)
=======
// PUT /api/admin/settings — modifier les paramètres plateforme
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
router.put('/settings', protect, requireAdmin, async (req, res) => {
    try {
        const updates = req.body;
        for (const [key, value] of Object.entries(updates)) {
            const existing = await queryOne('SELECT id FROM settings WHERE setting_key = $1 AND hospital_id IS NULL', [key]);
            if (existing) {
                await query('UPDATE settings SET setting_value = $1, updated_at = NOW() WHERE id = $2', [String(value), existing.id]);
            } else {
                await query('INSERT INTO settings (setting_key, setting_value, hospital_id, updated_at) VALUES ($1, $2, NULL, NOW())', [key, String(value)]);
            }
        }
        res.json({ success: true, message: 'Paramètres mis à jour' });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
<<<<<<< HEAD

export default router;
=======

// GET /api/admin/dashboard — vue plateforme : hôpitaux, demandes en attente, crédits (jamais de données patient)
router.get('/dashboard', protect, requireAdmin, async (req, res) => {
    try {
        const [hospitalsTotal, hospitalsActive, pendingRequests, balances] = await Promise.all([
            queryOne('SELECT COUNT(*) as count FROM hospitals', []),
            queryOne("SELECT COUNT(*) as count FROM hospitals WHERE status = 'active'", []),
            queryOne("SELECT COUNT(*) as count FROM hospital_requests WHERE status = 'pending'", []),
            getAllBalances()
        ]);

        res.json({
            success: true,
            data: {
                hospitaux_total: parseInt(hospitalsTotal.count),
                hospitaux_actifs: parseInt(hospitalsActive.count),
                demandes_en_attente: parseInt(pendingRequests.count),
                repartition_credits: balances,
                solde_virtuel_total: balances.reduce((sum, b) => sum + parseFloat(b.balance), 0)
            }
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
