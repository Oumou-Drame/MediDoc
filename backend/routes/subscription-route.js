import express from 'express';
import { protect, requireAdmin, requireHospitalUser } from '../middleware/auth-middleware.js';
import { queryOne, queryAll, query } from '../config/db.js';

const router = express.Router();

// GET /api/subscription/plans — liste des packs disponibles (public)
router.get('/plans', async (req, res) => {
    try {
        const plans = await queryAll(
            'SELECT id, name, description, price, currency, duration_days, features FROM subscription_plans WHERE is_active = true ORDER BY sort_order',
            []
        );
        res.json({ success: true, data: plans });
    } catch (err) {
        console.error('Get plans error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/subscription/my — abonnement actuel de l'hôpital connecté
router.get('/my', protect, requireHospitalUser, async (req, res) => {
    try {
        const sub = await queryOne(
            `SELECT hs.*, sp.name as plan_name, sp.price, sp.currency, sp.features, sp.duration_days
             FROM hospital_subscriptions hs
       JOIN subscription_plans sp ON sp.id = hs.plan_id
             WHERE hs.hospital_id = $1
       ORDER BY hs.chosen_at DESC
       LIMIT 1`,
            [req.user.hospital_id]
        );
        res.json({ success: true, data: sub });
    } catch (err) {
        console.error('Get my subscription error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/subscription/choose — l'hôpital choisit un pack
router.post('/choose', protect, requireHospitalUser, async (req, res) => {
    const { plan_id } = req.body;
    console.log('POST /api/subscription/choose - plan_id:', plan_id);
    
    if (!plan_id) {
        return res.status(400).json({ error: 'Plan requis' });
    }

    try {
        const plan = await queryOne('SELECT * FROM subscription_plans WHERE id = $1 AND is_active = true', [plan_id]);
        console.log('Plan trouvé:', plan);
        
        if (!plan) {
            return res.status(404).json({ error: 'Pack non trouvé' });
        }

        // Si le plan est gratuit, activer immédiatement
        if (plan.price === 0) {
            console.log('Plan gratuit, activation immédiate');
            const now = new Date();
            const start_date = now;
            const end_date = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
            const trial_end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            await query(
                `INSERT INTO hospital_subscriptions (hospital_id, plan_id, status, payment_status, start_date, end_date, trial_end_date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    req.user.hospital_id,
                    plan_id,
                    'active',
                    'paid',
                    start_date,
                    end_date,
                    trial_end
                ]
            );

            await query('UPDATE users SET has_chosen_plan = true WHERE id = $1', [req.user.id]);

            return res.json({ success: true, message: 'Pack choisi', plan_trial: true, requires_payment: false });
        }

        // Si le plan est payant, retourner les infos pour paiement
        console.log('Plan payant, retour infos pour paiement');
        const response = { 
            success: true, 
            message: 'Pack sélectionné', 
            requires_payment: true,
            plan: {
                id: plan.id,
                name: plan.name,
                price: plan.price,
                currency: plan.currency,
                duration_days: plan.duration_days
            }
        };
        console.log('Réponse envoyée:', response);
        res.json(response);
    } catch (err) {
        console.error('Choose plan error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/admin/plans — admin voit tous les packs
router.get('/admin/plans', protect, requireAdmin, async (req, res) => {
    try {
        const plans = await queryAll('SELECT * FROM subscription_plans ORDER BY sort_order', []);
        res.json({ success: true, data: plans });
    } catch (err) {
        console.error('Admin get plans error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/admin/plans — admin crée un pack
router.post('/admin/plans', protect, requireAdmin, async (req, res) => {
    try {
        const { name, description, price, currency, duration_days, features, sort_order } = req.body;
        const result = await queryOne(
            `INSERT INTO subscription_plans (name, description, price, currency, duration_days, features, sort_order, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`,
            [name, description, price, currency || 'XOF', duration_days || 30, JSON.stringify(features), sort_order || 0]
        );
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Admin create plan error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/admin/subscriptions — admin voit tous les abonnements
router.get('/admin/subscriptions', protect, requireAdmin, async (req, res) => {
    try {
        const subs = await queryAll(
            `SELECT hs.*, sp.name as plan_name, sp.price, sp.currency, h.name as hospital_name,
                    u.full_name as contact_name, u.email as contact_email
       FROM hospital_subscriptions hs
       JOIN subscription_plans sp ON sp.id = hs.plan_id
       JOIN hospitals h ON h.id = hs.hospital_id
       JOIN users u ON u.hospital_id = h.id AND u.role = 'lab_manager'
       ORDER BY hs.chosen_at DESC`,
            []
        );
        res.json({ success: true, data: subs });
    } catch (err) {
        console.error('Admin get subscriptions error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/admin/subscriptions/:id/validate — admin valide un abonnement après paiement
router.put('/admin/subscriptions/:id/validate', protect, requireAdmin, async (req, res) => {
    const { transaction_id } = req.body;
    try {
        const sub = await queryOne('SELECT * FROM hospital_subscriptions WHERE id = $1', [req.params.id]);
        if (!sub) {
            return res.status(404).json({ error: 'Abonnement non trouvé' });
        }

        const plan = await queryOne('SELECT duration_days, price FROM subscription_plans WHERE id = $1', [sub.plan_id]);
        const now = new Date();
        const end_date = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

        await query(
            `UPDATE hospital_subscriptions
       SET status = 'active', payment_status = 'paid', transaction_id = $1,
           start_date = $2, end_date = $3, validated_by = $4, validated_at = NOW()
             WHERE id = $5`,
            [transaction_id || null, now, end_date, req.user.id, req.params.id]
        );

        res.json({ success: true, message: 'Abonnement activé', end_date });
    } catch (err) {
        console.error('Admin validate subscription error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/admin/subscriptions/:id/reject — admin rejette un abonnement
router.put('/admin/subscriptions/:id/reject', protect, requireAdmin, async (req, res) => {
    const { reason } = req.body;
    try {
        await query(
            `UPDATE hospital_subscriptions
       SET status = 'cancelled', payment_status = 'failed'
             WHERE id = $1`,
            [req.params.id]
        );
        res.json({ success: true, message: 'Abonnement refusé' });
    } catch (err) {
        console.error('Admin reject subscription error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;