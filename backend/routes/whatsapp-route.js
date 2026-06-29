import express from 'express';
import { protect, requireAdmin } from '../middleware/auth-middleware.js';
import * as twilio from '../utils/twilio.js';
import { sendWhatsApp } from '../utils/sms.js';

const router = express.Router();

// GET /api/whatsapp/status — Statut de la connexion Twilio
router.get('/status', protect, requireAdmin, async (req, res) => {
    const result = await twilio.testConnection();
    res.json({
        success: result.success,
        data: {
            provider: result.configured ? 'twilio' : 'none',
            configured: result.configured,
            message: result.message,
            whatsapp_from: result.data?.whatsapp_from || 'Non configuré',
            sms_from: result.data?.sms_from || 'Non configuré'
        }
    });
});

// GET /api/whatsapp/test — Test de connexion Twilio
router.get('/test', protect, requireAdmin, async (req, res) => {
    try {
        const result = await twilio.testConnection();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erreur lors du test de connexion', error: error.message });
    }
});

// POST /api/whatsapp/send — Envoyer un message WhatsApp via Twilio
router.post('/send', protect, requireAdmin, async (req, res) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) {
            return res.status(400).json({ success: false, error: 'Numéro de téléphone et message requis' });
        }

        const formattedPhone = twilio.formatPhone(phone);
        if (!formattedPhone) {
            return res.status(400).json({ success: false, error: 'Numéro de téléphone invalide' });
        }

        const result = await sendWhatsApp(phone, message);
        if (result) {
            res.json({
                success: true,
                message: 'Message WhatsApp envoyé avec succès',
                data: {
                    phone: formattedPhone,
                    sent_at: new Date().toISOString(),
                    provider: twilio.isConfigured() ? 'twilio' : 'simulation'
                }
            });
        } else {
            res.status(500).json({ success: false, error: "Échec de l'envoi du message WhatsApp" });
        }
    } catch (error) {
        console.error('WhatsApp send error:', error);
        res.status(500).json({ success: false, error: "Erreur lors de l'envoi: " + error.message });
    }
});

export default router;