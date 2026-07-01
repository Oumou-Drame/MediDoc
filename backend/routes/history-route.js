import express from 'express';
import { protect } from '../middleware/auth-middleware.js';
import { queryOne, queryAll, query } from '../config/db.js';

const router = express.Router();

// GET /api/history — Historique (admin: tous les résultats, technicien: les siens uniquement)
router.get('/', protect, async (req, res) => {
    try {
        const { status, search, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        let whereClause = '1=1';
        const params = [];
        let paramIndex = 1;

        if (req.user.role === 'responsable_labo') {
            whereClause += ` AND mr.hospital_id = $${paramIndex}`;
            params.push(req.user.hospital_id);
            paramIndex++;
        } else if (req.user.role === 'technicien') {
            whereClause += ` AND mr.hospital_id = $${paramIndex}`;
            params.push(req.user.hospital_id);
            paramIndex++;
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
router.get('/:id', protect, async (req, res) => {
    try {
        const result = await queryOne(
            `SELECT mr.*, u.full_name as technician_name 
       FROM medical_results mr 
       LEFT JOIN users u ON mr.technician_id = u.id 
       WHERE mr.id = $1`,
            [req.params.id]
        );

        if (!result) {
            return res.status(404).json({ error: 'Résultat non trouvé' });
        }

        if (req.user.role === 'responsable_labo' && result.hospital_id !== req.user.hospital_id) {
            return res.status(404).json({ error: 'Résultat non trouvé' });
        }
        if (req.user.role === 'technicien' && (result.hospital_id !== req.user.hospital_id || result.technician_id !== req.user.id)) {
            return res.status(404).json({ error: 'Résultat non trouvé' });
        }

        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Get result error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// PUT /api/history/:id/unlock — Débloque un résultat verrouillé
router.put('/:id/unlock', protect, async (req, res) => {
    try {
        const result = await queryOne('SELECT * FROM medical_results WHERE id = $1', [req.params.id]);
        if (!result) {
            return res.status(404).json({ error: 'Résultat non trouvé' });
        }
        if (req.user.role === 'responsable_labo' && result.hospital_id !== req.user.hospital_id) {
            return res.status(404).json({ error: 'Résultat non trouvé' });
        }
        if (req.user.role === 'technicien' && (result.hospital_id !== req.user.hospital_id || result.technician_id !== req.user.id)) {
            return res.status(404).json({ error: 'Résultat non trouvé' });
        }

        await query('UPDATE medical_results SET is_locked = 0, attempt_count = 0 WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Compte débloqué avec succès' });
    } catch (err) {
        console.error('Unlock error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;