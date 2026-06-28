const express = require('express');
const router = express.Router();
const { requireAuth, queryOne, queryAll } = require('../middleware/auth');

// Get history for current user (technician) or all (admin)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let whereClause = '1=1';
    const params = [];
    let paramIndex = 1;

    if (req.session.user.role !== 'admin') {
      whereClause += ` AND mr.technician_id = $${paramIndex}`;
      params.push(req.session.user.id);
      paramIndex++;
    }
    if (status) {
      whereClause += ` AND mr.status = $${paramIndex}`;
      params.push(status);
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

// Get single result details
router.get('/:id', requireAuth, async (req, res) => {
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

    if (req.session.user.role !== 'admin' && result.technician_id !== req.session.user.id) {
      return res.status(404).json({ error: 'Résultat non trouvé' });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Get result error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;