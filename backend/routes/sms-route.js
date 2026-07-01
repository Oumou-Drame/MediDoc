import express from 'express';
import { protect, requireResponsableLabo } from '../middleware/auth-middleware.js';
import * as africastalking from '../utils/africastalking.js';
import { sendSMS } from '../utils/sms.js';

const router = express.Router();

// GET /api/sms/status — Statut de la connexion Africa's Talking
router.get('/status', protect, async (req, res) => {
    const configured = africastalking.isConfigured();
    res.json({
        success: true,
        data: {
            provider: 'africastalking',
            configured: configured,
            status: configured ? 'connected' : 'not_configured',
            message: configured 
                ? 'Africa\'s Talking connecté et prêt à envoyer des SMS'
                : 'Africa\'s Talking non configuré. Définissez AT_API_KEY dans .env'
        }
    });
});

// GET /api/sms/test — Test de connexion Africa's Talking
router.get('/test', protect, requireResponsableLabo, async (req, res) => {
    try {
        const result = await africastalking.testConnection();
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors du test de connexion', 
            error: error.message 
        });
    }
});

// GET /api/sms/balance — Solde du compte Africa's Talking
router.get('/balance', protect, requireResponsableLabo, async (req, res) => {
    try {
        const result = await africastalking.getBalance();
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la récupération du solde', 
            error: error.message 
        });
    }
});

// POST /api/sms/send — Envoyer un SMS
router.post('/send', protect, requireResponsableLabo, async (req, res) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Numéro de téléphone et message requis' 
            });
        }

        const formattedPhone = africastalking.formatPhone(phone);
        if (!formattedPhone) {
            return res.status(400).json({ 
                success: false, 
                error: 'Numéro de téléphone invalide' 
            });
        }

        const result = await sendSMS(phone, message);
        if (result) {
            res.json({
                success: true,
                message: 'SMS envoyé avec succès',
                data: {
                    phone: formattedPhone,
                    sent_at: new Date().toISOString(),
                    provider: 'africastalking',
                    mode: africastalking.isConfigured() ? 'production' : 'simulation'
                }
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: "Échec de l'envoi du SMS" 
            });
        }
    } catch (error) {
        console.error('SMS send error:', error);
        res.status(500).json({ 
            success: false, 
            error: "Erreur lors de l'envoi: " + error.message 
        });
    }
});

// POST /api/sms/send-bulk — Envoyer des SMS en masse
router.post('/send-bulk', protect, requireResponsableLabo, async (req, res) => {
    try {
        const { recipients, message } = req.body;
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0 || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Liste de destinataires (tableau) et message requis' 
            });
        }

        const result = await africastalking.sendBulkSMS(recipients, message);
        if (result.success) {
            res.json({
                success: true,
                message: `SMS envoyé à ${result.totalRecipients || recipients.length} destinataires`,
                data: {
                    total: result.totalRecipients || recipients.length,
                    sent_at: new Date().toISOString(),
                    provider: 'africastalking',
                    mode: africastalking.isConfigured() ? 'production' : 'simulation'
                }
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: result.error || "Échec de l'envoi des SMS" 
            });
        }
    } catch (error) {
        console.error('Bulk SMS error:', error);
        res.status(500).json({ 
            success: false, 
            error: "Erreur lors de l'envoi groupé: " + error.message 
        });
    }
});

export default router;