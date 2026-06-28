const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { queryOne, query } = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
  }

  try {
    const user = await queryOne('SELECT * FROM users WHERE username = $1 AND is_active = 1', [username]);

    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      phone: user.phone
    };

    await query(
      'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [user.id, 'login', `Connexion réussie: ${user.username}`, req.ip]
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  if (req.session && req.session.user) {
    try {
      await query(
        'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
        [req.session.user.id, 'logout', `Déconnexion: ${req.session.user.username}`, req.ip]
      );
    } catch (err) {
      console.error('Logout log error:', err);
    }
  }
  req.session.destroy();
  res.json({ success: true });
});

// Get current user
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: 'Non connecté' });
  }
});

// Change password
router.post('/change-password', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Non connecté' });
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
  }

  try {
    const user = await queryOne('SELECT * FROM users WHERE id = $1', [req.session.user.id]);
    const validPassword = await bcrypt.compare(currentPassword, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, user.id]);

    res.json({ success: true, message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;