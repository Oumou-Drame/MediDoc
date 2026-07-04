import express from 'express';
import { protect, requireHospitalUser, effectiveRoles } from '../middleware/auth-middleware.js';
import { queryOne, queryAll, query } from '../config/db.js';
import { refund } from '../utils/credits.js';
import { ESTIMATED_SMS_COST, ESTIMATED_WHATSAPP_COST } from '../utils/sms.js';

const router = express.Router();

// L'historique des résultats est une donnée patient : réservé aux comptes rattachés à un hôpital
// (responsable de labo ou technicien). L'admin plateforme n'y a jamais accès (section 3.1).
router.use(protect, requireHospitalUser);

// GET /api/history — responsable de labo: tous les résultats de son hôpital, technicien: les siens uniquement
router.get('/', async (req, res) => {
    try {
        const { status, search, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        const isLabManager = effectiveRoles(req.user).includes('lab_manager');

        let whereClause = 'mr.hospital_id = $1';
        const params = [req.user.hospital_id];
        let paramIndex = 2;

        if (!isLabManager) {
            whereClause += ` AND mr.technician_id = $${paramIndex}`;
            params.push(req.user.id);
            paramIndex++;
        }
        if (status) {
            whereClause += ` AND mr.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        if (search) {
            whereClause += ` AND mr.patient_name ILIKE $${paramIndex}`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        const countResult = await queryOne(
            `SELECT COUNT(*) as count FROM medical_results mr WHERE ${whereClause}`,
            params
        );
        const total = parseInt(countResult.count);

        const results = await queryAll(
            `SELECT mr.*, u.full_name as technician_name
       FROM medical_results mr
       LEFT JOIN users u ON mr.technician_id = u.id
       WHERE ${whereClause}
       ORDER BY mr.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, parseInt(limit), parseInt(skip)]
        );

        res.json({
            success: true,
            data: {
                results,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (err) {
        console.error('History error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/history/:id — Détail d'un résultat précis
router.get('/:id', async (req, res) => {
    try {
        const result = await queryOne(
            `SELECT mr.*, u.full_name as technician_name
       FROM medical_results mr
       LEFT JOIN users u ON mr.technician_id = u.id
       WHERE mr.id = $1`,
            [req.params.id]
        );

        if (!result || result.hospital_id !== req.user.hospital_id) {
            return res.status(404).json({ error: 'Résultat non trouvé' });
        }

        const isLabManager = effectiveRoles(req.user).includes('lab_manager');
        if (!isLabManager && result.technician_id !== req.user.id) {
            return res.status(404).json({ error: 'Résultat non trouvé' });
        }

        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Get result error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/history/:id/unlock — Débloque un résultat verrouillé
router.put('/:id/unlock', async (req, res) => {
    try {
        const result = await queryOne('SELECT * FROM medical_results WHERE id = $1', [req.params.id]);
        if (!result || result.hospital_id !== req.user.hospital_id) {
            return res.status(404).json({ error: 'Résultat non trouvé' });
        }

        const isLabManager = effectiveRoles(req.user).includes('lab_manager');
        if (!isLabManager && result.technician_id !== req.user.id) {
            return res.status(404).json({ error: 'Résultat non trouvé' });
        }

        await query('UPDATE medical_results SET is_locked = 0, attempt_count = 0 WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Compte débloqué avec succès' });
    } catch (err) {
        console.error('Unlock error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/history/:id/cancel — Annule un envoi (erreur de destinataire, mauvais document, etc.)
// Autorisé au technicien qui a fait l'envoi, ainsi qu'au responsable de labo de l'hôpital,
// même si le patient a déjà consulté le résultat (ex: mauvais patient) — section demandée explicitement.
router.put('/:id/cancel', async (req, res) => {
    try {
        const result = await queryOne('SELECT * FROM medical_results WHERE id = $1', [req.params.id]);
        if (!result || result.hospital_id !== req.user.hospital_id) {
            return res.status(404).json({ error: 'Résultat non trouvé' });
        }

        const isLabManager = effectiveRoles(req.user).includes('lab_manager');
        if (!isLabManager && result.technician_id !== req.user.id) {
            return res.status(403).json({ error: "Vous ne pouvez annuler que vos propres envois" });
        }

        if (result.status === 'cancelled') {
            return res.status(400).json({ error: 'Cet envoi est déjà annulé' });
        }

        await query(
            `UPDATE medical_results SET status = 'cancelled', cancelled_by = $1, cancelled_at = NOW() WHERE id = $2`,
            [req.user.id, result.id]
        );

        // Remboursement du crédit SMS/WhatsApp déduit lors de l'envoi, s'il y en avait un
        let cost = 0;
        if (result.channel === 'email_whatsapp' && result.whatsapp_sent) cost = ESTIMATED_WHATSAPP_COST;
        if (result.channel === 'email_sms' && result.sms_sent) cost = ESTIMATED_SMS_COST;
        if (cost > 0) {
            await refund(result.hospital_id, cost, {
                resultId: result.id,
                note: `Remboursement suite à l'annulation de l'envoi #${result.id} (${result.patient_name})`
            });
        }

        await query(
            'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
            [req.user.id, 'cancel_result', `Envoi annulé pour ${result.patient_name} (résultat #${result.id})`, req.ip]
        );

        res.json({ success: true, message: 'Envoi annulé. Le lien envoyé au patient est désormais invalide.' });
    } catch (err) {
        console.error('Cancel result error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
