import express from 'express';
import bcrypt from 'bcryptjs';
import { protect, requireLabManager } from '../middleware/auth-middleware.js';
import { queryOne, queryAll, query } from '../config/db.js';
import { getBalance, getTransactions } from '../utils/credits.js';

const router = express.Router();

// Toutes les routes ci-dessous sont réservées au responsable de labo et systématiquement
// filtrées par req.user.hospital_id : un responsable de labo ne voit jamais un autre hôpital.
router.use(protect, requireLabManager);

// ===========================================================
// Dashboard hôpital (reprend l'ancien dashboard admin, mais scoped + crédits)
// ===========================================================
router.get('/dashboard', async (req, res) => {
    const hospitalId = req.user.hospital_id;
    try {
        const [
            techniciensTotal, techniciensActifs, totalResultats, envoisCeMois,
            resultatsAccedes, codesExpires,
            whatsappCount, smsCount, emailCount,
            techniciens,
            recentActivity,
            dailyRows,
            balance
        ] = await Promise.all([
            queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'technician' AND hospital_id = $1", [hospitalId]),
            queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'technician' AND hospital_id = $1 AND is_active = 1", [hospitalId]),
            queryOne("SELECT COUNT(*) as count FROM medical_results WHERE hospital_id = $1", [hospitalId]),
            queryOne("SELECT COUNT(*) as count FROM medical_results WHERE hospital_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)", [hospitalId]),
            queryOne("SELECT COUNT(*) as count FROM medical_results WHERE hospital_id = $1 AND status = 'accessed'", [hospitalId]),
            queryOne("SELECT COUNT(*) as count FROM medical_results WHERE hospital_id = $1 AND status = 'expired'", [hospitalId]),
            queryOne("SELECT COUNT(*) as count FROM medical_results WHERE hospital_id = $1 AND channel IN ('whatsapp','email_whatsapp','sms_whatsapp','all')", [hospitalId]),
            queryOne("SELECT COUNT(*) as count FROM medical_results WHERE hospital_id = $1 AND channel IN ('sms','email_sms','sms_whatsapp','all')", [hospitalId]),
            queryOne("SELECT COUNT(*) as count FROM medical_results WHERE hospital_id = $1 AND channel IN ('email','email_sms','email_whatsapp','all')", [hospitalId]),
            queryAll("SELECT id, full_name, email, is_active FROM users WHERE role = 'technician' AND hospital_id = $1 ORDER BY created_at DESC", [hospitalId]),
            queryAll(
                `SELECT al.* FROM activity_logs al
         JOIN users u ON u.id = al.user_id
         WHERE u.hospital_id = $1
         ORDER BY al.created_at DESC LIMIT 8`, [hospitalId]
            ),
            queryAll(
                `SELECT to_char(created_at, 'YYYY-MM-DD') as date, COUNT(*) as count
         FROM medical_results
         WHERE hospital_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '6 days'
         GROUP BY date
         ORDER BY date`, [hospitalId]
            ),
            getBalance(hospitalId)
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
                tendance_7_jours: tendance,
                solde_credits: balance
            }
        });
    } catch (err) {
        console.error('Lab manager dashboard error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ===========================================================
// Comptes techniciens — toujours scoped à req.user.hospital_id
// ===========================================================

router.get('/technicians', async (req, res) => {
    try {
        const users = await queryAll(
            'SELECT id, email, full_name, first_name, last_name, date_naissance, phone, is_active, created_at FROM users WHERE role = $1 AND hospital_id = $2 ORDER BY created_at DESC',
            ['technician', req.user.hospital_id]
        );
        res.json({ success: true, data: users });
    } catch (err) {
        console.error('List technicians error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.post('/technicians', async (req, res) => {
    const { email, password, first_name, last_name, date_naissance, phone } = req.body;
    if (!email || !password || !first_name || !last_name || !date_naissance) {
        return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
    }
    try {
        const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }

        const fullName = `${first_name.trim()} ${last_name.trim()}`.trim();
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await queryOne(
            `INSERT INTO users (email, password, full_name, first_name, last_name, date_naissance, role, phone, hospital_id, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'technician', $7, $8, 1, NOW(), NOW()) RETURNING id`,
            [email.toLowerCase(), hashedPassword, fullName, first_name.trim(), last_name.trim(), date_naissance, phone || null, req.user.hospital_id]
        );

        await query(
            'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
            [req.user.id, 'create_technician', `Création technicien: ${email}`, req.ip]
        );

        res.json({ success: true, message: 'Technicien créé avec succès', data: { id: newUser.id } });
    } catch (err) {
        console.error('Create technician error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.put('/technicians/:id', async (req, res) => {
    const { first_name, last_name, date_naissance, phone, email } = req.body;
    if (!first_name || !last_name) {
        return res.status(400).json({ error: 'Le prénom et le nom sont obligatoires' });
    }
    try {
        const user = await queryOne(
            "SELECT id FROM users WHERE id = $1 AND role = 'technician' AND hospital_id = $2",
            [req.params.id, req.user.hospital_id]
        );
        if (!user) {
            return res.status(404).json({ error: 'Technicien non trouvé' });
        }

        const fullName = `${first_name.trim()} ${last_name.trim()}`.trim();

        if (email) {
            const emailTaken = await queryOne('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase(), req.params.id]);
            if (emailTaken) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre compte' });
            }
            await query(
                'UPDATE users SET full_name = $1, first_name = $2, last_name = $3, date_naissance = $4, phone = $5, email = $6, updated_at = NOW() WHERE id = $7',
                [fullName, first_name.trim(), last_name.trim(), date_naissance || null, phone || null, email.toLowerCase(), req.params.id]
            );
        } else {
            await query(
                'UPDATE users SET full_name = $1, first_name = $2, last_name = $3, date_naissance = $4, phone = $5, updated_at = NOW() WHERE id = $6',
                [fullName, first_name.trim(), last_name.trim(), date_naissance || null, phone || null, req.params.id]
            );
        }

        await query(
            'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
            [req.user.id, 'update_technician', `Modification du compte technicien: ${fullName}`, req.ip]
        );

        res.json({ success: true, message: 'Technicien modifié avec succès' });
    } catch (err) {
        console.error('Update technician error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.put('/technicians/:id/toggle', async (req, res) => {
    try {
        const user = await queryOne(
            "SELECT * FROM users WHERE id = $1 AND role = 'technician' AND hospital_id = $2",
            [req.params.id, req.user.hospital_id]
        );
        if (!user) {
            return res.status(404).json({ error: 'Technicien non trouvé' });
        }
        const newStatus = user.is_active ? 0 : 1;
        await query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2', [newStatus, req.params.id]);

        await query(
            'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
            [req.user.id, 'toggle_technician', `Compte technicien ${user.full_name} ${newStatus ? 'activé' : 'suspendu'}`, req.ip]
        );

        res.json({ success: true, message: `Technicien ${newStatus ? 'activé' : 'désactivé'}` });
    } catch (err) {
        console.error('Toggle technician error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.delete('/technicians/:id', async (req, res) => {
    try {
        const user = await queryOne(
            "SELECT full_name FROM users WHERE id = $1 AND role = 'technician' AND hospital_id = $2",
            [req.params.id, req.user.hospital_id]
        );
        await query(
            "DELETE FROM users WHERE id = $1 AND role = 'technician' AND hospital_id = $2",
            [req.params.id, req.user.hospital_id]
        );

        if (user) {
            await query(
                'INSERT INTO activity_logs (user_id, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
                [req.user.id, 'delete_technician', `Suppression du compte technicien: ${user.full_name}`, req.ip]
            );
        }

        res.json({ success: true, message: 'Technicien supprimé' });
    } catch (err) {
        console.error('Delete technician error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ===========================================================
// Crédits SMS/WhatsApp — l'hôpital ne voit que son propre solde (section 7.1)
// ===========================================================

// ===========================================================
// Journal d'activité — historique complet des actions de l'équipe de l'hôpital
// (envois, annulations, gestion des comptes techniciens), paginé et filtrable.
// ===========================================================

router.get('/activite', async (req, res) => {
    const hospitalId = req.user.hospital_id;
    const { action, technicien, search, date_debut, date_fin, page = 1, limit = 20 } = req.query;

    try {
        let whereClause = 'u.hospital_id = $1';
        const params = [hospitalId];
        let paramIndex = 2;

        if (action) {
            whereClause += ` AND al.action = $${paramIndex}`;
            params.push(action);
            paramIndex++;
        }
        if (technicien) {
            whereClause += ` AND al.user_id = $${paramIndex}`;
            params.push(technicien);
            paramIndex++;
        }
        if (search) {
            whereClause += ` AND al.details ILIKE $${paramIndex}`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        if (date_debut) {
            whereClause += ` AND al.created_at >= $${paramIndex}`;
            params.push(date_debut);
            paramIndex++;
        }
        if (date_fin) {
            whereClause += ` AND al.created_at < ($${paramIndex}::date + INTERVAL '1 day')`;
            params.push(date_fin);
            paramIndex++;
        }

        const skip = (page - 1) * limit;

        const countResult = await queryOne(
            `SELECT COUNT(*) as count FROM activity_logs al JOIN users u ON u.id = al.user_id WHERE ${whereClause}`,
            params
        );
        const total = parseInt(countResult.count);

        const logs = await queryAll(
            `SELECT al.id, al.action, al.details, al.created_at, u.id as user_id, u.full_name as auteur
       FROM activity_logs al
       JOIN users u ON u.id = al.user_id
       WHERE ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, parseInt(limit), parseInt(skip)]
        );

        res.json({
            success: true,
            data: {
                logs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (err) {
        console.error('Activity log error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/lab-manager/activite/auteurs — liste des personnes ayant une activité, pour le filtre
router.get('/activite/auteurs', async (req, res) => {
    try {
        const auteurs = await queryAll(
            `SELECT DISTINCT u.id, u.full_name
       FROM activity_logs al
       JOIN users u ON u.id = al.user_id
       WHERE u.hospital_id = $1
       ORDER BY u.full_name`,
            [req.user.hospital_id]
        );
        res.json({ success: true, data: auteurs });
    } catch (err) {
        console.error('Activity authors error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/credits', async (req, res) => {
    try {
        const balance = await getBalance(req.user.hospital_id);
        const transactions = await getTransactions(req.user.hospital_id, 50);
        res.json({ success: true, data: { balance, transactions } });
    } catch (err) {
        console.error('Get hospital credits error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
