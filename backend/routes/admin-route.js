import express from 'express';
import { protect, requireAdmin } from '../middleware/auth-middleware.js';
import { queryOne, queryAll, query } from '../config/db.js';
import { getAllBalances, recharge, getTransactions } from '../utils/credits.js';

const router = express.Router();

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
        );
        res.json({ success: true, data: users });
    } catch (err) {
        console.error('List lab managers error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/admin/lab-managers/:id/toggle — suspendre/réactiver un compte responsable de labo
router.put('/lab-managers/:id/toggle', protect, requireAdmin, async (req, res) => {
    try {
        const user = await queryOne("SELECT * FROM users WHERE id = $1 AND role = 'lab_manager'", [req.params.id]);
        if (!user) {
            return res.status(404).json({ error: 'Compte non trouvé' });
        }
        const newStatus = user.is_active ? 0 : 1;
        await query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2', [newStatus, req.params.id]);
        res.json({ success: true, message: `Compte ${newStatus ? 'réactivé' : 'suspendu'}` });
    } catch (err) {
        console.error('Toggle lab manager error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

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
    } catch (err) {
        console.error('Allocate credits error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ===========================================================
// Paramètres techniques globaux de la plateforme (section 3.1)
// (les identifiants sensibles du fournisseur SMS/WhatsApp restent en .env, non exposés ici)
// ===========================================================

// GET /api/admin/settings — paramètres plateforme (hospital_id IS NULL)
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

// PUT /api/admin/settings — modifier les paramètres plateforme
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
