import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { protect, requireAdmin } from '../middleware/auth-middleware.js';
import { queryOne, queryAll, query } from '../config/db.js';
import { sendPlatformEmail } from '../utils/platformMailer.js';

const router = express.Router();
const RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h pour le tout premier mot de passe

// ===========================================================
// Public — formulaire de demande d'inscription (landing page, section 6)
// ===========================================================

// POST /api/hospitals/request — un hôpital intéressé soumet une demande
router.post('/request', async (req, res) => {
    const { hospital_name, contact_name, contact_email, contact_phone, message } = req.body;

    if (!hospital_name || !contact_name || !contact_email) {
        return res.status(400).json({ error: "Nom de l'établissement, contact et email sont requis" });
    }

    try {
        await query(
            `INSERT INTO hospital_requests (hospital_name, contact_name, contact_email, contact_phone, message, status, created_at)
             VALUES ($1, $2, $3, $4, $5, 'pending', NOW())`,
            [hospital_name, contact_name, contact_email.toLowerCase(), contact_phone || null, message || null]
        );
        res.json({ success: true, message: 'Votre demande a bien été reçue. Notre équipe la vérifiera avant validation.' });
    } catch (err) {
        console.error('Hospital request error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ===========================================================
// Admin — gestion des demandes et des hôpitaux (niveau plateforme uniquement)
// ===========================================================

// GET /api/hospitals/requests — liste des demandes (filtrable par statut)
router.get('/requests', protect, requireAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        const where = status ? 'WHERE status = $1' : '';
        const params = status ? [status] : [];
        const requests = await queryAll(
            `SELECT * FROM hospital_requests ${where} ORDER BY created_at DESC`,
            params
        );
        res.json({ success: true, data: requests });
    } catch (err) {
        console.error('List hospital requests error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/hospitals/requests/:id/approve — crée l'hôpital + le premier compte responsable de labo
router.put('/requests/:id/approve', protect, requireAdmin, async (req, res) => {
    try {
        const reqRow = await queryOne('SELECT * FROM hospital_requests WHERE id = $1', [req.params.id]);
        if (!reqRow) {
            return res.status(404).json({ error: 'Demande non trouvée' });
        }
        if (reqRow.status !== 'pending') {
            return res.status(400).json({ error: 'Cette demande a déjà été traitée' });
        }

        const existingUser = await queryOne('SELECT id FROM users WHERE email = $1', [reqRow.contact_email]);
        if (existingUser) {
            return res.status(400).json({ error: 'Un compte existe déjà avec cet email de contact' });
        }

        const hospital = await queryOne(
            `INSERT INTO hospitals (name, contact_email, contact_phone, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, true, NOW(), NOW()) RETURNING id`,
            [reqRow.hospital_name, reqRow.contact_email, reqRow.contact_phone]
        );

        await query('INSERT INTO hospital_credits (hospital_id, balance) VALUES ($1, 0)', [hospital.id]);

        // Mot de passe initial : compte créé avec un mot de passe aléatoire inutilisable,
        // l'utilisateur le définit lui-même via un lien de réinitialisation (option retenue
        // pour la question ouverte section 10.2 — plus sûre qu'un mot de passe envoyé en clair).
        const placeholderHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
        const newUser = await queryOne(
            `INSERT INTO users (email, password, full_name, role, phone, hospital_id, is_active, must_change_password, created_at, updated_at)
             VALUES ($1, $2, $3, 'lab_manager', $4, $5, 1, true, NOW(), NOW()) RETURNING id`,
            [reqRow.contact_email, placeholderHash, reqRow.contact_name, reqRow.contact_phone, hospital.id]
        );

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
        await query(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [newUser.id, token, expiresAt]
        );

        await query(
            `UPDATE hospital_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), created_hospital_id = $2 WHERE id = $3`,
            [req.user.id, hospital.id, reqRow.id]
        );

        const setupUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;
        await sendPlatformEmail(
            reqRow.contact_email,
            'MediDoc - Votre établissement a été validé',
            `Bonjour ${reqRow.contact_name},\n\nVotre établissement "${reqRow.hospital_name}" a été validé sur MediDoc.\n\nDéfinissez votre mot de passe (lien valable 24h) : ${setupUrl}\n\nVous pourrez ensuite vous connecter avec l'email ${reqRow.contact_email}.`,
            `<h2>MediDoc - Établissement validé</h2>
             <p>Bonjour <strong>${reqRow.contact_name}</strong>,</p>
             <p>Votre établissement "<strong>${reqRow.hospital_name}</strong>" a été validé sur MediDoc.</p>
             <p><a href="${setupUrl}">Cliquez ici pour définir votre mot de passe</a> (lien valable 24h)</p>
             <p>Vous pourrez ensuite vous connecter avec l'email ${reqRow.contact_email}.</p>`
        );

        res.json({ success: true, message: 'Hôpital créé et compte responsable de labo initialisé', data: { hospital_id: hospital.id, user_id: newUser.id } });
    } catch (err) {
        console.error('Approve hospital request error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/hospitals/requests/:id/reject
router.put('/requests/:id/reject', protect, requireAdmin, async (req, res) => {
    const { reason } = req.body;
    try {
        const reqRow = await queryOne('SELECT * FROM hospital_requests WHERE id = $1', [req.params.id]);
        if (!reqRow) {
            return res.status(404).json({ error: 'Demande non trouvée' });
        }
        if (reqRow.status !== 'pending') {
            return res.status(400).json({ error: 'Cette demande a déjà été traitée' });
        }

        await query(
            `UPDATE hospital_requests SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2 WHERE id = $3`,
            [req.user.id, reason || null, reqRow.id]
        );

        res.json({ success: true, message: 'Demande refusée' });
    } catch (err) {
        console.error('Reject hospital request error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/hospitals — liste des hôpitaux inscrits (vue plateforme)
router.get('/', protect, requireAdmin, async (req, res) => {
    try {
        const hospitals = await queryAll(
            `SELECT h.id, h.name, h.contact_email as email, h.contact_phone as phone,
              CASE WHEN h.is_active THEN 'active' ELSE 'suspended' END as status,
              (SELECT COUNT(*) FROM users u WHERE u.hospital_id = h.id) as total_users,
              COALESCE(hc.balance, 0) as credit_balance,
              h.created_at
       FROM hospitals h
       LEFT JOIN hospital_credits hc ON hc.hospital_id = h.id
       ORDER BY h.created_at DESC`,
            []
        );
        res.json({ success: true, data: hospitals });
    } catch (err) {
        console.error('List hospitals error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/hospitals/:id/suspend
router.put('/:id/suspend', protect, requireAdmin, async (req, res) => {
    try {
        await query('UPDATE hospitals SET is_active = false, updated_at = NOW() WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Hôpital suspendu' });
    } catch (err) {
        console.error('Suspend hospital error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/hospitals/:id/activate
router.put('/:id/activate', protect, requireAdmin, async (req, res) => {
    try {
        await query('UPDATE hospitals SET is_active = true, updated_at = NOW() WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Hôpital activé' });
    } catch (err) {
        console.error('Activate hospital error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
