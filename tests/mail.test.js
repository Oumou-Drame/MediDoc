/**
 * Tests pour les fonctionnalités Email (Mail)
 * 
 * Tests couverts:
 * - Envoi d'email simple
 * - Envoi d'email avec pièce jointe
 * - Gestion des erreurs SMTP
 * - Validation des paramètres
 * - Email avec contenu HTML
 */

const nodemailer = require('nodemailer');

// Mock de nodemailer avant d'importer le module
jest.mock('nodemailer');
jest.mock('../utils/whatsapp', () => ({
  isConfigured: jest.fn(() => false),
  sendTextMessage: jest.fn()
}));

describe('📧 Tests Email (Mail)', () => {
  let sendEmail;
  let mockTransporter;

  beforeEach(() => {
    // Réinitialiser les mocks
    jest.clearAllMocks();

    // Créer un mock transporter
    mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn()
    };

    nodemailer.createTransport.mockReturnValue(mockTransporter);

    // Recharger le module pour capturer le nouveau transporter
    delete require.cache[require.resolve('../utils/sms')];
    const sms = require('../utils/sms');
    sendEmail = sms.sendEmail;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendEmail - Envoi simple', () => {
    test('devrait envoyer un email avec succès', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id-123'
      });

      const result = await sendEmail(
        'destinataire@test.com',
        'Test Subject',
        'Contenu du message'
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'destinataire@test.com',
          subject: 'Test Subject',
          text: 'Contenu du message'
        })
      );
    });

    test('devrait envoyer un email avec contenu HTML', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-html-id-456'
      });

      const htmlContent = '<h1>Titre</h1><p>Contenu HTML</p>';
      
      const result = await sendEmail(
        'destinataire@test.com',
        'Email HTML',
        'Version texte',
        null,
        htmlContent
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'destinataire@test.com',
          subject: 'Email HTML',
          text: 'Version texte',
          html: htmlContent
        })
      );
    });

    test('devrait inclure l\'expéditeur configuré', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-from-id'
      });

      await sendEmail('test@test.com', 'Subject', 'Body');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.any(String)
        })
      );
    });

    test('devrait retourner false en cas d\'erreur SMTP', async () => {
      mockTransporter.sendMail.mockRejectedValue(
        new Error('SMTP connection refused')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await sendEmail(
        'destinataire@test.com',
        'Test',
        'Message'
      );

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Erreur Email:',
        'SMTP connection refused'
      );
      consoleSpy.mockRestore();
    });

    test('devrait gérer les erreurs d\'authentification SMTP', async () => {
      mockTransporter.sendMail.mockRejectedValue(
        new Error('Invalid login: 535 Authentication failed')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await sendEmail(
        'destinataire@test.com',
        'Test',
        'Message'
      );

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('sendEmail - Pièces jointes', () => {
    const fs = require('fs');

    beforeEach(() => {
      jest.spyOn(fs, 'existsSync');
    });

    test('devrait joindre un fichier PDF si le chemin existe', async () => {
      fs.existsSync.mockReturnValue(true);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-attachment-id'
      });

      const result = await sendEmail(
        'destinataire@test.com',
        'Résultats médicaux',
        'Vos résultats en pièce jointe',
        '/path/to/results.pdf'
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [{
            filename: 'resultats_medicaux.pdf',
            path: '/path/to/results.pdf'
          }]
        })
      );
    });

    test('ne devrait pas joindre de fichier si le chemin n\'existe pas', async () => {
      fs.existsSync.mockReturnValue(false);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-no-attachment-id'
      });

      const result = await sendEmail(
        'destinataire@test.com',
        'Résultats',
        'Message',
        '/path/to/nonexistent.pdf'
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.not.objectContaining({
          attachments: expect.any(Array)
        })
      );
    });

    test('devrait fonctionner sans pièce jointe', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-no-attach-id'
      });

      const result = await sendEmail(
        'destinataire@test.com',
        'Subject',
        'Body'
      );

      expect(result).toBe(true);
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.attachments).toBeUndefined();
    });
  });

  describe('sendEmail - Cas limites', () => {
    test('devrait gérer un email à plusieurs destinataires', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-multi-id'
      });

      const result = await sendEmail(
        'a@test.com,b@test.com',
        'Multi',
        'Message groupé'
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@test.com,b@test.com'
        })
      );
    });

    test('devrait gérer un sujet vide', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-empty-subject'
      });

      const result = await sendEmail('test@test.com', '', 'Body');

      expect(result).toBe(true);
    });

    test('devrait gérer un corps de message vide', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-empty-body'
      });

      const result = await sendEmail('test@test.com', 'Subject', '');

      expect(result).toBe(true);
    });

    test('devrait loguer l\'adresse email en cas de succès', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-success-log'
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await sendEmail('user@example.com', 'Test', 'Body');

      expect(consoleSpy).toHaveBeenCalledWith('✅ Email envoyé à user@example.com');
      consoleSpy.mockRestore();
    });
  });
});