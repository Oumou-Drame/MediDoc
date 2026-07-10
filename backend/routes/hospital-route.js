import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { protect, requireAdmin } from '../middleware/auth-middleware.js';
import { queryOne, queryAll, query } from '../config/db.js';
import { sendPlatformEmail } from '../utils/platformMailer.js';

const router = express.Router();
const RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h pour le tout premier mot de passe

// Configuration Multer pour l'upload de documents
const uploadDir = path.join(process.cwd(), 'uploads', 'hospital-documents');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'hospital-doc-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Seuls les fichiers JPEG, PNG et PDF sont autorisés'));
        }
    }
});

// ===========================================================
// Public — formulaire de demande d'inscription (landing page, section 6)
// ===========================================================

// POST /api/hospitals/request — un hôpital intéressé soumet une demande
router.post('/request', async (req, res) => {
    const { hospital_name, contact_name, contact_email, contact_phone, address, numero_agrement, message } = req.body;

    if (!hospital_name || !contact_name || !contact_email || !numero_agrement) {
        return res.status(400).json({ error: "Nom de l'établissement, numéro d'agrément, contact et email sont requis" });
    }

    try {
        // Un établissement déjà inscrit (ou déjà en attente de validation) ne doit pas pouvoir être
        // réinscrit, même si le demandeur utilise un email de contact différent — la vérification se
        // fait sur le nom de l'établissement, jamais sur l'email (consigne du maître de stage).
        const nomNormalise = hospital_name.trim().toLowerCase();

        const dejaInscrit = await queryOne(
            `SELECT id FROM hospitals WHERE LOWER(TRIM(name)) = $1`,
            [nomNormalise]
        );
        if (dejaInscrit) {
            return res.status(400).json({ error: 'Cet établissement est déjà inscrit sur la plateforme.' });
        }

        const dejaEnAttente = await queryOne(
            `SELECT id FROM hospital_requests WHERE LOWER(TRIM(hospital_name)) = $1 AND status = 'pending'`,
            [nomNormalise]
        );
        if (dejaEnAttente) {
            return res.status(400).json({ error: 'Une demande est déjà en attente de validation pour cet établissement.' });
        }

        // Vérification par numéro d'agrément : détecte les doublons même quand le nom diffère
        // (ex: sigle "HOGYP" soumis une fois, puis nom complet "Hôpital Général Idrissa Pouye"
        // une autre fois) — le numéro d'agrément, lui, ne change pas selon la façon dont on tape
        // le nom de l'établissement.
        if (numero_agrement) {
            const agrementNormalise = numero_agrement.trim().toLowerCase();

            const agrementDejaInscrit = await queryOne(
                `SELECT id FROM hospitals WHERE LOWER(TRIM(numero_agrement)) = $1`,
                [agrementNormalise]
            );
            if (agrementDejaInscrit) {
                return res.status(400).json({ error: 'Un établissement avec ce numéro d\'agrément est déjà inscrit sur la plateforme.' });
            }

            const agrementDejaEnAttente = await queryOne(
                `SELECT id FROM hospital_requests WHERE LOWER(TRIM(numero_agrement)) = $1 AND status = 'pending'`,
                [agrementNormalise]
            );
            if (agrementDejaEnAttente) {
                return res.status(400).json({ error: 'Une demande est déjà en attente de validation pour ce numéro d\'agrément.' });
            }
        }

        const result = await query(
            `INSERT INTO hospital_requests (hospital_name, contact_name, contact_email, contact_phone, address, numero_agrement, message, status, document_status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'pending', NOW()) RETURNING id`,
            [hospital_name, contact_name, contact_email.toLowerCase(), contact_phone || null, address || null, numero_agrement || null, message || null]
        );
        res.json({ success: true, message: 'Votre demande a bien été reçue. Notre équipe la vérifiera avant validation.', request_id: result.rows[0].id });
    } catch (err) {
        console.error('Hospital request error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/hospitals/request/:id/document — upload d'un document de vérification
router.post('/request/:id/document', upload.single('document'), async (req, res) => {
    const { id } = req.params;
    const { document_type } = req.body;

    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    if (!document_type) {
        return res.status(400).json({ error: 'Type de document requis' });
    }

    try {
        const request = await queryOne('SELECT * FROM hospital_requests WHERE id = $1', [id]);
        if (!request) {
            return res.status(404).json({ error: 'Demande non trouvée' });
        }

        await query(
            `INSERT INTO hospital_documents (hospital_request_id, document_type, file_name, file_path, file_size, mime_type, verification_status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
            [
                id,
                document_type,
                req.file.originalname,
                req.file.path,
                req.file.size,
                req.file.mimetype
            ]
        );

        await query(
            `UPDATE hospital_requests SET document_status = 'pending' WHERE id = $1`,
            [id]
        );

        res.json({ success: true, message: 'Document uploadé avec succès' });
    } catch (err) {
        console.error('Document upload error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/hospitals/request/:id/documents — récupérer les documents d'une demande
router.get('/request/:id/documents', protect, requireAdmin, async (req, res) => {
    try {
        const documents = await queryAll(
            `SELECT * FROM hospital_documents WHERE hospital_request_id = $1 ORDER BY upload_date DESC`,
            [req.params.id]
        );
        res.json({ success: true, data: documents });
    } catch (err) {
        console.error('Get documents error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/hospitals/request/:id/documents/:docId — télécharger un document
router.get('/request/:id/documents/:docId', protect, requireAdmin, async (req, res) => {
    try {
        const document = await queryOne(
            'SELECT * FROM hospital_documents WHERE id = $1 AND hospital_request_id = $2',
            [req.params.docId, req.params.id]
        );

        if (!document) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }

        res.download(document.file_path, document.file_name);
    } catch (err) {
        console.error('Download document error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/hospitals/request/:id/documents/:docId/view — visualiser le document dans la page
// (Content-Disposition: inline, contrairement à la route de téléchargement ci-dessus)
router.get('/request/:id/documents/:docId/view', protect, requireAdmin, async (req, res) => {
    try {
        const document = await queryOne(
            'SELECT * FROM hospital_documents WHERE id = $1 AND hospital_request_id = $2',
            [req.params.docId, req.params.id]
        );

        if (!document) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }

        res.setHeader('Content-Type', document.mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${document.file_name}"`);
        res.sendFile(path.resolve(document.file_path));
    } catch (err) {
        console.error('View document error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/hospitals/request/:id/documents/:docId/verify — vérifier un document
router.put('/request/:id/documents/:docId/verify', protect, requireAdmin, async (req, res) => {
    const { status, reason } = req.body; // status: 'verified' or 'rejected'

    if (!status || !['verified', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Statut invalide' });
    }

    try {
        await query(
            `UPDATE hospital_documents 
             SET verification_status = $1, verified_by = $2, verified_at = NOW(), rejection_reason = $3
             WHERE id = $4 AND hospital_request_id = $5`,
            [status, req.user.id, reason || null, req.params.docId, req.params.id]
        );

        // Mettre à jour le statut de la demande si tous les documents sont vérifiés
        const allDocs = await queryAll(
            'SELECT verification_status FROM hospital_documents WHERE hospital_request_id = $1',
            [req.params.id]
        );

        const allVerified = allDocs.every(doc => doc.verification_status === 'verified');
        const anyRejected = allDocs.some(doc => doc.verification_status === 'rejected');

        if (allVerified) {
            await query(
                `UPDATE hospital_requests SET document_status = 'verified' WHERE id = $1`,
                [req.params.id]
            );
        } else if (anyRejected) {
            await query(
                `UPDATE hospital_requests SET document_status = 'rejected' WHERE id = $1`,
                [req.params.id]
            );
        }

        res.json({ success: true, message: 'Document vérifié' });
    } catch (err) {
        console.error('Verify document error:', err);
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

// GET /api/hospitals/requests/:id — détail d'une demande (page dédiée admin)
router.get('/requests/:id', protect, requireAdmin, async (req, res) => {
    try {
        const reqRow = await queryOne('SELECT * FROM hospital_requests WHERE id = $1', [req.params.id]);
        if (!reqRow) {
            return res.status(404).json({ error: 'Demande non trouvée' });
        }
        res.json({ success: true, data: reqRow });
    } catch (err) {
        console.error('Get hospital request error:', err);
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

        // Vérifier si des documents sont requis et leur statut
        if (reqRow.document_status === 'pending') {
            return res.status(400).json({ error: 'Les documents doivent être vérifiés avant d\'approuver la demande' });
        }

        if (reqRow.document_status === 'rejected') {
            return res.status(400).json({ error: 'Les documents ont été rejetés. Impossible d\'approuver la demande.' });
        }

        const existingUser = await queryOne('SELECT id FROM users WHERE email = $1', [reqRow.contact_email]);
        if (existingUser) {
            return res.status(400).json({ error: 'Un compte existe déjà avec cet email de contact' });
        }

        const hospital = await queryOne(
            `INSERT INTO hospitals (name, email, phone, address, numero_agrement, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW()) RETURNING id`,
            [reqRow.hospital_name, reqRow.contact_email, reqRow.contact_phone, reqRow.address || null, reqRow.numero_agrement || null]
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

        await sendPlatformEmail(
            reqRow.contact_email,
            'MediDoc - Votre demande d\'inscription n\'a pas été retenue',
            `Bonjour ${reqRow.contact_name},\n\nNous vous remercions pour votre demande d'inscription de "${reqRow.hospital_name}" sur MediDoc.\n\nAprès examen, nous ne sommes pas en mesure de valider votre établissement pour le moment.` +
            (reason ? `\n\nMotif : ${reason}` : '') +
            `\n\nSi vous pensez qu'il s'agit d'une erreur ou souhaitez soumettre une nouvelle demande avec des informations complémentaires, n'hésitez pas à nous recontacter.`,
            `<h2>MediDoc - Demande non retenue</h2>
             <p>Bonjour <strong>${reqRow.contact_name}</strong>,</p>
             <p>Nous vous remercions pour votre demande d'inscription de "<strong>${reqRow.hospital_name}</strong>" sur MediDoc.</p>
             <p>Après examen, nous ne sommes pas en mesure de valider votre établissement pour le moment.</p>
             ${reason ? `<p><strong>Motif :</strong> ${reason}</p>` : ''}
             <p>Si vous pensez qu'il s'agit d'une erreur ou souhaitez soumettre une nouvelle demande avec des informations complémentaires, n'hésitez pas à nous recontacter.</p>`
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
            `SELECT h.id, h.name, h.email, h.phone, h.status,
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
        await query(`UPDATE hospitals SET status = 'suspended', updated_at = NOW() WHERE id = $1`, [req.params.id]);
        res.json({ success: true, message: 'Hôpital suspendu' });
    } catch (err) {
        console.error('Suspend hospital error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/hospitals/:id/activate
router.put('/:id/activate', protect, requireAdmin, async (req, res) => {
    try {
        await query(`UPDATE hospitals SET status = 'active', updated_at = NOW() WHERE id = $1`, [req.params.id]);
        res.json({ success: true, message: 'Hôpital activé' });
    } catch (err) {
        console.error('Activate hospital error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
