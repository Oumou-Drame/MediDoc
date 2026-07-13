import express from 'express';
import { protect, requireAdmin } from '../middleware/auth-middleware.js';
import { queryOne, queryAll, query } from '../config/db.js';
import { getAllBalances, recharge, getTransactions } from '../utils/credits.js';
import { testSmtpConnection, explainSmtpError } from '../utils/sms.js';

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
// Configuration SMTP plateforme (emails système : demande approuvée/refusée,
// mot de passe oublié). À NE PAS CONFONDRE avec la configuration d'envoi par
// hôpital ci-dessus (hospital_send_config), qui sert aux envois de résultats aux
// patients. Stockée dans `settings` (hospital_id IS NULL, clés platform_smtp_*).
// ===========================================================

const PLATFORM_SMTP_KEYS = ['platform_smtp_host', 'platform_smtp_port', 'platform_smtp_user', 'platform_smtp_pass', 'platform_smtp_from_name'];

// GET /api/admin/platform-smtp-config — config SMTP plateforme (mot de passe masqué)
router.get('/platform-smtp-config', protect, requireAdmin, async (req, res) => {
    try {
        const rows = await queryAll(
            `SELECT setting_key, setting_value FROM settings WHERE hospital_id IS NULL AND setting_key = ANY($1)`,
            [PLATFORM_SMTP_KEYS]
        );
        const map = {};
        rows.forEach(r => { map[r.setting_key] = r.setting_value; });

        res.json({
            success: true,
            data: {
                smtp_host: map.platform_smtp_host || '',
                smtp_port: map.platform_smtp_port ? parseInt(map.platform_smtp_port) : 587,
                smtp_user: map.platform_smtp_user || '',
                smtp_pass: map.platform_smtp_pass ? '••••••••' : '',
                smtp_from_name: map.platform_smtp_from_name || 'MediDoc'
            }
        });
    } catch (err) {
        console.error('Get platform SMTP config error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/admin/platform-smtp-config — modifier la config SMTP plateforme
router.put('/platform-smtp-config', protect, requireAdmin, async (req, res) => {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_name } = req.body;
    if (!smtp_user) {
        return res.status(400).json({ error: "L'adresse email est requise" });
    }
    try {
        const existingPassRow = await queryOne(
            `SELECT setting_value FROM settings WHERE hospital_id IS NULL AND setting_key = 'platform_smtp_pass'`,
            []
        );
        const passwordToStore = (smtp_pass && smtp_pass !== '••••••••') ? smtp_pass : (existingPassRow?.setting_value || null);

        const valeurs = {
            platform_smtp_host: smtp_host || 'smtp.gmail.com',
            platform_smtp_port: String(smtp_port || 587),
            platform_smtp_user: smtp_user,
            platform_smtp_from_name: smtp_from_name || 'MediDoc',
            ...(passwordToStore ? { platform_smtp_pass: passwordToStore } : {})
        };

        for (const [key, value] of Object.entries(valeurs)) {
            const existing = await queryOne('SELECT id FROM settings WHERE setting_key = $1 AND hospital_id IS NULL', [key]);
            if (existing) {
                await query('UPDATE settings SET setting_value = $1, updated_at = NOW() WHERE id = $2', [String(value), existing.id]);
            } else {
                await query('INSERT INTO settings (setting_key, setting_value, hospital_id, updated_at) VALUES ($1, $2, NULL, NOW())', [key, String(value)]);
            }
        }

        res.json({ success: true, message: 'Configuration SMTP plateforme mise à jour' });
    } catch (err) {
        console.error('Update platform SMTP config error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/admin/platform-smtp-config/test — tester la config SMTP plateforme
router.post('/platform-smtp-config/test', protect, requireAdmin, async (req, res) => {
    const { smtp_host, smtp_port, smtp_user, smtp_pass } = req.body;
    if (!smtp_user) {
        return res.status(400).json({ error: "L'adresse email est requise pour tester" });
    }

    let passwordToTest = smtp_pass;
    if (!passwordToTest || passwordToTest === '••••••••') {
        const existing = await queryOne(
            `SELECT setting_value FROM settings WHERE hospital_id IS NULL AND setting_key = 'platform_smtp_pass'`,
            []
        );
        passwordToTest = existing?.setting_value || null;
    }
    if (!passwordToTest) {
        return res.status(400).json({ error: "Le mot de passe d'application est requis pour tester" });
    }

    const result = await testSmtpConnection({
        host: smtp_host || 'smtp.gmail.com',
        port: smtp_port || 587,
        user: smtp_user,
        pass: passwordToTest
    });

    if (result.success) {
        res.json({ success: true, message: 'Connexion réussie — les emails système (approbation, refus, mot de passe oublié) peuvent être envoyés' });
    } else {
        res.status(400).json({ error: explainSmtpError(result.error) });
    }
});

// ===========================================================
// Paramètres techniques globaux de la plateforme (section 3.1)
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
