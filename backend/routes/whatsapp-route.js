import express from 'express';
import { protect, requireAdmin } from '../middleware/auth-middleware.js';
import * as baileys from '../utils/whatsapp.js';
import { sendWhatsApp } from '../utils/sms.js';

const router = express.Router();

// GET /api/whatsapp/status — Statut de la connexion Baileys
router.get('/status', protect, requireAdmin, async (req, res) => {
    const status = baileys.getConnectionStatus();
    const phone = status.info?.id?.replace(/:.*@/, '@')?.split('@')[0] || 'Non connecté';
    res.json({
        success: status.status === 'connected',
        data: {
            provider: 'baileys',
            configured: status.configured,
            status: status.status,
            phone: phone ? `+${phone}` : 'Non connecté',
            message: status.status === 'connected' 
                ? 'WhatsApp connecté via Baileys' 
                : 'WhatsApp non connecté. Scannez le QR code.'
        }
    });
});

// GET /api/whatsapp/test — Test de connexion Baileys
router.get('/test', protect, requireAdmin, async (req, res) => {
    try {
        const result = await baileys.testConnection();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erreur lors du test de connexion', error: error.message });
    }
});

// GET /api/whatsapp/qr — Obtenir le QR code pour la connexion WhatsApp
router.get('/qr', protect, requireAdmin, async (req, res) => {
    try {
        const result = await baileys.getQR();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erreur lors de la récupération du QR code', error: error.message });
    }
});

// POST /api/whatsapp/send — Envoyer un message WhatsApp via Baileys
router.post('/send', protect, requireAdmin, async (req, res) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) {
            return res.status(400).json({ success: false, error: 'Numéro de téléphone et message requis' });
        }

        const formattedPhone = baileys.formatPhoneNumber(phone);
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
                    provider: baileys.isConfigured() ? 'baileys' : 'simulation'
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

// POST /api/whatsapp/reconnect — Reconnecter WhatsApp
router.post('/reconnect', protect, requireAdmin, async (req, res) => {
    try {
        const result = await baileys.reconnect();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erreur lors de la reconnexion', error: error.message });
    }
});

// POST /api/whatsapp/disconnect — Déconnecter WhatsApp
router.post('/disconnect', protect, requireAdmin, async (req, res) => {
    try {
        const result = await baileys.disconnect();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erreur lors de la déconnexion', error: error.message });
    }
});

export default router;