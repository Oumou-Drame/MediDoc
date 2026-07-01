import express from 'express';
import bcrypt from 'bcryptjs';
import { protect, requireResponsableLabo } from '../middleware/auth-middleware.js';
import { queryOne, queryAll, query } from '../config/db.js';

const router = express.Router();

// GET /api/admin/users — Liste des techniciens et responsables
router.get('/users', protect, requireResponsableLabo, async (req, res) => {
    try {
        const users = await queryAll(
            `SELECT id, email, full_name, role, phone, matricule, date_naissance, is_active, created_at 
             FROM users WHERE role IN ('technicien', 'responsable_labo') 
             ORDER BY created_at DESC`
        );
        res.json({ success: true, data: users });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/admin/users — Créer un technicien ou responsable de laboratoire
router.post('/users', protect, requireResponsableLabo, async (req, res) => {
    const { email, full_name, phone, role, date_naissance, nom, prenom } = req.body;

    if (!email || !full_name) {
        return res.status(400).json({ error: 'Email et nom complet requis' });
    }

    const userRole = role || 'technicien';
    if (!['technicien', 'responsable_labo'].includes(userRole)) {
        return res.status(400).json({ error: 'Rôle invalide. Choisissez technicien ou responsable_labo' });
    }

    try {
        const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
        if (existing) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre compte' });
        }

        // Validation d'âge (minimum 18 ans)
        if (date_naissance) {
            const birthDate = new Date(date_naissance);
            const minAge = new Date();
            minAge.setFullYear(minAge.getFullYear() - 18);
            if (birthDate > minAge) {
                return res.status(400).json({ error: 'Le compte doit être créé pour une personne majeure (18 ans minimum)' });
            }
        }

        // Générer le matricule au format MED-YYYY-XXXX
        const year = new Date().getFullYear();
        const count = await queryOne("SELECT COUNT(*) as count FROM users WHERE matricule LIKE $1", [`MED-${year}-%`]);
        const num = String(parseInt(count.count) + 1).padStart(4, '0');
        const matricule = `MED-${year}-${num}`;

        // Générer un mot de passe temporaire
        const tempPassword = Math.random().toString(36).slice(-8).toUpperCase() + Math.random().toString(36).slice(-4);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const result = await query(
            `INSERT INTO users (email, password, full_name, role, phone, date_naissance, matricule, is_active, created_at, updated_at, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW(), NOW(), true) RETURNING id, matricule`,
            [email, hashedPassword, full_name, userRole, phone || null, date_naissance || null, matricule]
        );

        await query(
            'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
            [req.user.id, 'create_user', `Création ${userRole}: ${email} (${matricule})`, req.ip]
        );

        // TODO: Envoyer email avec mot de passe temporaire
        // Pour l'instant, on retourne le mot de passe dans la réponse (à remplacer par envoi d'email)
        
        res.json({ 
            success: true, 
            message: `Compte créé — matricule ${matricule}`,
            data: { id: result.rows[0].id, matricule, temp_password: tempPassword }
        });
    } catch (err) {
        console.error('Create user error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/admin/users/:id/toggle — Activer/désactiver un compte
router.put('/users/:id/toggle', protect, requireResponsableLabo, async (req, res) => {
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

// PUT /api/admin/users/:id — Modifier un technicien existant
router.put('/users/:id', protect, requireResponsableLabo, async (req, res) => {
    const { full_name, email, phone, role, date_naissance } = req.body;

    if (!full_name || !email) {
        return res.status(400).json({ error: 'Nom complet et email sont obligatoires' });
    }

    try {
        const user = await queryOne('SELECT id FROM users WHERE id = $1 AND role IN ($2, $3)', 
            [req.params.id, 'technicien', 'responsable_labo']);
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const emailTaken = await queryOne('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.params.id]);
        if (emailTaken) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre compte' });
        }

        const newRole = role && ['technicien', 'responsable_labo'].includes(role) ? role : user.role;

        await query(
            `UPDATE users SET full_name = $1, email = $2, phone = $3, role = $4, date_naissance = COALESCE($5, date_naissance), updated_at = NOW() WHERE id = $6`,
            [full_name, email, phone || null, newRole, date_naissance, req.params.id]
        );

        res.json({ success: true, message: 'Utilisateur modifié avec succès' });
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/admin/users/:id — Supprimer un technicien
router.delete('/users/:id', protect, requireResponsableLabo, async (req, res) => {
    try {
        await query('DELETE FROM users WHERE id = $1 AND role IN ($2, $3)', 
            [req.params.id, 'technicien', 'responsable_labo']);
        res.json({ success: true, message: 'Utilisateur supprimé' });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/admin/stats — Statistiques pour le dashboard
router.get('/stats', protect, requireResponsableLabo, async (req, res) => {
    try {
        const totalResults = await queryOne('SELECT COUNT(*) as count FROM medical_results', []);
        const sentResults = await queryOne("SELECT COUNT(*) as count FROM medical_results WHERE status IN ('sent', 'accessed')", []);
        const pendingResults = await queryOne("SELECT COUNT(*) as count FROM medical_results WHERE status = 'pending'", []);
        const accessedResults = await queryOne("SELECT COUNT(*) as count FROM medical_results WHERE status = 'accessed'", []);
        const expiredResults = await queryOne("SELECT COUNT(*) as count FROM medical_results WHERE status = 'expired'", []);
        const totalTechnicians = await queryOne("SELECT COUNT(*) as count FROM users WHERE role IN ('technicien', 'responsable_labo')", []);
        const emailSms = await queryOne("SELECT COUNT(*) as count FROM medical_results WHERE channel = 'email_sms'", []);
        const emailWhatsapp = await queryOne("SELECT COUNT(*) as count FROM medical_results WHERE channel = 'email_whatsapp'", []);

        const recentActivity = await queryAll('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10', []);

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
                total_results: parseInt(totalResults.count),
                sent_results: parseInt(sentResults.count),
                pending_results: parseInt(pendingResults.count),
                accessed_results: parseInt(accessedResults.count),
                expired_results: parseInt(expiredResults.count),
                total_technicians: parseInt(totalTechnicians.count),
                channels: {
                    email_sms: parseInt(emailSms.count),
                    email_whatsapp: parseInt(emailWhatsapp.count)
                },
                recent_activity: enrichedActivity,
                daily_stats: dailyStats
            }
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/admin/settings — Lire les paramètres
router.get('/settings', protect, requireResponsableLabo, async (req, res) => {
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

// PUT /api/admin/settings — Modifier les paramètres
router.put('/settings', protect, requireResponsableLabo, async (req, res) => {
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

// GET /api/admin/dashboard — Données pour la page dashboard
router.get('/dashboard', protect, requireResponsableLabo, async (req, res) => {
    try {
        const [
            techniciensTotal, techniciensActifs, totalResultats, envoisCeMois,
            resultatsAccedes, codesExpires,
            whatsappCount, smsCount, emailCount,
            techniciens,
            recentActivity,
            dailyRows
        ] = await Promise.all([
            queryOne("SELECT COUNT(*) as count FROM users WHERE role IN ('technicien', 'responsable_labo')", []),
            queryOne("SELECT COUNT(*) as count FROM users WHERE role IN ('technicien', 'responsable_labo') AND is_active = 1", []),
            queryOne("SELECT COUNT(*) as count FROM medical_results", []),
            queryOne("SELECT COUNT(*) as count FROM medical_results WHERE created_at >= date_trunc('month', CURRENT_DATE)", []),
            queryOne("SELECT COUNT(*) as count FROM medical_results WHERE status = 'accessed'", []),
            queryOne("SELECT COUNT(*) as count FROM medical_results WHERE status = 'expired'", []),
            queryOne("SELECT COUNT(*) as count FROM medical_results WHERE channel IN ('whatsapp','email_whatsapp','sms_whatsapp','all')", []),
            queryOne("SELECT COUNT(*) as count FROM medical_results WHERE channel IN ('sms','email_sms','sms_whatsapp','all')", []),
            queryOne("SELECT COUNT(*) as count FROM medical_results WHERE channel IN ('email','email_sms','email_whatsapp','all')", []),
            queryAll("SELECT id, full_name, email, is_active FROM users WHERE role IN ('technicien', 'responsable_labo') ORDER BY created_at DESC", []),
            queryAll('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 8', []),
            queryAll(
                `SELECT to_char(created_at, 'YYYY-MM-DD') as date, COUNT(*) as count
         FROM medical_results
         WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
         GROUP BY date
         ORDER BY date`, []
            )
        ]);

        const total = parseInt(totalResultats.count) || 0;
        const pct = (count) => total > 0 ? Math.round((parseInt(count) / total) * 100) : 0;

        const tendance = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().substring(0, 10);
            const trouve = dailyRows.find(r => r.date === key);
            tendance.push({ date: key, count: trouve ? parseInt(trouve.count) : 0 });
        }

        const activiteRecente = [];
        for (const a of recentActivity) {
            let nom = 'Système';
            if (a.user_id) {
                const u = await queryOne('SELECT full_name FROM users WHERE id = $1', [a.user_id]);
                if (u) nom = u.full_name;
            }
            activiteRecente.push({ action: a.action, details: a.details, auteur: nom, date: a.created_at });
        }

        res.json({
            success: true,
            data: {
                techniciens_total: parseInt(techniciensTotal.count),
                techniciens_actifs: parseInt(techniciensActifs.count),
                envois_ce_mois: parseInt(envoisCeMois.count),
                taux_consultation: pct(resultatsAccedes.count),
                codes_expires: parseInt(codesExpires.count),
                techniciens: techniciens.map(t => ({ id: t.id, nom: t.full_name, email: t.email, en_ligne: !!t.is_active })),
                canaux: [
                    { nom: 'WhatsApp', pourcentage: pct(whatsappCount.count), classe: 'whatsapp' },
                    { nom: 'SMS', pourcentage: pct(smsCount.count), classe: 'sms' },
                    { nom: 'Email', pourcentage: pct(emailCount.count), classe: 'email' }
                ],
                activite_recente: activiteRecente,
                tendance_7_jours: tendance
            }
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;