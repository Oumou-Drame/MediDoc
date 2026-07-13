import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin-service';

@Component({
  selector: 'app-parametres',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parametres.html',
  styleUrl: './parametres.css',
})
export class Parametres implements OnInit {
  private adminService = inject(AdminService);

  whatsappActif = true;
  smsActif = true;
  emailActif = true;
  dureeExpiration = 48;
  tailleMaxFichier = 50;

  chargement = true;
  enregistrement = false;
  messageSucces = '';

  // Configuration SMTP plateforme (emails système : demande approuvée/refusée, mot de passe oublié,
  // et par défaut aussi les envois de résultats aux patients — plus de config par hôpital séparée).
  chargementSmtpPlateforme = true;
  smtpPlateformeHost = '';
  smtpPlateformePort = 587;
  smtpPlateformeUser = '';
  smtpPlateformePass = '';
  smtpPlateformeFromName = '';
  avanceSmtpPlateformeOuvert = false;

  enregistrementSmtpPlateforme = false;
  messageSuccesSmtpPlateforme = '';

  testSmtpPlateformeEnCours = false;
  testSmtpPlateformeMessage = '';
  testSmtpPlateformeErreur = '';

  // Configuration d'envoi par hôpital
  hopitaux: any[] = [];
  hospitalIdSelectionne: number | null = null;
  chargementEnvoi = false;
  enregistrementEnvoi = false;
  messageSuccesEnvoi = '';

  smsWhatsappSender = '';
  smtpHost = '';
  smtpPort = 587;
  smtpUser = '';
  smtpPass = '';
  smtpFromName = '';
  avanceOuvert = false;

  testEnCours = false;
  testMessage = '';
  testErreur = '';

  ngOnInit(): void {
    this.adminService.getSettings().subscribe({
      next: (res) => {
        const d = res.data;
        this.whatsappActif = d.whatsapp_enabled === 'true';
        this.smsActif = d.sms_enabled === 'true';
        this.emailActif = d.email_enabled === 'true';
        this.dureeExpiration = parseInt(d.code_expiration_hours) || 48;
        this.tailleMaxFichier = parseInt(d.max_file_size_mb) || 50;
        this.chargement = false;
      },
      error: () => { this.chargement = false; }
    });

    this.chargerSmtpPlateforme();
  }

  chargerConfigEnvoi() {
    if (!this.hospitalIdSelectionne) return;
    this.chargementEnvoi = true;
    this.adminService.getSendConfig(this.hospitalIdSelectionne).subscribe({
      next: (res) => {
        const d = res.data;
        this.smsWhatsappSender = d.sms_whatsapp_sender || '';
        this.smtpHost = d.smtp_host || '';
        this.smtpPort = d.smtp_port || 587;
        this.smtpUser = d.smtp_user || '';
        this.smtpPass = d.smtp_pass || '';
        this.smtpFromName = d.smtp_from_name || '';
        this.avanceOuvert = !!(d.smtp_host && d.smtp_host !== 'smtp.gmail.com');
        this.chargementEnvoi = false;
      },
      error: () => { this.chargementEnvoi = false; }
    });
  }

  chargerSmtpPlateforme() {
    this.chargementSmtpPlateforme = true;
    this.adminService.getPlatformSmtpConfig().subscribe({
      next: (res) => {
        const d = res.data;
        this.smtpPlateformeHost = d.smtp_host || '';
        this.smtpPlateformePort = d.smtp_port || 587;
        this.smtpPlateformeUser = d.smtp_user || '';
        this.smtpPlateformePass = d.smtp_pass || '';
        this.smtpPlateformeFromName = d.smtp_from_name || 'MediDoc';
        this.avanceSmtpPlateformeOuvert = !!(d.smtp_host && d.smtp_host !== 'smtp.gmail.com');
        this.chargementSmtpPlateforme = false;
      },
      error: () => { this.chargementSmtpPlateforme = false; }
    });
  }

  enregistrerSmtpPlateforme() {
    this.enregistrementSmtpPlateforme = true;
    this.messageSuccesSmtpPlateforme = '';
    this.testSmtpPlateformeMessage = '';
    this.testSmtpPlateformeErreur = '';
    this.adminService.updatePlatformSmtpConfig({
      smtp_host: this.smtpPlateformeHost || 'smtp.gmail.com',
      smtp_port: this.smtpPlateformePort || 587,
      smtp_user: this.smtpPlateformeUser,
      smtp_pass: this.smtpPlateformePass,
      smtp_from_name: this.smtpPlateformeFromName
    }).subscribe({
      next: () => { this.enregistrementSmtpPlateforme = false; this.messageSuccesSmtpPlateforme = 'Configuration SMTP plateforme enregistrée'; },
      error: (err) => { this.enregistrementSmtpPlateforme = false; alert(err.error?.error || "Erreur lors de l'enregistrement"); }
    });
  }

  testerConnexionSmtpPlateforme() {
    this.testSmtpPlateformeEnCours = true;
    this.testSmtpPlateformeMessage = '';
    this.testSmtpPlateformeErreur = '';
    this.adminService.testPlatformSmtpConfig({
      smtp_host: this.smtpPlateformeHost || 'smtp.gmail.com',
      smtp_port: this.smtpPlateformePort || 587,
      smtp_user: this.smtpPlateformeUser,
      smtp_pass: this.smtpPlateformePass
    }).subscribe({
      next: (res) => { this.testSmtpPlateformeEnCours = false; this.testSmtpPlateformeMessage = res.message || 'Connexion réussie'; },
      error: (err) => { this.testSmtpPlateformeEnCours = false; this.testSmtpPlateformeErreur = err.error?.error || 'Échec du test de connexion'; }
    });
  }

  enregistrer() {
    this.enregistrement = true;
    this.messageSucces = '';
    this.adminService.updateSettings({
      whatsapp_enabled: String(this.whatsappActif),
      sms_enabled: String(this.smsActif),
      email_enabled: String(this.emailActif),
      code_expiration_hours: String(this.dureeExpiration),
      max_file_size_mb: String(this.tailleMaxFichier)
    }).subscribe({
      next: () => { this.enregistrement = false; this.messageSucces = 'Paramètres enregistrés avec succès'; },
      error: (err) => { this.enregistrement = false; alert(err.error?.error || "Erreur lors de l'enregistrement"); }
    });
  }

  enregistrerEnvoi() {
    if (!this.hospitalIdSelectionne) return;
    this.enregistrementEnvoi = true;
    this.messageSuccesEnvoi = '';
    this.testMessage = '';
    this.testErreur = '';
    this.adminService.updateSendConfig(this.hospitalIdSelectionne, {
      smtp_host: this.smtpHost || 'smtp.gmail.com',
      smtp_port: this.smtpPort || 587,
      smtp_user: this.smtpUser,
      smtp_pass: this.smtpPass,
      smtp_from_name: this.smtpFromName,
      sms_whatsapp_sender: this.smsWhatsappSender
    }).subscribe({
      next: () => { this.enregistrementEnvoi = false; this.messageSuccesEnvoi = "Configuration d'envoi enregistrée"; },
      error: (err: any) => { this.enregistrementEnvoi = false; alert(err.error?.error || "Erreur lors de l'enregistrement"); }
    });
  }

  effacerConfig() {
    if (!this.hospitalIdSelectionne) return;
    if (!confirm('Voulez-vous vraiment effacer la configuration d\'envoi pour cet hôpital ?')) {
      return;
    }
    this.enregistrementEnvoi = true;
    this.messageSuccesEnvoi = '';
    this.testMessage = '';
    this.testErreur = '';
    this.adminService.updateSendConfig(this.hospitalIdSelectionne, {
      smtp_host: null,
      smtp_port: null,
      smtp_user: null,
      smtp_pass: null,
      smtp_from_name: null,
      sms_whatsapp_sender: null,
      clear_email: true
    }).subscribe({
      next: () => {
        this.enregistrementEnvoi = false;
        this.messageSuccesEnvoi = "Configuration effacée";
        this.smtpHost = '';
        this.smtpPort = 587;
        this.smtpUser = '';
        this.smtpPass = '';
        this.smtpFromName = '';
        this.smsWhatsappSender = '';
        this.avanceOuvert = false;
      },
      error: (err: any) => { this.enregistrementEnvoi = false; alert(err.error?.error || "Erreur lors de l'effacement"); }
    });
  }

  testerConnexion() {
    if (!this.hospitalIdSelectionne) return;
    this.testEnCours = true;
    this.testMessage = '';
    this.testErreur = '';
    this.adminService.testSendConfig(this.hospitalIdSelectionne, {
      smtp_host: this.smtpHost || 'smtp.gmail.com',
      smtp_port: this.smtpPort || 587,
      smtp_user: this.smtpUser,
      smtp_pass: this.smtpPass
    }).subscribe({
      next: (res: any) => { this.testEnCours = false; this.testMessage = res.message || 'Connexion réussie'; },
      error: (err: any) => { this.testEnCours = false; this.testErreur = err.error?.error || 'Échec du test de connexion'; }
    });
  }
}