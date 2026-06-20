/**
 * Tests pour les fonctionnalités SMS
 *
 * Tests couverts:
 * - SMS via Termii
 * - SMS en mode simulation
 * - Formatage des numéros de téléphone
 * - Gestion des erreurs
 */

jest.mock('../utils/whatsapp', () => ({
  isConfigured: jest.fn(() => false),
  sendTextMessage: jest.fn(),
  sendDocument: jest.fn()
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' })
  }))
}));

describe('📱 Tests SMS', () => {
  let sendSMS;
  let sendSMSViaTermii;
  let formatPhoneForTermii;
  let mockFetch;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    delete process.env.TERMII_API_KEY;
    delete process.env.TERMII_SENDER_ID;
    delete process.env.TERMII_CHANNEL;

    mockFetch = jest.fn();
    global.fetch = mockFetch;

    const sms = require('../utils/sms');
    sendSMS = sms.sendSMS;
    sendSMSViaTermii = sms.sendSMSViaTermii;
    formatPhoneForTermii = sms.formatPhoneForTermii;
  });

  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
    delete process.env.TERMII_API_KEY;
    delete process.env.TERMII_SENDER_ID;
    delete process.env.TERMII_CHANNEL;
  });

  // ============================================
  // Formatage des numéros
  // ============================================
  describe('formatPhoneForTermii', () => {
    test('devrait formater un numéro avec +221', () => {
      expect(formatPhoneForTermii('+221771234567')).toBe('221771234567');
    });

    test('devrait formater un numéro avec 00221', () => {
      expect(formatPhoneForTermii('00221771234567')).toBe('221771234567');
    });

    test('devrait formater un numéro avec 221 (sans +)', () => {
      expect(formatPhoneForTermii('221771234567')).toBe('221771234567');
    });

    test('devrait ajouter l\'indicatif 221 si absent', () => {
      expect(formatPhoneForTermii('771234567')).toBe('221771234567');
    });

    test('devrait supprimer les espaces du numéro', () => {
      expect(formatPhoneForTermii('+221 77 123 45 67')).toBe('221771234567');
    });
  });

  // ============================================
  // SMS via Termii
  // ============================================
  describe('sendSMSViaTermii', () => {
    beforeEach(() => {
      process.env.TERMII_API_KEY = 'test_termii_key';
      process.env.TERMII_SENDER_ID = 'MediDoc';
      process.env.TERMII_CHANNEL = 'dnd';
    });

    test('devrait envoyer un SMS avec succès', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ message: 'Successfully Sent', code: 'ok' })
      });

      const result = await sendSMSViaTermii('+221771234567', 'Votre résultat est prêt');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://v3.api.termii.com/api/sms/send',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.to).toBe('221771234567');
      expect(body.sms).toBe('Votre résultat est prêt');
      expect(body.from).toBe('MediDoc');
      expect(body.channel).toBe('dnd');
      expect(body.type).toBe('plain');
      expect(body.api_key).toBe('test_termii_key');
    });

    test('devrait formater un numéro avec 00221', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ message: 'Successfully Sent', code: 'ok' })
      });

      await sendSMSViaTermii('00221771234567', 'Test');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.to).toBe('221771234567');
    });

    test('devrait retourner false si l\'API key n\'est pas configurée', async () => {
      delete process.env.TERMII_API_KEY;

      const result = await sendSMSViaTermii('+221771234567', 'Test');

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('devrait retourner false si l\'API key est la valeur par défaut', async () => {
      process.env.TERMII_API_KEY = 'your_termii_api_key';

      const result = await sendSMSViaTermii('+221771234567', 'Test');

      expect(result).toBe(false);
    });

    test('devrait retourner false en cas d\'erreur Termii', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ message: 'Invalid sender ID' })
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await sendSMSViaTermii('+221771234567', 'Test');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('devrait retourner false en cas d\'erreur réseau', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await sendSMSViaTermii('+221771234567', 'Test');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('devrait utiliser le channel par défaut dnd', async () => {
      delete process.env.TERMII_CHANNEL;

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ message: 'Successfully Sent', code: 'ok' })
      });

      await sendSMSViaTermii('+221771234567', 'Test');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.channel).toBe('dnd');
    });
  });

  // ============================================
  // SMS - Termii et Simulation
  // ============================================
  describe('sendSMS - Termii et Simulation', () => {
    test('devrait utiliser Termii si configuré', async () => {
      process.env.TERMII_API_KEY = 'test_termii_key';

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ message: 'Successfully Sent', code: 'ok' })
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await sendSMS('+221771234567', 'Test priorité');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('devrait utiliser la simulation si Termii n\'est pas configuré', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await sendSMS('+221771234567', 'Message simulation');

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SIMULATION SMS]')
      );
      consoleSpy.mockRestore();
    });

    test('devrait toujours retourner true en mode simulation', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await sendSMS('+221771234567', 'Test');

      expect(result).toBe(true);
      consoleSpy.mockRestore();
    });

    test('devrait passer en simulation si Termii échoue', async () => {
      process.env.TERMII_API_KEY = 'test_termii_key';

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ message: 'Insufficient balance' })
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await sendSMS('+221771234567', 'Test fallback');

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SIMULATION SMS]')
      );
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  // ============================================
  // WhatsApp via sms.js wrapper
  // ============================================
  describe('sendWhatsApp - Wrapper dans sms.js', () => {
    let sendWhatsApp;

    beforeEach(() => {
      delete require.cache[require.resolve('../utils/sms')];
      const sms = require('../utils/sms');
      sendWhatsApp = sms.sendWhatsApp;
    });

    test('devrait utiliser la simulation si WhatsApp n\'est pas configuré', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await sendWhatsApp('+221771234567', 'Test WhatsApp');

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SIMULATION]')
      );
      consoleSpy.mockRestore();
    });

    test('devrait retourner false en cas d\'erreur WhatsApp', async () => {
      const whatsapp = require('../utils/whatsapp');
      whatsapp.isConfigured.mockReturnValue(true);
      whatsapp.sendTextMessage.mockRejectedValue(new Error('Connection lost'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await sendWhatsApp('+221771234567', 'Test');

      expect(result).toBe(false);
      consoleSpy.mockRestore();

      whatsapp.isConfigured.mockReturnValue(false);
    });
  });

  // ============================================
  // WhatsApp Document via sms.js wrapper
  // ============================================
  describe('sendWhatsAppDocument - Wrapper dans sms.js', () => {
    let sendWhatsAppDocument;

    beforeEach(() => {
      delete require.cache[require.resolve('../utils/sms')];
      const sms = require('../utils/sms');
      sendWhatsAppDocument = sms.sendWhatsAppDocument;
    });

    test('devrait utiliser la simulation si WhatsApp n\'est pas configuré', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await sendWhatsAppDocument(
        '+221771234567',
        'https://example.com/doc.pdf',
        'resultats.pdf',
        'Vos résultats'
      );

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SIMULATION]')
      );
      consoleSpy.mockRestore();
    });

    test('devrait retourner false en cas d\'erreur document', async () => {
      const whatsapp = require('../utils/whatsapp');
      whatsapp.isConfigured.mockReturnValue(true);
      whatsapp.sendDocument.mockRejectedValue(new Error('File not found'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await sendWhatsAppDocument(
        '+221771234567',
        '/path/to/file.pdf',
        'file.pdf'
      );

      expect(result).toBe(false);
      consoleSpy.mockRestore();

      whatsapp.isConfigured.mockReturnValue(false);
    });
  });
});
