import express from 'express';
import bcrypt from 'bcryptjs';
import { protect, requireLabManager } from '../middleware/auth-middleware.js';
import { queryOne, queryAll, query } from '../config/db.js';
import { getBalance, getTransactions } from '../utils/credits.js';
import { testSmtpConnection, explainSmtpError } from '../utils/sms.js';

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
        res.json({ success: true, message: `Technicien ${newStatus ? 'activé' : 'désactivé'}` });
    } catch (err) {
        console.error('Toggle technician error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.delete('/technicians/:id', async (req, res) => {
    try {
        await query(
            "DELETE FROM users WHERE id = $1 AND role = 'technician' AND hospital_id = $2",
            [req.params.id, req.user.hospital_id]
        );
        res.json({ success: true, message: 'Technicien supprimé' });
    } catch (err) {
        console.error('Delete technician error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ===========================================================
// Configuration d'envoi propre à l'hôpital (email SMTP + numéro d'envoi SMS/WhatsApp)
// Le responsable de labo configure uniquement le numéro déjà activé côté plateforme,
// pas les identifiants techniques du fournisseur (voir cadrage section 3.2 / 7).
// ===========================================================

router.get('/send-config', async (req, res) => {
    try {
        const config = await queryOne('SELECT * FROM hospital_send_config WHERE hospital_id = $1', [req.user.hospital_id]);
        const safeConfig = config ? { ...config, smtp_pass: config.smtp_pass ? '••••••••' : null } : null;
        res.json({ success: true, data: safeConfig });
    } catch (err) {
        console.error('Get send config error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.put('/send-config', async (req, res) => {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_name, sms_whatsapp_sender, clear_email } = req.body;
    try {
        const existing = await queryOne('SELECT hospital_id, smtp_pass FROM hospital_send_config WHERE hospital_id = $1', [req.user.hospital_id]);

        let hostToStore, portToStore, userToStore, passwordToStore;
        if (clear_email) {
            // Le responsable de labo a désactivé "email personnalisé" : on repasse sur le compte
            // email de la plateforme (comportement par défaut, voir utils/sms.js getHospitalTransporter).
            hostToStore = null;
            portToStore = null;
            userToStore = null;
            passwordToStore = null;
        } else {
            hostToStore = smtp_host || null;
            portToStore = smtp_port || null;
            userToStore = smtp_user || null;
            // Ne pas écraser le mot de passe SMTP si le champ masqué a été renvoyé tel quel
            passwordToStore = (smtp_pass && smtp_pass !== '••••••••') ? smtp_pass : (existing ? existing.smtp_pass : null);
        }

        if (existing) {
            await query(
                `UPDATE hospital_send_config
         SET smtp_host = $1, smtp_port = $2, smtp_user = $3, smtp_pass = $4, smtp_from_name = $5, sms_whatsapp_sender = $6, updated_at = NOW()
         WHERE hospital_id = $7`,
                [hostToStore, portToStore, userToStore, passwordToStore, smtp_from_name || null, sms_whatsapp_sender || null, req.user.hospital_id]
            );
        } else {
            await query(
                `INSERT INTO hospital_send_config (hospital_id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_name, sms_whatsapp_sender, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [req.user.hospital_id, hostToStore, portToStore, userToStore, passwordToStore, smtp_from_name || null, sms_whatsapp_sender || null]
            );
        }

        res.json({ success: true, message: "Configuration d'envoi mise à jour" });
    } catch (err) {
        console.error('Update send config error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/lab-manager/send-config/test — vérifie tout de suite si l'email + mot de passe
// d'application saisis fonctionnent réellement (sans envoyer de vrai email), pour éviter
// qu'une config invalide ne soit découverte plus tard via un envoi silencieusement échoué.
router.post('/send-config/test', async (req, res) => {
    const { smtp_host, smtp_port, smtp_user, smtp_pass } = req.body;
    if (!smtp_user) {
        return res.status(400).json({ error: "L'adresse email est requise pour tester" });
    }

    // Si le mot de passe masqué (••••••••) a été renvoyé tel quel, on reprend celui déjà enregistré.
    let passwordToTest = smtp_pass;
    if (!passwordToTest || passwordToTest === '••••••••') {
        const existing = await queryOne('SELECT smtp_pass FROM hospital_send_config WHERE hospital_id = $1', [req.user.hospital_id]);
        passwordToTest = existing?.smtp_pass || null;
    }
    if (!passwordToTest) {
        return res.status(400).json({ error: "Le mot de passe d'application est requis pour tester" });
    }

    const result = await testSmtpConnection({
        host: smtp_host || 'smtp.gmail.com',
        port: smtp_port || 587,
        user: smtp_user,
        pass: passwordToTest
    });

    if (result.success) {
        res.json({ success: true, message: 'Connexion réussie — cette adresse peut envoyer des emails aux patients' });
    } else {
        res.status(400).json({ error: explainSmtpError(result.error) });
    }
});

// ===========================================================
// Crédits SMS/WhatsApp — l'hôpital ne voit que son propre solde (section 7.1)
// ===========================================================

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
