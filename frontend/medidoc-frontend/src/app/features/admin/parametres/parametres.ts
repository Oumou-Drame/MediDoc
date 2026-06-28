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
}