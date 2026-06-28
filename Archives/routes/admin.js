const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin, queryOne, queryAll, query } = require('../middleware/auth');

// Get all technicians
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await queryAll(
      'SELECT id, username, email, full_name, role, phone, is_active, created_at FROM users WHERE role = $1 ORDER BY created_at DESC',
      ['technician']
    );
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Create new technician
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, email, password, full_name, phone } = req.body;

  if (!username || !email || !password || !full_name) {
    return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
  }

  try {
    const existing = await queryOne(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing) {
      return res.status(400).json({ error: 'Nom d\'utilisateur ou email déjà utilisé' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO users (username, email, password, full_name, role, phone, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'technician', $5, 1, NOW(), NOW())`,
      [username, email, hashedPassword, full_name, phone || null]
    );

    await query(
      'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [req.session.user.id, 'create_user', `Création technicien: ${username}`, req.ip]
    );

    res.json({ success: true, message: 'Technicien créé avec succès' });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Toggle user active status
router.put('/users/:id/toggle', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);
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

// Delete user
router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id = $1 AND role = $2', [req.params.id, 'technician']);
    res.json({ success: true, message: 'Utilisateur supprimé' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get statistics
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const totalResults = await queryOne('SELECT COUNT(*) as count FROM medical_results', []);
    const sentResults = await queryOne("SELECT COUNT(*) as count FROM medical_results WHERE status IN ('sent', 'accessed')", []);
    const pendingResults = await queryOne("SELECT COUNT(*) as count FROM medical_results WHERE status = 'pending'", []);
    const accessedResults = await queryOne("SELECT COUNT(*) as count FROM medical_results WHERE status = 'accessed'", []);
    const expiredResults = await queryOne("SELECT COUNT(*) as count FROM medical_results WHERE status = 'expired'", []);
    const totalTechnicians = await queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'technician'", []);
    const emailSms = await queryOne("SELECT COUNT(*) as count FROM medical_results WHERE channel = 'email_sms'", []);
    const emailWhatsapp = await queryOne("SELECT COUNT(*) as count FROM medical_results WHERE channel = 'email_whatsapp'", []);

    const recentActivity = await queryAll('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10', []);

    // Get all results to compute daily stats
    const allResults = await queryAll('SELECT created_at FROM medical_results', []);
    const dailyMap = {};
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    allResults.forEach(r => {
      if (new Date(r.created_at) >= sevenDaysAgo) {
        const date = r.created_at.toISOString().substring(0, 10);
        dailyMap[date] = (dailyMap[date] || 0) + 1;
      }
    });
    const dailyStats = Object.entries(dailyMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    // Enrich activity with user names
    const enrichedActivity = [];
    for (const a of recentActivity) {
      let fullName = 'System';
      if (a.user_id) {
        const u = await queryOne('SELECT full_name FROM users WHERE id = $1', [a.user_id]);
        if (u) fullName = u.full_name;
      }
      enrichedActivity.push({ ...a, full_name: fullName });
    }

    res.json({
      success: true,
      data: {
        total_results: parseInt(totalResults.count), sent_results: parseInt(sentResults.count),
        pending_results: parseInt(pendingResults.count), accessed_results: parseInt(accessedResults.count),
        expired_results: parseInt(expiredResults.count), total_technicians: parseInt(totalTechnicians.count),
        channels: { 
          email_sms: parseInt(emailSms.count), 
          email_whatsapp: parseInt(emailWhatsapp.count)
        },
        recent_activity: enrichedActivity, daily_stats: dailyStats
      }
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get settings
router.get('/settings', requireAuth, requireAdmin, async (req, res) => {
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

// Update settings
router.put('/settings', requireAuth, requireAdmin, async (req, res) => {
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

module.exports = router;