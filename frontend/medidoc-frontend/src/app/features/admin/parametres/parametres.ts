import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin-service';
import { PlatformService } from '../../../core/services/platform-service';

interface Hospital {
  id: number;
  name: string;
}

@Component({
  selector: 'app-parametres',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parametres.html',
  styleUrl: './parametres.css',
})
export class Parametres implements OnInit {
  private adminService = inject(AdminService);
  private platformService = inject(PlatformService);

  whatsappActif = true;
  smsActif = true;
  emailActif = true;
  dureeExpiration = 48;
  tailleMaxFichier = 50;

  chargement = true;
  enregistrement = false;
  messageSucces = '';

  // Configuration d'envoi par hôpital
  hopitaux: Hospital[] = [];
  hospitalIdSelectionne: number | null = null;

  smtpHost = '';
  smtpPort = 587;
  smtpUser = '';
  smtpPass = '';
  smtpFromName = '';
  smsWhatsappSender = '';

  avanceOuvert = false;

  chargementEnvoi = false;
  enregistrementEnvoi = false;
  messageSuccesEnvoi = '';

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

    this.platformService.getHospitals().subscribe({
      next: (res) => {
        this.hopitaux = res.data || [];
        if (this.hopitaux.length > 0) {
          this.hospitalIdSelectionne = this.hopitaux[0].id;
          this.chargerConfigEnvoi();
        }
      },
      error: () => {}
    });
  }

  chargerConfigEnvoi() {
    if (!this.hospitalIdSelectionne) return;
    this.chargementEnvoi = true;
    this.testMessage = '';
    this.testErreur = '';
    this.messageSuccesEnvoi = '';
    this.adminService.getSendConfig(this.hospitalIdSelectionne).subscribe({
      next: (res) => {
        const d = res.data;
        if (d) {
          this.smtpHost = d.smtp_host || '';
          this.smtpPort = d.smtp_port || 587;
          this.smtpUser = d.smtp_user || '';
          this.smtpPass = d.smtp_pass || '';
          this.smtpFromName = d.smtp_from_name || '';
          this.smsWhatsappSender = d.sms_whatsapp_sender || '';
          this.avanceOuvert = !!(d.smtp_host && d.smtp_host !== 'smtp.gmail.com');
        } else {
          this.smtpHost = '';
          this.smtpPort = 587;
          this.smtpUser = '';
          this.smtpPass = '';
          this.smtpFromName = '';
          this.smsWhatsappSender = '';
          this.avanceOuvert = false;
        }
        this.chargementEnvoi = false;
      },
      error: () => { this.chargementEnvoi = false; }
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
      error: (err) => { this.enregistrementEnvoi = false; alert(err.error?.error || "Erreur lors de l'enregistrement"); }
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
      error: (err) => { this.enregistrementEnvoi = false; alert(err.error?.error || "Erreur lors de l'effacement"); }
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
      next: (res) => { this.testEnCours = false; this.testMessage = res.message || 'Connexion réussie'; },
      error: (err) => { this.testEnCours = false; this.testErreur = err.error?.error || 'Échec du test de connexion'; }
    });
  }
}