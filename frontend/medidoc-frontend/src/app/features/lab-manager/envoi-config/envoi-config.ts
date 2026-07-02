import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin-service';

@Component({
  selector: 'app-envoi-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './envoi-config.html',
  styleUrl: './envoi-config.css',
})
export class EnvoiConfig implements OnInit {
  private adminService = inject(AdminService);

  chargement = true;
  enregistrement = false;
  messageSucces = '';

  smtpHost = '';
  smtpPort = 587;
  smtpUser = '';
  smtpPass = '';
  smtpFromName = '';
  smsWhatsappSender = '';

  // Champs SMTP techniques masqués tant que ce n'est pas un autre fournisseur que Gmail.
  avanceOuvert = false;

  testEnCours = false;
  testMessage = '';
  testErreur = '';

  ngOnInit(): void {
    this.adminService.getSendConfig().subscribe({
      next: (res) => {
        const d = res.data;
        if (d) {
          this.smtpHost = d.smtp_host || '';
          this.smtpPort = d.smtp_port || 587;
          this.smtpUser = d.smtp_user || '';
          this.smtpPass = d.smtp_pass || ''; // masqué (••••••••) si déjà défini côté serveur
          this.smtpFromName = d.smtp_from_name || '';
          this.smsWhatsappSender = d.sms_whatsapp_sender || '';
          this.avanceOuvert = !!(d.smtp_host && d.smtp_host !== 'smtp.gmail.com');
        }
        this.chargement = false;
      },
      error: () => { this.chargement = false; }
    });
  }

  testerConnexion() {
    this.testEnCours = true;
    this.testMessage = '';
    this.testErreur = '';
    this.adminService.testSendConfig({
      smtp_host: this.smtpHost || 'smtp.gmail.com',
      smtp_port: this.smtpPort || 587,
      smtp_user: this.smtpUser,
      smtp_pass: this.smtpPass
    }).subscribe({
      next: (res) => { this.testEnCours = false; this.testMessage = res.message || 'Connexion réussie'; },
      error: (err) => { this.testEnCours = false; this.testErreur = err.error?.error || 'Échec du test de connexion'; }
    });
  }

  enregistrer() {
    this.enregistrement = true;
    this.messageSucces = '';
    this.testMessage = '';
    this.testErreur = '';

    this.adminService.updateSendConfig({
      // Gmail par défaut tant que le responsable de labo n'a pas ouvert les options avancées.
      smtp_host: this.smtpHost || 'smtp.gmail.com',
      smtp_port: this.smtpPort || 587,
      smtp_user: this.smtpUser,
      smtp_pass: this.smtpPass,
      smtp_from_name: this.smtpFromName,
      sms_whatsapp_sender: this.smsWhatsappSender
    }).subscribe({
      next: () => { this.enregistrement = false; this.messageSucces = "Configuration d'envoi enregistrée"; },
      error: (err) => { this.enregistrement = false; alert(err.error?.error || "Erreur lors de l'enregistrement"); }
    });
  }
}
