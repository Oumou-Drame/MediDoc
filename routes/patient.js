const express = require('express');
const router = express.Router();
const path = require('path');
const { queryOne, query } = require('../middleware/auth');

const MAX_ATTEMPTS = 3;

// Verify access code and get download info (using access_token from URL)
router.post('/verify', async (req, res) => {
  const { token, code } = req.body;

  if (!token || !code || code.length !== 6) {
    return res.status(400).json({ error: 'Token et code à 6 chiffres requis' });
  }

  try {
    const result = await queryOne('SELECT * FROM medical_results WHERE access_token = $1', [token]);

    if (!result) {
      return res.status(404).json({ error: 'Lien invalide. Aucun résultat trouvé.' });
    }

    // Check if the PDF is locked (too many attempts)
    if (result.is_locked) {
      return res.status(403).json({ 
        error: 'Ce document est bloqué. Nombre maximum de tentatives atteint. Veuillez contacter votre technicien.',
        locked: true
      });
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(result.expires_at);
    if (now > expiresAt) {
      await query('UPDATE medical_results SET status = $1 WHERE id = $2', ['expired', result.id]);
      return res.status(410).json({ error: 'Ce code a expiré. Veuillez contacter votre technicien.' });
    }

    // Verify the code matches
    if (result.access_code !== code) {
      // Increment attempt count for wrong code
      const newAttemptCount = result.attempt_count + 1;
      
      if (newAttemptCount >= MAX_ATTEMPTS) {
        await query(
          `UPDATE medical_results SET is_locked = 1, status = 'locked', attempt_count = $1 WHERE id = $2`,
          [newAttemptCount, result.id]
        );
        return res.status(403).json({ 
          error: 'Code incorrect. Nombre maximum de tentatives atteint. Ce document est désormais bloqué.',
          locked: true,
          attempt_count: newAttemptCount,
          max_attempts: MAX_ATTEMPTS
        });
      }

      await query(
        `UPDATE medical_results SET attempt_count = $1 WHERE id = $2`,
        [newAttemptCount, result.id]
      );

      return res.status(401).json({ 
        error: `Code incorrect. ${MAX_ATTEMPTS - newAttemptCount} tentative(s) restante(s).`,
        attempt_count: newAttemptCount,
        max_attempts: MAX_ATTEMPTS,
        remaining_attempts: MAX_ATTEMPTS - newAttemptCount
      });
    }

    // Code is correct - update access info
    const newAttemptCount = result.attempt_count + 1;
    
    await query(
      `UPDATE medical_results 
       SET code_accessed = 1, status = 'accessed', accessed_at = NOW(), 
           access_count = access_count + 1, attempt_count = $1
       WHERE id = $2`,
      [newAttemptCount, result.id]
    );

    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [null, 'patient_access', `Accès patient au résultat #${result.id} - Tentative ${newAttemptCount}/${MAX_ATTEMPTS}`, req.ip]
    );

    res.json({
      success: true,
      data: {
        id: result.id,
        patient_name: result.patient_name,
        protected_filename: result.protected_filename,
        download_url: `/protected/${result.protected_filename}`,
        expires_at: result.expires_at,
        attempt_count: newAttemptCount,
        max_attempts: MAX_ATTEMPTS,
        remaining_attempts: MAX_ATTEMPTS - newAttemptCount
      }
    });
  } catch (err) {
    console.error('Verify code error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get result info by access_token
router.get('/info/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await queryOne('SELECT * FROM medical_results WHERE access_token = $1', [token]);

    if (!result) {
      return res.status(404).json({ error: 'Lien invalide' });
    }

    const now = new Date();
    const expiresAt = new Date(result.expires_at);
    const isExpired = now > expiresAt;

    res.json({
      success: true,
      data: {
        id: result.id,
        patient_name: result.patient_name,
        status: result.status,
        expires_at: result.expires_at,
        created_at: result.created_at,
        is_expired: isExpired,
        is_locked: result.is_locked,
        attempt_count: result.attempt_count,
        max_attempts: MAX_ATTEMPTS
      }
    });
  } catch (err) {
    console.error('Info error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Download protected PDF
router.get('/download/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await queryOne('SELECT * FROM medical_results WHERE access_token = $1', [token]);

    if (!result) {
      return res.status(404).json({ error: 'Lien invalide' });
    }

    // Check if locked
    if (result.is_locked) {
      return res.status(403).json({ error: 'Ce document est bloqué. Veuillez contacter votre technicien.' });
    }

    const now = new Date();
    const expiresAt = new Date(result.expires_at);
    if (now > expiresAt) {
      return res.status(410).json({ error: 'Ce code a expiré' });
    }

    const filePath = path.join(__dirname, '..', 'protected', result.protected_filename);
    res.download(filePath, `resultats_${result.patient_name}.pdf`);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;