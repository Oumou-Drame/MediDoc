/**
 * Tests pour les fonctionnalités WhatsApp (Baileys)
 * 
 * Tests couverts:
 * - Formatage des numéros de téléphone
 * - Validation des numéros
 * - Gestion de la connexion
 * - Envoi de messages texte
 * - Envoi de documents
 * - Envoi de médias
 * - Statut de connexion
 * - QR Code
 * - Déconnexion et reconnexion
 */

// Mock des dépendances Baileys avant tout import
jest.mock('@whiskeysockets/baileys', () => ({
  default: jest.fn(() => ({
    ev: {
      on: jest.fn(),
      emit: jest.fn()
    },
    user: { id: '221763162273:12@s.whatsapp.net', name: 'Test User', platform: 'Chrome' },
    sendMessage: jest.fn().mockResolvedValue({
      key: { id: 'msg-id-123', remoteJid: '221763162273@s.whatsapp.net', fromMe: true },
      messageTimestamp: Date.now()
    }),
    end: jest.fn()
  })),
  useMultiFileAuthState: jest.fn(() => Promise.resolve({
    state: { creds: {}, keys: { get: jest.fn(), set: jest.fn() } },
    saveCreds: jest.fn()
  })),
  fetchLatestBaileysVersion: jest.fn(() => Promise.resolve({ version: [2, 2323, 6] })),
  makeCacheableSignalKeyStore: jest.fn(),
  DisconnectReason: {
    loggedOut: 401,
    badSession: 500,
    connectionClosed: 408,
    connectionLost: 408,
    timedOut: 408
  }
}));

jest.mock('pino', () => jest.fn(() => ({ level: jest.fn() })));
jest.mock('@hapi/boom', () => ({
  boomify: jest.fn()
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(() => Promise.resolve('data:image/png;base64,mockQR'))
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' })
  }))
}));

describe('💬 Tests WhatsApp (Baileys)', () => {
  let whatsapp;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Réinitialiser le module whatsapp
    jest.mock('@whiskeysockets/baileys', () => ({
      default: jest.fn(() => ({
        ev: {
          on: jest.fn(),
          emit: jest.fn()
        },
        user: { id: '221763162273:12@s.whatsapp.net', name: 'Test User', platform: 'Chrome' },
        sendMessage: jest.fn().mockResolvedValue({
          key: { id: 'msg-id-123', remoteJid: '221763162273@s.whatsapp.net', fromMe: true },
          messageTimestamp: Date.now()
        }),
        end: jest.fn()
      })),
      useMultiFileAuthState: jest.fn(() => Promise.resolve({
        state: { creds: {}, keys: { get: jest.fn(), set: jest.fn() } },
        saveCreds: jest.fn()
      })),
      fetchLatestBaileysVersion: jest.fn(() => Promise.resolve({ version: [2, 2323, 6] })),
      makeCacheableSignalKeyStore: jest.fn(),
      DisconnectReason: {
        loggedOut: 401,
        badSession: 500,
        connectionClosed: 408,
        connectionLost: 408,
        timedOut: 408
      }
    }));

    whatsapp = require('../utils/whatsapp');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ============================================
  // Formatage des numéros
  // ============================================
  describe('formatPhoneNumber', () => {
    test('devrait formater un numéro avec +', () => {
      expect(whatsapp.formatPhoneNumber('+221763162273')).toBe('+221763162273');
    });

    test('devrait formater un numéro avec 00221', () => {
      expect(whatsapp.formatPhoneNumber('00221763162273')).toBe('+221763162273');
    });

    test('devrait formater un numéro avec 221 sans +', () => {
      expect(whatsapp.formatPhoneNumber('221763162273')).toBe('+221763162273');
    });

    test('devrait ajouter +221 à un numéro local', () => {
      expect(whatsapp.formatPhoneNumber('771234567')).toBe('+221771234567');
    });

    test('devrait supprimer les espaces', () => {
      expect(whatsapp.formatPhoneNumber('+221 77 123 45 67')).toBe('+221771234567');
    });

    test('devrait supprimer les tirets', () => {
      expect(whatsapp.formatPhoneNumber('+221-77-123-45-67')).toBe('+221771234567');
    });

    test('devrait supprimer les parenthèses', () => {
      expect(whatsapp.formatPhoneNumber('+221 (77) 123 45 67')).toBe('+221771234567');
    });

    test('devrait retourner une chaîne vide pour un input vide', () => {
      expect(whatsapp.formatPhoneNumber('')).toBe('');
    });

    test('devrait retourner une chaîne vide pour null', () => {
      expect(whatsapp.formatPhoneNumber(null)).toBe('');
    });

    test('devrait retourner une chaîne vide pour undefined', () => {
      expect(whatsapp.formatPhoneNumber(undefined)).toBe('');
    });
  });

  // ============================================
  // Formatage Chat ID (JID)
  // ============================================
  describe('formatChatId', () => {
    test('devrait formater un numéro en JID WhatsApp', () => {
      expect(whatsapp.formatChatId('+221771234567')).toBe('221771234567@s.whatsapp.net');
    });

    test('devrait formater 00221 en JID', () => {
      expect(whatsapp.formatChatId('00221771234567')).toBe('221771234567@s.whatsapp.net');
    });

    test('devrait formater 221 en JID', () => {
      expect(whatsapp.formatChatId('221771234567')).toBe('221771234567@s.whatsapp.net');
    });

    test('devrait ajouter 221 à un numéro local', () => {
      expect(whatsapp.formatChatId('771234567')).toBe('221771234567@s.whatsapp.net');
    });

    test('devrait supprimer les espaces et formater', () => {
      expect(whatsapp.formatChatId('+221 77 123 45 67')).toBe('221771234567@s.whatsapp.net');
    });

    test('devrait retourner une chaîne vide pour un input vide', () => {
      expect(whatsapp.formatChatId('')).toBe('');
    });

    test('devrait retourner une chaîne vide pour null', () => {
      expect(whatsapp.formatChatId(null)).toBe('');
    });
  });

  // ============================================
  // Validation des numéros
  // ============================================
  describe('isValidPhoneNumber', () => {
    test('devrait valider un numéro senegalais standard', () => {
      expect(whatsapp.isValidPhoneNumber('+221771234567')).toBe(true);
    });

    test('devrait valider un numéro sans indicatif', () => {
      expect(whatsapp.isValidPhoneNumber('771234567')).toBe(true);
    });

    test('devrait valider un numéro avec 00221', () => {
      expect(whatsapp.isValidPhoneNumber('00221771234567')).toBe(true);
    });

    test('devrait rejeter un numéro trop court', () => {
      expect(whatsapp.isValidPhoneNumber('77123')).toBe(false);
    });

    test('devrait rejeter un numéro vide', () => {
      expect(whatsapp.isValidPhoneNumber('')).toBe(false);
    });

    test('devrait rejeter null', () => {
      expect(whatsapp.isValidPhoneNumber(null)).toBe(false);
    });

    test('devrait rejeter undefined', () => {
      expect(whatsapp.isValidPhoneNumber(undefined)).toBe(false);
    });

    test('devrait valider un numéro avec des lettres', () => {
      // Les numéros avec des lettres ne devraient pas être valides après formatage
      expect(whatsapp.isValidPhoneNumber('abc123')).toBe(false);
    });
  });

  // ============================================
  // Statut de connexion
  // ============================================
  describe('isConfigured / getConnectionStatus', () => {
    test('isConfigured devrait retourner false par défaut', () => {
      expect(whatsapp.isConfigured()).toBe(false);
    });

    test('getConnectionStatus devrait retourner le statut par défaut', () => {
      const status = whatsapp.getConnectionStatus();
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('configured');
      expect(status).toHaveProperty('hasQR');
      expect(status).toHaveProperty('info');
      expect(status.configured).toBe(false);
    });
  });

  // ============================================
  // QR Code
  // ============================================
  describe('getQRCode / getQR', () => {
    test('getQRCode devrait retourner null par défaut', () => {
      expect(whatsapp.getQRCode()).toBeNull();
    });

    test('getQR devrait indiquer que le QR n\'est pas disponible', async () => {
      const result = await whatsapp.getQR();
      expect(result.success).toBe(false);
      expect(result.connected).toBe(false);
    });
  });

  // ============================================
  // Test de connexion
  // ============================================
  describe('testConnection', () => {
    test('devrait indiquer non connecté par défaut', async () => {
      const result = await whatsapp.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('non connecté');
    });
  });

  // ============================================
  // Déconnexion
  // ============================================
  describe('disconnect', () => {
    test('devrait indiquer non connecté si pas de session', async () => {
      const result = await whatsapp.disconnect();
      expect(result.success).toBe(false);
    });
  });

  // ============================================
  // Envoi de messages texte
  // ============================================
  describe('sendTextMessage', () => {
    test('devrait lancer une erreur si non connecté', async () => {
      await expect(
        whatsapp.sendTextMessage('+221771234567', 'Bonjour')
      ).rejects.toThrow('WhatsApp non connecté');
    });
  });

  // ============================================
  // Envoi de documents
  // ============================================
  describe('sendDocument', () => {
    test('devrait lancer une erreur si non connecté', async () => {
      await expect(
        whatsapp.sendDocument('+221771234567', '/path/to/file.pdf', 'doc.pdf', 'Caption')
      ).rejects.toThrow('WhatsApp non connecté');
    });
  });

  // ============================================
  // Envoi de médias
  // ============================================
  describe('sendMediaMessage', () => {
    test('devrait lancer une erreur si non connecté', async () => {
      await expect(
        whatsapp.sendMediaMessage('+221771234567', 'image', '/path/to/image.jpg', 'Photo')
      ).rejects.toThrow('WhatsApp non connecté');
    });
  });

  // ============================================
  // Template messages
  // ============================================
  describe('sendTemplateMessage', () => {
    test('devrait lancer une erreur si non connecté', async () => {
      await expect(
        whatsapp.sendTemplateMessage('+221771234567', 'test_template', 'fr', [])
      ).rejects.toThrow('WhatsApp non connecté');
    });
  });

  // ============================================
  // Reconnexion
  // ============================================
  describe('reconnect', () => {
    test('devrait retourner un succès avec statut', async () => {
      const result = await whatsapp.reconnect();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('status');
    });
  });
});

// ============================================
// Tests des Routes WhatsApp (API)
// ============================================
describe('🌐 Tests Routes WhatsApp (API)', () => {
  let app;
  let request;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock des modules
    jest.mock('@whiskeysockets/baileys', () => ({
      default: jest.fn(() => ({
        ev: { on: jest.fn(), emit: jest.fn() },
        user: { id: '221771234567:12@s.whatsapp.net', name: 'Test' },
        sendMessage: jest.fn().mockResolvedValue({
          key: { id: 'msg-123', remoteJid: '221771234567@s.whatsapp.net', fromMe: true },
          messageTimestamp: Date.now()
        }),
        end: jest.fn()
      })),
      useMultiFileAuthState: jest.fn(() => Promise.resolve({
        state: { creds: {}, keys: { get: jest.fn(), set: jest.fn() } },
        saveCreds: jest.fn()
      })),
      fetchLatestBaileysVersion: jest.fn(() => Promise.resolve({ version: [2, 2323, 6] })),
      makeCacheableSignalKeyStore: jest.fn(),
      DisconnectReason: { loggedOut: 401 }
    }));

    jest.mock('pino', () => jest.fn(() => ({ level: jest.fn() })));
    jest.mock('qrcode', () => ({
      toDataURL: jest.fn(() => Promise.resolve('data:image/png;base64,mockQR'))
    }));

    jest.mock('nodemailer', () => ({
      createTransport: jest.fn(() => ({
        sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' })
      }))
    }));

    jest.mock('../middleware/auth', () => ({
      requireAuth: (req, res, next) => {
        // Simuler un utilisateur authentifié
        req.user = { id: 1, username: 'admin', role: 'admin' };
        next();
      }
    }));

    // Créer une app Express de test
    const express = require('express');
    app = express();
    app.use(express.json());
    app.use('/api/whatsapp', require('../routes/whatsapp'));
    request = require('supertest');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/whatsapp/status', () => {
    test('devrait retourner le statut WhatsApp', async () => {
      const res = await request(app).get('/api/whatsapp/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('provider');
      expect(res.body.data).toHaveProperty('configured');
      expect(res.body.data).toHaveProperty('status');
    });
  });

  describe('GET /api/whatsapp/test', () => {
    test('devrait retourner le résultat du test de connexion', async () => {
      const res = await request(app).get('/api/whatsapp/test');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success');
    });
  });

  describe('GET /api/whatsapp/qr', () => {
    test('devrait retourner les informations QR', async () => {
      const res = await request(app).get('/api/whatsapp/qr');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('connected');
    });
  });

  describe('POST /api/whatsapp/send', () => {
    test('devrait retourner 400 si phone manquant', async () => {
      const res = await request(app)
        .post('/api/whatsapp/send')
        .send({ message: 'Bonjour' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toContain('requis');
    });

    test('devrait retourner 400 si message manquant', async () => {
      const res = await request(app)
        .post('/api/whatsapp/send')
        .send({ phone: '+221771234567' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
    });

    test('devrait retourner 400 si numéro invalide', async () => {
      const res = await request(app)
        .post('/api/whatsapp/send')
        .send({ phone: 'invalid', message: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invalide');
    });

    test('devrait envoyer un message avec succès (simulation)', async () => {
      const res = await request(app)
        .post('/api/whatsapp/send')
        .send({ phone: '+221771234567', message: 'Bonjour MediDoc' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('phone');
      expect(res.body.data).toHaveProperty('sent_at');
      expect(res.body.data).toHaveProperty('provider');
    });
  });

  describe('POST /api/whatsapp/send-document', () => {
    test('devrait retourner 400 si phone manquant', async () => {
      const res = await request(app)
        .post('/api/whatsapp/send-document')
        .send({ documentUrl: 'https://example.com/doc.pdf' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
    });

    test('devrait retourner 400 si documentUrl manquant', async () => {
      const res = await request(app)
        .post('/api/whatsapp/send-document')
        .send({ phone: '+221771234567' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
    });

    test('devrait retourner 400 si numéro invalide', async () => {
      const res = await request(app)
        .post('/api/whatsapp/send-document')
        .send({ phone: '123', documentUrl: 'https://example.com/doc.pdf' });
      expect(res.status).toBe(400);
    });

    test('devrait envoyer un document avec succès (simulation)', async () => {
      const res = await request(app)
        .post('/api/whatsapp/send-document')
        .send({
          phone: '+221771234567',
          documentUrl: 'https://example.com/resultats.pdf',
          filename: 'resultats.pdf',
          caption: 'Vos résultats médicaux'
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('document_url');
      expect(res.body.data).toHaveProperty('filename');
    });
  });

  describe('POST /api/whatsapp/disconnect', () => {
    test('devrait tenter la déconnexion', async () => {
      const res = await request(app).post('/api/whatsapp/disconnect');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('POST /api/whatsapp/reconnect', () => {
    test('devrait tenter la reconnexion', async () => {
      const res = await request(app).post('/api/whatsapp/reconnect');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('status');
    });
  });
});